/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'rh' | 'supervisor';

export type PortalModule = 
  | 'nomina'        // Dashboard y Tabla de Asistencia / Trabajo de Nómina
  | 'semaforo'      // Semáforo de Nóminas y Dispersión
  | 'incidencias'   // Bandeja de Incidencias
  | 'contpaqi'      // Exportador CONTPAQi® Nóminas
  | 'tiempo_extra'  // Configuración de Reglas de Tiempo Extra
  | 'tiempo_limite' // Configuración de Límite de Tiempo para Trabajar/Liberar Lista
  | 'smtp_correo'   // Configuración de Credenciales SMTP para Correo Automático
  | 'usuarios';     // Administración de Usuarios, Roles y Permisos

export const PORTAL_MODULE_LABELS: Record<PortalModule, { short: string; title: string; description: string }> = {
  nomina: {
    short: 'Nómina',
    title: 'Nómina y Asistencia',
    description: 'Trabajo de checadas, horarios y asistencias de listas',
  },
  semaforo: {
    short: 'Semáforo',
    title: 'Semáforo de Nóminas',
    description: 'Monitoreo de liberación y dispersión semanal',
  },
  incidencias: {
    short: 'Incidencias',
    title: 'Bandeja de Incidencias',
    description: 'Solicitudes, permisos y validación de formatos',
  },
  contpaqi: {
    short: 'CONTPAQi',
    title: 'CONTPAQi® Nóminas',
    description: 'Exportador y layout con claves de incidencias',
  },
  tiempo_extra: {
    short: 'Tiempo Extra',
    title: 'Configuración de Tiempo Extra',
    description: 'Definir desde cuántos minutos cuenta el tiempo extra y descartar llegadas anticipadas',
  },
  tiempo_limite: {
    short: 'Tiempo Límite',
    title: 'Límite de Tiempo para Trabajar Lista',
    description: 'Definir el plazo (por horas) para que supervisores liberen su nómina',
  },
  smtp_correo: {
    short: 'Correo SMTP',
    title: 'Credenciales de Correo SMTP',
    description: 'Configurar servidor, puerto, usuario y clave para alertas por email',
  },
  usuarios: {
    short: 'Usuarios y Accesos',
    title: 'Administración de Usuarios y Roles',
    description: 'Crear credenciales, asignar listas y otorgar accesos a módulos',
  },
};

export interface PortalUser {
  id: string;
  name: string;
  username?: string;      // Usuario para login (ej. "oscar", "00615", "admin")
  password?: string;      // Contraseña de acceso al portal
  email: string;
  role: UserRole;
  employeeId?: string;    // Formato de 5 dígitos (ej: "00615")
  // Módulos específicos a los que este usuario tiene permiso de entrar
  allowedModules?: PortalModule[];
  // Lista principal de supervisor asignada en el catálogo de empleados
  supervisorName?: string;
  // Todas las listas de nómina que este usuario tiene asignadas para trabajar
  assignedLists?: string[];
  // Si este supervisor está supliendo a otro por vacaciones, a quién suple
  delegatedSupervisor?: string;
  active: boolean;
  notes?: string;
}

/**
 * Obtiene los módulos permitidos para un usuario, garantizando defaults según su rol si no fueron configurados manualmente.
 */
export function getUserAllowedModules(user: PortalUser): PortalModule[] {
  if (user.id === 'user_admin') {
    return ['nomina', 'semaforo', 'incidencias', 'contpaqi', 'tiempo_extra', 'tiempo_limite', 'smtp_correo', 'usuarios'];
  }
  if (Array.isArray(user.allowedModules) && user.allowedModules.length > 0) {
    return user.allowedModules;
  }
  if (user.role === 'admin') {
    return ['nomina', 'semaforo', 'incidencias', 'contpaqi', 'tiempo_extra', 'tiempo_limite', 'smtp_correo', 'usuarios'];
  }
  if (user.role === 'rh') {
    return ['nomina', 'semaforo', 'incidencias', 'contpaqi', 'tiempo_extra', 'tiempo_limite', 'smtp_correo'];
  }
  return ['nomina', 'incidencias'];
}

export function userHasModuleAccess(user: PortalUser, module: PortalModule): boolean {
  if (user.id === 'user_admin' || user.role === 'admin') return true;
  const mods = getUserAllowedModules(user);
  return mods.includes(module);
}

/**
 * Determina si el usuario tiene acceso a al menos una sección del panel Administrativo
 * (Gestión de Usuarios, Tiempo Extra, Configuración de Tiempo Límite de Liberación o Servidor SMTP).
 */
export function userHasAnyAdminPanelAccess(user: PortalUser): boolean {
  return (
    userHasModuleAccess(user, 'usuarios') ||
    userHasModuleAccess(user, 'tiempo_extra') ||
    userHasModuleAccess(user, 'tiempo_limite') ||
    userHasModuleAccess(user, 'smtp_correo')
  );
}

/**
 * Devuelve todas las listas de nómina (nombres de supervisor en el catálogo)
 * que un usuario tiene permiso de trabajar y liberar.
 */
export function getUserAllowedLists(user: PortalUser): string[] {
  const set = new Set<string>();
  if (user.supervisorName && user.supervisorName.trim()) {
    set.add(user.supervisorName.trim().toUpperCase());
  }
  if (Array.isArray(user.assignedLists)) {
    user.assignedLists.forEach(listName => {
      if (listName && listName.trim()) {
        set.add(listName.trim().toUpperCase());
      }
    });
  }
  if (user.delegatedSupervisor && user.delegatedSupervisor.trim()) {
    set.add(user.delegatedSupervisor.trim().toUpperCase());
  }
  return Array.from(set);
}

export type IncidentType = 
  | 'Vacaciones' 
  | 'Permiso con goce' 
  | 'Permiso sin goce' 
  | 'Cambio de horario'
  | 'Permiso de viaje'
  | 'Home Office'
  | 'Pase Médico' 
  | 'Incapacidad' 
  | 'Checado sin Gafete'
  | 'Otro';

/**
 * Regla de negocio oficial para obligatoriedad de formato adjunto:
 * - OBLIGATORIO subir formato firmado:
 *   1. Vacaciones
 *   2. Permiso con goce
 *   3. Permiso de viaje
 *   4. Home Office
 *   5. Otro (Otra Justificación, ej. Permiso de Paternidad — además debe especificar el concepto)
 *   6. Checado sin Gafete CUANDO faltan las 2 checadas (sin entrada ni salida)
 * - OPCIONAL subir formato:
 *   1. Permiso sin goce
 *   2. Checado sin Gafete cuando solo falta 1 checada
 *   3. Cambio de horario, Pase Médico, Incapacidad
 */
export function doesIncidentRequireMandatoryFile(
  tipo: IncidentType,
  missingBothPunches = false
): boolean {
  switch (tipo) {
    case 'Vacaciones':
    case 'Permiso con goce':
    case 'Permiso de viaje':
    case 'Home Office':
    case 'Otro':
      return true;
    case 'Checado sin Gafete':
      return missingBothPunches;
    case 'Permiso sin goce':
    case 'Cambio de horario':
    case 'Pase Médico':
    case 'Incapacidad':
    default:
      return false;
  }
}

export type IncidentStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface IncidentRequest {
  id: string;
  solicitanteId: string;
  solicitanteNombre: string;
  solicitanteRol: UserRole;
  // Para quién es la incidencia:
  esParaMi: boolean;
  empleadoId: string;
  empleadoNombre: string;
  supervisorNombre: string;
  tipo: IncidentType;
  // Cuando tipo === 'Otro', especifica el concepto exacto (ej. "Permiso de Paternidad")
  especificacionOtro?: string;
  fechaInicio: string; // ISO YYYY-MM-DD
  fechaFin: string;    // ISO YYYY-MM-DD
  motivo: string;
  status: IncidentStatus;
  fechaCreacion: string;
  revisadoPor?: string;
  fechaRevision?: string;
  notasResolucion?: string;
  // Hora de entrada/salida propuesta en caso de Formato de Checada sin Gafete
  entradaPropuesta?: string;
  salidaPropuesta?: string;
  // Archivo de formato firmado / comprobante adjunto
  archivoFormatoNombre?: string;
  archivoFormatoBase64?: string;
}

export type PayrollReleaseStatus = 'pendiente' | 'en_revision' | 'liberado';

export interface PayrollRelease {
  id: string; // ej: "43_OSCAR_VALENZUELA"
  semanaPeriodo: string; // "YYYY-MM-DD|YYYY-MM-DD"
  semanaNumero: number;
  supervisorNombre: string;
  status: PayrollReleaseStatus;
  liberadoPor?: string;
  fechaLiberacion?: string;
  comentariosSupervisor?: string;
  empleadosCount: number;
  horasNormales: number;
  horasExtras: number;
  alertasCount: number;
  checadasAgregadasSupervisorCount?: number;
  formatosAdjuntosCount?: number;
  faltasConfirmadasCount?: number;
  trabajadaEnSistema?: boolean;
  archivoExcelGenerado?: string;
  // Archivo Excel trabajado devuelto por el supervisor con sus correcciones
  excelTrabajadoNombre?: string;
  excelTrabajadoBase64?: string;
  fechaSubidaExcelTrabajado?: string;
  notasRevision?: string;
  revisadoPor?: string;
  fechaRevision?: string;
}

export interface DispersalEmailDispatch {
  supervisorName: string;
  recipientName: string;
  recipientEmail: string;
  sentAt: string;
  channel: 'sistema_y_correo' | 'sistema';
  subject: string;
}

export interface EmailServerConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFromName?: string;
}

export interface PayrollDispersal {
  id: string; // ej: "disp_semana_43"
  semanaNumero: number;
  semanaPeriodo: string; // "YYYY-MM-DD|YYYY-MM-DD"
  dispersadoPor: string;
  fechaDispersion: string;
  mensaje?: string;
  supervisoresNotificados: string[];
  emailDispatches?: DispersalEmailDispatch[];
  horasLimite?: number;             // ej: 24 (horas para liberar)
  limiteLiberacion?: string;        // ISO string de fecha y hora límite
  cancelada?: boolean;              // Indica si la dispersión fue cancelada globalmente
  fechaCancelacion?: string;        // ISO string
  canceladoPor?: string;            // Nombre de quien canceló
  motivoCancelacion?: string;       // Motivo (ej: "No trabajó su nómina", etc.)
  supervisoresCancelados?: string[]; // Si se cancelaron listas específicas
}

export interface PortalNotification {
  id: string;
  targetSupervisor?: string;     // Nombre de la lista de supervisor (ej: "OSCAR VALENZUELA")
  targetUserId?: string;         // ID de usuario específico (opcional)
  recipientEmail?: string;       // Correo electrónico empresarial notificado
  semanaNumero: number;
  semanaPeriodo: string;
  titulo: string;
  mensaje: string;
  enviadoPor: string;
  fechaEnvio: string;
  leida: boolean;
  emailEnviado: boolean;
}

export interface PayrollModificationLog {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  supervisorName: string;
  isoDate: string;
  dayName: string;
  actionType:
    | 'checada_agregada'
    | 'formato_permiso'
    | 'falta_confirmada'
    | 'tiempo_extra_autorizado'
    | 'tiempo_extra_rechazado'
    | 'cambio_incidencia'
    | 'nota_supervisor';
  summary: string;
  details?: string;
  modifiedBy: string;
  hasAttachment?: boolean;
  attachmentName?: string;
}


