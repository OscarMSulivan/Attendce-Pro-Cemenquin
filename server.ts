/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'portal_db.json');

interface ServerEmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFromName?: string;
  asuntoDispersion?: string;
  mensajeDispersion?: string;
  activarAlertaPorVencer?: boolean;
  horasAntesVencimiento?: number;
  asuntoPorVencer?: string;
  mensajePorVencer?: string;
}

function renderServerEmailTemplate(template: string, vars: Record<string, string>): string {
  let out = template || '';
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), v ?? '');
  });
  return out;
}

interface ServerPortalDatabase {
  users?: unknown[];
  incidents?: unknown[];
  releases?: Record<string, unknown>;
  dispersals?: unknown[];
  notifications?: unknown[];
  emailLogs?: unknown[];
  empleadosDB?: Record<string, unknown>;
  eventosDB?: Record<string, unknown>;
  vacacionesDB?: Record<string, unknown>;
  reportes?: unknown[];
  resumen?: unknown;
  selectedWeek?: string;
  horarios?: Record<string, unknown>;
  asignaciones?: Record<string, string>;
  config?: Record<string, unknown>;
  emailConfig?: ServerEmailConfig;
  updatedAt?: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDatabase(): ServerPortalDatabase {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as ServerPortalDatabase;
  } catch (err) {
    console.warn('Error leyendo base de datos local:', err);
    return {};
  }
}

function writeDatabase(partial: Partial<ServerPortalDatabase>): ServerPortalDatabase {
  ensureDataDir();
  const current = readDatabase();
  const mergedConfig =
    partial.config && typeof partial.config === 'object'
      ? { ...(current.config || {}), ...partial.config }
      : current.config;

  const updated: ServerPortalDatabase = {
    ...current,
    ...partial,
    ...(mergedConfig ? { config: mergedConfig } : {}),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

function resolveEmailConfig(override?: Partial<ServerEmailConfig>): ServerEmailConfig {
  const db = readDatabase();
  const fromConfig = (db.config?.emailServer as ServerEmailConfig | undefined) || {};
  const fromRoot = db.emailConfig || {};
  return {
    asuntoDispersion: '[AttendancePRO] Nómina Semana {semana} Lista para Validación — {supervisor}',
    mensajeDispersion:
      'Hola {nombre},\n\nTu lista de asistencia de la Semana {semana} ({periodo}) ha sido dispersada por {dispersado_por}.\n\nTienes una nómina pendiente por revisar, autorizar tiempos extras o formatos y liberar antes del {fecha_limite} ({horas_limite} horas de plazo).',
    activarAlertaPorVencer: true,
    horasAntesVencimiento: 2,
    asuntoPorVencer: '⚠️ [URGENTE] Tu tiempo para liberar la Nómina Semana {semana} está por finalizar — {supervisor}',
    mensajePorVencer:
      'Hola {nombre},\n\nTe recordamos que tienes la Nómina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado está a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora límite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisión y liberar tu lista.',
    ...fromConfig,
    ...fromRoot,
    ...(override || {}),
  };
}

function createSmtpTransporter(emailConfig: ServerEmailConfig, timeoutMs = 8000) {
  const cleanUser = String(emailConfig.smtpUser || '').trim();
  const rawPass = String(emailConfig.smtpPass || '').trim();
  const host = String(
    emailConfig.smtpHost ||
      (cleanUser.toLowerCase().includes('@gmail') ? 'smtp.gmail.com' : 'smtp.office365.com')
  ).trim();
  const port = Number(emailConfig.smtpPort) || 587;
  const secure = Boolean(emailConfig.smtpSecure) || port === 465;

  // Si es Gmail / Google Workspace y el usuario pegó la Contraseña de Aplicación con espacios (ej. "abcd efgh ijkl mnop"), eliminar espacios
  const isGoogleHost = host.toLowerCase().includes('gmail') || cleanUser.toLowerCase().includes('@gmail');
  const cleanPass =
    isGoogleHost && /^[a-zA-Z]{4}(\s+[a-zA-Z]{4}){3}$/.test(rawPass)
      ? rawPass.replace(/\s+/g, '')
      : rawPass;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    connectionTimeout: timeoutMs,
  });

  return { transporter, cleanUser, cleanPass, host, port, secure };
}

/**
 * Revisa dispersiones activas cuyo tiempo límite esté próximo a finalizar (<= horasAntesVencimiento)
 * y envía automáticamente el segundo correo de recordatorio + notificación en el sistema
 * a los supervisores que aún no han liberado su nómina.
 */
async function checkAndSendExpiringReminders(options?: {
  forceTest?: boolean;
  overrideEmailConfig?: Partial<ServerEmailConfig>;
}): Promise<{
  checked: boolean;
  remindersSent: number;
  smtpSent: number;
  details: string[];
}> {
  const db = readDatabase();
  const emailCfg = resolveEmailConfig(options?.overrideEmailConfig);

  if (!options?.forceTest && emailCfg.activarAlertaPorVencer === false) {
    return { checked: false, remindersSent: 0, smtpSent: 0, details: ['Alerta por vencer desactivada'] };
  }

  const horasUmbral = Number(emailCfg.horasAntesVencimiento ?? 2) || 2;
  const umbralMs = horasUmbral * 3600000;
  const nowMs = Date.now();
  const nowISO = new Date().toISOString();

  // Si es una prueba forzada desde el panel de configuración y no hay dispersión próxima, enviar correo de prueba de vencimiento al remitente
  if (options?.forceTest) {
    if (!emailCfg.smtpUser || !emailCfg.smtpPass) {
      return {
        checked: true,
        remindersSent: 0,
        smtpSent: 0,
        details: ['Configura y guarda tus credenciales SMTP primero para enviar el correo de prueba.'],
      };
    }
    const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8000);
    const sampleVars = {
      supervisor: 'OSCAR VALENZUELA',
      nombre: 'Óscar Valenzuela (Supervisor)',
      semana: '43',
      periodo: '2026-10-22 al 2026-10-28',
      dispersado_por: 'Recursos Humanos',
      fecha_limite: new Date(nowMs + umbralMs).toLocaleString('es-MX', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      horas_limite: '24',
      tiempo_restante: `${horasUmbral} hora(s)`,
    };
    const subject = renderServerEmailTemplate(
      emailCfg.asuntoPorVencer ||
        '⚠️ [URGENTE] Tu tiempo para liberar la Nómina Semana {semana} está por finalizar — {supervisor}',
      sampleVars
    );
    const bodyText = renderServerEmailTemplate(
      emailCfg.mensajePorVencer ||
        'Hola {nombre}, el plazo para liberar la nómina de la Semana {semana} vence en {tiempo_restante} ({fecha_limite}).',
      sampleVars
    );

    await transporter.sendMail({
      from: `"${emailCfg.smtpFromName || 'AttendancePRO Nóminas'}" <${cleanUser}>`,
      to: cleanUser,
      subject: `[PRUEBA] ${subject}`,
      text: bodyText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
          <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
            <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">AttendancePRO · Alerta Automática por Vencimiento</div>
            <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">⏳ Tiempo Límite a Punto de Finalizar</h2>
          </div>
          <div style="padding: 24px;">
            <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-top: 18px;">
              <div style="color: #b91c1c; font-weight: bold; font-size: 12px; text-transform: uppercase;">Tiempo Restante Estimado: ${sampleVars.tiempo_restante}</div>
              <div style="color: #0f172a; font-size: 13px; font-weight: bold; margin-top: 4px;">Vence el: ${sampleVars.fecha_limite}</div>
            </div>
          </div>
        </div>
      `,
    });
    return {
      checked: true,
      remindersSent: 1,
      smtpSent: 1,
      details: [`Correo de prueba de alerta por vencimiento enviado a ${cleanUser}`],
    };
  }

  const dispersals = Array.isArray(db.dispersals) ? (db.dispersals as any[]) : [];
  const releases = (db.releases && typeof db.releases === 'object' ? db.releases : {}) as Record<string, any>;
  const users = Array.isArray(db.users) ? (db.users as any[]) : [];
  const notifications = Array.isArray(db.notifications) ? (db.notifications as any[]) : [];

  let remindersSent = 0;
  let smtpSent = 0;
  let dbModified = false;
  const details: string[] = [];

  for (const disp of dispersals) {
    if (!disp || disp.cancelada || !disp.limiteLiberacion) continue;
    const deadlineMs = new Date(disp.limiteLiberacion).getTime();
    if (isNaN(deadlineMs)) continue;

    const remainingMs = deadlineMs - nowMs;
    // Disparar si queda tiempo positivo y es menor o igual al umbral configurado (ej. <= 2 horas)
    if (remainingMs <= 0 || remainingMs > umbralMs) continue;

    const alreadyReminded: string[] = Array.isArray(disp.recordatoriosVencimientoEnviados)
      ? disp.recordatoriosVencimientoEnviados.map((s: string) => String(s).toUpperCase())
      : [];

    const notifiedSups: string[] = Array.isArray(disp.supervisoresNotificados)
      ? disp.supervisoresNotificados.map((s: string) => String(s).toUpperCase())
      : [];

    const pendingSupsToRemind = notifiedSups.filter(supName => {
      if (alreadyReminded.includes(supName)) return false;
      const relKey = `${disp.semanaNumero}_${supName}`;
      const rel = releases[relKey];
      return !rel || rel.status !== 'liberado';
    });

    if (pendingSupsToRemind.length === 0) continue;

    const minsLeft = Math.max(1, Math.round(remainingMs / 60000));
    const hoursLeft = Math.floor(minsLeft / 60);
    const remMins = minsLeft % 60;
    const tiempoRestanteStr =
      hoursLeft > 0 ? `${hoursLeft}h ${remMins}m` : `${minsLeft} minutos`;

    const limiteFormatted = new Date(deadlineMs).toLocaleString('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const supName of pendingSupsToRemind) {
      const matchedUser = users.find((u: any) => {
        if (!u || !u.active || u.role !== 'supervisor') return false;
        const supMain = String(u.supervisorName || '').trim().toUpperCase();
        const assigned = Array.isArray(u.assignedLists)
          ? u.assignedLists.map((l: string) => String(l).trim().toUpperCase())
          : [];
        return supMain === supName || assigned.includes(supName);
      });

      const recipientEmail =
        matchedUser?.email || `${supName.toLowerCase().replace(/\s+/g, '.')}@empresa.com`;
      const recipientName = matchedUser?.name || supName;

      const vars = {
        supervisor: supName,
        nombre: recipientName,
        semana: String(disp.semanaNumero),
        periodo: String(disp.semanaPeriodo || '').replace('|', ' al '),
        dispersado_por: String(disp.dispersadoPor || 'Nóminas / RH'),
        fecha_limite: limiteFormatted,
        horas_limite: String(disp.horasLimite || 24),
        tiempo_restante: tiempoRestanteStr,
      };

      const subject = renderServerEmailTemplate(
        emailCfg.asuntoPorVencer ||
          '⚠️ [URGENTE] Tu tiempo para liberar la Nómina Semana {semana} está por finalizar — {supervisor}',
        vars
      );
      const bodyText = renderServerEmailTemplate(
        emailCfg.mensajePorVencer ||
          'Hola {nombre},\n\nTe recordamos que tienes la Nómina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado está a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora límite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisión y liberar tu lista.',
        vars
      );

      // Crear notificación en el sistema
      const newNotif = {
        id: `notif_exp_${disp.semanaNumero}_${supName.replace(/\s+/g, '_')}_${Date.now()}`,
        targetSupervisor: supName,
        targetUserId: matchedUser?.id,
        recipientEmail,
        semanaNumero: disp.semanaNumero,
        semanaPeriodo: disp.semanaPeriodo,
        titulo: `⏳ Tiempo por Vencer (${tiempoRestanteStr}) — Nómina Semana ${disp.semanaNumero}`,
        mensaje: bodyText,
        enviadoPor: 'Alerta Automática de Vencimiento',
        fechaEnvio: nowISO,
        leida: false,
        emailEnviado: Boolean(emailCfg.smtpUser && emailCfg.smtpPass),
      };
      notifications.unshift(newNotif);

      // Enviar por SMTP si hay credenciales
      if (emailCfg.smtpUser && emailCfg.smtpPass) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8000);
          await transporter.sendMail({
            from: `"${emailCfg.smtpFromName || 'AttendancePRO Nóminas'}" <${cleanUser}>`,
            to: recipientEmail,
            subject,
            text: bodyText,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
                <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
                  <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">AttendancePRO · Alerta Automática por Vencimiento</div>
                  <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">⏳ Tiempo Límite a Punto de Finalizar</h2>
                  <div style="color: #fecaca; font-size: 12px; margin-top: 4px;">Semana ${disp.semanaNumero} · Lista: ${supName}</div>
                </div>
                <div style="padding: 24px;">
                  <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</div>
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-top: 18px;">
                    <div style="color: #b91c1c; font-weight: bold; font-size: 12px; text-transform: uppercase;">⏳ Tiempo Restante: ${tiempoRestanteStr}</div>
                    <div style="color: #0f172a; font-size: 13px; font-weight: bold; margin-top: 4px;">Fecha y Hora Límite: ${limiteFormatted}</div>
                  </div>
                </div>
              </div>
            `,
          });
          smtpSent++;
        } catch {
          // Continuar aunque falle el envío individual
        }
      }

      alreadyReminded.push(supName);
      remindersSent++;
      details.push(`${supName} (${recipientEmail}) — restan ${tiempoRestanteStr}`);
    }

    disp.recordatoriosVencimientoEnviados = Array.from(new Set(alreadyReminded));
    dbModified = true;
  }

  if (dbModified) {
    writeDatabase({
      dispersals,
      notifications: notifications.slice(0, 120),
    });
  }

  return {
    checked: true,
    remindersSent,
    smtpSent,
    details,
  };
}

async function startServer() {
  const app = express();

  // Soporte para subida de formatos firmados y Excels trabajados en base64 (hasta 50 MB)
  app.use(express.json({ limit: '50mb' }));

  // Endpoint de diagnóstico para Hostinger VPS KVM 2
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AttendancePRO v10 — Servidor RH, Nóminas y CONTPAQi',
      hostname: os.hostname(),
      uptime: Math.round(process.uptime()),
      storagePath: DB_FILE,
    });
  });

  // Obtener el estado centralizado del portal
  app.get('/api/portal/state', (_req, res) => {
    const db = readDatabase();
    res.json({
      ...db,
      serverInfo: {
        hostname: os.hostname(),
        uptime: Math.round(process.uptime()),
        storagePath: DB_FILE,
      },
    });
  });

  // Sincronizar cambios (usuarios, listas asignadas, incidencias, liberaciones, dispersiones, notificaciones y nómina activa)
  app.post('/api/portal/sync', (req, res) => {
    try {
      const body = req.body || {};
      const emailServerFromConfig =
        body.config && typeof body.config === 'object' && body.config.emailServer
          ? (body.config.emailServer as ServerEmailConfig)
          : undefined;
      const updated = writeDatabase({
        ...(Array.isArray(body.users) ? { users: body.users } : {}),
        ...(Array.isArray(body.incidents) ? { incidents: body.incidents } : {}),
        ...(body.releases && typeof body.releases === 'object' ? { releases: body.releases } : {}),
        ...(Array.isArray(body.dispersals) ? { dispersals: body.dispersals } : {}),
        ...(Array.isArray(body.notifications) ? { notifications: body.notifications } : {}),
        ...(body.empleadosDB && typeof body.empleadosDB === 'object' ? { empleadosDB: body.empleadosDB } : {}),
        ...(body.eventosDB && typeof body.eventosDB === 'object' ? { eventosDB: body.eventosDB } : {}),
        ...(body.vacacionesDB && typeof body.vacacionesDB === 'object' ? { vacacionesDB: body.vacacionesDB } : {}),
        ...(Array.isArray(body.reportes) ? { reportes: body.reportes } : {}),
        ...(body.resumen !== undefined ? { resumen: body.resumen } : {}),
        ...(typeof body.selectedWeek === 'string' ? { selectedWeek: body.selectedWeek } : {}),
        ...(body.horarios && typeof body.horarios === 'object' ? { horarios: body.horarios } : {}),
        ...(body.asignaciones && typeof body.asignaciones === 'object' ? { asignaciones: body.asignaciones } : {}),
        ...(body.config && typeof body.config === 'object' ? { config: body.config } : {}),
        ...(body.emailConfig && typeof body.emailConfig === 'object'
          ? { emailConfig: body.emailConfig }
          : emailServerFromConfig
          ? { emailConfig: emailServerFromConfig }
          : {}),
      });
      res.json({ ok: true, updatedAt: updated.updatedAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint para probar conexión y credenciales SMTP
  app.post('/api/notifications/test-smtp', async (req, res) => {
    try {
      const activeEmailConfig = resolveEmailConfig(req.body || {});
      const { transporter, cleanUser, cleanPass, host, port } = createSmtpTransporter(activeEmailConfig, 8000);

      if (!cleanUser || !cleanPass) {
        return res.status(200).json({
          ok: false,
          error: 'Faltan credenciales: se requiere Correo de Nóminas y Contraseña / Clave de aplicación.',
        });
      }

      // Persistir la configuración probada en el estado del proyecto
      writeDatabase({
        emailConfig: activeEmailConfig,
        config: { emailServer: activeEmailConfig },
      });

      await transporter.verify();

      // Enviar correo de prueba al mismo remitente
      const info = await transporter.sendMail({
        from: `"${activeEmailConfig.smtpFromName || 'AttendancePRO Nóminas'}" <${cleanUser}>`,
        to: cleanUser,
        subject: '✓ [AttendancePRO] Prueba de Conexión Exitosa',
        text: `Hola,\n\nEste es un mensaje de prueba para verificar que el servidor de correo está correctamente conectado y listo para enviar alertas automáticas de nómina.\n\nServidor: ${host}:${port}\nUsuario: ${cleanUser}\nFecha: ${new Date().toLocaleString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <div style="background: #0f172a; padding: 12px 18px; border-radius: 8px; color: #a9dfd8; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
              AttendancePRO · Validación SMTP
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">✓ Conexión de Correo Exitosa</h2>
            <p style="color: #475569; font-size: 13px; line-height: 1.5;">
              Tu servidor de correo ha sido verificado correctamente. A partir de ahora, cuando Nóminas / RH disperse una lista, se enviará automáticamente la alerta a cada supervisor.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #a9dfd8; padding: 10px 14px; margin: 16px 0; font-size: 12px; color: #334155;">
              <strong>Servidor:</strong> ${host}:${port}<br/>
              <strong>Cuenta conectada:</strong> ${cleanUser}<br/>
              <strong>Fecha:</strong> ${new Date().toLocaleString()}
            </div>
          </div>
        `,
      });

      return res.status(200).json({
        ok: true,
        message: `Conexión verificada con éxito. Se envió un correo de prueba a ${cleanUser}.`,
        messageId: info.messageId,
      });
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      let friendlyError = 'No se pudo autenticar con el servidor SMTP. Verifica el correo y la contraseña.';
      let requiresAppPassword = false;

      if (rawMsg.includes("Cannot find package 'nodemailer'") || err?.code === 'ERR_MODULE_NOT_FOUND') {
        friendlyError =
          "El paquete 'nodemailer' aún no está instalado en este servidor VPS. Para activarlo, ejecuta en la terminal de tu servidor: npm install y luego reinicia con pm2 restart all.";
      } else if (rawMsg.includes('534-5.7.9') || rawMsg.toLowerCase().includes('application-specific password required')) {
        requiresAppPassword = true;
        friendlyError =
          'Google exige una "Contraseña de Aplicación" de 16 letras (no tu contraseña normal de Gmail). Activa la Verificación en 2 pasos en tu cuenta de Google y genera una Contraseña de Aplicación en myaccount.google.com/apppasswords.';
      } else if (rawMsg.includes('535') || rawMsg.toLowerCase().includes('username and password not accepted')) {
        requiresAppPassword = true;
        friendlyError =
          'Usuario o contraseña rechazados por el servidor (Código 535). Si usas Gmail u Office 365, asegúrate de colocar una Contraseña de Aplicación de 16 caracteres en lugar de tu contraseña habitual.';
      } else if (rawMsg) {
        friendlyError = `No se pudo conectar al servidor SMTP: ${rawMsg}`;
      }

      return res.status(200).json({
        ok: false,
        requiresAppPassword,
        error: friendlyError,
      });
    }
  });

  // Endpoint para envío y registro de notificaciones por correo electrónico empresarial al dispersar listas
  app.post('/api/notifications/send-email', async (req, res) => {
    try {
      const {
        dispatches,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        emailConfig,
        limiteLiberacion,
        horasLimite,
        mensaje,
      } = req.body || {};

      let smtpSuccessCount = 0;
      const deliveryResults: Array<{ email: string; ok: boolean; info?: string }> = [];

      // Inicializar transporte usando el estado emailConfig del proyecto (combinado con lo enviado en la petición)
      const resolvedEmailConfig = resolveEmailConfig(emailConfig);
      if (resolvedEmailConfig.smtpUser && resolvedEmailConfig.smtpPass && Array.isArray(dispatches)) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(resolvedEmailConfig, 10000);

          for (const d of dispatches) {
            try {
              const limiteText = limiteLiberacion
                ? new Date(limiteLiberacion).toLocaleString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : horasLimite
                ? `${horasLimite} horas posteriores a este aviso`
                : 'A la brevedad posible';

              const templateVars = {
                supervisor: String(d.supervisorName || ''),
                nombre: String(d.recipientName || d.supervisorName || ''),
                semana: String(semanaNumero || ''),
                periodo: String(semanaPeriodo || '').replace('|', ' al '),
                dispersado_por: String(dispersadoPor || 'Nóminas / RH'),
                fecha_limite: limiteText,
                horas_limite: String(horasLimite || 24),
                tiempo_restante: `${horasLimite || 24} horas`,
              };

              const renderedSubject =
                d.subject ||
                renderServerEmailTemplate(
                  resolvedEmailConfig.asuntoDispersion ||
                    '[AttendancePRO] Nómina Semana {semana} Lista para Validación — {supervisor}',
                  templateVars
                );

              const renderedBodyText = renderServerEmailTemplate(
                resolvedEmailConfig.mensajeDispersion ||
                  `Hola {nombre},\n\nEl área de Nóminas ({dispersado_por}) ha dispersado tu lista de asistencia para la Semana {semana} ({periodo}).\n\nTIEMPO LÍMITE DE LIBERACIÓN: {fecha_limite}\n\nPor favor ingresa al portal AttendancePRO para revisar tu equipo y liberar tu nómina dentro del plazo establecido.`,
                templateVars
              );

              await transporter.sendMail({
                from: `"${resolvedEmailConfig.smtpFromName || 'AttendancePRO Nóminas'}" <${cleanUser}>`,
                to: d.recipientEmail,
                subject: renderedSubject,
                text:
                  renderedBodyText +
                  (mensaje ? `\n\nNota adicional: ${mensaje}` : '') +
                  `\n\nAtentamente,\nRecursos Humanos / Nóminas`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                      <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">AttendancePRO · Notificación de Nómina</div>
                      <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Nómina Semana ${semanaNumero} Dispersada</h2>
                      <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Período: ${templateVars.periodo} · Lista: ${d.supervisorName}</div>
                    </div>
                    <div style="padding: 24px;">
                      <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">${renderedBodyText}</div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #20aef3; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                        <div style="color: #0369a1; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">⏳ Tiempo Límite para Liberar:</div>
                        <div style="color: #0f172a; font-size: 14px; font-weight: bold;">${limiteText}</div>
                        ${horasLimite ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">(Plazo configurado de ${horasLimite} horas)</div>` : ''}
                      </div>
                      ${
                        mensaje
                          ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #92400e;">
                              <strong>Instrucción de Nóminas:</strong> ${mensaje}
                            </div>`
                          : ''
                      }
                      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
                        Ingresa a tu cuenta de supervisor en el sistema para autorizar tiempos extras, agregar formatos de checada sin gafete y liberar la lista a tiempo.
                      </p>
                    </div>
                  </div>
                `,
              });
              smtpSuccessCount++;
              deliveryResults.push({ email: d.recipientEmail, ok: true });
            } catch (singleErr: any) {
              deliveryResults.push({ email: d.recipientEmail, ok: false, info: singleErr.message });
            }
          }
        } catch (_smtpInitErr: any) {
          // Transporter initialization error captured in delivery results
        }
      }

      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const newEntry = {
        id: `mail_${Date.now()}`,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        dispatches: Array.isArray(dispatches) ? dispatches : [],
        smtpSuccessCount,
        deliveryResults,
        sentAt: new Date().toISOString(),
      };
      writeDatabase({
        emailLogs: [newEntry, ...prevLogs].slice(0, 200),
      });

      res.json({
        ok: true,
        sentCount: Array.isArray(dispatches) ? dispatches.length : 0,
        smtpSentCount: smtpSuccessCount,
        timestamp: newEntry.sentAt,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint para verificar y enviar alertas automáticas cuando el plazo de liberación está por vencer
  app.post('/api/notifications/check-expiring', async (req, res) => {
    try {
      const { forceTest, emailConfig } = req.body || {};
      const result = await checkAndSendExpiringReminders({
        forceTest: Boolean(forceTest),
        overrideEmailConfig: emailConfig,
      });
      const db = readDatabase();
      res.json({
        ok: true,
        ...result,
        dispersals: db.dispersals,
        notifications: db.notifications,
      });
    } catch (err: any) {
      res.status(200).json({
        ok: false,
        error: err?.message || 'Error al procesar recordatorios de vencimiento',
      });
    }
  });

  // Revisión automática en segundo plano cada 60 segundos para detectar listas cuyo plazo está por vencer
  setInterval(() => {
    checkAndSendExpiringReminders().catch(() => {
      // ignore background timer errors
    });
  }, 60000);

  // Endpoint para registrar cancelación de nómina dispersada
  app.post('/api/notifications/cancel-email', async (req, res) => {
    try {
      const { semanaNumero, canceladoPor, targetSupervisors, motivo } = req.body || {};
      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const cancelEntry = {
        id: `mail_cancel_${Date.now()}`,
        type: 'cancellation',
        semanaNumero,
        canceladoPor,
        targetSupervisors,
        motivo,
        cancelledAt: new Date().toISOString(),
      };
      writeDatabase({
        emailLogs: [cancelEntry, ...prevLogs].slice(0, 200),
      });
      res.json({ ok: true, timestamp: cancelEntry.cancelledAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ AttendancePRO v10 Server corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
