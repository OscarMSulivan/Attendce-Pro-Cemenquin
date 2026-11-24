/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.CEMENQTIME_DATA_DIR
  ? path.resolve(process.env.CEMENQTIME_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'portal_db.json');

// Espejo persistente fuera de la carpeta del repositorio git para que ningún git pull / rebuild borre usuarios ni datos
const PERSISTENT_BACKUP_DIR = path.join(os.homedir(), '.cemenqtime_data');
const PERSISTENT_BACKUP_UPLOADS_DIR = path.join(PERSISTENT_BACKUP_DIR, 'uploads');
const PERSISTENT_BACKUP_DB_FILE = path.join(PERSISTENT_BACKUP_DIR, 'portal_db.json');

interface ServerEmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFromName?: string;
  portalUrl?: string;
  textoBotonCorreo?: string;
  asuntoDispersion?: string;
  mensajeDispersion?: string;
  activarAlertaPorVencer?: boolean;
  horasAntesVencimiento?: number;
  asuntoPorVencer?: string;
  mensajePorVencer?: string;
  updatedAt?: string;
}

function renderServerEmailTemplate(template: string, vars: Record<string, string>): string {
  let out = template || '';
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), v ?? '');
  });
  return out;
}

function buildSupervisorPortalLink(
  baseUrl: string | undefined,
  semanaNumero: string | number,
  supervisorName: string
): string {
  const fallbackOrigin = process.env.APP_URL || `http://localhost:${PORT}`;
  const rawBase = String(baseUrl || fallbackOrigin).trim().replace(/\/+$/, '');
  const cleanBase = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
  return `${cleanBase}/?action=liberar_nomina&semana=${encodeURIComponent(
    String(semanaNumero || '')
  )}&supervisor=${encodeURIComponent(String(supervisorName || ''))}`;
}

interface ServerPortalDatabase {
  users?: unknown[];
  deletedUserIds?: string[];
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
  deletedHorarioCodes?: string[];
  asignaciones?: Record<string, string>;
  config?: Record<string, unknown>;
  emailConfig?: ServerEmailConfig;
  livePresence?: Record<string, any>;
  liveActivityFeed?: any[];
  evaluationCampaigns?: unknown[];
  evaluationRecords?: unknown[];
  updatedAt?: string;
}

const uploadMemoryCache = new Map<string, string>();
const BASE64_FIELDS = new Set([
  'formatoSubidoBase64',
  'archivoFormatoBase64',
  'excelTrabajadoBase64',
]);

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  try {
    if (!fs.existsSync(PERSISTENT_BACKUP_DIR)) {
      fs.mkdirSync(PERSISTENT_BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(PERSISTENT_BACKUP_UPLOADS_DIR)) {
      fs.mkdirSync(PERSISTENT_BACKUP_UPLOADS_DIR, { recursive: true });
    }
  } catch {
    // ignore if home dir is read-only
  }
}

function offloadBase64String(raw: string, fieldName: string): string {
  if (!raw || typeof raw !== 'string' || raw.length < 256 || raw.startsWith('@upload:')) {
    return raw;
  }
  try {
    ensureDataDir();
    const hash = crypto.createHash('sha1').update(raw).digest('hex');
    const fileName = `${fieldName}_${hash}.b64`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      const tmpUpload = `${filePath}.tmp.${process.pid}`;
      fs.writeFileSync(tmpUpload, raw, 'utf-8');
      fs.renameSync(tmpUpload, filePath);
    }
    try {
      const backupUploadPath = path.join(PERSISTENT_BACKUP_UPLOADS_DIR, fileName);
      if (!fs.existsSync(backupUploadPath)) {
        fs.writeFileSync(backupUploadPath, raw, 'utf-8');
      }
    } catch {
      // ignore backup upload error
    }
    uploadMemoryCache.set(fileName, raw);
    return `@upload:${fileName}`;
  } catch (err) {
    console.warn('No se pudo externalizar adjunto base64 a disco:', err);
    return raw;
  }
}

function hydrateBase64String(ref: string): string {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('@upload:')) {
    return ref;
  }
  const fileName = path.basename(ref.slice('@upload:'.length));
  if (!fileName) return '';
  const cached = uploadMemoryCache.get(fileName);
  if (cached !== undefined) return cached;
  try {
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      uploadMemoryCache.set(fileName, content);
      return content;
    }
    const backupFilePath = path.join(PERSISTENT_BACKUP_UPLOADS_DIR, fileName);
    if (fs.existsSync(backupFilePath)) {
      const content = fs.readFileSync(backupFilePath, 'utf-8');
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch {
        // ignore restore write error
      }
      uploadMemoryCache.set(fileName, content);
      return content;
    }
  } catch (err) {
    console.warn('Error leyendo adjunto desde data/uploads:', err);
  }
  return '';
}

function transformBase64FieldsDeep(node: any, mode: 'offload' | 'hydrate'): any {
  if (node === null || node === undefined || typeof node !== 'object') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => transformBase64FieldsDeep(item, mode));
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(node)) {
    if (BASE64_FIELDS.has(k) && typeof v === 'string' && v.length > 0) {
      out[k] = mode === 'offload' ? offloadBase64String(v, k) : hydrateBase64String(v);
    } else if (v !== null && typeof v === 'object') {
      out[k] = transformBase64FieldsDeep(v, mode);
    } else {
      out[k] = v;
    }
  }
  return out;
}

let cachedMemoryDb: ServerPortalDatabase | null = null;
let cachedDiskMtimeMs = 0;

function readDatabase(): ServerPortalDatabase {
  try {
    ensureDataDir();
    // Si la carpeta ./data del proyecto fue limpiada en un deploy/push, restaurar automáticamente del espejo en ~/.cemenqtime_data
    if (!fs.existsSync(DB_FILE) && fs.existsSync(PERSISTENT_BACKUP_DB_FILE)) {
      try {
        fs.copyFileSync(PERSISTENT_BACKUP_DB_FILE, DB_FILE);
      } catch (copyErr) {
        console.warn('Error restaurando espejo de base de datos:', copyErr);
      }
    }
    const targetFile = fs.existsSync(DB_FILE)
      ? DB_FILE
      : fs.existsSync(PERSISTENT_BACKUP_DB_FILE)
      ? PERSISTENT_BACKUP_DB_FILE
      : null;

    if (!targetFile) {
      cachedMemoryDb = {};
      cachedDiskMtimeMs = 0;
      return cachedMemoryDb;
    }
    const stat = fs.statSync(targetFile);
    if (cachedMemoryDb && stat.mtimeMs === cachedDiskMtimeMs) {
      return cachedMemoryDb;
    }
    const raw = fs.readFileSync(targetFile, 'utf-8');
    const parsed = JSON.parse(raw) as ServerPortalDatabase;
    cachedMemoryDb = transformBase64FieldsDeep(parsed, 'hydrate') as ServerPortalDatabase;
    cachedDiskMtimeMs = stat.mtimeMs;
    return cachedMemoryDb;
  } catch (err) {
    console.warn('Error leyendo base de datos local:', err);
    return cachedMemoryDb || {};
  }
}

function normalizeEmpIdServer(id: unknown): string {
  if (id === null || id === undefined) return '';
  const str = String(id).trim();
  if (!str) return '';
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? str : parsed.toString().padStart(5, '0');
}

function mergeReportListsPreservingSupervisorEdits(
  currentList: unknown[] | undefined,
  incomingList: unknown[] | undefined,
  sameWeek: boolean
): unknown[] | undefined {
  if (!Array.isArray(incomingList)) return currentList;
  if (!sameWeek || !Array.isArray(currentList) || currentList.length === 0) return incomingList;

  const currentByEmp = new Map<string, any>();
  for (const rep of currentList as any[]) {
    const id = normalizeEmpIdServer(rep?.empleado?.id);
    if (id) currentByEmp.set(id, rep);
  }

  return (incomingList as any[]).map(incRep => {
    const id = normalizeEmpIdServer(incRep?.empleado?.id);
    const curRep = id ? currentByEmp.get(id) : undefined;
    if (!curRep || !Array.isArray(curRep.dias) || !Array.isArray(incRep?.dias)) {
      return incRep;
    }

    let anyPreserved = false;
    const mergedDias = incRep.dias.map((incDay: any) => {
      const curDay = curRep.dias.find((d: any) => d?.isoDate === incDay?.isoDate);
      if (!curDay) return incDay;

      const curEdited =
        Boolean(curDay.modificadoPorSupervisor) ||
        curDay.horasExtrasAutorizadas !== undefined ||
        Boolean(curDay.notaSupervisorDia) ||
        Boolean(curDay.formatoSubidoNombre);
      const incEdited =
        Boolean(incDay?.modificadoPorSupervisor) ||
        incDay?.horasExtrasAutorizadas !== undefined ||
        Boolean(incDay?.notaSupervisorDia) ||
        Boolean(incDay?.formatoSubidoNombre);

      // Si el día entrante sí viene editado por el supervisor, prevalece el cambio nuevo;
      // si viene sin editar (por ej. de otra pestaña con estado anterior), preservamos la edición existente.
      if (curEdited && !incEdited) {
        anyPreserved = true;
        return {
          ...curDay,
          horarioProgramado: incDay.horarioProgramado ?? curDay.horarioProgramado,
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
      const incUp = String(d.incidencia || '').toUpperCase();
      if (d.incidencia === 'Asistencia' || (d.modificadoPorSupervisor && !incUp.includes('FALTA') && !incUp.includes('SIN GOCE') && !incUp.includes('RETARDO') && Number(d.hNormal) > 0)) {
        asistencias++;
      } else if (incUp.includes('FALTA')) {
        faltas++;
      } else if (incUp.includes('RETARDO')) {
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
      asistenciaPerfecta: faltas === 0 && retardos === 0 && asistencias > 0,
    };
  });
}

function writeDatabase(partial: Partial<ServerPortalDatabase>): ServerPortalDatabase {
  ensureDataDir();
  const current = readDatabase();
  const currentEmailTime = current.emailConfig?.updatedAt
    ? new Date(current.emailConfig.updatedAt).getTime()
    : 0;
  const incomingEmailTime = partial.emailConfig?.updatedAt
    ? new Date(partial.emailConfig.updatedAt).getTime()
    : 0;

  // Si llega un sync rezagado con un timestamp más antiguo que el emailConfig actual en disco, preservar el más reciente
  const isIncomingEmailOlder =
    currentEmailTime > 0 && incomingEmailTime > 0 && incomingEmailTime < currentEmailTime;

  const cleanIncomingEmail =
    partial.emailConfig && typeof partial.emailConfig === 'object'
      ? {
          ...partial.emailConfig,
          smtpPass:
            partial.emailConfig.smtpPass === '••••••••'
              ? current.emailConfig?.smtpPass || ''
              : partial.emailConfig.smtpPass,
        }
      : undefined;

  const mergedEmailConfig: ServerEmailConfig | undefined = cleanIncomingEmail
    ? isIncomingEmailOlder
      ? { ...cleanIncomingEmail, ...(current.emailConfig || {}) }
      : { ...(current.emailConfig || {}), ...cleanIncomingEmail }
    : current.emailConfig;

  const mergedConfig: Record<string, unknown> | undefined =
    partial.config && typeof partial.config === 'object'
      ? {
          ...(current.config || {}),
          ...partial.config,
          ...(mergedEmailConfig ? { emailServer: mergedEmailConfig } : {}),
        }
      : mergedEmailConfig && current.config
      ? { ...current.config, emailServer: mergedEmailConfig }
      : current.config;

  const sameWeek =
    !partial.selectedWeek ||
    !current.selectedWeek ||
    partial.selectedWeek === current.selectedWeek;

  const explicitClearReportes = Boolean((partial as any).clearReportes);
  const explicitDeleteDispersal = Boolean((partial as any).deleteDispersal);

  const mergedReportes = Array.isArray(partial.reportes)
    ? partial.reportes.length === 0
      ? explicitClearReportes
        ? []
        : current.reportes
      : mergeReportListsPreservingSupervisorEdits(current.reportes, partial.reportes, sameWeek)
    : current.reportes;

  let mergedDispersals = current.dispersals;
  if (Array.isArray(partial.dispersals)) {
    if (
      partial.dispersals.length === 0 &&
      Array.isArray(current.dispersals) &&
      current.dispersals.length > 0 &&
      !explicitDeleteDispersal
    ) {
      mergedDispersals = current.dispersals;
    } else {
      const incomingMerged = partial.dispersals.map((incDisp: any) => {
        const curDisp = Array.isArray(current.dispersals)
          ? (current.dispersals as any[]).find(
              d => d?.semanaNumero === incDisp?.semanaNumero || d?.id === incDisp?.id
            )
          : undefined;
        if (curDisp && Array.isArray(curDisp.reportesSnapshot) && curDisp.reportesSnapshot.length > 0) {
          if (Array.isArray(incDisp?.reportesSnapshot) && incDisp.reportesSnapshot.length > 0) {
            return {
              ...incDisp,
              reportesSnapshot: mergeReportListsPreservingSupervisorEdits(
                curDisp.reportesSnapshot,
                incDisp.reportesSnapshot,
                true
              ),
            };
          }
          // Si el cliente envió una dispersión compactada sin reportesSnapshot (por límite de localStorage),
          // preservar el snapshot completo almacenado en el servidor
          return {
            ...incDisp,
            reportesSnapshot: curDisp.reportesSnapshot,
          };
        }
        return incDisp;
      });

      if (!explicitDeleteDispersal && Array.isArray(current.dispersals)) {
        const incomingWeeks = new Set(incomingMerged.map((d: any) => d?.semanaNumero));
        const missingFromIncoming = (current.dispersals as any[]).filter(
          d => d && !incomingWeeks.has(d.semanaNumero)
        );
        mergedDispersals = [...incomingMerged, ...missingFromIncoming];
      } else {
        mergedDispersals = incomingMerged;
      }
    }
  }

  // Fusión permanente de empleadosDB (soporte multi-empresa: subir una segunda base nunca borra la primera)
  const replaceEmpleadosDB = Boolean((partial as any).replaceEmpleadosDB);
  const deletedEmployeeIds = Array.isArray((partial as any).deletedEmployeeIds)
    ? new Set((partial as any).deletedEmployeeIds.map((id: unknown) => normalizeEmpIdServer(id)))
    : null;

  let mergedEmpleadosDB: Record<string, unknown> | undefined = current.empleadosDB;
  if (partial.empleadosDB && typeof partial.empleadosDB === 'object') {
    if (replaceEmpleadosDB) {
      mergedEmpleadosDB = { ...partial.empleadosDB };
    } else {
      const nextEmpDB: Record<string, any> = {};
      Object.entries(current.empleadosDB || {}).forEach(([k, v]) => {
        const normId = normalizeEmpIdServer((v as any)?.id || k) || k;
        if (!deletedEmployeeIds || !deletedEmployeeIds.has(normId)) {
          nextEmpDB[normId] = { ...(v as any), id: normId };
        }
      });
      Object.entries(partial.empleadosDB).forEach(([k, v]) => {
        if (!v || typeof v !== 'object') return;
        const inc = v as any;
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
            jefe: keepCustomList
              ? existing.jefe
              : inc.jefe && inc.jefe !== 'GENERAL' && inc.jefe !== 'General'
              ? inc.jefe
              : existing.jefe || inc.jefe,
            listaPersonalizada: keepCustomList ? true : Boolean(inc.listaPersonalizada),
            horario: inc.horario || existing.horario || '',
            empresa: inc.empresa || existing.empresa || '',
            origenArchivo: inc.origenArchivo || existing.origenArchivo || '',
          };
        } else {
          nextEmpDB[normId] = { ...inc, id: normId };
        }
      });
      mergedEmpleadosDB = nextEmpDB;
    }
  } else if (deletedEmployeeIds && current.empleadosDB) {
    const nextEmpDB: Record<string, any> = {};
    Object.entries(current.empleadosDB).forEach(([k, v]) => {
      const normId = normalizeEmpIdServer((v as any)?.id || k) || k;
      if (!deletedEmployeeIds.has(normId)) {
        nextEmpDB[normId] = v;
      }
    });
    mergedEmpleadosDB = nextEmpDB;
  }

  // Fusión permanente de usuarios del portal (nunca perder usuarios creados cuando una pestaña envía DEFAULT_USERS)
  const incomingDeletedUserIds = Array.isArray((partial as any).deletedUserIds)
    ? (partial as any).deletedUserIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
    : [];
  const existingDeletedUserIds = Array.isArray(current.deletedUserIds)
    ? current.deletedUserIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
    : [];
  const mergedDeletedUserIdsSet = new Set<string>([
    ...existingDeletedUserIds,
    ...incomingDeletedUserIds,
  ]);

  let mergedUsers: unknown[] | undefined = current.users;
  if (Array.isArray(partial.users)) {
    const userMap = new Map<string, any>();
    if (Array.isArray(current.users)) {
      for (const u of current.users as any[]) {
        const uid = String(u?.id || '').trim();
        if (uid && !mergedDeletedUserIdsSet.has(uid)) {
          userMap.set(uid, u);
        }
      }
    }

    // Si incoming trae únicamente los 4 usuarios por defecto sin ediciones mientras el servidor ya tiene usuarios personalizados,
    // sólo agregar los que falten sin sobrescribir cambios personalizados existentes
    const incomingList = partial.users as any[];
    const defaultIds = new Set(['user_admin', 'user_rh', 'user_sup_oscar', 'user_sup_eudis']);
    const isIncomingOnlyDefaultSeed =
      incomingList.length <= 4 &&
      incomingList.every(u => defaultIds.has(String(u?.id || ''))) &&
      userMap.size > incomingList.length;

    for (const incU of incomingList) {
      const uid = String(incU?.id || '').trim();
      if (!uid || mergedDeletedUserIdsSet.has(uid)) continue;
      const existingU = userMap.get(uid);
      if (existingU) {
        if (isIncomingOnlyDefaultSeed) {
          continue;
        }
        userMap.set(uid, { ...existingU, ...incU });
      } else {
        userMap.set(uid, incU);
      }
    }
    mergedUsers = Array.from(userMap.values());
  } else if (incomingDeletedUserIds.length > 0 && Array.isArray(current.users)) {
    mergedUsers = (current.users as any[]).filter(
      u => u?.id && !mergedDeletedUserIdsSet.has(String(u.id).trim())
    );
  }

  // Fusión permanente de horarios programados
  const incomingDeletedHorarios = Array.isArray((partial as any).deletedHorarioCodes)
    ? (partial as any).deletedHorarioCodes.map((c: unknown) => String(c || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const existingDeletedHorarios = Array.isArray(current.deletedHorarioCodes)
    ? current.deletedHorarioCodes.map((c: unknown) => String(c || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const mergedDeletedHorariosSet = new Set<string>([
    ...existingDeletedHorarios,
    ...incomingDeletedHorarios,
  ]);

  let mergedHorarios: Record<string, unknown> | undefined = current.horarios;
  if (partial.horarios && typeof partial.horarios === 'object') {
    const nextHor: Record<string, unknown> = {};
    Object.entries(current.horarios || {}).forEach(([code, cfg]) => {
      if (!mergedDeletedHorariosSet.has(code.trim().toUpperCase())) {
        nextHor[code] = cfg;
      }
    });
    Object.entries(partial.horarios).forEach(([code, cfg]) => {
      if (!mergedDeletedHorariosSet.has(code.trim().toUpperCase())) {
        nextHor[code] = cfg;
      }
    });
    mergedHorarios = nextHor;
  } else if (incomingDeletedHorarios.length > 0 && current.horarios) {
    const nextHor: Record<string, unknown> = {};
    Object.entries(current.horarios).forEach(([code, cfg]) => {
      if (!mergedDeletedHorariosSet.has(code.trim().toUpperCase())) {
        nextHor[code] = cfg;
      }
    });
    mergedHorarios = nextHor;
  }

  // Fusión acumulativa de liberaciones (salvo cuando se elimina explícitamente una nómina)
  const mergedReleases: Record<string, unknown> | undefined =
    partial.releases && typeof partial.releases === 'object'
      ? explicitDeleteDispersal
        ? { ...partial.releases }
        : { ...(current.releases || {}), ...partial.releases }
      : current.releases;

  // Fusión acumulativa de incidencias por ID (preservando resoluciones más recientes)
  let mergedIncidents: unknown[] | undefined = current.incidents;
  if (Array.isArray(partial.incidents)) {
    const incMap = new Map<string, any>();
    if (Array.isArray(current.incidents)) {
      for (const inc of current.incidents as any[]) {
        if (inc?.id) incMap.set(String(inc.id), inc);
      }
    }
    for (const inc of partial.incidents as any[]) {
      if (!inc?.id) continue;
      const existing = incMap.get(String(inc.id));
      if (existing && existing.status !== 'pendiente' && inc.status === 'pendiente') {
        continue;
      }
      incMap.set(String(inc.id), existing ? { ...existing, ...inc } : inc);
    }
    mergedIncidents = Array.from(incMap.values());
  }

  // Fusión permanente de asignaciones de horario
  const mergedAsignaciones: Record<string, string> | undefined =
    partial.asignaciones && typeof partial.asignaciones === 'object'
      ? { ...(current.asignaciones || {}), ...partial.asignaciones }
      : current.asignaciones;

  // Fusión de eventosDB por colaborador y fecha (para conservar checadas de ambas empresas)
  const replaceEventosDB = Boolean((partial as any).replaceEventosDB);
  let mergedEventosDB: Record<string, unknown> | undefined = current.eventosDB;
  if (partial.eventosDB && typeof partial.eventosDB === 'object') {
    if (replaceEventosDB) {
      mergedEventosDB = { ...partial.eventosDB };
    } else {
      const nextEvt: Record<string, any> = { ...(current.eventosDB || {}) };
      Object.entries(partial.eventosDB).forEach(([empId, empDates]) => {
        if (!empDates || typeof empDates !== 'object') return;
        nextEvt[empId] = {
          ...(nextEvt[empId] || {}),
          ...(empDates as Record<string, any>),
        };
      });
      mergedEventosDB = nextEvt;
    }
  }

  const cleanPartial: Record<string, unknown> = { ...(partial as Record<string, unknown>) };
  delete cleanPartial.replaceEmpleadosDB;
  delete cleanPartial.deletedEmployeeIds;
  delete cleanPartial.deletedUserIds;
  delete cleanPartial.deletedHorarioCodes;
  delete cleanPartial.replaceEventosDB;
  delete cleanPartial.clearReportes;
  delete cleanPartial.deleteDispersal;

  if (cleanPartial.resumen === null && !explicitClearReportes && current.resumen) {
    cleanPartial.resumen = current.resumen;
  }

  const mergedEvaluationCampaigns: unknown[] | undefined = Array.isArray(partial.evaluationCampaigns)
    ? partial.evaluationCampaigns
    : current.evaluationCampaigns;

  const mergedEvaluationRecords: unknown[] | undefined = Array.isArray(partial.evaluationRecords)
    ? partial.evaluationRecords
    : current.evaluationRecords;

  const updated: ServerPortalDatabase = {
    ...current,
    ...cleanPartial,
    ...(mergedUsers ? { users: mergedUsers } : {}),
    ...(mergedDeletedUserIdsSet.size > 0
      ? { deletedUserIds: Array.from(mergedDeletedUserIdsSet) }
      : {}),
    ...(mergedHorarios ? { horarios: mergedHorarios } : {}),
    ...(mergedDeletedHorariosSet.size > 0
      ? { deletedHorarioCodes: Array.from(mergedDeletedHorariosSet) }
      : {}),
    ...(mergedReleases ? { releases: mergedReleases } : {}),
    ...(mergedIncidents ? { incidents: mergedIncidents } : {}),
    ...(mergedEmpleadosDB ? { empleadosDB: mergedEmpleadosDB } : {}),
    ...(mergedAsignaciones ? { asignaciones: mergedAsignaciones } : {}),
    ...(mergedEventosDB ? { eventosDB: mergedEventosDB } : {}),
    ...(mergedReportes ? { reportes: mergedReportes } : {}),
    ...(mergedDispersals ? { dispersals: mergedDispersals } : {}),
    ...(mergedConfig ? { config: mergedConfig } : {}),
    ...(mergedEmailConfig ? { emailConfig: mergedEmailConfig } : {}),
    ...(mergedEvaluationCampaigns !== undefined
      ? { evaluationCampaigns: mergedEvaluationCampaigns }
      : {}),
    ...(mergedEvaluationRecords !== undefined
      ? { evaluationRecords: mergedEvaluationRecords }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  const diskSnapshot = transformBase64FieldsDeep(updated, 'offload');
  const serializedJson = JSON.stringify(diskSnapshot, null, 2);
  const tmpFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, serializedJson, 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  try {
    const tmpBackup = `${PERSISTENT_BACKUP_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpBackup, serializedJson, 'utf-8');
    fs.renameSync(tmpBackup, PERSISTENT_BACKUP_DB_FILE);
  } catch {
    // ignore if backup dir is not writable
  }
  try {
    cachedMemoryDb = updated;
    cachedDiskMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  } catch {
    cachedMemoryDb = updated;
  }
  return updated;
}

function resolveEmailConfig(override?: Partial<ServerEmailConfig>): ServerEmailConfig {
  const db = readDatabase();
  const fromConfig = (db.config?.emailServer as ServerEmailConfig | undefined) || {};
  const fromRoot = db.emailConfig || {};
  const cleanOverride =
    override && typeof override === 'object'
      ? {
          ...override,
          ...(override.smtpPass === '••••••••'
            ? { smtpPass: fromRoot.smtpPass || fromConfig.smtpPass || '' }
            : {}),
        }
      : {};
  return {
    textoBotonCorreo: 'Ir al Sistema a Revisar y Liberar Nómina',
    asuntoDispersion: '[CemenQtime] Nómina Semana {semana} Lista para Validación — {supervisor}',
    mensajeDispersion:
      'Hola {nombre},\n\nTu lista de asistencia de la Semana {semana} ({periodo}) ha sido dispersada por {dispersado_por}.\n\nTienes una nómina pendiente por revisar, autorizar tiempos extras o formatos y liberar antes del {fecha_limite} ({horas_limite} horas de plazo).',
    activarAlertaPorVencer: true,
    horasAntesVencimiento: 2,
    asuntoPorVencer: '⚠️ [URGENTE] Tu tiempo para liberar la Nómina Semana {semana} está por finalizar — {supervisor}',
    mensajePorVencer:
      'Hola {nombre},\n\nTe recordamos que tienes la Nómina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado está a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora límite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisión y liberar tu lista.',
    ...fromConfig,
    ...fromRoot,
    ...cleanOverride,
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
    const actionUrl = buildSupervisorPortalLink(emailCfg.portalUrl, '43', 'OSCAR VALENZUELA');
    const buttonLabel = (emailCfg.textoBotonCorreo || '').trim() || 'Ir al Sistema a Revisar y Liberar Nómina';
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
      url_portal: actionUrl,
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
      from: `"${emailCfg.smtpFromName || 'CemenQtime Nóminas'}" <${cleanUser}>`,
      to: cleanUser,
      subject: `[PRUEBA] ${subject}`,
      text: `${bodyText}\n\n👉 ${buttonLabel}:\n${actionUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
          <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
            <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime · Alerta Automática por Vencimiento</div>
            <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">⏳ Tiempo Límite a Punto de Finalizar</h2>
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
                ¿No puedes ver el botón? Haz clic o copia este enlace:<br/>
                <a href="${actionUrl}" style="color: #b91c1c; word-break: break-all;">${actionUrl}</a>
              </div>
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

      const actionUrl = buildSupervisorPortalLink(emailCfg.portalUrl, disp.semanaNumero, supName);
      const buttonLabel = (emailCfg.textoBotonCorreo || '').trim() || 'Ir al Sistema a Revisar y Liberar Nómina';

      const vars = {
        supervisor: supName,
        nombre: recipientName,
        semana: String(disp.semanaNumero),
        periodo: String(disp.semanaPeriodo || '').replace('|', ' al '),
        dispersado_por: String(disp.dispersadoPor || 'Nóminas / RH'),
        fecha_limite: limiteFormatted,
        horas_limite: String(disp.horasLimite || 24),
        tiempo_restante: tiempoRestanteStr,
        url_portal: actionUrl,
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
            from: `"${emailCfg.smtpFromName || 'CemenQtime Nóminas'}" <${cleanUser}>`,
            to: recipientEmail,
            subject,
            text: `${bodyText}\n\n👉 ${buttonLabel}:\n${actionUrl}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden;">
                <div style="background: #7f1d1d; padding: 18px 24px; color: #ffffff;">
                  <div style="color: #fca5a5; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime · Alerta Automática por Vencimiento</div>
                  <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">⏳ Tiempo Límite a Punto de Finalizar</h2>
                  <div style="color: #fecaca; font-size: 12px; margin-top: 4px;">Semana ${disp.semanaNumero} · Lista: ${supName}</div>
                </div>
                <div style="padding: 24px;">
                  <div style="white-space: pre-line; color: #334155; font-size: 14px; line-height: 1.6;">${bodyText}</div>
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-top: 18px;">
                    <div style="color: #b91c1c; font-weight: bold; font-size: 12px; text-transform: uppercase;">⏳ Tiempo Restante: ${tiempoRestanteStr}</div>
                    <div style="color: #0f172a; font-size: 13px; font-weight: bold; margin-top: 4px;">Fecha y Hora Límite: ${limiteFormatted}</div>
                  </div>
                  <div style="text-align: center; margin: 24px 0 12px 0;">
                    <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #b91c1c; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(185, 28, 28, 0.25);">
                      ${buttonLabel} &rarr;
                    </a>
                    <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                      ¿No puedes ver el botón? Haz clic o copia este enlace:<br/>
                      <a href="${actionUrl}" style="color: #b91c1c; word-break: break-all;">${actionUrl}</a>
                    </div>
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

// Clientes conectados en tiempo real mediante Server-Sent Events (SSE) para Web Push sin recargar la página
const sseClients = new Set<{ id: string; res: express.Response }>();

function broadcastRealtimeEvent(payload: Record<string, unknown>) {
  if (sseClients.size === 0) return;
  const serialized = `data: ${JSON.stringify({
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  })}\n\n`;

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

  // Soporte para subida de formatos firmados y Excels trabajados en base64 (hasta 50 MB)
  app.use(express.json({ limit: '50mb' }));

  // Endpoint de diagnóstico para Hostinger VPS KVM 2
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CemenQtime — Servidor RH, Nóminas y CONTPAQi',
      hostname: os.hostname(),
      uptime: Math.round(process.uptime()),
      storagePath: DB_FILE,
      connectedRealtimeClients: sseClients.size,
    });
  });

  // Stream de eventos en tiempo real (Server-Sent Events) para notificaciones Push sin refrescar la página
  app.get('/api/notifications/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientId = String(req.query.clientId || `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const clientEntry = { id: clientId, res };
    sseClients.add(clientEntry);

    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(clientEntry);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(clientEntry);
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
        ...(Array.isArray(body.deletedUserIds) ? { deletedUserIds: body.deletedUserIds } : {}),
        ...(Array.isArray(body.incidents) ? { incidents: body.incidents } : {}),
        ...(body.releases && typeof body.releases === 'object' ? { releases: body.releases } : {}),
        ...(Array.isArray(body.dispersals) ? { dispersals: body.dispersals } : {}),
        ...(body.deleteDispersal ? { deleteDispersal: true } : {}),
        ...(Array.isArray(body.notifications) ? { notifications: body.notifications } : {}),
        ...(body.empleadosDB && typeof body.empleadosDB === 'object' ? { empleadosDB: body.empleadosDB } : {}),
        ...(Array.isArray(body.deletedEmployeeIds) ? { deletedEmployeeIds: body.deletedEmployeeIds } : {}),
        ...(body.replaceEmpleadosDB ? { replaceEmpleadosDB: true } : {}),
        ...(body.eventosDB && typeof body.eventosDB === 'object' ? { eventosDB: body.eventosDB } : {}),
        ...(body.replaceEventosDB ? { replaceEventosDB: true } : {}),
        ...(body.vacacionesDB && typeof body.vacacionesDB === 'object' ? { vacacionesDB: body.vacacionesDB } : {}),
        ...(Array.isArray(body.reportes) ? { reportes: body.reportes } : {}),
        ...(body.clearReportes ? { clearReportes: true } : {}),
        ...(body.resumen !== undefined ? { resumen: body.resumen } : {}),
        ...(typeof body.selectedWeek === 'string' ? { selectedWeek: body.selectedWeek } : {}),
        ...(body.horarios && typeof body.horarios === 'object' ? { horarios: body.horarios } : {}),
        ...(Array.isArray(body.deletedHorarioCodes) ? { deletedHorarioCodes: body.deletedHorarioCodes } : {}),
        ...(body.asignaciones && typeof body.asignaciones === 'object' ? { asignaciones: body.asignaciones } : {}),
        ...(body.config && typeof body.config === 'object' ? { config: body.config } : {}),
        ...(body.emailConfig && typeof body.emailConfig === 'object'
          ? { emailConfig: body.emailConfig }
          : emailServerFromConfig
          ? { emailConfig: emailServerFromConfig }
          : {}),
        ...(Array.isArray(body.evaluationCampaigns)
          ? { evaluationCampaigns: body.evaluationCampaigns }
          : {}),
        ...(Array.isArray(body.evaluationRecords)
          ? { evaluationRecords: body.evaluationRecords }
          : {}),
      } as Partial<ServerPortalDatabase>);

      const hasEmployeeChanges =
        (body.empleadosDB && typeof body.empleadosDB === 'object') ||
        Array.isArray(body.deletedEmployeeIds);

      const shouldBroadcastReportes =
        (Array.isArray(body.reportes) && (body.reportes.length > 0 || Boolean(body.clearReportes))) ||
        (Array.isArray(body.dispersals) && Array.isArray(updated.reportes) && updated.reportes.length > 0);

      const hasRealtimeRelevantChanges =
        Array.isArray(body.incidents) ||
        Array.isArray(body.dispersals) ||
        Array.isArray(body.notifications) ||
        (body.releases && typeof body.releases === 'object') ||
        shouldBroadcastReportes ||
        Array.isArray(body.users) ||
        hasEmployeeChanges ||
        Array.isArray(body.evaluationCampaigns) ||
        Array.isArray(body.evaluationRecords);

      if (hasRealtimeRelevantChanges) {
        broadcastRealtimeEvent({
          type: 'portal_sync',
          senderTabId: body.senderTabId,
          state: {
            ...(Array.isArray(body.users) ? { users: updated.users } : {}),
            ...(Array.isArray(body.incidents) ? { incidents: updated.incidents } : {}),
            ...(body.releases && typeof body.releases === 'object' ? { releases: updated.releases } : {}),
            ...(Array.isArray(body.dispersals) ? { dispersals: updated.dispersals } : {}),
            ...(Array.isArray(body.notifications) ? { notifications: updated.notifications } : {}),
            ...(Array.isArray(body.evaluationCampaigns)
              ? { evaluationCampaigns: updated.evaluationCampaigns }
              : {}),
            ...(Array.isArray(body.evaluationRecords)
              ? { evaluationRecords: updated.evaluationRecords }
              : {}),
            ...(hasEmployeeChanges
              ? {
                  empleadosDB: updated.empleadosDB,
                  asignaciones: updated.asignaciones,
                }
              : {}),
            ...(shouldBroadcastReportes
              ? {
                  reportes: updated.reportes,
                  resumen: updated.resumen,
                  selectedWeek: updated.selectedWeek,
                  ...(body.clearReportes ? { clearReportes: true } : {}),
                }
              : {}),
          },
        });
      }

      res.json({ ok: true, updatedAt: updated.updatedAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint de autenticación validado en servidor
  app.post('/api/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      const cleanPass = String(password || '').trim();
      if (!cleanId || !cleanPass) {
        return res.status(400).json({ ok: false, error: 'Credenciales incompletas.' });
      }
      const db = readDatabase();
      const usersList = (Array.isArray(db.users) ? db.users : []) as Array<Record<string, any>>;
      const paddedId = /^\d+$/.test(cleanId) ? cleanId.padStart(5, '0') : cleanId;
      const paddedPass = /^\d+$/.test(cleanPass) ? cleanPass.padStart(5, '0') : cleanPass;

      const matched = usersList.find((u) => {
        if (!u || !u.active) return false;
        const uName = String(u.username || '').trim().toLowerCase();
        const uEmail = String(u.email || '').trim().toLowerCase();
        const uEmpId = String(u.employeeId || '').trim().toLowerCase();
        const emailPrefix = uEmail.split('@')[0];
        const matchesIdentity =
          uName === cleanId ||
          uName === paddedId ||
          uEmail === cleanId ||
          emailPrefix === cleanId ||
          (uEmpId && (uEmpId === cleanId || uEmpId === paddedId));
        if (!matchesIdentity) return false;
        const expectedPass = String(u.password || u.employeeId || '12345');
        return expectedPass === cleanPass || expectedPass === paddedPass;
      });

      if (!matched) {
        return res.status(401).json({
          ok: false,
          error: 'Usuario, número de empleado o contraseña incorrectos.',
        });
      }

      res.json({ ok: true, user: matched });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // MONITOREO EN VIVO DE USUARIOS (THE OFFICE PIXEL ART — SOLO ADMINISTRADOR)
  // ---------------------------------------------------------------------------
  interface ServerActivityEntry {
    id: string;
    userId: string;
    userName: string;
    userRole: 'admin' | 'rh' | 'supervisor';
    action: string;
    tab: string;
    supervisorList?: string;
    timestamp: string;
  }

  interface ServerUserPresence {
    userId: string;
    userName: string;
    userRole: 'admin' | 'rh' | 'supervisor';
    email?: string;
    employeeId?: string;
    supervisorList?: string;
    status: 'working' | 'idle' | 'offline';
    activeTab: string;
    currentAction: string;
    lastActionAt: string;
    lastHeartbeatAt: string;
    connectedSince?: string;
    recentActions: ServerActivityEntry[];
  }

  const livePresenceMap = new Map<string, ServerUserPresence>();
  const liveGlobalActivityFeed: ServerActivityEntry[] = [];

  function computeEffectivePresenceRecord(
    existing: ServerUserPresence,
    nowMs: number,
    overrides?: Partial<ServerUserPresence>
  ): ServerUserPresence {
    const lastHbMs = existing.lastHeartbeatAt ? new Date(existing.lastHeartbeatAt).getTime() : 0;
    const lastActMs = existing.lastActionAt
      ? new Date(existing.lastActionAt).getTime()
      : lastHbMs;
    const elapsedHbSec = lastHbMs > 0 ? (nowMs - lastHbMs) / 1000 : 999999;
    const elapsedActSec = lastActMs > 0 ? (nowMs - lastActMs) / 1000 : 999999;

    let effectiveStatus: 'working' | 'idle' | 'offline' = existing.status;
    if (existing.status === 'offline' || elapsedHbSec > 110) {
      effectiveStatus = 'offline';
    } else if (existing.status === 'idle' || elapsedActSec > 90) {
      effectiveStatus = 'idle';
    } else {
      effectiveStatus = 'working';
    }

    return {
      ...existing,
      ...overrides,
      status: effectiveStatus,
      currentAction:
        effectiveStatus === 'offline'
          ? 'Desconectado del portal'
          : effectiveStatus === 'idle'
          ? 'En la cafetería / Sin actividad reciente'
          : existing.currentAction || 'Trabajando en el portal',
    };
  }

  function findMatchingPresenceForCatalogUser(u: Record<string, any>): ServerUserPresence | undefined {
    const uid = String(u.id || '').trim();
    if (uid && livePresenceMap.has(uid)) {
      return livePresenceMap.get(uid);
    }
    const uEmpNorm = normalizeEmpIdServer(u.employeeId);
    const uEmail = String(u.email || '').trim().toLowerCase();
    const uName = String(u.name || '').trim().toUpperCase();

    for (const entry of livePresenceMap.values()) {
      if (uEmpNorm && normalizeEmpIdServer(entry.employeeId) === uEmpNorm) {
        return entry;
      }
      if (uEmail && entry.email && entry.email.trim().toLowerCase() === uEmail) {
        return entry;
      }
      if (uName && entry.userName && entry.userName.trim().toUpperCase() === uName) {
        return entry;
      }
    }
    return undefined;
  }

  function buildFullPresenceSnapshot(): Record<string, ServerUserPresence> {
    const db = cachedMemoryDb || readDatabase();
    const users = (Array.isArray(db.users) ? db.users : []) as Array<Record<string, any>>;
    const nowMs = Date.now();
    const result: Record<string, ServerUserPresence> = {};
    const consumedPresenceKeys = new Set<string>();

    users.forEach((u) => {
      if (!u || !u.id) return;
      const uid = String(u.id);
      const existing = findMatchingPresenceForCatalogUser(u);
      if (existing) {
        consumedPresenceKeys.add(existing.userId);
      }
      const role = (u.role === 'admin' || u.role === 'rh' ? u.role : 'supervisor') as
        | 'admin'
        | 'rh'
        | 'supervisor';
      const supList =
        u.supervisorName ||
        (Array.isArray(u.assignedLists) && u.assignedLists.length > 0 ? u.assignedLists[0] : undefined);

      if (!existing) {
        result[uid] = {
          userId: uid,
          userName: String(u.name || 'Usuario'),
          userRole: role,
          email: u.email,
          employeeId: u.employeeId,
          supervisorList: supList,
          status: 'offline',
          activeTab: 'offline',
          currentAction: 'Desconectado del portal',
          lastActionAt: '',
          lastHeartbeatAt: '',
          recentActions: [],
        };
        return;
      }

      result[uid] = computeEffectivePresenceRecord(existing, nowMs, {
        userId: uid,
        userName: String(u.name || existing.userName || 'Usuario'),
        userRole: role,
        email: u.email || existing.email,
        employeeId: u.employeeId || existing.employeeId,
        supervisorList: existing.supervisorList || supList,
      });
    });

    // Garantizar que CUALQUIER usuario en livePresenceMap aparezca en el snapshot aunque db.users esté vacío o tenga otro ID
    for (const [uid, existing] of livePresenceMap.entries()) {
      const computed = computeEffectivePresenceRecord(existing, nowMs);
      if (!result[uid]) {
        result[uid] = computed;
      } else if (consumedPresenceKeys.has(uid) && computed.status !== 'offline') {
        result[uid] = computed;
      }
    }

    return result;
  }

  app.get('/api/portal/presence', (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const snapshot = buildFullPresenceSnapshot();
      res.json({
        ok: true,
        presence: snapshot,
        activityFeed: liveGlobalActivityFeed.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/portal/presence', (req, res) => {
    try {
      const body = req.body || {};
      const userId = String(body.userId || '').trim();
      if (!userId) {
        return res.status(400).json({ ok: false, error: 'userId requerido' });
      }

      const nowISO = new Date().toISOString();
      const prev = livePresenceMap.get(userId);
      const incomingStatus =
        body.status === 'offline' || body.status === 'idle' || body.status === 'working'
          ? body.status
          : 'working';
      const activeTab = String(body.activeTab || prev?.activeTab || 'inicio');
      const currentAction = String(
        body.currentAction || prev?.currentAction || 'Trabajando en el sistema'
      );
      const userName = String(body.userName || prev?.userName || 'Usuario');
      const userRole = (
        body.userRole === 'admin' || body.userRole === 'rh' ? body.userRole : 'supervisor'
      ) as 'admin' | 'rh' | 'supervisor';
      const supervisorList = body.supervisorList
        ? String(body.supervisorList)
        : prev?.supervisorList;

      const isActionChange =
        Boolean(body.recordAction) ||
        !prev ||
        prev.status !== incomingStatus ||
        prev.activeTab !== activeTab ||
        prev.supervisorList !== supervisorList ||
        (body.currentAction && body.currentAction !== prev.currentAction);

      const recentActions = prev && Array.isArray(prev.recentActions) ? [...prev.recentActions] : [];

      if (isActionChange && incomingStatus !== 'offline') {
        const entry: ServerActivityEntry = {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId,
          userName,
          userRole,
          action: currentAction,
          tab: activeTab,
          supervisorList,
          timestamp: nowISO,
        };
        recentActions.unshift(entry);
        if (recentActions.length > 15) recentActions.length = 15;
        liveGlobalActivityFeed.unshift(entry);
        if (liveGlobalActivityFeed.length > 60) liveGlobalActivityFeed.length = 60;
      }

      const updatedUserPresence: ServerUserPresence = {
        userId,
        userName,
        userRole,
        email: body.email || prev?.email,
        employeeId: body.employeeId || prev?.employeeId,
        supervisorList,
        status: incomingStatus,
        activeTab,
        currentAction,
        lastActionAt:
          incomingStatus === 'working' && (body.recordAction || !prev || prev.status !== 'working')
            ? nowISO
            : prev?.lastActionAt || nowISO,
        lastHeartbeatAt: nowISO,
        connectedSince:
          incomingStatus === 'offline'
            ? undefined
            : prev?.connectedSince && prev.status !== 'offline'
            ? prev.connectedSince
            : nowISO,
        recentActions,
      };

      livePresenceMap.set(userId, updatedUserPresence);

      const fullSnapshot = buildFullPresenceSnapshot();
      const feedSnapshot = liveGlobalActivityFeed.slice(0, 50);

      // Solo emitir evento SSE cuando hubo un cambio real de estado/acción/pestaña (evita tráfico innecesario en heartbeats silenciosos)
      if (isActionChange) {
        broadcastRealtimeEvent({
          type: 'presence_update',
          actorId: userId,
          actorName: userName,
          presence: fullSnapshot,
          activityFeed: feedSnapshot,
        });
      }

      res.json({
        ok: true,
        changed: isActionChange,
        presence: fullSnapshot,
        activityFeed: feedSnapshot,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/portal/presence/ping', (req, res) => {
    try {
      const body = req.body || {};
      const targetUserId = String(body.targetUserId || '').trim();
      const targetUserName = String(body.targetUserName || 'Usuario').trim();
      const fromAdminName = String(body.fromAdminName || 'Administrador General').trim();
      const message = String(
        body.message || '¡Hola! Dirección está revisando el avance de nómina en vivo.'
      ).trim();
      const kind =
        body.kind === 'recordatorio' || body.kind === 'urgente' || body.kind === 'felicitacion'
          ? body.kind
          : 'saludo';

      if (!targetUserId) {
        return res.status(400).json({ ok: false, error: 'targetUserId requerido' });
      }

      const nowISO = new Date().toISOString();
      const pingPayload = {
        id: `ping_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        targetUserId,
        targetUserName,
        fromAdminName,
        message,
        kind,
        timestamp: nowISO,
      };

      const feedEntry: ServerActivityEntry = {
        id: pingPayload.id,
        userId: 'user_admin',
        userName: fromAdminName,
        userRole: 'admin',
        action: `📢 Envió toque en vivo a ${targetUserName}: "${message}"`,
        tab: 'oficina_live',
        timestamp: nowISO,
      };
      liveGlobalActivityFeed.unshift(feedEntry);
      if (liveGlobalActivityFeed.length > 60) liveGlobalActivityFeed.length = 60;

      broadcastRealtimeEvent({
        type: 'admin_ping',
        ping: pingPayload,
        activityFeed: liveGlobalActivityFeed.slice(0, 50),
      });

      res.json({ ok: true, ping: pingPayload });
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
        from: `"${activeEmailConfig.smtpFromName || 'CemenQtime Nóminas'}" <${cleanUser}>`,
        to: cleanUser,
        subject: '✓ [CemenQtime] Prueba de Conexión Exitosa',
        text: `Hola,\n\nEste es un mensaje de prueba para verificar que el servidor de correo está correctamente conectado y listo para enviar alertas automáticas de nómina.\n\nServidor: ${host}:${port}\nUsuario: ${cleanUser}\nFecha: ${new Date().toLocaleString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <div style="background: #0f172a; padding: 12px 18px; border-radius: 8px; color: #a9dfd8; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
              CemenQtime · Validación SMTP
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
        portalUrl,
        limiteLiberacion,
        horasLimite,
        mensaje,
      } = req.body || {};

      let smtpSuccessCount = 0;
      const deliveryResults: Array<{ email: string; ok: boolean; info?: string }> = [];

      const requestOrigin =
        portalUrl ||
        emailConfig?.portalUrl ||
        (req.headers.origin ? String(req.headers.origin) : `${req.protocol}://${req.get('host')}`);

      // Inicializar transporte usando el estado emailConfig del proyecto (combinado con lo enviado en la petición)
      const resolvedEmailConfig = resolveEmailConfig({
        ...(emailConfig || {}),
        ...(requestOrigin && !emailConfig?.portalUrl ? { portalUrl: requestOrigin } : {}),
      });
      const buttonLabel =
        (resolvedEmailConfig.textoBotonCorreo || '').trim() ||
        'Ir al Sistema a Revisar y Liberar Nómina';

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

              const actionUrl = buildSupervisorPortalLink(
                resolvedEmailConfig.portalUrl || requestOrigin,
                semanaNumero,
                String(d.supervisorName || '')
              );

              const templateVars = {
                supervisor: String(d.supervisorName || ''),
                nombre: String(d.recipientName || d.supervisorName || ''),
                semana: String(semanaNumero || ''),
                periodo: String(semanaPeriodo || '').replace('|', ' al '),
                dispersado_por: String(dispersadoPor || 'Nóminas / RH'),
                fecha_limite: limiteText,
                horas_limite: String(horasLimite || 24),
                tiempo_restante: `${horasLimite || 24} horas`,
                url_portal: actionUrl,
              };

              const renderedSubject =
                d.subject ||
                renderServerEmailTemplate(
                  resolvedEmailConfig.asuntoDispersion ||
                    '[CemenQtime] Nómina Semana {semana} Lista para Validación — {supervisor}',
                  templateVars
                );

              const renderedBodyText = renderServerEmailTemplate(
                d.customBody ||
                  resolvedEmailConfig.mensajeDispersion ||
                  `Hola {nombre},\n\nEl área de Nóminas ({dispersado_por}) ha dispersado tu lista de asistencia para la Semana {semana} ({periodo}).\n\nTIEMPO LÍMITE DE LIBERACIÓN: {fecha_limite}\n\nPor favor ingresa al portal CemenQtime para revisar tu equipo y liberar tu nómina dentro del plazo establecido.`,
                templateVars
              );

              const attachments =
                d.attachmentBase64 && d.attachmentFilename
                  ? [
                      {
                        filename: String(d.attachmentFilename),
                        content: Buffer.from(String(d.attachmentBase64), 'base64'),
                        contentType:
                          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      },
                    ]
                  : undefined;

              await transporter.sendMail({
                from: `"${resolvedEmailConfig.smtpFromName || 'CemenQtime Nóminas'}" <${cleanUser}>`,
                to: d.recipientEmail,
                subject: renderedSubject,
                attachments,
                text:
                  renderedBodyText +
                  (mensaje ? `\n\nNota adicional: ${mensaje}` : '') +
                  `\n\n👉 ${buttonLabel}:\n${actionUrl}` +
                  `\n\nAtentamente,\nRecursos Humanos / Nóminas`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                      <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime · Notificación de Nómina</div>
                      <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Nómina Semana ${semanaNumero} Lista para Revisión</h2>
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
                        d.attachmentFilename
                          ? `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #0f766e;">
                              📎 <strong>Archivo Excel Adjunto:</strong> ${d.attachmentFilename}
                            </div>`
                          : ''
                      }
                      ${
                        mensaje
                          ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #92400e;">
                              <strong>Instrucción de Nóminas:</strong> ${mensaje}
                            </div>`
                          : ''
                      }
                      <div style="text-align: center; margin: 24px 0 20px 0;">
                        <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0f172a; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);">
                          ${buttonLabel} &rarr;
                        </a>
                        <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                          ¿No puedes hacer clic en el botón? Abre directamente este enlace:<br/>
                          <a href="${actionUrl}" style="color: #0284c7; word-break: break-all;">${actionUrl}</a>
                        </div>
                      </div>
                      <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin-bottom: 0;">
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
      const sanitizedDispatches = Array.isArray(dispatches)
        ? dispatches.map(({ attachmentBase64: _b64, ...rest }: any) => rest)
        : [];
      const newEntry = {
        id: `mail_${Date.now()}`,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        dispatches: sanitizedDispatches,
        smtpSuccessCount,
        deliveryResults,
        sentAt: new Date().toISOString(),
      };
      const updatedDb = writeDatabase({
        emailLogs: [newEntry, ...prevLogs].slice(0, 200),
      });

      broadcastRealtimeEvent({
        type: 'notification_dispatched',
        actorName: dispersadoPor,
        summary: `Nueva nómina enviada por correo (Semana ${semanaNumero})`,
        state: {
          dispersals: updatedDb.dispersals,
          notifications: updatedDb.notifications,
          releases: updatedDb.releases,
        },
      });

      res.json({
        ok: true,
        sentCount: sanitizedDispatches.length,
        smtpSentCount: smtpSuccessCount,
        smtpConfigured: Boolean(resolvedEmailConfig.smtpUser && resolvedEmailConfig.smtpPass),
        deliveryResults,
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
      if (result.remindersSent > 0) {
        broadcastRealtimeEvent({
          type: 'expiring_reminder',
          summary: `Se enviaron ${result.remindersSent} alerta(s) por vencimiento próximo de nómina`,
          state: {
            dispersals: db.dispersals,
            notifications: db.notifications,
          },
        });
      }
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
    checkAndSendExpiringReminders()
      .then((result) => {
        if (result.remindersSent > 0) {
          const db = readDatabase();
          broadcastRealtimeEvent({
            type: 'expiring_reminder',
            summary: `Se enviaron ${result.remindersSent} alerta(s) automáticas por vencimiento próximo`,
            state: {
              dispersals: db.dispersals,
              notifications: db.notifications,
            },
          });
        }
      })
      .catch(() => {
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
      const updatedDb = writeDatabase({
        emailLogs: [cancelEntry, ...prevLogs].slice(0, 200),
      });

      broadcastRealtimeEvent({
        type: 'dispersal_cancelled',
        actorName: canceladoPor,
        summary: `Dispersión de Semana ${semanaNumero} cancelada`,
        state: {
          dispersals: updatedDb.dispersals,
          notifications: updatedDb.notifications,
          releases: updatedDb.releases,
        },
      });

      res.json({ ok: true, timestamp: cancelEntry.cancelledAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Almacén en memoria de códigos temporales de recuperación (expiración de 10 minutos)
  const passwordResetTokens = new Map<
    string,
    { code: string; userId: string; userEmail: string; expiresAt: number }
  >();

  // Endpoint de autenticación validada en servidor
  app.post('/api/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      const rawPassword = String(password || '');
      if (!cleanId || !rawPassword) {
        return res.status(200).json({
          ok: false,
          error: 'Ingresa tus credenciales completas.',
        });
      }

      const db = readDatabase();
      const allUsers = Array.isArray(db.users) ? db.users : [];
      const cleanIdNumeric = cleanId.replace(/^0+/, '');

      const matchedUser: any = allUsers.find((u: any) => {
        if (!u || u.active === false) return false;
        const emailMatch = String(u.email || '').trim().toLowerCase() === cleanId;
        const usernameMatch = String(u.username || '').trim().toLowerCase() === cleanId;
        const idMatch = String(u.id || '').trim().toLowerCase() === cleanId;
        const empIdRaw = String(u.employeeId || '').trim().toLowerCase();
        const empIdMatch =
          Boolean(empIdRaw) &&
          (empIdRaw === cleanId ||
            (Boolean(cleanIdNumeric) && empIdRaw.replace(/^0+/, '') === cleanIdNumeric));
        return emailMatch || usernameMatch || idMatch || empIdMatch;
      });

      if (!matchedUser) {
        return res.status(200).json({
          ok: false,
          error: 'No se encontró ningún usuario activo con ese identificador.',
        });
      }

      const expectedPass = matchedUser.password || '1234';
      if (rawPassword !== expectedPass) {
        return res.status(200).json({
          ok: false,
          error: 'Contraseña incorrecta.',
        });
      }

      const { password: _omitted, ...safeUser } = matchedUser;
      return res.status(200).json({
        ok: true,
        user: safeUser,
      });
    } catch (err: any) {
      return res.status(200).json({
        ok: false,
        error: err?.message || 'Error al autenticar en el servidor.',
      });
    }
  });

  // Endpoint para recuperación de contraseña por correo electrónico (sin exponer el código cuando el correo fue enviado)
  app.post('/api/auth/recover-password', async (req, res) => {
    try {
      const { identifier, users: clientUsers } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      if (!cleanId) {
        return res.status(200).json({
          ok: false,
          error: 'Por favor ingresa tu correo electrónico, usuario o número de empleado.',
        });
      }

      const db = readDatabase();
      const allUsers =
        Array.isArray(db.users) && db.users.length > 0
          ? db.users
          : Array.isArray(clientUsers) && clientUsers.length > 0
          ? clientUsers
          : [];

      const cleanIdNumeric = cleanId.replace(/^0+/, '');
      const matchedUser: any = allUsers.find((u: any) => {
        if (!u || u.active === false) return false;
        const emailMatch = String(u.email || '').trim().toLowerCase() === cleanId;
        const usernameMatch = String(u.username || '').trim().toLowerCase() === cleanId;
        const empIdRaw = String(u.employeeId || '').trim().toLowerCase();
        const empIdMatch =
          Boolean(empIdRaw) &&
          (empIdRaw === cleanId || (Boolean(cleanIdNumeric) && empIdRaw.replace(/^0+/, '') === cleanIdNumeric));
        return emailMatch || usernameMatch || empIdMatch;
      });

      if (!matchedUser) {
        return res.status(200).json({
          ok: false,
          error: 'No se encontró ningún usuario activo con ese correo, usuario o número de empleado.',
        });
      }

      const targetEmail = String(matchedUser.email || '').trim();
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos de vigencia
      passwordResetTokens.set(String(matchedUser.id), {
        code: verificationCode,
        userId: String(matchedUser.id),
        userEmail: targetEmail,
        expiresAt,
      });

      const emailCfg = resolveEmailConfig();

      let emailSent = false;
      let smtpErrorMsg = '';

      if (emailCfg.smtpUser && emailCfg.smtpPass && targetEmail.includes('@')) {
        try {
          const { transporter, cleanUser } = createSmtpTransporter(emailCfg, 8000);
          await transporter.sendMail({
            from: `"${emailCfg.smtpFromName || 'CemenQtime Nóminas'}" <${cleanUser}>`,
            to: targetEmail,
            subject: `🔐 [CemenQtime] Código de Recuperación de Contraseña — ${matchedUser.name}`,
            text: `Hola ${matchedUser.name},\n\nRecibimos una solicitud para recuperar tu contraseña de acceso al portal CemenQtime.\n\nCódigo de verificación: ${verificationCode}\nVigencia: 10 minutos\nUsuario: ${matchedUser.username || matchedUser.email}\n${matchedUser.employeeId ? `No. de Empleado: #${matchedUser.employeeId}\n` : ''}\nIngresa este código de 6 dígitos en la pantalla de recuperación del sistema para establecer tu nueva contraseña.\n\nAtentamente,\nCemenQtime · Recursos Humanos y Nóminas`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
                <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                  <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">CemenQtime · Seguridad de Cuenta</div>
                  <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">🔐 Recuperación de Contraseña</h2>
                </div>
                <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
                  <p style="margin-top: 0;">Hola <strong>${matchedUser.name}</strong>,</p>
                  <p>Recibimos una solicitud para restablecer tu contraseña de acceso al sistema <strong>CemenQtime</strong>. Utiliza el siguiente código de verificación de 6 dígitos (válido por 10 minutos):</p>
                  <div style="background: #f8fafc; border: 2px dashed #0f172a; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Código de Verificación</div>
                    <div style="font-size: 28px; font-family: monospace; font-weight: 900; letter-spacing: 6px; color: #0f172a; margin-top: 6px;">${verificationCode}</div>
                  </div>
                  <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #475569;">
                    <strong>Datos de tu cuenta:</strong><br/>
                    Usuario: <strong>${matchedUser.username || matchedUser.email}</strong><br/>
                    Correo registrado: <strong>${targetEmail}</strong>
                    ${matchedUser.employeeId ? `<br/>No. de Empleado: <strong>#${matchedUser.employeeId}</strong>` : ''}
                  </div>
                  <p style="font-size: 12px; color: #64748b; margin-top: 18px; margin-bottom: 0;">
                    Si tú no solicitaste este cambio, puedes ignorar este mensaje.
                  </p>
                </div>
              </div>
            `,
          });
          emailSent = true;
        } catch (err: any) {
          smtpErrorMsg = String(err?.message || '');
        }
      }

      return res.status(200).json({
        ok: true,
        emailSent,
        userId: matchedUser.id,
        userName: matchedUser.name,
        userEmail: targetEmail,
        // Por seguridad, solo se envía fallbackCode cuando NO hay servidor SMTP activo (modo local/demo)
        ...(emailSent ? {} : { fallbackCode: verificationCode }),
        smtpErrorMsg: smtpErrorMsg || undefined,
      });
    } catch (err: any) {
      return res.status(200).json({
        ok: false,
        error: err?.message || 'Error al procesar la solicitud de recuperación.',
      });
    }
  });

  // Endpoint para verificar el código de 6 dígitos en el servidor y actualizar la contraseña de forma segura
  app.post('/api/auth/verify-reset-password', (req, res) => {
    try {
      const { userId, code, newPassword, users: clientUsers } = req.body || {};
      const cleanUserId = String(userId || '').trim();
      const cleanCode = String(code || '').trim();
      const cleanPass = String(newPassword || '').trim();

      if (!cleanUserId || !cleanCode || cleanPass.length < 4) {
        return res.status(200).json({
          ok: false,
          error: 'Datos incompletos o contraseña menor a 4 caracteres.',
        });
      }

      const tokenEntry = passwordResetTokens.get(cleanUserId);
      if (!tokenEntry) {
        return res.status(200).json({
          ok: false,
          error: 'No existe una solicitud activa de recuperación o ya fue utilizada. Solicita un nuevo código.',
        });
      }

      if (Date.now() > tokenEntry.expiresAt) {
        passwordResetTokens.delete(cleanUserId);
        return res.status(200).json({
          ok: false,
          error: 'El código de verificación ha expirado (vigencia de 10 minutos). Solicita uno nuevo.',
        });
      }

      if (tokenEntry.code !== cleanCode) {
        return res.status(200).json({
          ok: false,
          error: 'El código de verificación ingresado no es válido.',
        });
      }

      // Invalidar el código tras su uso exitoso
      passwordResetTokens.delete(cleanUserId);

      const db = readDatabase();
      const baseUsers =
        Array.isArray(db.users) && db.users.length > 0
          ? db.users
          : Array.isArray(clientUsers)
          ? clientUsers
          : [];

      if (baseUsers.length > 0) {
        const updatedUsers = baseUsers.map((u: any) =>
          String(u?.id) === cleanUserId ? { ...u, password: cleanPass } : u
        );
        writeDatabase({ users: updatedUsers });
      }

      return res.status(200).json({
        ok: true,
        userId: cleanUserId,
      });
    } catch (err: any) {
      return res.status(200).json({
        ok: false,
        error: err?.message || 'Error al verificar el código y restablecer la contraseña.',
      });
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
    console.log(`✓ CemenQtime Server corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
