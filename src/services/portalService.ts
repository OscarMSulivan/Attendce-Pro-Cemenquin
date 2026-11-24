/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DispersalEmailDispatch,
  EmailServerConfig,
  IncidentRequest,
  PayrollDispersal,
  PayrollRelease,
  PortalNotification,
  PortalUser,
  getUserAllowedLists,
} from '../types/portal';
import {
  EmployeeEvaluationRecord,
  EvaluationCampaign,
} from '../types/evaluations';
import { getDateRangeISO, normalizeEmployeeId, normalizeSupervisorName } from '../utils/calendarUtils';
import { PushNotificationService } from './pushNotificationService';

const STORAGE_KEYS = {
  USERS: 'attendancePro_portal_users_v1',
  DELETED_USERS: 'attendancePro_portal_deleted_users_v1',
  ACTIVE_USER_ID: 'attendancePro_portal_active_user_v1',
  AUTH_SESSION: 'attendancePro_portal_auth_session_v1',
  INCIDENTS: 'attendancePro_portal_incidents_v1',
  RELEASES: 'attendancePro_portal_releases_v1',
  DISPERSALS: 'attendancePro_portal_dispersals_v1',
  NOTIFICATIONS: 'attendancePro_portal_notifications_v1',
  EMAIL_CONFIG: 'attendancePro_portal_email_config_v1',
  EVALUATION_CAMPAIGNS: 'attendancePro_portal_eval_campaigns_v1',
  EVALUATION_RECORDS: 'attendancePro_portal_eval_records_v1',
};

export const DEFAULT_USERS: PortalUser[] = [
  {
    id: 'user_admin',
    name: 'Administrador General',
    username: 'admin',
    password: 'admin123',
    email: 'admin@empresa.com',
    role: 'admin',
    active: true,
    notes: 'Acceso total para crear usuarios, asignar qué listas trabajará cada supervisor y gestionar suplencias.'
  },
  {
    id: 'user_rh',
    name: 'Lic. Mariana Morales (RH / Nóminas)',
    username: 'rh',
    password: 'rh123',
    email: 'rh@empresa.com',
    role: 'rh',
    active: true,
    notes: 'Gestión global de checadas, dispersión semanal, autorización de incidencias y exportación a CONTPAQi.'
  },
  {
    id: 'user_sup_oscar',
    name: 'Óscar Valenzuela (Supervisor)',
    username: '00615',
    password: '00615',
    email: 'oscar.valenzuela@empresa.com',
    role: 'supervisor',
    employeeId: '00615',
    supervisorName: 'OSCAR VALENZUELA',
    assignedLists: ['OSCAR VALENZUELA'],
    active: true,
    notes: 'Supervisor de Área / Producción.'
  },
  {
    id: 'user_sup_eudis',
    name: 'Eudis Zenon (Supervisor)',
    username: '00053',
    password: '00053',
    email: 'eudis.zenon@empresa.com',
    role: 'supervisor',
    employeeId: '00053',
    supervisorName: 'EUDIS ZENON',
    assignedLists: ['EUDIS ZENON'],
    active: true,
    notes: 'Supervisor Operativo.'
  }
];

export const DEFAULT_INCIDENTS: IncidentRequest[] = [
  {
    id: 'inc_demo_1',
    solicitanteId: 'user_sup_oscar',
    solicitanteNombre: 'Óscar Valenzuela',
    solicitanteRol: 'supervisor',
    esParaMi: false,
    empleadoId: '00979',
    empleadoNombre: 'Empleado 00979',
    supervisorNombre: 'OSCAR VALENZUELA',
    tipo: 'Vacaciones',
    fechaInicio: '2026-10-16',
    fechaFin: '2026-10-18',
    motivo: 'Vacaciones anuales programadas con anticipación',
    status: 'aprobada',
    fechaCreacion: '2026-10-10T10:00:00Z',
    revisadoPor: 'Lic. Mariana Morales (RH)',
    fechaRevision: '2026-10-11T12:30:00Z',
    notasResolucion: 'Aprobado conforme a días disponibles en kardex.'
  },
  {
    id: 'inc_demo_2',
    solicitanteId: 'user_sup_oscar',
    solicitanteNombre: 'Óscar Valenzuela',
    solicitanteRol: 'supervisor',
    esParaMi: false,
    empleadoId: '01091',
    empleadoNombre: 'Empleado 01091',
    supervisorNombre: 'OSCAR VALENZUELA',
    tipo: 'Pase Médico',
    fechaInicio: '2026-10-19',
    fechaFin: '2026-10-19',
    motivo: 'Cita en clínica IMSS de 10:00 a 14:00 hrs',
    status: 'pendiente',
    fechaCreacion: '2026-10-18T08:00:00Z'
  },
  {
    id: 'inc_demo_3',
    solicitanteId: 'user_sup_eudis',
    solicitanteNombre: 'Eudis Zenon',
    solicitanteRol: 'supervisor',
    esParaMi: false,
    empleadoId: '00053',
    empleadoNombre: 'SILVA CONTRERAS JOSE',
    supervisorNombre: 'EUDIS ZENON',
    tipo: 'Permiso con goce',
    fechaInicio: '2026-10-16',
    fechaFin: '2026-10-16',
    motivo: 'Permiso especial por trámite oficial vehicular',
    status: 'pendiente',
    fechaCreacion: '2026-10-15T09:00:00Z'
  }
];

export class PortalService {
  private static memoryDispersals: PayrollDispersal[] | null = null;
  private static memoryReleases: Record<string, PayrollRelease> | null = null;
  private static memoryNotifications: PortalNotification[] | null = null;

  /**
   * Guarda de forma segura en localStorage sin lanzar excepciones QuotaExceededError
   * que interrumpan el renderizado de React o bloqueen el envío al servidor.
   */
  private static safeSetLocalStorage(
    key: string,
    value: unknown,
    compactFallback?: () => unknown,
    ultraCompactFallback?: () => unknown
  ): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    } catch {
      if (compactFallback) {
        try {
          localStorage.setItem(key, JSON.stringify(compactFallback()));
          return;
        } catch {
          // try ultra-compact fallback next
        }
      }
      if (ultraCompactFallback) {
        try {
          localStorage.setItem(key, JSON.stringify(ultraCompactFallback()));
          return;
        } catch {
          // ignore tertiary quota error
        }
      }
      console.warn(`[PortalService] Quota de localStorage alcanzada al guardar ${key}; manteniendo en memoria y servidor.`);
    }
  }

  private static compactDispersalsForLocalStorage(dispersals: PayrollDispersal[]): PayrollDispersal[] {
    return dispersals.map((d, idx) => ({
      ...d,
      // Conservar snapshot compacto solo en la dispersión más reciente para no saturar los 5MB de localStorage
      reportesSnapshot:
        idx === 0 && Array.isArray(d.reportesSnapshot)
          ? d.reportesSnapshot.map((rep: any) => ({
              ...rep,
              dias: Array.isArray(rep.dias)
                ? rep.dias.map((day: any) => ({
                    ...day,
                    registrosCrudosDia: undefined,
                    formatoSubidoBase64: undefined,
                  }))
                : rep.dias,
            }))
          : undefined,
    }));
  }

  private static metadataOnlyDispersalsForLocalStorage(dispersals: PayrollDispersal[]): PayrollDispersal[] {
    return dispersals.map(d => ({
      ...d,
      reportesSnapshot: undefined,
    }));
  }

  private static compactIncidentsForLocalStorage(incidents: IncidentRequest[]): IncidentRequest[] {
    return incidents.map(inc => ({
      ...inc,
      archivoFormatoBase64: undefined,
    }));
  }

  /**
   * Actualiza la caché en memoria y localStorage sin disparar pushToServer (útil al recibir SSE o hidratar del servidor).
   */
  static cacheDispersals(dispersals: PayrollDispersal[]): void {
    const normalized = dispersals
      .filter((d: PayrollDispersal) => d && d.id !== 'disp_semana_43')
      .map((d: PayrollDispersal) => {
        const existingInMem = this.memoryDispersals?.find(
          m => m.semanaNumero === d.semanaNumero || m.id === d.id
        );
        return {
          ...d,
          supervisoresNotificados: Array.isArray(d.supervisoresNotificados)
            ? d.supervisoresNotificados.map(s => normalizeSupervisorName(s))
            : [],
          reportesSnapshot:
            Array.isArray(d.reportesSnapshot) && d.reportesSnapshot.length > 0
              ? d.reportesSnapshot
              : existingInMem?.reportesSnapshot,
        };
      });
    this.memoryDispersals = normalized;
    this.safeSetLocalStorage(
      STORAGE_KEYS.DISPERSALS,
      normalized,
      () => this.compactDispersalsForLocalStorage(normalized),
      () => this.metadataOnlyDispersalsForLocalStorage(normalized)
    );
  }

  static cacheReleases(releases: Record<string, PayrollRelease>): void {
    this.memoryReleases = releases;
    this.safeSetLocalStorage(STORAGE_KEYS.RELEASES, releases);
  }

  static cacheNotifications(notifications: PortalNotification[]): void {
    this.memoryNotifications = notifications;
    this.safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }

  /**
   * Sincroniza datos con el servidor Express (/api/portal/sync) cuando está disponible
   * y transmite cambios en tiempo real entre pestañas y sesiones conectadas.
   */
  static pushToServer(payload: Record<string, unknown>): void {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return;
    const senderTabId = PushNotificationService.getClientTabId();
    PushNotificationService.broadcastLocalEvent({
      type: 'portal_sync',
      timestamp: new Date().toISOString(),
      state: {
        users: payload.users as PortalUser[] | undefined,
        incidents: payload.incidents as IncidentRequest[] | undefined,
        releases: payload.releases as Record<string, PayrollRelease> | undefined,
        dispersals: payload.dispersals as PayrollDispersal[] | undefined,
        notifications: payload.notifications as PortalNotification[] | undefined,
        reportes: payload.reportes as any[] | undefined,
        resumen: payload.resumen,
        selectedWeek: payload.selectedWeek as string | undefined,
        evaluationCampaigns: payload.evaluationCampaigns as EvaluationCampaign[] | undefined,
        evaluationRecords: payload.evaluationRecords as EmployeeEvaluationRecord[] | undefined,
      },
    });
    fetch('/api/portal/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, senderTabId }),
    }).catch(() => {
      // Modo offline / localStorage fallback silencioso
    });
  }

  static loadDeletedUserIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USERS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((id: unknown) => String(id || '').trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  static saveDeletedUserIds(ids: string[]): void {
    const unique = Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)));
    this.safeSetLocalStorage(STORAGE_KEYS.DELETED_USERS, unique);
  }

  /**
   * Fusiona acumulativamente los usuarios locales y del servidor por ID (igual que horarios y empleadosDB),
   * respetando las bajas explícitas (deletedUserIds) para que un push o reinicio de contenedor nunca borre usuarios.
   */
  static mergeUsersCatalog(
    localUsers: PortalUser[],
    serverUsers?: PortalUser[],
    serverDeletedIds?: string[]
  ): { mergedUsers: PortalUser[]; mergedDeletedIds: string[]; needsServerSync: boolean } {
    const localDeleted = this.loadDeletedUserIds();
    const deletedSet = new Set<string>([
      ...localDeleted,
      ...(Array.isArray(serverDeletedIds) ? serverDeletedIds : []),
    ]);

    const userMap = new Map<string, PortalUser>();
    DEFAULT_USERS.forEach(u => {
      if (!deletedSet.has(u.id)) {
        userMap.set(u.id, this.normalizeUserRecord(u));
      }
    });

    // 1. Usuarios guardados localmente en el navegador
    localUsers.forEach(u => {
      if (!u || !u.id || deletedSet.has(u.id)) return;
      userMap.set(u.id, this.normalizeUserRecord(u));
    });

    const srvList = Array.isArray(serverUsers) ? serverUsers : [];
    const defaultIds = new Set(['user_admin', 'user_rh', 'user_sup_oscar', 'user_sup_eudis']);
    const isServerOnlyDefaultSeed =
      srvList.length <= 4 &&
      srvList.every(u => defaultIds.has(String(u?.id || ''))) &&
      userMap.size > srvList.length;

    // 2. Usuarios del servidor (sin pisar usuarios personalizados locales si el servidor recién reinició con los 4 por defecto)
    srvList.forEach(u => {
      if (!u || !u.id || deletedSet.has(u.id)) return;
      const normSrv = this.normalizeUserRecord(u);
      const existingLocal = userMap.get(normSrv.id);
      if (existingLocal && isServerOnlyDefaultSeed) {
        return;
      }
      userMap.set(normSrv.id, existingLocal ? { ...existingLocal, ...normSrv } : normSrv);
    });

    const mergedUsers = Array.from(userMap.values());
    const mergedDeletedIds = Array.from(deletedSet);

    const serverIds = new Set(srvList.map(u => u?.id).filter(Boolean));
    const needsServerSync =
      mergedUsers.length > srvList.length ||
      mergedUsers.some(u => !serverIds.has(u.id));

    return {
      mergedUsers,
      mergedDeletedIds,
      needsServerSync,
    };
  }

  /**
   * Obtiene el estado centralizado desde el servidor Express (/api/portal/state)
   * fusionando usuarios, liberaciones, dispersiones e incidencias con localStorage para nunca perder datos tras un push.
   */
  static async fetchServerState(): Promise<{
    users?: PortalUser[];
    deletedUserIds?: string[];
    incidents?: IncidentRequest[];
    releases?: Record<string, PayrollRelease>;
    dispersals?: PayrollDispersal[];
    notifications?: PortalNotification[];
    empleadosDB?: Record<string, any>;
    eventosDB?: Record<string, any>;
    vacacionesDB?: Record<string, any>;
    reportes?: any[];
    resumen?: any;
    selectedWeek?: string;
    horarios?: Record<string, any>;
    asignaciones?: Record<string, string>;
    config?: Record<string, any>;
    evaluationCampaigns?: EvaluationCampaign[];
    evaluationRecords?: EmployeeEvaluationRecord[];
    serverInfo?: { hostname: string; uptime: number; storagePath: string };
  } | null> {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return null;
    try {
      const res = await fetch('/api/portal/state');
      if (!res.ok) return null;
      const data = await res.json();

      // 1. Fusión acumulativa de Usuarios (igual que horarios: local + servidor respetando deletedUserIds)
      const localUsers = this.loadUsers();
      const { mergedUsers, mergedDeletedIds, needsServerSync: usersNeedSync } = this.mergeUsersCatalog(
        localUsers,
        Array.isArray(data.users) ? data.users : undefined,
        Array.isArray(data.deletedUserIds) ? data.deletedUserIds : undefined
      );
      this.saveDeletedUserIds(mergedDeletedIds);
      this.safeSetLocalStorage(STORAGE_KEYS.USERS, mergedUsers);
      data.users = mergedUsers;

      // 2. Fusión acumulativa de Incidencias por ID
      const localIncidents = this.loadIncidents();
      const srvIncidents: IncidentRequest[] = Array.isArray(data.incidents) ? data.incidents : [];
      const incMap = new Map<string, IncidentRequest>();
      localIncidents.forEach(inc => {
        if (inc?.id) incMap.set(inc.id, inc);
      });
      srvIncidents.forEach(inc => {
        if (inc?.id) incMap.set(inc.id, inc);
      });
      const mergedIncidents = Array.from(incMap.values());
      this.safeSetLocalStorage(STORAGE_KEYS.INCIDENTS, mergedIncidents, () =>
        this.compactIncidentsForLocalStorage(mergedIncidents)
      );
      data.incidents = mergedIncidents;

      // 3. Fusión acumulativa de Liberaciones
      const localReleases = this.loadReleases();
      const srvReleases: Record<string, PayrollRelease> =
        data.releases && typeof data.releases === 'object' ? data.releases : {};
      const mergedReleases = { ...localReleases, ...srvReleases };
      this.cacheReleases(mergedReleases);
      data.releases = mergedReleases;

      // 4. Fusión acumulativa de Dispersiones por semanaNumero
      const localDispersals = this.loadDispersals();
      const srvDispersals: PayrollDispersal[] = Array.isArray(data.dispersals) ? data.dispersals : [];
      const dispMap = new Map<number, PayrollDispersal>();
      localDispersals.forEach(d => {
        if (d?.semanaNumero) dispMap.set(d.semanaNumero, d);
      });
      srvDispersals.forEach(d => {
        if (!d?.semanaNumero) return;
        const loc = dispMap.get(d.semanaNumero);
        dispMap.set(d.semanaNumero, {
          ...(loc || {}),
          ...d,
          reportesSnapshot:
            Array.isArray(d.reportesSnapshot) && d.reportesSnapshot.length > 0
              ? d.reportesSnapshot
              : loc?.reportesSnapshot,
        });
      });
      const mergedDispersals = Array.from(dispMap.values());
      this.cacheDispersals(mergedDispersals);
      data.dispersals = mergedDispersals;

      // 5. Notificaciones
      if (data.notifications && Array.isArray(data.notifications) && data.notifications.length > 0) {
        this.cacheNotifications(data.notifications);
      }

      // 6. Evaluaciones Anuales (campañas y registros)
      const localEvalCampaigns = this.getEvaluationCampaigns();
      const srvEvalCampaigns: EvaluationCampaign[] | null = Array.isArray(data.evaluationCampaigns)
        ? data.evaluationCampaigns
        : null;
      let resolvedEvalCampaigns: EvaluationCampaign[] | undefined;
      let evalCampaignsNeedSync = false;
      if (srvEvalCampaigns && srvEvalCampaigns.length > 0) {
        this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_CAMPAIGNS, srvEvalCampaigns);
        resolvedEvalCampaigns = srvEvalCampaigns;
      } else if (localEvalCampaigns.length > 0) {
        resolvedEvalCampaigns = localEvalCampaigns;
        evalCampaignsNeedSync = true;
      } else if (srvEvalCampaigns) {
        this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_CAMPAIGNS, srvEvalCampaigns);
        resolvedEvalCampaigns = srvEvalCampaigns;
      }
      if (resolvedEvalCampaigns !== undefined) {
        data.evaluationCampaigns = resolvedEvalCampaigns;
      }

      const localEvalRecords = this.getEvaluationRecords();
      const srvEvalRecords: EmployeeEvaluationRecord[] | null = Array.isArray(data.evaluationRecords)
        ? data.evaluationRecords
        : null;
      let resolvedEvalRecords: EmployeeEvaluationRecord[] | undefined;
      let evalRecordsNeedSync = false;
      if (srvEvalRecords && srvEvalRecords.length > 0) {
        this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_RECORDS, srvEvalRecords);
        resolvedEvalRecords = srvEvalRecords;
      } else if (localEvalRecords.length > 0) {
        resolvedEvalRecords = localEvalRecords;
        evalRecordsNeedSync = true;
      } else if (srvEvalRecords) {
        this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_RECORDS, srvEvalRecords);
        resolvedEvalRecords = srvEvalRecords;
      }
      if (resolvedEvalRecords !== undefined) {
        data.evaluationRecords = resolvedEvalRecords;
      }

      // Si el servidor tenía menos usuarios, dispersiones o evaluaciones que el almacenamiento local (ej. tras un push / redeploy),
      // sincronizar inmediatamente al servidor los registros rescatados
      if (
        usersNeedSync ||
        mergedDispersals.length > srvDispersals.length ||
        Object.keys(mergedReleases).length > Object.keys(srvReleases).length ||
        evalCampaignsNeedSync ||
        evalRecordsNeedSync
      ) {
        this.pushToServer({
          users: mergedUsers,
          ...(mergedDeletedIds.length > 0 ? { deletedUserIds: mergedDeletedIds } : {}),
          ...(mergedDispersals.length > srvDispersals.length ? { dispersals: mergedDispersals } : {}),
          ...(Object.keys(mergedReleases).length > Object.keys(srvReleases).length
            ? { releases: mergedReleases }
            : {}),
          ...(evalCampaignsNeedSync && resolvedEvalCampaigns
            ? { evaluationCampaigns: resolvedEvalCampaigns }
            : {}),
          ...(evalRecordsNeedSync && resolvedEvalRecords
            ? { evaluationRecords: resolvedEvalRecords }
            : {}),
        });
      }

      const serverEmailCfg = data.emailConfig || data.config?.emailServer;
      if (serverEmailCfg && typeof serverEmailCfg === 'object') {
        const localCurrent = this.loadEmailConfig();
        const localTime = localCurrent.updatedAt ? new Date(localCurrent.updatedAt).getTime() : 0;
        const serverTime = serverEmailCfg.updatedAt ? new Date(serverEmailCfg.updatedAt).getTime() : 0;
        if (!localTime || (serverTime && serverTime >= localTime)) {
          const merged = { ...localCurrent, ...serverEmailCfg };
          this.safeSetLocalStorage(STORAGE_KEYS.EMAIL_CONFIG, merged);
        }
      }
      return data;
    } catch {
      return null;
    }
  }

  static normalizeUserRecord(u: PortalUser): PortalUser {
    let updatedUser = { ...u };
    if (updatedUser.id === 'user_sup_oscar') {
      updatedUser.employeeId = '00615';
      if (!updatedUser.username) updatedUser.username = '00615';
      if (!updatedUser.password) updatedUser.password = '00615';
    }
    const isOmar =
      updatedUser.id === 'user_sup_omar' ||
      (updatedUser.name && updatedUser.name.toUpperCase().includes('OMAR')) ||
      (updatedUser.supervisorName && updatedUser.supervisorName.toUpperCase().includes('OMAR'));
    if (isOmar) {
      updatedUser = {
        ...updatedUser,
        id: 'user_sup_eudis',
        name: 'Eudis Zenon (Supervisor)',
        username: '00053',
        password: updatedUser.password || '00053',
        email: 'eudis.zenon@empresa.com',
        employeeId: '00053',
        supervisorName: 'EUDIS ZENON',
        assignedLists: ['EUDIS ZENON'],
      };
    }

    // Completar username y password por defecto para usuarios preexistentes
    if (!updatedUser.username) {
      if (updatedUser.id === 'user_admin') updatedUser.username = 'admin';
      else if (updatedUser.id === 'user_rh') updatedUser.username = 'rh';
      else if (updatedUser.employeeId) updatedUser.username = normalizeEmployeeId(updatedUser.employeeId);
      else updatedUser.username = updatedUser.email.split('@')[0];
    }
    if (!updatedUser.password) {
      if (updatedUser.id === 'user_admin') updatedUser.password = 'admin123';
      else if (updatedUser.id === 'user_rh') updatedUser.password = 'rh123';
      else if (updatedUser.employeeId) updatedUser.password = normalizeEmployeeId(updatedUser.employeeId);
      else updatedUser.password = '12345';
    }

    if (updatedUser.supervisorName) {
      updatedUser.supervisorName = normalizeSupervisorName(updatedUser.supervisorName);
    }
    if (updatedUser.delegatedSupervisor) {
      updatedUser.delegatedSupervisor = normalizeSupervisorName(updatedUser.delegatedSupervisor);
    }
    if (updatedUser.employeeId) {
      updatedUser.employeeId = normalizeEmployeeId(updatedUser.employeeId);
    }

    // Asegurar que assignedLists esté sincronizado con supervisorName
    const listsSet = new Set<string>();
    if (updatedUser.supervisorName) {
      listsSet.add(updatedUser.supervisorName);
    }
    if (Array.isArray(updatedUser.assignedLists)) {
      updatedUser.assignedLists.forEach(item => {
        if (item && item.trim()) {
          listsSet.add(normalizeSupervisorName(item.trim()));
        }
      });
    }
    updatedUser.assignedLists = Array.from(listsSet);
    if (!updatedUser.supervisorName && updatedUser.assignedLists.length > 0) {
      updatedUser.supervisorName = updatedUser.assignedLists[0];
    }

    return updatedUser;
  }

  static loadUsers(): PortalUser[] {
    try {
      const deletedSet = new Set(this.loadDeletedUserIds());
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((u: PortalUser) => u && u.id && !deletedSet.has(u.id))
            .map((u: PortalUser) => this.normalizeUserRecord(u));
        }
      }
    } catch (e) {
      console.warn('Error loading users', e);
    }
    return DEFAULT_USERS;
  }

  static saveUsers(users: PortalUser[], deletedUserIds?: string[]): void {
    const normalized = users.map(u => this.normalizeUserRecord(u));
    if (Array.isArray(deletedUserIds) && deletedUserIds.length > 0) {
      const currentDeleted = this.loadDeletedUserIds();
      const updatedDeleted = Array.from(new Set([...currentDeleted, ...deletedUserIds]));
      this.saveDeletedUserIds(updatedDeleted);
      this.safeSetLocalStorage(STORAGE_KEYS.USERS, normalized);
      this.pushToServer({ users: normalized, deletedUserIds: updatedDeleted });
      return;
    }
    // Si se guarda un usuario cuyo ID estaba previamente en deletedUserIds, quitarlo de la lista de eliminados
    const savedIds = new Set(normalized.map(u => u.id));
    const remainingDeleted = this.loadDeletedUserIds().filter(id => !savedIds.has(id));
    this.saveDeletedUserIds(remainingDeleted);
    this.safeSetLocalStorage(STORAGE_KEYS.USERS, normalized);
    this.pushToServer({
      users: normalized,
      ...(remainingDeleted.length > 0 ? { deletedUserIds: remainingDeleted } : {}),
    });
  }

  /**
   * Valida las credenciales de login (acepta usuario, ID de empleado como 615 o 00615, o correo electrónico)
   */
  static authenticateUser(
    users: PortalUser[],
    identifier: string,
    passwordInput: string
  ): PortalUser | null {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = passwordInput.trim();
    if (!cleanId || !cleanPass) return null;

    // Si ingresó un número (ej. "615"), obtener también versión de 5 dígitos ("00615")
    const paddedId = /^\d+$/.test(cleanId) ? cleanId.padStart(5, '0') : cleanId;

    const matchedUser = users.find(u => {
      if (!u.active) return false;
      const uName = (u.username || '').trim().toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      const uEmpId = (u.employeeId || '').trim().toLowerCase();
      const emailPrefix = uEmail.split('@')[0];

      const matchesIdentity =
        uName === cleanId ||
        uName === paddedId ||
        uEmail === cleanId ||
        emailPrefix === cleanId ||
        (uEmpId && (uEmpId === cleanId || uEmpId === paddedId));

      if (!matchesIdentity) return false;

      const expectedPass = u.password || u.employeeId || '12345';
      const paddedPass = /^\d+$/.test(cleanPass) ? cleanPass.padStart(5, '0') : cleanPass;
      return expectedPass === cleanPass || expectedPass === paddedPass;
    });

    return matchedUser || null;
  }

  static isSessionAuthenticated(): boolean {
    try {
      const tabSession = sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (tabSession === 'true') return true;
      if (tabSession === 'false') return false;
      const globalSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) === 'true';
      if (globalSession) {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
      }
      return globalSession;
    } catch {
      return false;
    }
  }

  static setSessionAuthenticated(isAuth: boolean, userId?: string): void {
    try {
      if (isAuth) {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
        localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
        if (userId) {
          this.saveActiveUserId(userId);
        }
      } else {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'false');
        sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      }
    } catch (e) {
      console.warn('Error saving auth session', e);
    }
  }

  static loadActiveUserId(): string {
    try {
      const tabUserId = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
      if (tabUserId) {
        return tabUserId === 'user_sup_omar' ? 'user_sup_eudis' : tabUserId;
      }
      const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || 'user_admin';
      const resolved = id === 'user_sup_omar' ? 'user_sup_eudis' : id;
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, resolved);
      return resolved;
    } catch {
      return 'user_admin';
    }
  }

  static saveActiveUserId(userId: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
    } catch {
      // ignore
    }
  }

  static loadIncidents(): IncidentRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map((inc: IncidentRequest) => {
            const isOmarSolicitante =
              inc.solicitanteId === 'user_sup_omar' ||
              (inc.solicitanteNombre && inc.solicitanteNombre.toUpperCase().includes('OMAR'));
            return {
              ...inc,
              solicitanteId: isOmarSolicitante ? 'user_sup_eudis' : inc.solicitanteId,
              solicitanteNombre: isOmarSolicitante ? 'Eudis Zenon' : inc.solicitanteNombre,
              supervisorNombre: normalizeSupervisorName(inc.supervisorNombre) || inc.supervisorNombre,
              empleadoId: normalizeEmployeeId(inc.empleadoId) || inc.empleadoId
            };
          });
        }
      }
    } catch (e) {
      console.warn('Error loading incidents', e);
    }
    return DEFAULT_INCIDENTS;
  }

  static saveIncidents(incidents: IncidentRequest[]): void {
    this.safeSetLocalStorage(STORAGE_KEYS.INCIDENTS, incidents, () =>
      this.compactIncidentsForLocalStorage(incidents)
    );
    this.pushToServer({ incidents });
  }

  static loadReleases(): Record<string, PayrollRelease> {
    if (this.memoryReleases !== null) {
      return this.memoryReleases;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RELEASES);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          const normalized: Record<string, PayrollRelease> = {};
          Object.entries(parsed as Record<string, PayrollRelease>).forEach(([, rel]) => {
            const supName = normalizeSupervisorName(rel.supervisorNombre);
            const newKey = `${rel.semanaNumero}_${supName}`;
            normalized[newKey] = {
              ...rel,
              id: newKey,
              supervisorNombre: supName
            };
          });
          this.memoryReleases = normalized;
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Error loading releases', e);
    }
    this.memoryReleases = {};
    return {};
  }

  static saveReleases(releases: Record<string, PayrollRelease>): void {
    this.cacheReleases(releases);
    this.pushToServer({ releases });
  }

  static loadDispersals(): PayrollDispersal[] {
    if (this.memoryDispersals !== null) {
      return this.memoryDispersals;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DISPERSALS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .filter((d: PayrollDispersal) => d && d.id !== 'disp_semana_43')
            .map((d: PayrollDispersal) => ({
              ...d,
              supervisoresNotificados: Array.isArray(d.supervisoresNotificados)
                ? d.supervisoresNotificados.map(s => normalizeSupervisorName(s))
                : []
            }));
          this.memoryDispersals = normalized;
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Error loading dispersals', e);
    }
    this.memoryDispersals = [];
    return [];
  }

  static saveDispersals(dispersals: PayrollDispersal[], extraServerPayload?: Record<string, unknown>): void {
    this.cacheDispersals(dispersals);
    this.pushToServer({ dispersals: this.memoryDispersals || dispersals, ...(extraServerPayload || {}) });
  }

  static loadNotifications(): PortalNotification[] {
    if (this.memoryNotifications !== null) {
      return this.memoryNotifications;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.memoryNotifications = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading notifications', e);
    }
    this.memoryNotifications = [];
    return [];
  }

  static saveNotifications(notifications: PortalNotification[]): void {
    this.cacheNotifications(notifications);
    this.pushToServer({ notifications });
  }

  static loadEmailConfig(): EmailServerConfig {
    const defaults: EmailServerConfig = {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'nominas@empresa.com',
      smtpPass: '',
      smtpSecure: false,
      smtpFromName: 'CemenQtime Nóminas',
      portalUrl: '',
      textoBotonCorreo: 'Ir al Sistema a Revisar y Liberar Nómina',
      asuntoDispersion: '[CemenQtime] Nómina Semana {semana} Lista para Validación — {supervisor}',
      mensajeDispersion:
        'Hola {nombre},\n\nTu lista de asistencia de la Semana {semana} ({periodo}) ha sido dispersada por {dispersado_por}.\n\nTienes una nómina pendiente por revisar, autorizar tiempos extras o formatos y liberar antes del {fecha_limite} ({horas_limite} horas de plazo).',
      activarAlertaPorVencer: true,
      horasAntesVencimiento: 2,
      asuntoPorVencer: '⚠️ [URGENTE] Tu tiempo para liberar la Nómina Semana {semana} está por finalizar — {supervisor}',
      mensajePorVencer:
        'Hola {nombre},\n\nTe recordamos que tienes la Nómina de la Semana {semana} ({periodo}) pendiente de liberar y el tiempo asignado está a punto de finalizar (restan aprox. {tiempo_restante}).\n\nFecha y hora límite: {fecha_limite}.\nPor favor ingresa de inmediato al portal para concluir la revisión y liberar tu lista.',
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaults;
  }

  static saveEmailConfig(cfg: EmailServerConfig): void {
    const payloadWithTimestamp: EmailServerConfig = {
      ...this.loadEmailConfig(),
      ...cfg,
      updatedAt: cfg.updatedAt || new Date().toISOString(),
    };
    console.log('[PortalService.saveEmailConfig] Persisting emailConfig payload before server sync:', payloadWithTimestamp);
    this.safeSetLocalStorage(STORAGE_KEYS.EMAIL_CONFIG, payloadWithTimestamp);
    this.pushToServer({
      emailConfig: payloadWithTimestamp,
      config: { emailServer: payloadWithTimestamp },
    });
  }

  /**
   * Registra la dispersión de una o varias listas de nómina (soporta Dispersión Lista por Lista o Dispersar Todas),
   * y genera automáticamente notificaciones tanto en el Sistema como al Correo Electrónico Empresarial del supervisor
   * usando la plantilla personalizada configurada por el administrador.
   */
  static recordDispersal(
    semanaNumero: number,
    semanaPeriodo: string,
    dispersadoPor: string,
    targetSupervisors: string[],
    mensaje?: string,
    users?: PortalUser[],
    sendCorporateEmail = true,
    horasLimite?: number,
    limiteLiberacion?: string,
    snapshotMeta?: {
      empleadosCount?: number;
      totalHorasNormales?: number;
      totalHorasExtras?: number;
      reportesSnapshot?: any[];
    }
  ): {
    dispersal: PayrollDispersal;
    newNotifications: PortalNotification[];
    emailDispatches: DispersalEmailDispatch[];
  } {
    const allUsers = users && users.length > 0 ? users : this.loadUsers();
    const dispersals = this.loadDispersals();
    const existingIndex = dispersals.findIndex(d => d.semanaNumero === semanaNumero);
    const existingDispersal = existingIndex >= 0 ? dispersals[existingIndex] : null;
    const emailCfg = this.loadEmailConfig();

    const normalizedTargets = targetSupervisors.map(s => normalizeSupervisorName(s).toUpperCase());

    // Combinar listas previamente dispersadas en esta misma semana con las nuevas listas dispersadas
    const mergedSupervisors = Array.from(
      new Set([
        ...(existingDispersal?.supervisoresNotificados || []).map(s => s.toUpperCase()),
        ...normalizedTargets,
      ])
    );

    const effectiveHorasLimite =
      horasLimite !== undefined ? horasLimite : existingDispersal?.horasLimite;

    const effectiveLimiteLiberacion =
      limiteLiberacion ||
      (effectiveHorasLimite && effectiveHorasLimite > 0
        ? new Date(Date.now() + effectiveHorasLimite * 3600000).toISOString()
        : existingDispersal?.limiteLiberacion);

    const limiteFormatted = effectiveLimiteLiberacion
      ? new Date(effectiveLimiteLiberacion).toLocaleString('es-MX', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : effectiveHorasLimite
      ? `${effectiveHorasLimite} horas`
      : 'A la brevedad';

    const periodoClean = semanaPeriodo.replace('|', ' al ');
    const nowISO = new Date().toISOString();

    const renderTemplate = (tpl: string, vars: Record<string, string>) => {
      let out = tpl || '';
      Object.entries(vars).forEach(([k, v]) => {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), v ?? '');
      });
      return out;
    };

    const customMsg =
      mensaje && mensaje.trim()
        ? mensaje.trim()
        : renderTemplate(
            emailCfg.mensajeDispersion ||
              'Tu lista de asistencia de la Semana {semana} ({periodo}) ha sido dispersada por {dispersado_por}. Ingresa al portal para revisarla y liberarla antes del {fecha_limite}.',
            {
              supervisor: normalizedTargets.length === 1 ? normalizedTargets[0] : 'SUPERVISORES',
              nombre: normalizedTargets.length === 1 ? normalizedTargets[0] : 'Supervisor',
              semana: String(semanaNumero),
              periodo: periodoClean,
              dispersado_por: dispersadoPor,
              fecha_limite: limiteFormatted,
              horas_limite: String(effectiveHorasLimite || 24),
              tiempo_restante: `${effectiveHorasLimite || 24} hrs`,
            }
          );

    const newNotifications: PortalNotification[] = [];
    const emailDispatches: DispersalEmailDispatch[] = [];

    normalizedTargets.forEach(supListName => {
      // Buscar el usuario supervisor que tiene asignada esta lista
      const matchedUser = allUsers.find(u => {
        if (u.role !== 'supervisor' || !u.active) return false;
        const allowed = getUserAllowedLists(u);
        return allowed.includes(supListName);
      });

      const recipientEmail =
        matchedUser?.email ||
        `${supListName.toLowerCase().replace(/\s+/g, '.')}@empresa.com`;
      const recipientName = matchedUser?.name || supListName;

      const templateVars = {
        supervisor: supListName,
        nombre: recipientName,
        semana: String(semanaNumero),
        periodo: periodoClean,
        dispersado_por: dispersadoPor,
        fecha_limite: limiteFormatted,
        horas_limite: String(effectiveHorasLimite || 24),
        tiempo_restante: `${effectiveHorasLimite || 24} hrs`,
      };

      const personalizedMsg =
        mensaje && mensaje.trim()
          ? renderTemplate(mensaje.trim(), templateVars)
          : renderTemplate(
              emailCfg.mensajeDispersion || customMsg,
              templateVars
            );

      const personalizedSubject = renderTemplate(
        emailCfg.asuntoDispersion || '[CemenQtime] Nómina Semana {semana} Lista para Validación — {supervisor}',
        templateVars
      );

      const notif: PortalNotification = {
        id: `notif_${semanaNumero}_${supListName.replace(/\s+/g, '_')}_${Date.now()}`,
        targetSupervisor: supListName,
        targetUserId: matchedUser?.id,
        recipientEmail,
        semanaNumero,
        semanaPeriodo,
        titulo: `Nómina Semana ${semanaNumero} Dispersada — Lista ${supListName}`,
        mensaje: personalizedMsg,
        enviadoPor: dispersadoPor,
        fechaEnvio: nowISO,
        leida: false,
        emailEnviado: sendCorporateEmail,
      };
      newNotifications.push(notif);

      if (sendCorporateEmail) {
        emailDispatches.push({
          supervisorName: supListName,
          recipientName,
          recipientEmail,
          sentAt: nowISO,
          channel: 'sistema_y_correo',
          subject: personalizedSubject,
        });
      }
    });

    const combinedEmailDispatches = [
      ...emailDispatches,
      ...(existingDispersal?.emailDispatches || []).filter(
        prev => !normalizedTargets.includes(prev.supervisorName.toUpperCase())
      ),
    ];

    const newDispersal: PayrollDispersal = {
      id: existingDispersal?.id || `disp_semana_${semanaNumero}_${Date.now()}`,
      semanaNumero,
      semanaPeriodo,
      dispersadoPor,
      fechaDispersion: nowISO,
      mensaje: customMsg,
      supervisoresNotificados: mergedSupervisors,
      emailDispatches: combinedEmailDispatches,
      horasLimite: effectiveHorasLimite,
      limiteLiberacion: effectiveLimiteLiberacion,
      recordatoriosVencimientoEnviados: (existingDispersal?.recordatoriosVencimientoEnviados || []).filter(
        s => !normalizedTargets.includes(s.toUpperCase())
      ),
      cancelada: false,
      supervisoresCancelados: (existingDispersal?.supervisoresCancelados || []).filter(
        s => !normalizedTargets.includes(s.toUpperCase())
      ),
      empleadosCount: snapshotMeta?.empleadosCount ?? existingDispersal?.empleadosCount,
      totalHorasNormales: snapshotMeta?.totalHorasNormales ?? existingDispersal?.totalHorasNormales,
      totalHorasExtras: snapshotMeta?.totalHorasExtras ?? existingDispersal?.totalHorasExtras,
      reportesSnapshot: snapshotMeta?.reportesSnapshot ?? existingDispersal?.reportesSnapshot,
    };

    if (existingIndex >= 0) {
      dispersals[existingIndex] = newDispersal;
    } else {
      dispersals.unshift(newDispersal);
    }

    // Guardar notificaciones en el sistema
    const currentNotifications = this.loadNotifications();
    const filteredExisting = currentNotifications.filter(
      n =>
        !(
          n.semanaNumero === semanaNumero &&
          n.targetSupervisor &&
          normalizedTargets.includes(n.targetSupervisor.toUpperCase())
        )
    );
    const updatedNotifications = [...newNotifications, ...filteredExisting].slice(0, 100);

    this.cacheDispersals(dispersals);
    this.cacheNotifications(updatedNotifications);
    this.pushToServer({
      dispersals: this.memoryDispersals || dispersals,
      notifications: updatedNotifications,
      ...(snapshotMeta?.reportesSnapshot && snapshotMeta.reportesSnapshot.length > 0
        ? { reportes: snapshotMeta.reportesSnapshot }
        : {}),
      ...(semanaPeriodo ? { selectedWeek: semanaPeriodo } : {}),
    });

    // Disparar envío automático en servidor Express con credenciales SMTP
    if (sendCorporateEmail && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      const resolvedOrigin = (emailCfg.portalUrl || '').trim() || window.location.origin;
      fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaNumero,
          semanaPeriodo,
          dispersadoPor,
          dispatches: emailDispatches,
          emailConfig: {
            ...emailCfg,
            portalUrl: resolvedOrigin,
          },
          portalUrl: resolvedOrigin,
          limiteLiberacion: newDispersal.limiteLiberacion,
          horasLimite: newDispersal.horasLimite,
          mensaje: customMsg,
        }),
      }).catch(() => {
        // Fallback silencioso en modo local
      });
    }

    return {
      dispersal: newDispersal,
      newNotifications,
      emailDispatches,
    };
  }

  /**
   * Actualiza el límite de tiempo en horas sobre una dispersión activa (o sobre todas las dispersiones activas).
   */
  static updateDispersalDeadlineHours(
    semanaNumero: number,
    horasLimite: number,
    resetFromNow = false
  ): PayrollDispersal | undefined {
    const dispersals = [...this.loadDispersals()];
    const idx = dispersals.findIndex(d => d.semanaNumero === semanaNumero);
    if (idx < 0) return undefined;

    const current = dispersals[idx];
    const baseTime = resetFromNow
      ? Date.now()
      : current.fechaDispersion
      ? new Date(current.fechaDispersion).getTime()
      : Date.now();

    const updated: PayrollDispersal = {
      ...current,
      horasLimite: horasLimite > 0 ? horasLimite : undefined,
      limiteLiberacion:
        horasLimite > 0 ? new Date(baseTime + horasLimite * 3600000).toISOString() : undefined,
    };

    dispersals[idx] = updated;
    this.saveDispersals(dispersals);
    return updated;
  }

  /**
   * Cancela la dispersión de una nómina completa (cerrándola y borrándola de la información obtenida)
   * o de listas específicas seleccionadas.
   */
  static cancelDispersal(
    semanaNumero: number,
    canceladoPor: string,
    targetSupervisors?: string[],
    motivo?: string,
    deleteObtainedData = true
  ): {
    dispersal?: PayrollDispersal;
    deletedDispersal: boolean;
    newNotifications: PortalNotification[];
  } {
    const dispersals = [...this.loadDispersals()];
    const existingIndex = dispersals.findIndex(d => d.semanaNumero === semanaNumero);
    const disp = existingIndex >= 0 ? dispersals[existingIndex] : undefined;
    const nowISO = new Date().toISOString();

    const isGlobal =
      !targetSupervisors ||
      targetSupervisors.length === 0 ||
      (disp ? targetSupervisors.length >= disp.supervisoresNotificados.length : true);

    const normalizedTargets = (
      targetSupervisors && targetSupervisors.length > 0
        ? targetSupervisors
        : disp?.supervisoresNotificados || []
    ).map(s => normalizeSupervisorName(s).toUpperCase());

    // Si es cancelación global de la nómina o se indicó borrar la información obtenida
    if (isGlobal && deleteObtainedData) {
      const remainingDispersals = dispersals.filter(d => d.semanaNumero !== semanaNumero);
      this.cacheDispersals(remainingDispersals);

      // Borrar todas las liberaciones de esa semana
      const releases = this.loadReleases();
      const weekPrefix = `${semanaNumero}_`;
      const remainingReleases: Record<string, PayrollRelease> = {};
      Object.entries(releases).forEach(([key, rel]) => {
        if (!key.startsWith(weekPrefix) && rel.semanaNumero !== semanaNumero) {
          remainingReleases[key] = rel;
        }
      });
      this.cacheReleases(remainingReleases);

      // Si había supervisores notificados, generar aviso de cancelación y limpiar avisos previos de dispersión de esa semana
      const newNotifications: PortalNotification[] = normalizedTargets.map(sup => ({
        id: `notif_canc_${semanaNumero}_${sup.replace(/\s+/g, '_')}_${Date.now()}`,
        targetSupervisor: sup,
        semanaNumero,
        semanaPeriodo: disp?.semanaPeriodo || '',
        titulo: `⚠️ Nómina Semana ${semanaNumero} Cancelada y Cerrada — Lista ${sup}`,
        mensaje: `La nómina de la Semana ${semanaNumero} ha sido cancelada y cerrada por ${canceladoPor}.${
          motivo ? ` Motivo: ${motivo}` : ''
        } La información obtenida fue eliminada del proceso activo.`,
        enviadoPor: canceladoPor,
        fechaEnvio: nowISO,
        leida: false,
        emailEnviado: true,
      }));

      const currentNotifications = this.loadNotifications().filter(
        n => !(n.semanaNumero === semanaNumero && n.titulo?.includes('Dispersada'))
      );
      const updatedNotifications = [...newNotifications, ...currentNotifications].slice(0, 100);
      this.cacheNotifications(updatedNotifications);

      this.pushToServer({
        dispersals: remainingDispersals,
        releases: remainingReleases,
        notifications: updatedNotifications,
        deleteDispersal: true,
      });

      if (
        normalizedTargets.length > 0 &&
        typeof window !== 'undefined' &&
        window.location.protocol !== 'file:'
      ) {
        fetch('/api/notifications/cancel-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            semanaNumero,
            canceladoPor,
            targetSupervisors: normalizedTargets,
            motivo,
          }),
        }).catch(() => {});
      }

      return {
        dispersal: undefined,
        deletedDispersal: true,
        newNotifications,
      };
    }

    if (!disp || existingIndex < 0) {
      return { deletedDispersal: false, newNotifications: [] };
    }

    const updatedCancelled = Array.from(
      new Set([...(disp.supervisoresCancelados || []), ...normalizedTargets])
    );

    const updatedNotified = disp.supervisoresNotificados.filter(
      s => !normalizedTargets.includes(s.toUpperCase())
    );

    const updatedDispersal: PayrollDispersal = {
      ...disp,
      supervisoresNotificados: updatedNotified,
      supervisoresCancelados: updatedCancelled,
      cancelada: isGlobal || updatedNotified.length === 0,
      fechaCancelacion: nowISO,
      canceladoPor,
      motivoCancelacion: motivo || 'Cancelada por Recursos Humanos / Administración',
    };

    dispersals[existingIndex] = updatedDispersal;
    this.saveDispersals(dispersals);

    // Eliminar o revocar el release de la lista cancelada
    const releases = this.loadReleases();
    let releasesChanged = false;
    normalizedTargets.forEach(sup => {
      const releaseKey = `${semanaNumero}_${sup}`;
      if (releases[releaseKey]) {
        delete releases[releaseKey];
        releasesChanged = true;
      }
    });
    if (releasesChanged) {
      this.saveReleases(releases);
    }

    // Generar notificaciones en el sistema
    const newNotifications: PortalNotification[] = normalizedTargets.map(sup => ({
      id: `notif_canc_${semanaNumero}_${sup.replace(/\s+/g, '_')}_${Date.now()}`,
      targetSupervisor: sup,
      semanaNumero,
      semanaPeriodo: disp.semanaPeriodo,
      titulo: `⚠️ Dispersión Cancelada — Lista ${sup}`,
      mensaje: `La dispersión de tu nómina para la Semana ${semanaNumero} ha sido cancelada por ${canceladoPor}.${
        motivo ? ` Motivo: ${motivo}` : ''
      } La lista queda bloqueada para liberación hasta nueva indicación.`,
      enviadoPor: canceladoPor,
      fechaEnvio: nowISO,
      leida: false,
      emailEnviado: true,
    }));

    const currentNotifications = this.loadNotifications();
    this.saveNotifications([...newNotifications, ...currentNotifications].slice(0, 100));

    // Notificar al servidor Express
    if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      fetch('/api/notifications/cancel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaNumero,
          canceladoPor,
          targetSupervisors: normalizedTargets,
          motivo,
        }),
      }).catch(() => {});
    }

    return {
      dispersal: updatedDispersal,
      deletedDispersal: false,
      newNotifications,
    };
  }

  /**
   * Transforma las incidencias aprobadas en un diccionario compatible con vacacionesDB
   * para que el motor de cálculo de checadas las tome automáticamente sin subir CSV.
   */
  static extractApprovedIncidentsAsVacationsDB(
    incidents: IncidentRequest[]
  ): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};

    incidents
      .filter(inc => inc.status === 'aprobada' && inc.tipo !== 'Cambio de horario')
      .forEach(inc => {
        const endIso = !inc.fechaFin || inc.fechaFin === 'INDEFINIDO' ? inc.fechaInicio : inc.fechaFin;
        const fechas = getDateRangeISO(inc.fechaInicio, endIso);
        if (!result[inc.empleadoId]) {
          result[inc.empleadoId] = {};
        }
        fechas.forEach(iso => {
          const label =
            inc.tipo === 'Otro' && inc.especificacionOtro
              ? `Otra: ${inc.especificacionOtro}`
              : inc.tipo;
          result[inc.empleadoId][iso] = `${label}: ${inc.motivo}`;
        });
      });

    return result;
  }

  static getEvaluationCampaigns(): EvaluationCampaign[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVALUATION_CAMPAIGNS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as EvaluationCampaign[];
        }
      }
    } catch (e) {
      console.warn('Error loading evaluation campaigns', e);
    }
    return [];
  }

  static saveEvaluationCampaigns(
    campaigns: EvaluationCampaign[],
    options?: { skipSync?: boolean }
  ): void {
    this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_CAMPAIGNS, campaigns);
    if (!options?.skipSync) {
      this.pushToServer({ evaluationCampaigns: campaigns });
    }
  }

  static getEvaluationRecords(): EmployeeEvaluationRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVALUATION_RECORDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as EmployeeEvaluationRecord[];
        }
      }
    } catch (e) {
      console.warn('Error loading evaluation records', e);
    }
    return [];
  }

  static saveEvaluationRecords(
    records: EmployeeEvaluationRecord[],
    options?: { skipSync?: boolean }
  ): void {
    this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_RECORDS, records);
    if (!options?.skipSync) {
      this.pushToServer({ evaluationRecords: records });
    }
  }

  static saveEvaluationsBundle(
    campaigns: EvaluationCampaign[],
    records: EmployeeEvaluationRecord[],
    options?: { skipSync?: boolean }
  ): void {
    this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_CAMPAIGNS, campaigns);
    this.safeSetLocalStorage(STORAGE_KEYS.EVALUATION_RECORDS, records);
    if (!options?.skipSync) {
      this.pushToServer({
        evaluationCampaigns: campaigns,
        evaluationRecords: records,
      });
    }
  }
}


