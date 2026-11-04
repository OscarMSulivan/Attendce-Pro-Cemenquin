/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'rh' | 'supervisor';

export interface PortalUser {
  id: string;
  name: string;
  username?: string;      // Usuario para login (ej. "oscar", "00615", "admin")
  password?: string;      // Contraseña de acceso al portal
  email: string;
  role: UserRole;
  employeeId?: string;    // Formato de 5 dígitos (ej: "00615")
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
}

export interface DispersalEmailDispatch {
  supervisorName: string;
  recipientName: string;
  recipientEmail: string;
  sentAt: string;
  channel: 'sistema_y_correo' | 'sistema';
  subject: string;
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

