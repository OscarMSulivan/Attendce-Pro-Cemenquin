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
import { getDateRangeISO, normalizeEmployeeId, normalizeSupervisorName } from '../utils/calendarUtils';
import { PushNotificationService } from './pushNotificationService';

const STORAGE_KEYS = {
  USERS: 'attendancePro_portal_users_v1',
  ACTIVE_USER_ID: 'attendancePro_portal_active_user_v1',
  AUTH_SESSION: 'attendancePro_portal_auth_session_v1',
  INCIDENTS: 'attendancePro_portal_incidents_v1',
  RELEASES: 'attendancePro_portal_releases_v1',
  DISPERSALS: 'attendancePro_portal_dispersals_v1',
  NOTIFICATIONS: 'attendancePro_portal_notifications_v1',
  EMAIL_CONFIG: 'attendancePro_portal_email_config_v1',
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
  /**
   * Guarda de forma segura en localStorage sin lanzar excepciones QuotaExceededError
   * que interrumpan el renderizado de React o bloqueen el envío al servidor.
   */
  private static safeSetLocalStorage(key: string, value: unknown, compactFallback?: () => unknown): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (compactFallback) {
        try {
          localStorage.setItem(key, JSON.stringify(compactFallback()));
          return;
        } catch {
          // ignore secondary quota error
        }
      }
      console.warn(`[PortalService] Quota de localStorage alcanzada al guardar ${key}; sincronizando con el servidor.`);
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

  private static compactIncidentsForLocalStorage(incidents: IncidentRequest[]): IncidentRequest[] {
    return incidents.map(inc => ({
      ...inc,
      archivoFormatoBase64: undefined,
    }));
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

  /**
   * Obtiene el estado centralizado desde el servidor Express (/api/portal/state)
   */
  static async fetchServerState(): Promise<{
    users?: PortalUser[];
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
    serverInfo?: { hostname: string; uptime: number; storagePath: string };
  } | null> {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return null;
    try {
      const res = await fetch('/api/portal/state');
      if (!res.ok) return null;
      const data = await res.json();
      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        this.safeSetLocalStorage(STORAGE_KEYS.USERS, data.users);
      }
      if (data.incidents && Array.isArray(data.incidents)) {
        this.safeSetLocalStorage(STORAGE_KEYS.INCIDENTS, data.incidents, () =>
          this.compactIncidentsForLocalStorage(data.incidents)
        );
      }
      if (data.releases && typeof data.releases === 'object') {
        this.safeSetLocalStorage(STORAGE_KEYS.RELEASES, data.releases);
      }
      if (data.dispersals && Array.isArray(data.dispersals)) {
        this.safeSetLocalStorage(STORAGE_KEYS.DISPERSALS, data.dispersals, () =>
          this.compactDispersalsForLocalStorage(data.dispersals)
        );
      }
      if (data.notifications && Array.isArray(data.notifications)) {
        this.safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, data.notifications);
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
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: PortalUser) => this.normalizeUserRecord(u));
        }
      }
    } catch (e) {
      console.warn('Error loading users', e);
    }
    return DEFAULT_USERS;
  }

  static saveUsers(users: PortalUser[]): void {
    const normalized = users.map(u => this.normalizeUserRecord(u));
    this.safeSetLocalStorage(STORAGE_KEYS.USERS, normalized);
    this.pushToServer({ users: normalized });
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
      return localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) === 'true';
    } catch {
      return false;
    }
  }

  static setSessionAuthenticated(isAuth: boolean, userId?: string): void {
    try {
      if (isAuth) {
        localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
        if (userId) {
          this.saveActiveUserId(userId);
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      }
    } catch (e) {
      console.warn('Error saving auth session', e);
    }
  }

  static loadActiveUserId(): string {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || 'user_admin';
    if (id === 'user_sup_omar') return 'user_sup_eudis';
    return id;
  }

  static saveActiveUserId(userId: string): void {
    try {
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RELEASES);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          const normalized: Record<string, PayrollRelease> = {};
          Object.entries(parsed as Record<string, PayrollRelease>).forEach(([key, rel]) => {
            const supName = normalizeSupervisorName(rel.supervisorNombre);
            const newKey = `${rel.semanaNumero}_${supName}`;
            normalized[newKey] = {
              ...rel,
              id: newKey,
              supervisorNombre: supName
            };
          });
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Error loading releases', e);
    }
    return {};
  }

  static saveReleases(releases: Record<string, PayrollRelease>): void {
    this.safeSetLocalStorage(STORAGE_KEYS.RELEASES, releases);
    this.pushToServer({ releases });
  }

  static loadDispersals(): PayrollDispersal[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DISPERSALS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((d: PayrollDispersal) => d.id !== 'disp_semana_43')
            .map((d: PayrollDispersal) => ({
              ...d,
              supervisoresNotificados: Array.isArray(d.supervisoresNotificados)
                ? d.supervisoresNotificados.map(s => normalizeSupervisorName(s))
                : []
            }));
        }
      }
    } catch (e) {
      console.warn('Error loading dispersals', e);
    }
    return [];
  }

  static saveDispersals(dispersals: PayrollDispersal[], extraServerPayload?: Record<string, unknown>): void {
    this.safeSetLocalStorage(STORAGE_KEYS.DISPERSALS, dispersals, () =>
      this.compactDispersalsForLocalStorage(dispersals)
    );
    this.pushToServer({ dispersals, ...(extraServerPayload || {}) });
  }

  static loadNotifications(): PortalNotification[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading notifications', e);
    }
    return [];
  }

  static saveNotifications(notifications: PortalNotification[]): void {
    this.safeSetLocalStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
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

    this.saveDispersals(dispersals);

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
    this.saveNotifications(updatedNotifications);

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
    const dispersals = this.loadDispersals();
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
   * Cancela la dispersión de una nómina completa o de listas específicas seleccionadas.
   */
  static cancelDispersal(
    semanaNumero: number,
    canceladoPor: string,
    targetSupervisors?: string[],
    motivo?: string
  ): {
    dispersal?: PayrollDispersal;
    newNotifications: PortalNotification[];
  } {
    const dispersals = this.loadDispersals();
    const existingIndex = dispersals.findIndex(d => d.semanaNumero === semanaNumero);
    if (existingIndex < 0) return { newNotifications: [] };

    const disp = dispersals[existingIndex];
    const nowISO = new Date().toISOString();
    const isGlobal =
      !targetSupervisors ||
      targetSupervisors.length === 0 ||
      targetSupervisors.length >= disp.supervisoresNotificados.length;

    const normalizedTargets = (targetSupervisors || disp.supervisoresNotificados).map(s =>
      normalizeSupervisorName(s).toUpperCase()
    );

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

    // Revocar cualquier release existente para que no quede liberada
    const releases = this.loadReleases();
    let releasesChanged = false;
    normalizedTargets.forEach(sup => {
      const releaseKey = `${semanaNumero}_${sup}`;
      if (releases[releaseKey]) {
        releases[releaseKey].status = 'en_revision';
        releases[releaseKey].notasRevision = `[CANCELACIÓN DE DISPERSIÓN] ${motivo || 'Dispersión cancelada por RH'}`;
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
}

