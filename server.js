// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
var PORT = Number(process.env.PORT) || 3e3;
var DATA_DIR = path.resolve(process.cwd(), "data");
var UPLOADS_DIR = path.join(DATA_DIR, "uploads");
var DB_FILE = path.join(DATA_DIR, "portal_db.json");
function renderServerEmailTemplate(template, vars) {
  let out = template || "";
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, "gi"), v ?? "");
  });
  return out;
}
function buildSupervisorPortalLink(baseUrl, semanaNumero, supervisorName) {
  const fallbackOrigin = process.env.APP_URL || `http://localhost:${PORT}`;
  const rawBase = String(baseUrl || fallbackOrigin).trim().replace(/\/+$/, "");
  const cleanBase = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
  return `${cleanBase}/?action=liberar_nomina&semana=${encodeURIComponent(
    String(semanaNumero || "")
  )}&supervisor=${encodeURIComponent(String(supervisorName || ""))}`;
}
var uploadMemoryCache = /* @__PURE__ */ new Map();
var BASE64_FIELDS = /* @__PURE__ */ new Set([
  "formatoSubidoBase64",
  "archivoFormatoBase64",
  "excelTrabajadoBase64"
]);
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
function offloadBase64String(raw, fieldName) {
  if (!raw || typeof raw !== "string" || raw.length < 256 || raw.startsWith("@upload:")) {
    return raw;
  }
  try {
    ensureDataDir();
    const hash = crypto.createHash("sha1").update(raw).digest("hex");
    const fileName = `${fieldName}_${hash}.b64`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      const tmpUpload = `${filePath}.tmp.${process.pid}`;
      fs.writeFileSync(tmpUpload, raw, "utf-8");
      fs.renameSync(tmpUpload, filePath);
    }
    uploadMemoryCache.set(fileName, raw);
    return `@upload:${fileName}`;
  } catch (err) {
    console.warn("No se pudo externalizar adjunto base64 a disco:", err);
    return raw;
  }
}
function hydrateBase64String(ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("@upload:")) {
    return ref;
  }
  const fileName = path.basename(ref.slice("@upload:".length));
  if (!fileName) return "";
  const cached = uploadMemoryCache.get(fileName);
  if (cached !== void 0) return cached;
  try {
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      uploadMemoryCache.set(fileName, content);
      return content;
    }
  } catch (err) {
    console.warn("Error leyendo adjunto desde data/uploads:", err);
  }
  return "";
}
function transformBase64FieldsDeep(node, mode) {
  if (node === null || node === void 0 || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => transformBase64FieldsDeep(item, mode));
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (BASE64_FIELDS.has(k) && typeof v === "string" && v.length > 0) {
      out[k] = mode === "offload" ? offloadBase64String(v, k) : hydrateBase64String(v);
    } else if (v !== null && typeof v === "object") {
      out[k] = transformBase64FieldsDeep(v, mode);
    } else {
      out[k] = v;
    }
  }
  return out;
}
function readDatabase() {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return transformBase64FieldsDeep(parsed, "hydrate");
  } catch (err) {
    console.warn("Error leyendo base de datos local:", err);
    return {};
  }
}
function normalizeEmpIdServer(id) {
  if (id === null || id === void 0) return "";
  const str = String(id).trim();
  if (!str) return "";
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? str : parsed.toString().padStart(5, "0");
}
function mergeReportListsPreservingSupervisorEdits(currentList, incomingList, sameWeek) {
  if (!Array.isArray(incomingList)) return currentList;
  if (!sameWeek || !Array.isArray(currentList) || currentList.length === 0) return incomingList;
  const currentByEmp = /* @__PURE__ */ new Map();
  for (const rep of currentList) {
    const id = normalizeEmpIdServer(rep?.empleado?.id);
    if (id) currentByEmp.set(id, rep);
  }
  return incomingList.map((incRep) => {
    const id = normalizeEmpIdServer(incRep?.empleado?.id);
    const curRep = id ? currentByEmp.get(id) : void 0;
    if (!curRep || !Array.isArray(curRep.dias) || !Array.isArray(incRep?.dias)) {
      return incRep;
    }
    let anyPreserved = false;
    const mergedDias = incRep.dias.map((incDay) => {
      const curDay = curRep.dias.find((d) => d?.isoDate === incDay?.isoDate);
      if (!curDay) return incDay;
      const curEdited = Boolean(curDay.modificadoPorSupervisor) || curDay.horasExtrasAutorizadas !== void 0 || Boolean(curDay.notaSupervisorDia) || Boolean(curDay.formatoSubidoNombre);
      const incEdited = Boolean(incDay?.modificadoPorSupervisor) || incDay?.horasExtrasAutorizadas !== void 0 || Boolean(incDay?.notaSupervisorDia) || Boolean(incDay?.formatoSubidoNombre);
      if (curEdited && !incEdited) {
        anyPreserved = true;
        return {
          ...curDay,
          horarioProgramado: incDay.horarioProgramado ?? curDay.horarioProgramado
        };
      }
      return incDay;
    });
    if (!anyPreserved) return incRep;
    let sumNormal = 0;
    let sumExtra = 0;
    let asistencias = 0;
    let faltas = 0;
    let retardos = 0;
    for (const d of mergedDias) {
      sumNormal += Number(d.hNormal) || 0;
      if (d.horasExtrasAutorizadas === true) {
        sumExtra += Number(d.hExtra) || 0;
      }
      const incUp = String(d.incidencia || "").toUpperCase();
      if (d.incidencia === "Asistencia" || d.modificadoPorSupervisor && !incUp.includes("FALTA") && !incUp.includes("SIN GOCE") && !incUp.includes("RETARDO") && Number(d.hNormal) > 0) {
        asistencias++;
      } else if (incUp.includes("FALTA")) {
        faltas++;
      } else if (incUp.includes("RETARDO")) {
        retardos++;
      }
    }
    return {
      ...incRep,
      dias: mergedDias,
      totalNormal: sumNormal,
      totalExtra: sumExtra,
      asistencias,
      faltas,
      retardos,
      asistenciaPerfecta: faltas === 0 && retardos === 0 && asistencias > 0
    };
  });
}
function writeDatabase(partial) {
  ensureDataDir();
  const current = readDatabase();
  const currentEmailTime = current.emailConfig?.updatedAt ? new Date(current.emailConfig.updatedAt).getTime() : 0;
  const incomingEmailTime = partial.emailConfig?.updatedAt ? new Date(partial.emailConfig.updatedAt).getTime() : 0;
  const isIncomingEmailOlder = currentEmailTime > 0 && incomingEmailTime > 0 && incomingEmailTime < currentEmailTime;
  const mergedEmailConfig = partial.emailConfig && typeof partial.emailConfig === "object" ? isIncomingEmailOlder ? { ...partial.emailConfig, ...current.emailConfig || {} } : { ...current.emailConfig || {}, ...partial.emailConfig } : current.emailConfig;
  const mergedConfig = partial.config && typeof partial.config === "object" ? {
    ...current.config || {},
    ...partial.config,
    ...mergedEmailConfig ? { emailServer: mergedEmailConfig } : {}
  } : mergedEmailConfig && current.config ? { ...current.config, emailServer: mergedEmailConfig } : current.config;
  const sameWeek = !partial.selectedWeek || !current.selectedWeek || partial.selectedWeek === current.selectedWeek;
  const mergedReportes = Array.isArray(partial.reportes) ? mergeReportListsPreservingSupervisorEdits(current.reportes, partial.reportes, sameWeek) : current.reportes;
  const mergedDispersals = Array.isArray(partial.dispersals) ? partial.dispersals.map((incDisp) => {
    const curDisp = Array.isArray(current.dispersals) ? current.dispersals.find(
      (d) => d?.semanaNumero === incDisp?.semanaNumero || d?.id === incDisp?.id
    ) : void 0;
    if (curDisp && Array.isArray(curDisp.reportesSnapshot) && Array.isArray(incDisp?.reportesSnapshot)) {
      return {
        ...incDisp,
        reportesSnapshot: mergeReportListsPreservingSupervisorEdits(
          curDisp.reportesSnapshot,
          incDisp.reportesSnapshot,
          true
        )
      };
    }
    return incDisp;
  }) : current.dispersals;
  const replaceEmpleadosDB = Boolean(partial.replaceEmpleadosDB);
  const deletedEmployeeIds = Array.isArray(partial.deletedEmployeeIds) ? new Set(partial.deletedEmployeeIds.map((id) => normalizeEmpIdServer(id))) : null;
  let mergedEmpleadosDB = current.empleadosDB;
  if (partial.empleadosDB && typeof partial.empleadosDB === "object") {
    if (replaceEmpleadosDB) {
      mergedEmpleadosDB = { ...partial.empleadosDB };
    } else {
      const nextEmpDB = {};
      Object.entries(current.empleadosDB || {}).forEach(([k, v]) => {
        const normId = normalizeEmpIdServer(v?.id || k) || k;
        if (!deletedEmployeeIds || !deletedEmployeeIds.has(normId)) {
          nextEmpDB[normId] = { ...v, id: normId };
        }
      });
      Object.entries(partial.empleadosDB).forEach(([k, v]) => {
        if (!v || typeof v !== "object") return;
        const inc = v;
        const normId = normalizeEmpIdServer(inc.id || k) || k;
        if (deletedEmployeeIds && deletedEmployeeIds.has(normId)) return;
        const existing = nextEmpDB[normId];
        if (existing) {
          const keepCustomList = Boolean(existing.listaPersonalizada && !inc.listaPersonalizada);
          nextEmpDB[normId] = {
            ...existing,
            ...inc,
            id: normId,
            nombre: inc.nombre || existing.nombre,
            jefe: keepCustomList ? existing.jefe : inc.jefe && inc.jefe !== "GENERAL" && inc.jefe !== "General" ? inc.jefe : existing.jefe || inc.jefe,
            listaPersonalizada: keepCustomList ? true : Boolean(inc.listaPersonalizada),
            horario: inc.horario || existing.horario || "",
            empresa: inc.empresa || existing.empresa || "",
            origenArchivo: inc.origenArchivo || existing.origenArchivo || ""
          };
        } else {
          nextEmpDB[normId] = { ...inc, id: normId };
        }
      });
      mergedEmpleadosDB = nextEmpDB;
    }
  } else if (deletedEmployeeIds && current.empleadosDB) {
    const nextEmpDB = {};
    Object.entries(current.empleadosDB).forEach(([k, v]) => {
      const normId = normalizeEmpIdServer(v?.id || k) || k;
      if (!deletedEmployeeIds.has(normId)) {
        nextEmpDB[normId] = v;
      }
    });
    mergedEmpleadosDB = nextEmpDB;
  }
  const mergedAsignaciones = partial.asignaciones && typeof partial.asignaciones === "object" ? { ...current.asignaciones || {}, ...partial.asignaciones } : current.asignaciones;
  const replaceEventosDB = Boolean(partial.replaceEventosDB);
  let mergedEventosDB = current.eventosDB;
  if (partial.eventosDB && typeof partial.eventosDB === "object") {
    if (replaceEventosDB) {
      mergedEventosDB = { ...partial.eventosDB };
    } else {
      const nextEvt = { ...current.eventosDB || {} };
      Object.entries(partial.eventosDB).forEach(([empId, empDates]) => {
        if (!empDates || typeof empDates !== "object") return;
        nextEvt[empId] = {
          ...nextEvt[empId] || {},
          ...empDates
        };
      });
      mergedEventosDB = nextEvt;
    }
  }
  const cleanPartial = { ...partial };
  delete cleanPartial.replaceEmpleadosDB;
  delete cleanPartial.deletedEmployeeIds;
  delete cleanPartial.replaceEventosDB;
  const updated = {
    ...current,
    ...cleanPartial,
    ...mergedEmpleadosDB ? { empleadosDB: mergedEmpleadosDB } : {},
    ...mergedAsignaciones ? { asignaciones: mergedAsignaciones } : {},
    ...mergedEventosDB ? { eventosDB: mergedEventosDB } : {},
    ...mergedReportes ? { reportes: mergedReportes } : {},
    ...mergedDispersals ? { dispersals: mergedDispersals } : {},
    ...mergedConfig ? { config: mergedConfig } : {},
    ...mergedEmailConfig ? { emailConfig: mergedEmailConfig } : {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const diskSnapshot = transformBase64FieldsDeep(updated, "offload");
  const tmpFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(diskSnapshot, null, 2), "utf-8");
  fs.renameSync(tmpFile, DB_FILE);
  return updated;
}
function resolveEmailConfig(override) {
  const db = readDatabase();
  const fromConfig = db.config?.emailServer || {};
  const fromRoot = db.emailConfig || {};
  return {
    textoBotonCorreo: "Ir al Sistema a Revisar y Liberar N\xF3mina",
    asuntoDispersion: "[CemenQtime] N\xF3mina Semana {semana} Lista para Validaci\xF3n \u2014 {supervisor}",
    mensajeDispersion: "Hola {nombre},\n\nTu lista de asistencia de la Semana {semana} ({periodo}) ha sido dispersada por {dispersado_por}.\n\nTienes una n\xF3mina pendiente por revisar, autorizar tiempos extras o formatos y liberar antes del {fecha_limite} ({horas_limite} horas de plazo).",
    activarAlertaPorVencer: true,
    horasAntesVencimiento: 2,
    asuntoPorVencer: "\u26A0\uFE0F [URGENTE] Tu tiempo para liberar la N\xF3mina Semana {semana} est\xE1 por finalizar \u2014 {supervisor}",
    mensajePorVencer: "Hola {nombre},\n\nTe recordamos que tienes la N\xF3mina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado est\xE1 a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora l\xEDmite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisi\xF3n y liberar tu lista.",
    ...fromConfig,
    ...fromRoot,
    ...override || {}
  };
}
function createSmtpTransporter(emailConfig, timeoutMs = 8e3) {
  const cleanUser = String(emailConfig.smtpUser || "").trim();
  const rawPass = String(emailConfig.smtpPass || "").trim();
  const host = String(
    emailConfig.smtpHost || (cleanUser.toLowerCase().includes("@gmail") ? "smtp.gmail.com" : "smtp.office365.com")
  ).trim();
  const port = Number(emailConfig.smtpPort) || 587;
  const secure = Boolean(emailConfig.smtpSecure) || port === 465;
  const isGoogleHost = host.toLowerCase().includes("gmail") || cleanUser.toLowerCase().includes("@gmail");
  const cleanPass = isGoogleHost && /^[a-zA-Z]{4}(\s+[a-zA-Z]{4}){3}$/.test(rawPass) ? rawPass.replace(/\s+/g, "") : rawPass;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: cleanUser,
      pass: cleanPass
    },
    connectionTimeout: timeoutMs
  });
  return { transporter, cleanUser, cleanPass, host, port, secure };
}
async function checkAndSendExpiringReminders(options) {
  const db = readDatabase();
  const emailCfg = resolveEmailConfig(options?.overrideEmailConfig);
  if (!options?.forceTest && emailCfg.activarAlertaPorVencer === false) {
    return { checked: false, remindersSent: 0, smtpSent: 0, details: ["Alerta por vencer desactivada"] };
  }
  const horasUmbral = Number(emailCfg.horasAntesVencimiento ?? 2) || 2;
  const umbralMs = horasUmbral * 36e5;
  const nowMs = Date.now();
  const nowISO = (/* @__PURE__ */ new Date()).toISOString();
  if (options?.forceTest) {
    if (!emailCfg.smtpUser || !emailCfg.smtpPass) {
      return {
        checked: true,
        remindersSent: 0,
        smtpSent: 0,
        details: ["Configura y guarda tus credenciales SMTP primero para enviar el correo de prueba."]
      };
    }
    const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8e3);
    const actionUrl = buildSupervisorPortalLink(emailCfg.portalUrl, "43", "OSCAR VALENZUELA");
    const buttonLabel = (emailCfg.textoBotonCorreo || "").trim() || "Ir al Sistema a Revisar y Liberar N\xF3mina";
    const sampleVars = {
      supervisor: "OSCAR VALENZUELA",
      nombre: "\xD3scar Valenzuela (Supervisor)",
      semana: "43",
      periodo: "2026-10-22 al 2026-10-28",
      dispersado_por: "Recursos Humanos",
      fecha_limite: new Date(nowMs + umbralMs).toLocaleString("es-MX", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }),
      horas_limite: "24",
      tiempo_restante: `${horasUmbral} hora(s)`,
      url_portal: actionUrl
    };
    const subject = renderServerEmailTemplate(
      emailCfg.asuntoPorVencer || "\u26A0\uFE0F [URGENTE] Tu tiempo para liberar la N\xF3mina Semana {semana} est\xE1 por finalizar \u2014 {supervisor}",
      sampleVars
    );
    const bodyText = renderServerEmailTemplate(
      emailCfg.mensajePorVencer || "Hola {nombre}, el plazo para liberar la n\xF3mina de la Semana {semana} vence en {tiempo_restante} ({fecha_limite}).",
      sampleVars
    );
    await transporter.sendMail({
      from: `"${emailCfg.smtpFromName || "CemenQtime N\xF3minas"}" <${cleanUser}>`,
      to: cleanUser,
      subject: `[PRUEBA] ${subject}`,
      text: `${bodyText}

\u{1F449} ${buttonLabel}:
${actionUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
          <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
            <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime \xB7 Alerta Autom\xE1tica por Vencimiento</div>
            <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">\u23F3 Tiempo L\xEDmite a Punto de Finalizar</h2>
          </div>
          <div style="padding: 24px;">
            <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-top: 18px;">
              <div style="color: #b91c1c; font-weight: bold; font-size: 12px; text-transform: uppercase;">Tiempo Restante Estimado: ${sampleVars.tiempo_restante}</div>
              <div style="color: #0f172a; font-size: 13px; font-weight: bold; margin-top: 4px;">Vence el: ${sampleVars.fecha_limite}</div>
            </div>
            <div style="text-align: center; margin: 24px 0 12px 0;">
              <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #b91c1c; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(185, 28, 28, 0.25);">
                ${buttonLabel} &rarr;
              </a>
              <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                \xBFNo puedes ver el bot\xF3n? Haz clic o copia este enlace:<br/>
                <a href="${actionUrl}" style="color: #b91c1c; word-break: break-all;">${actionUrl}</a>
              </div>
            </div>
          </div>
        </div>
      `
    });
    return {
      checked: true,
      remindersSent: 1,
      smtpSent: 1,
      details: [`Correo de prueba de alerta por vencimiento enviado a ${cleanUser}`]
    };
  }
  const dispersals = Array.isArray(db.dispersals) ? db.dispersals : [];
  const releases = db.releases && typeof db.releases === "object" ? db.releases : {};
  const users = Array.isArray(db.users) ? db.users : [];
  const notifications = Array.isArray(db.notifications) ? db.notifications : [];
  let remindersSent = 0;
  let smtpSent = 0;
  let dbModified = false;
  const details = [];
  for (const disp of dispersals) {
    if (!disp || disp.cancelada || !disp.limiteLiberacion) continue;
    const deadlineMs = new Date(disp.limiteLiberacion).getTime();
    if (isNaN(deadlineMs)) continue;
    const remainingMs = deadlineMs - nowMs;
    if (remainingMs <= 0 || remainingMs > umbralMs) continue;
    const alreadyReminded = Array.isArray(disp.recordatoriosVencimientoEnviados) ? disp.recordatoriosVencimientoEnviados.map((s) => String(s).toUpperCase()) : [];
    const notifiedSups = Array.isArray(disp.supervisoresNotificados) ? disp.supervisoresNotificados.map((s) => String(s).toUpperCase()) : [];
    const pendingSupsToRemind = notifiedSups.filter((supName) => {
      if (alreadyReminded.includes(supName)) return false;
      const relKey = `${disp.semanaNumero}_${supName}`;
      const rel = releases[relKey];
      return !rel || rel.status !== "liberado";
    });
    if (pendingSupsToRemind.length === 0) continue;
    const minsLeft = Math.max(1, Math.round(remainingMs / 6e4));
    const hoursLeft = Math.floor(minsLeft / 60);
    const remMins = minsLeft % 60;
    const tiempoRestanteStr = hoursLeft > 0 ? `${hoursLeft}h ${remMins}m` : `${minsLeft} minutos`;
    const limiteFormatted = new Date(deadlineMs).toLocaleString("es-MX", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    for (const supName of pendingSupsToRemind) {
      const matchedUser = users.find((u) => {
        if (!u || !u.active || u.role !== "supervisor") return false;
        const supMain = String(u.supervisorName || "").trim().toUpperCase();
        const assigned = Array.isArray(u.assignedLists) ? u.assignedLists.map((l) => String(l).trim().toUpperCase()) : [];
        return supMain === supName || assigned.includes(supName);
      });
      const recipientEmail = matchedUser?.email || `${supName.toLowerCase().replace(/\s+/g, ".")}@empresa.com`;
      const recipientName = matchedUser?.name || supName;
      const actionUrl = buildSupervisorPortalLink(emailCfg.portalUrl, disp.semanaNumero, supName);
      const buttonLabel = (emailCfg.textoBotonCorreo || "").trim() || "Ir al Sistema a Revisar y Liberar N\xF3mina";
      const vars = {
        supervisor: supName,
        nombre: recipientName,
        semana: String(disp.semanaNumero),
        periodo: String(disp.semanaPeriodo || "").replace("|", " al "),
        dispersado_por: String(disp.dispersadoPor || "N\xF3minas / RH"),
        fecha_limite: limiteFormatted,
        horas_limite: String(disp.horasLimite || 24),
        tiempo_restante: tiempoRestanteStr,
        url_portal: actionUrl
      };
      const subject = renderServerEmailTemplate(
        emailCfg.asuntoPorVencer || "\u26A0\uFE0F [URGENTE] Tu tiempo para liberar la N\xF3mina Semana {semana} est\xE1 por finalizar \u2014 {supervisor}",
        vars
      );
      const bodyText = renderServerEmailTemplate(
        emailCfg.mensajePorVencer || "Hola {nombre},\n\nTe recordamos que tienes la N\xF3mina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado est\xE1 a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora l\xEDmite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisi\xF3n y liberar tu lista.",
        vars
      );
      const newNotif = {
        id: `notif_exp_${disp.semanaNumero}_${supName.replace(/\s+/g, "_")}_${Date.now()}`,
        targetSupervisor: supName,
        targetUserId: matchedUser?.id,
        recipientEmail,
        semanaNumero: disp.semanaNumero,
        semanaPeriodo: disp.semanaPeriodo,
        titulo: `\u23F3 Tiempo por Vencer (${tiempoRestanteStr}) \u2014 N\xF3mina Semana ${disp.semanaNumero}`,
        mensaje: bodyText,
        enviadoPor: "Alerta Autom\xE1tica de Vencimiento",
        fechaEnvio: nowISO,
        leida: false,
        emailEnviado: Boolean(emailCfg.smtpUser && emailCfg.smtpPass)
      };
      notifications.unshift(newNotif);
      if (emailCfg.smtpUser && emailCfg.smtpPass) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8e3);
          await transporter.sendMail({
            from: `"${emailCfg.smtpFromName || "CemenQtime N\xF3minas"}" <${cleanUser}>`,
            to: recipientEmail,
            subject,
            text: `${bodyText}

\u{1F449} ${buttonLabel}:
${actionUrl}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
                <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
                  <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime \xB7 Alerta Autom\xE1tica por Vencimiento</div>
                  <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">\u23F3 Tiempo L\xEDmite a Punto de Finalizar</h2>
                  <div style="color: #fecaca; font-size: 12px; margin-top: 4px;">Semana ${disp.semanaNumero} \xB7 Lista: ${supName}</div>
                </div>
                <div style="padding: 24px;">
                  <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</div>
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-top: 18px;">
                    <div style="color: #b91c1c; font-weight: bold; font-size: 12px; text-transform: uppercase;">\u23F3 Tiempo Restante: ${tiempoRestanteStr}</div>
                    <div style="color: #0f172a; font-size: 13px; font-weight: bold; margin-top: 4px;">Fecha y Hora L\xEDmite: ${limiteFormatted}</div>
                  </div>
                  <div style="text-align: center; margin: 24px 0 12px 0;">
                    <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #b91c1c; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(185, 28, 28, 0.25);">
                      ${buttonLabel} &rarr;
                    </a>
                    <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                      \xBFNo puedes ver el bot\xF3n? Haz clic o copia este enlace:<br/>
                      <a href="${actionUrl}" style="color: #b91c1c; word-break: break-all;">${actionUrl}</a>
                    </div>
                  </div>
                </div>
              </div>
            `
          });
          smtpSent++;
        } catch {
        }
      }
      alreadyReminded.push(supName);
      remindersSent++;
      details.push(`${supName} (${recipientEmail}) \u2014 restan ${tiempoRestanteStr}`);
    }
    disp.recordatoriosVencimientoEnviados = Array.from(new Set(alreadyReminded));
    dbModified = true;
  }
  if (dbModified) {
    writeDatabase({
      dispersals,
      notifications: notifications.slice(0, 120)
    });
  }
  return {
    checked: true,
    remindersSent,
    smtpSent,
    details
  };
}
var sseClients = /* @__PURE__ */ new Set();
function broadcastRealtimeEvent(payload) {
  if (sseClients.size === 0) return;
  const serialized = `data: ${JSON.stringify({
    ...payload,
    timestamp: payload.timestamp || (/* @__PURE__ */ new Date()).toISOString()
  })}

`;
  for (const client of sseClients) {
    try {
      client.res.write(serialized);
    } catch {
      sseClients.delete(client);
    }
  }
}
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "CemenQtime \u2014 Servidor RH, N\xF3minas y CONTPAQi",
      hostname: os.hostname(),
      uptime: Math.round(process.uptime()),
      storagePath: DB_FILE,
      connectedRealtimeClients: sseClients.size
    });
  });
  app.get("/api/notifications/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const clientId = String(req.query.clientId || `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const clientEntry = { id: clientId, res };
    sseClients.add(clientEntry);
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        clientId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      })}

`
    );
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(clientEntry);
      }
    }, 25e3);
    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(clientEntry);
    });
  });
  app.get("/api/portal/state", (_req, res) => {
    const db = readDatabase();
    res.json({
      ...db,
      serverInfo: {
        hostname: os.hostname(),
        uptime: Math.round(process.uptime()),
        storagePath: DB_FILE
      }
    });
  });
  app.post("/api/portal/sync", (req, res) => {
    try {
      const body = req.body || {};
      const emailServerFromConfig = body.config && typeof body.config === "object" && body.config.emailServer ? body.config.emailServer : void 0;
      const updated = writeDatabase({
        ...Array.isArray(body.users) ? { users: body.users } : {},
        ...Array.isArray(body.incidents) ? { incidents: body.incidents } : {},
        ...body.releases && typeof body.releases === "object" ? { releases: body.releases } : {},
        ...Array.isArray(body.dispersals) ? { dispersals: body.dispersals } : {},
        ...Array.isArray(body.notifications) ? { notifications: body.notifications } : {},
        ...body.empleadosDB && typeof body.empleadosDB === "object" ? { empleadosDB: body.empleadosDB } : {},
        ...body.eventosDB && typeof body.eventosDB === "object" ? { eventosDB: body.eventosDB } : {},
        ...body.vacacionesDB && typeof body.vacacionesDB === "object" ? { vacacionesDB: body.vacacionesDB } : {},
        ...Array.isArray(body.reportes) ? { reportes: body.reportes } : {},
        ...body.resumen !== void 0 ? { resumen: body.resumen } : {},
        ...typeof body.selectedWeek === "string" ? { selectedWeek: body.selectedWeek } : {},
        ...body.horarios && typeof body.horarios === "object" ? { horarios: body.horarios } : {},
        ...body.asignaciones && typeof body.asignaciones === "object" ? { asignaciones: body.asignaciones } : {},
        ...body.config && typeof body.config === "object" ? { config: body.config } : {},
        ...body.emailConfig && typeof body.emailConfig === "object" ? { emailConfig: body.emailConfig } : emailServerFromConfig ? { emailConfig: emailServerFromConfig } : {}
      });
      const hasRealtimeRelevantChanges = Array.isArray(body.incidents) || Array.isArray(body.dispersals) || Array.isArray(body.notifications) || body.releases && typeof body.releases === "object" || Array.isArray(body.reportes) || Array.isArray(body.users);
      if (hasRealtimeRelevantChanges) {
        broadcastRealtimeEvent({
          type: "portal_sync",
          senderTabId: body.senderTabId,
          state: {
            ...Array.isArray(body.users) ? { users: updated.users } : {},
            ...Array.isArray(body.incidents) ? { incidents: updated.incidents } : {},
            ...body.releases && typeof body.releases === "object" ? { releases: updated.releases } : {},
            ...Array.isArray(body.dispersals) ? { dispersals: updated.dispersals } : {},
            ...Array.isArray(body.notifications) ? { notifications: updated.notifications } : {},
            ...Array.isArray(body.reportes) ? {
              reportes: updated.reportes,
              resumen: updated.resumen,
              selectedWeek: updated.selectedWeek
            } : {}
          }
        });
      }
      res.json({ ok: true, updatedAt: updated.updatedAt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.post("/api/notifications/test-smtp", async (req, res) => {
    try {
      const activeEmailConfig = resolveEmailConfig(req.body || {});
      const { transporter, cleanUser, cleanPass, host, port } = createSmtpTransporter(activeEmailConfig, 8e3);
      if (!cleanUser || !cleanPass) {
        return res.status(200).json({
          ok: false,
          error: "Faltan credenciales: se requiere Correo de N\xF3minas y Contrase\xF1a / Clave de aplicaci\xF3n."
        });
      }
      writeDatabase({
        emailConfig: activeEmailConfig,
        config: { emailServer: activeEmailConfig }
      });
      await transporter.verify();
      const info = await transporter.sendMail({
        from: `"${activeEmailConfig.smtpFromName || "CemenQtime N\xF3minas"}" <${cleanUser}>`,
        to: cleanUser,
        subject: "\u2713 [CemenQtime] Prueba de Conexi\xF3n Exitosa",
        text: `Hola,

Este es un mensaje de prueba para verificar que el servidor de correo est\xE1 correctamente conectado y listo para enviar alertas autom\xE1ticas de n\xF3mina.

Servidor: ${host}:${port}
Usuario: ${cleanUser}
Fecha: ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <div style="background: #0f172a; padding: 12px 18px; border-radius: 8px; color: #a9dfd8; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
              CemenQtime \xB7 Validaci\xF3n SMTP
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">\u2713 Conexi\xF3n de Correo Exitosa</h2>
            <p style="color: #475569; font-size: 13px; line-height: 1.5;">
              Tu servidor de correo ha sido verificado correctamente. A partir de ahora, cuando N\xF3minas / RH disperse una lista, se enviar\xE1 autom\xE1ticamente la alerta a cada supervisor.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #a9dfd8; padding: 10px 14px; margin: 16px 0; font-size: 12px; color: #334155;">
              <strong>Servidor:</strong> ${host}:${port}<br/>
              <strong>Cuenta conectada:</strong> ${cleanUser}<br/>
              <strong>Fecha:</strong> ${(/* @__PURE__ */ new Date()).toLocaleString()}
            </div>
          </div>
        `
      });
      return res.status(200).json({
        ok: true,
        message: `Conexi\xF3n verificada con \xE9xito. Se envi\xF3 un correo de prueba a ${cleanUser}.`,
        messageId: info.messageId
      });
    } catch (err) {
      const rawMsg = String(err?.message || "");
      let friendlyError = "No se pudo autenticar con el servidor SMTP. Verifica el correo y la contrase\xF1a.";
      let requiresAppPassword = false;
      if (rawMsg.includes("Cannot find package 'nodemailer'") || err?.code === "ERR_MODULE_NOT_FOUND") {
        friendlyError = "El paquete 'nodemailer' a\xFAn no est\xE1 instalado en este servidor VPS. Para activarlo, ejecuta en la terminal de tu servidor: npm install y luego reinicia con pm2 restart all.";
      } else if (rawMsg.includes("534-5.7.9") || rawMsg.toLowerCase().includes("application-specific password required")) {
        requiresAppPassword = true;
        friendlyError = 'Google exige una "Contrase\xF1a de Aplicaci\xF3n" de 16 letras (no tu contrase\xF1a normal de Gmail). Activa la Verificaci\xF3n en 2 pasos en tu cuenta de Google y genera una Contrase\xF1a de Aplicaci\xF3n en myaccount.google.com/apppasswords.';
      } else if (rawMsg.includes("535") || rawMsg.toLowerCase().includes("username and password not accepted")) {
        requiresAppPassword = true;
        friendlyError = "Usuario o contrase\xF1a rechazados por el servidor (C\xF3digo 535). Si usas Gmail u Office 365, aseg\xFArate de colocar una Contrase\xF1a de Aplicaci\xF3n de 16 caracteres en lugar de tu contrase\xF1a habitual.";
      } else if (rawMsg) {
        friendlyError = `No se pudo conectar al servidor SMTP: ${rawMsg}`;
      }
      return res.status(200).json({
        ok: false,
        requiresAppPassword,
        error: friendlyError
      });
    }
  });
  app.post("/api/notifications/send-email", async (req, res) => {
    try {
      const {
        dispatches,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        emailConfig,
        portalUrl,
        limiteLiberacion,
        horasLimite,
        mensaje
      } = req.body || {};
      let smtpSuccessCount = 0;
      const deliveryResults = [];
      const requestOrigin = portalUrl || emailConfig?.portalUrl || (req.headers.origin ? String(req.headers.origin) : `${req.protocol}://${req.get("host")}`);
      const resolvedEmailConfig = resolveEmailConfig({
        ...emailConfig || {},
        ...requestOrigin && !emailConfig?.portalUrl ? { portalUrl: requestOrigin } : {}
      });
      const buttonLabel = (resolvedEmailConfig.textoBotonCorreo || "").trim() || "Ir al Sistema a Revisar y Liberar N\xF3mina";
      if (resolvedEmailConfig.smtpUser && resolvedEmailConfig.smtpPass && Array.isArray(dispatches)) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(resolvedEmailConfig, 1e4);
          for (const d of dispatches) {
            try {
              const limiteText = limiteLiberacion ? new Date(limiteLiberacion).toLocaleString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }) : horasLimite ? `${horasLimite} horas posteriores a este aviso` : "A la brevedad posible";
              const actionUrl = buildSupervisorPortalLink(
                resolvedEmailConfig.portalUrl || requestOrigin,
                semanaNumero,
                String(d.supervisorName || "")
              );
              const templateVars = {
                supervisor: String(d.supervisorName || ""),
                nombre: String(d.recipientName || d.supervisorName || ""),
                semana: String(semanaNumero || ""),
                periodo: String(semanaPeriodo || "").replace("|", " al "),
                dispersado_por: String(dispersadoPor || "N\xF3minas / RH"),
                fecha_limite: limiteText,
                horas_limite: String(horasLimite || 24),
                tiempo_restante: `${horasLimite || 24} horas`,
                url_portal: actionUrl
              };
              const renderedSubject = d.subject || renderServerEmailTemplate(
                resolvedEmailConfig.asuntoDispersion || "[CemenQtime] N\xF3mina Semana {semana} Lista para Validaci\xF3n \u2014 {supervisor}",
                templateVars
              );
              const renderedBodyText = renderServerEmailTemplate(
                d.customBody || resolvedEmailConfig.mensajeDispersion || `Hola {nombre},

El \xE1rea de N\xF3minas ({dispersado_por}) ha dispersado tu lista de asistencia para la Semana {semana} ({periodo}).

TIEMPO L\xCDMITE DE LIBERACI\xD3N: {fecha_limite}

Por favor ingresa al portal CemenQtime para revisar tu equipo y liberar tu n\xF3mina dentro del plazo establecido.`,
                templateVars
              );
              const attachments = d.attachmentBase64 && d.attachmentFilename ? [
                {
                  filename: String(d.attachmentFilename),
                  content: Buffer.from(String(d.attachmentBase64), "base64"),
                  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
              ] : void 0;
              await transporter.sendMail({
                from: `"${resolvedEmailConfig.smtpFromName || "CemenQtime N\xF3minas"}" <${cleanUser}>`,
                to: d.recipientEmail,
                subject: renderedSubject,
                attachments,
                text: renderedBodyText + (mensaje ? `

Nota adicional: ${mensaje}` : "") + `

\u{1F449} ${buttonLabel}:
${actionUrl}

Atentamente,
Recursos Humanos / N\xF3minas`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                      <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime \xB7 Notificaci\xF3n de N\xF3mina</div>
                      <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">N\xF3mina Semana ${semanaNumero} Lista para Revisi\xF3n</h2>
                      <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Per\xEDodo: ${templateVars.periodo} \xB7 Lista: ${d.supervisorName}</div>
                    </div>
                    <div style="padding: 24px;">
                      <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">${renderedBodyText}</div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #20aef3; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                        <div style="color: #0369a1; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">\u23F3 Tiempo L\xEDmite para Liberar:</div>
                        <div style="color: #0f172a; font-size: 14px; font-weight: bold;">${limiteText}</div>
                        ${horasLimite ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">(Plazo configurado de ${horasLimite} horas)</div>` : ""}
                      </div>
                      ${d.attachmentFilename ? `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #0f766e;">
                              \u{1F4CE} <strong>Archivo Excel Adjunto:</strong> ${d.attachmentFilename}
                            </div>` : ""}
                      ${mensaje ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #92400e;">
                              <strong>Instrucci\xF3n de N\xF3minas:</strong> ${mensaje}
                            </div>` : ""}
                      <div style="text-align: center; margin: 24px 0 20px 0;">
                        <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0f172a; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);">
                          ${buttonLabel} &rarr;
                        </a>
                        <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                          \xBFNo puedes hacer clic en el bot\xF3n? Abre directamente este enlace:<br/>
                          <a href="${actionUrl}" style="color: #0284c7; word-break: break-all;">${actionUrl}</a>
                        </div>
                      </div>
                      <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin-bottom: 0;">
                        Ingresa a tu cuenta de supervisor en el sistema para autorizar tiempos extras, agregar formatos de checada sin gafete y liberar la lista a tiempo.
                      </p>
                    </div>
                  </div>
                `
              });
              smtpSuccessCount++;
              deliveryResults.push({ email: d.recipientEmail, ok: true });
            } catch (singleErr) {
              deliveryResults.push({ email: d.recipientEmail, ok: false, info: singleErr.message });
            }
          }
        } catch (_smtpInitErr) {
        }
      }
      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const sanitizedDispatches = Array.isArray(dispatches) ? dispatches.map(({ attachmentBase64: _b64, ...rest }) => rest) : [];
      const newEntry = {
        id: `mail_${Date.now()}`,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        dispatches: sanitizedDispatches,
        smtpSuccessCount,
        deliveryResults,
        sentAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedDb = writeDatabase({
        emailLogs: [newEntry, ...prevLogs].slice(0, 200)
      });
      broadcastRealtimeEvent({
        type: "notification_dispatched",
        actorName: dispersadoPor,
        summary: `Nueva n\xF3mina enviada por correo (Semana ${semanaNumero})`,
        state: {
          dispersals: updatedDb.dispersals,
          notifications: updatedDb.notifications,
          releases: updatedDb.releases
        }
      });
      res.json({
        ok: true,
        sentCount: sanitizedDispatches.length,
        smtpSentCount: smtpSuccessCount,
        smtpConfigured: Boolean(resolvedEmailConfig.smtpUser && resolvedEmailConfig.smtpPass),
        deliveryResults,
        timestamp: newEntry.sentAt
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.post("/api/notifications/check-expiring", async (req, res) => {
    try {
      const { forceTest, emailConfig } = req.body || {};
      const result = await checkAndSendExpiringReminders({
        forceTest: Boolean(forceTest),
        overrideEmailConfig: emailConfig
      });
      const db = readDatabase();
      if (result.remindersSent > 0) {
        broadcastRealtimeEvent({
          type: "expiring_reminder",
          summary: `Se enviaron ${result.remindersSent} alerta(s) por vencimiento pr\xF3ximo de n\xF3mina`,
          state: {
            dispersals: db.dispersals,
            notifications: db.notifications
          }
        });
      }
      res.json({
        ok: true,
        ...result,
        dispersals: db.dispersals,
        notifications: db.notifications
      });
    } catch (err) {
      res.status(200).json({
        ok: false,
        error: err?.message || "Error al procesar recordatorios de vencimiento"
      });
    }
  });
  setInterval(() => {
    checkAndSendExpiringReminders().then((result) => {
      if (result.remindersSent > 0) {
        const db = readDatabase();
        broadcastRealtimeEvent({
          type: "expiring_reminder",
          summary: `Se enviaron ${result.remindersSent} alerta(s) autom\xE1ticas por vencimiento pr\xF3ximo`,
          state: {
            dispersals: db.dispersals,
            notifications: db.notifications
          }
        });
      }
    }).catch(() => {
    });
  }, 6e4);
  app.post("/api/notifications/cancel-email", async (req, res) => {
    try {
      const { semanaNumero, canceladoPor, targetSupervisors, motivo } = req.body || {};
      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const cancelEntry = {
        id: `mail_cancel_${Date.now()}`,
        type: "cancellation",
        semanaNumero,
        canceladoPor,
        targetSupervisors,
        motivo,
        cancelledAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedDb = writeDatabase({
        emailLogs: [cancelEntry, ...prevLogs].slice(0, 200)
      });
      broadcastRealtimeEvent({
        type: "dispersal_cancelled",
        actorName: canceladoPor,
        summary: `Dispersi\xF3n de Semana ${semanaNumero} cancelada`,
        state: {
          dispersals: updatedDb.dispersals,
          notifications: updatedDb.notifications,
          releases: updatedDb.releases
        }
      });
      res.json({ ok: true, timestamp: cancelEntry.cancelledAt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  const passwordResetTokens = /* @__PURE__ */ new Map();
  app.post("/api/auth/login", (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const cleanId = String(identifier || "").trim().toLowerCase();
      const rawPassword = String(password || "");
      if (!cleanId || !rawPassword) {
        return res.status(200).json({
          ok: false,
          error: "Ingresa tus credenciales completas."
        });
      }
      const db = readDatabase();
      const allUsers = Array.isArray(db.users) ? db.users : [];
      const cleanIdNumeric = cleanId.replace(/^0+/, "");
      const matchedUser = allUsers.find((u) => {
        if (!u || u.active === false) return false;
        const emailMatch = String(u.email || "").trim().toLowerCase() === cleanId;
        const usernameMatch = String(u.username || "").trim().toLowerCase() === cleanId;
        const idMatch = String(u.id || "").trim().toLowerCase() === cleanId;
        const empIdRaw = String(u.employeeId || "").trim().toLowerCase();
        const empIdMatch = Boolean(empIdRaw) && (empIdRaw === cleanId || Boolean(cleanIdNumeric) && empIdRaw.replace(/^0+/, "") === cleanIdNumeric);
        return emailMatch || usernameMatch || idMatch || empIdMatch;
      });
      if (!matchedUser) {
        return res.status(200).json({
          ok: false,
          error: "No se encontr\xF3 ning\xFAn usuario activo con ese identificador."
        });
      }
      const expectedPass = matchedUser.password || "1234";
      if (rawPassword !== expectedPass) {
        return res.status(200).json({
          ok: false,
          error: "Contrase\xF1a incorrecta."
        });
      }
      const { password: _omitted, ...safeUser } = matchedUser;
      return res.status(200).json({
        ok: true,
        user: safeUser
      });
    } catch (err) {
      return res.status(200).json({
        ok: false,
        error: err?.message || "Error al autenticar en el servidor."
      });
    }
  });
  app.post("/api/auth/recover-password", async (req, res) => {
    try {
      const { identifier, users: clientUsers } = req.body || {};
      const cleanId = String(identifier || "").trim().toLowerCase();
      if (!cleanId) {
        return res.status(200).json({
          ok: false,
          error: "Por favor ingresa tu correo electr\xF3nico, usuario o n\xFAmero de empleado."
        });
      }
      const db = readDatabase();
      const allUsers = Array.isArray(db.users) && db.users.length > 0 ? db.users : Array.isArray(clientUsers) && clientUsers.length > 0 ? clientUsers : [];
      const cleanIdNumeric = cleanId.replace(/^0+/, "");
      const matchedUser = allUsers.find((u) => {
        if (!u || u.active === false) return false;
        const emailMatch = String(u.email || "").trim().toLowerCase() === cleanId;
        const usernameMatch = String(u.username || "").trim().toLowerCase() === cleanId;
        const empIdRaw = String(u.employeeId || "").trim().toLowerCase();
        const empIdMatch = Boolean(empIdRaw) && (empIdRaw === cleanId || Boolean(cleanIdNumeric) && empIdRaw.replace(/^0+/, "") === cleanIdNumeric);
        return emailMatch || usernameMatch || empIdMatch;
      });
      if (!matchedUser) {
        return res.status(200).json({
          ok: false,
          error: "No se encontr\xF3 ning\xFAn usuario activo con ese correo, usuario o n\xFAmero de empleado."
        });
      }
      const targetEmail = String(matchedUser.email || "").trim();
      const verificationCode = String(Math.floor(1e5 + Math.random() * 9e5));
      const expiresAt = Date.now() + 10 * 60 * 1e3;
      passwordResetTokens.set(String(matchedUser.id), {
        code: verificationCode,
        userId: String(matchedUser.id),
        userEmail: targetEmail,
        expiresAt
      });
      const emailCfg = resolveEmailConfig();
      let emailSent = false;
      let smtpErrorMsg = "";
      if (emailCfg.smtpUser && emailCfg.smtpPass && targetEmail.includes("@")) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8e3);
          await transporter.sendMail({
            from: `"${emailCfg.smtpFromName || "CemenQtime N\xF3minas"}" <${cleanUser}>`,
            to: targetEmail,
            subject: `\u{1F510} [CemenQtime] C\xF3digo de Recuperaci\xF3n de Contrase\xF1a \u2014 ${matchedUser.name}`,
            text: `Hola ${matchedUser.name},

Recibimos una solicitud para recuperar tu contrase\xF1a de acceso al portal CemenQtime.

C\xF3digo de verificaci\xF3n: ${verificationCode}
Vigencia: 10 minutos
Usuario: ${matchedUser.username || matchedUser.email}
${matchedUser.employeeId ? `No. de Empleado: #${matchedUser.employeeId}
` : ""}
Ingresa este c\xF3digo de 6 d\xEDgitos en la pantalla de recuperaci\xF3n del sistema para establecer tu nueva contrase\xF1a.

Atentamente,
CemenQtime \xB7 Recursos Humanos y N\xF3minas`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
                <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                  <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime \xB7 Seguridad de Cuenta</div>
                  <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">\u{1F510} Recuperaci\xF3n de Contrase\xF1a</h2>
                </div>
                <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
                  <p style="margin-top: 0;">Hola <strong>${matchedUser.name}</strong>,</p>
                  <p>Recibimos una solicitud para restablecer tu contrase\xF1a de acceso al sistema <strong>CemenQtime</strong>. Utiliza el siguiente c\xF3digo de verificaci\xF3n de 6 d\xEDgitos (v\xE1lido por 10 minutos):</p>
                  <div style="background: #f8fafc; border: 2px dashed #0f172a; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">C\xF3digo de Verificaci\xF3n</div>
                    <div style="font-size: 28px; font-family: monospace; font-weight: 900; letter-spacing: 6px; color: #0f172a; margin-top: 6px;">${verificationCode}</div>
                  </div>
                  <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #475569;">
                    <strong>Datos de tu cuenta:</strong><br/>
                    Usuario: <strong>${matchedUser.username || matchedUser.email}</strong><br/>
                    Correo registrado: <strong>${targetEmail}</strong>
                    ${matchedUser.employeeId ? `<br/>No. de Empleado: <strong>#${matchedUser.employeeId}</strong>` : ""}
                  </div>
                  <p style="font-size: 12px; color: #64748b; margin-top: 18px; margin-bottom: 0;">
                    Si t\xFA no solicitaste este cambio, puedes ignorar este mensaje.
                  </p>
                </div>
              </div>
            `
          });
          emailSent = true;
        } catch (err) {
          smtpErrorMsg = String(err?.message || "");
        }
      }
      return res.status(200).json({
        ok: true,
        emailSent,
        userId: matchedUser.id,
        userName: matchedUser.name,
        userEmail: targetEmail,
        // Por seguridad, solo se envía fallbackCode cuando NO hay servidor SMTP activo (modo local/demo)
        ...emailSent ? {} : { fallbackCode: verificationCode },
        smtpErrorMsg: smtpErrorMsg || void 0
      });
    } catch (err) {
      return res.status(200).json({
        ok: false,
        error: err?.message || "Error al procesar la solicitud de recuperaci\xF3n."
      });
    }
  });
  app.post("/api/auth/verify-reset-password", (req, res) => {
    try {
      const { userId, code, newPassword, users: clientUsers } = req.body || {};
      const cleanUserId = String(userId || "").trim();
      const cleanCode = String(code || "").trim();
      const cleanPass = String(newPassword || "").trim();
      if (!cleanUserId || !cleanCode || cleanPass.length < 4) {
        return res.status(200).json({
          ok: false,
          error: "Datos incompletos o contrase\xF1a menor a 4 caracteres."
        });
      }
      const tokenEntry = passwordResetTokens.get(cleanUserId);
      if (!tokenEntry) {
        return res.status(200).json({
          ok: false,
          error: "No existe una solicitud activa de recuperaci\xF3n o ya fue utilizada. Solicita un nuevo c\xF3digo."
        });
      }
      if (Date.now() > tokenEntry.expiresAt) {
        passwordResetTokens.delete(cleanUserId);
        return res.status(200).json({
          ok: false,
          error: "El c\xF3digo de verificaci\xF3n ha expirado (vigencia de 10 minutos). Solicita uno nuevo."
        });
      }
      if (tokenEntry.code !== cleanCode) {
        return res.status(200).json({
          ok: false,
          error: "El c\xF3digo de verificaci\xF3n ingresado no es v\xE1lido."
        });
      }
      passwordResetTokens.delete(cleanUserId);
      const db = readDatabase();
      const baseUsers = Array.isArray(db.users) && db.users.length > 0 ? db.users : Array.isArray(clientUsers) ? clientUsers : [];
      if (baseUsers.length > 0) {
        const updatedUsers = baseUsers.map(
          (u) => String(u?.id) === cleanUserId ? { ...u, password: cleanPass } : u
        );
        writeDatabase({ users: updatedUsers });
      }
      return res.status(200).json({
        ok: true,
        userId: cleanUserId
      });
    } catch (err) {
      return res.status(200).json({
        ok: false,
        error: err?.message || "Error al verificar el c\xF3digo y restablecer la contrase\xF1a."
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u2713 CemenQtime Server corriendo en http://0.0.0.0:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
