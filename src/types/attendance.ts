/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DaySchedule {
  entrada: string; // "HH:MM" 24h
  salida: string;  // "HH:MM" 24h
  comida: number;  // minutos (ej. 60)
  cruzaMedianoche?: boolean; // Turno nocturno (la salida ocurre al día siguiente)
}

export interface ScheduleConfig {
  nombre: string;
  // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado. null indica día de Descanso
  dias: Record<number, DaySchedule | null>;
}

export interface Employee {
  id: string;
  nombre: string;
  jefe: string;
  horario?: string; // Código de horario asignado (ej: "ADMO")
  tipoHorario?: string;
  puesto?: string;
  turno?: string;
}


export interface RawPunchItem {
  hora: string;     // "HH:MM" 24h
  codigo: string;   // "ENT", "ERT", "SNT", "RST", etc.
  descripcion?: string;
}

export interface DayEventStore {
  entradas: Record<string, string[]>; // codigo -> ["08:00", ...]
  salidas: Record<string, string[]>;  // codigo -> ["17:05", ...]
  rstHoras: string[];                 // Horas marcadas específicamente como RST
  registrosCrudos: RawPunchItem[];    // TODAS las checadas físicas del día en orden cronológico
  isRST: boolean;                     // true solo si hubo al menos un evento RST
  ret: boolean;
  todas: string[];                    // [entradaFinal, salidaFinal] consolidadas
  entradaFinal?: string | null;
  salidaFinal?: string | null;
}

export type EventsDB = Record<string, Record<string, DayEventStore>>; // empId -> isoDate -> DayEventStore

export type SupervisorModificationType =
  | 'checada_agregada'
  | 'formato_checada_sin_gafete'
  | 'formato_permiso'
  | 'falta_confirmada'
  | 'ajuste_hora';

export interface ProcessedDay {
  isoDate: string;
  dayName: string;
  dayOfWeek: number; // 0..6
  entrada: string;
  salida: string;
  entradaOriginal?: string;
  salidaOriginal?: string;
  hNormal: number;
  hExtra: number;
  incidencia: string;
  advertencia: string;
  huerfana: boolean;
  rowClass: 'row-success' | 'row-warning' | 'row-danger' | 'row-default';
  horarioProgramado: DaySchedule | null;
  registrosCrudosDia: RawPunchItem[];
  // Autorización de Horas Extras por el Supervisor (para envío a RH y CONTPAQi)
  horasExtrasAutorizadas?: boolean;
  // Campos de trazabilidad cuando el supervisor trabaja la lista en el sistema
  modificadoPorSupervisor?: boolean;
  tipoModificacionSupervisor?: SupervisorModificationType;
  notaSupervisorDia?: string;
  formatoSubidoNombre?: string;
  formatoSubidoBase64?: string;
  incidenciaIdVinculada?: string;
}

export interface EmployeeReport {
  empleado: Employee;
  dias: ProcessedDay[];
  totalNormal: number;
  totalExtra: number;
  asistencias: number;
  faltas: number;
  retardos: number;
  asistenciaPerfecta: boolean;
}

export interface PayrollSummary {
  totalHoras: number;
  totalHorasExtra: number;
  totalFaltas: number;
  totalVac: number;
  totalRetardos: number;
  totalRetardosExcesivos: number;
  totalEmpleados: number;
  tasaCumplimiento: number;
  promedioHoras: number;
  asistenciasPerfectas: number;
  incidenciasConteo: Record<string, number>;
}

export type ReadingMode = 'checadas_reales' | 'jerarquia_eventos';

export type OvertimeRoundingMode = 'exacto' | '15_min' | '30_min' | '60_min';
export type OvertimeCalculationMode = 'desde_minuto_uno' | 'despues_del_umbral';

export interface OvertimeRulesConfig {
  /** Minutos mínimos de excedente para que se considere Tiempo Extra (ej. 30 min = a partir de media hora) */
  minutosMinimosParaExtra: number;
  /** Si es true, si el empleado llega antes de su hora de entrada (ej. 10 min antes), NO se cuenta como tiempo extra */
  ignorarEntradaAnticipada: boolean;
  /** Opcional: permitir contar tiempo antes de la entrada únicamente si supera un umbral grande (ej. 60 min antes) */
  permitirExtraAntesEntradaConUmbral: boolean;
  /** Minutos mínimos antes de la entrada para que cuente cuando permitirExtraAntesEntradaConUmbral es true */
  minutosMinimosAntesEntrada: number;
  /** 'desde_minuto_uno' cuenta todo el extra al superar el mínimo; 'despues_del_umbral' resta los minutos del umbral */
  modoCalculoExtra: OvertimeCalculationMode;
  /** Modo de redondeo del tiempo extra: exacto o por bloques cumplidos de 15, 30 o 60 min */
  redondeoExtra: OvertimeRoundingMode;
  /** Límite máximo de horas extras por día (0 = sin límite) */
  topeMaximoExtraDiarioHrs: number;
}

export const DEFAULT_OVERTIME_RULES: OvertimeRulesConfig = {
  minutosMinimosParaExtra: 30,
  ignorarEntradaAnticipada: true,
  permitirExtraAntesEntradaConUmbral: false,
  minutosMinimosAntesEntrada: 60,
  modoCalculoExtra: 'desde_minuto_uno',
  redondeoExtra: 'exacto',
  topeMaximoExtraDiarioHrs: 0,
};

export interface AppConfig {
  emailDestino: string;
  toleranciaAntes: number; // minutos (default: 29)
  toleranciaDespues: number; // minutos (default: 14)
  jornadaBase: number; // horas (default: 8)
  comidaDefault: number; // minutos (default: 60)
  modoLectura: ReadingMode; // 'checadas_reales' (recomendado) | 'jerarquia_eventos'
  minutosRebote: number; // minutos mínimos para no duplicar la misma checada (default: 15)
  horasLimiteLiberacion: number; // horas permitidas para que supervisores liberen nómina tras dispersión (default: 24)
  overtimeRules: OvertimeRulesConfig; // configuración de reglas de tiempo extra
  theme: 'dark' | 'light';
}

export interface EmpleadoProcesado {
  id: string;
  nombre: string;
  supervisor: string;
  totalHorasNormales: number;
  totalHorasExtras: number;
  asistencias: number;
  faltas: number;
  retardos: number;
  checadasHuerfanas: number;
  alertas: string[];
  dias: ProcessedDay[];
}
