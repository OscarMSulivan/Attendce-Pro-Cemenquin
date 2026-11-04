/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import { EmployeeReport, ProcessedDay } from '../types/attendance';
import { PayrollRelease } from '../types/portal';

export type IncidenceRuleId =
  | 'FALTA'
  | 'PRIMA_DOMINICAL'
  | 'ASISTENCIA'
  | 'RETARDO'
  | 'VACACIONES'
  | 'PERMISO_CON_GOCE'
  | 'PERMISO_SIN_GOCE'
  | 'HOME_OFFICE'
  | 'OTRA_JUSTIFICACION'
  | 'INCAPACIDAD'
  | 'PASE_MEDICO'
  | 'CHECADA_SIN_GAFETE'
  | 'DESCANSO'
  | 'FESTIVO'
  | 'RST'
  | 'INGRESO'
  | 'HORAS_EXTRAS_DOBLES'
  | 'HORAS_EXTRAS_TRIPLES'
  | string;

export interface ContpaqiIncidenceRule {
  id: IncidenceRuleId;
  etiquetaSistema: string;     // Nombre amigable en el configurador (ej. "Falta Injustificada", "Asistencia", "Retardo")
  clave: string;               // Clave CONTPAQi (ej. "FINJ", "SRDN", "ASIS", "RET", "VAC")
  prefijoCantidad: boolean;    // Si true, antepone el número al código en las celdas de fecha (ej. "1FINJ", "1SRDN")
  nombreColA: string;          // Columna A ("NOMBRE"): ej. "PAGO 0", "GUARDIAS 12 HRS"
  observacionesModo: 'SUPERVISOR' | 'FIJO'; // Si usa el nombre del supervisor o un texto fijo en Columna B ("OBSERVACIONES")
  observacionesFijo: string;   // Texto fijo para Columna B cuando observacionesModo === 'FIJO' (ej. "SEMANA REDUCIDA")
  conceptoColC: string;        // Columna C ("CONCEPTO"): ej. "FALTA INJUSTIFICADA", "PRIMA DOMINICAL"
  montoColF: number;           // Columna F ("MONTO"): ej. 0 (muestra "-") o 168.75
  activa: boolean;             // Si se incluye o no en el reporte de exportación a CONTPAQi
  esPersonalizada?: boolean;   // Si fue agregada manualmente por el usuario
  palabraClaveMatch?: string;  // Texto para empatar con day.incidencia en reglas personalizadas
}

export interface ContpaqiConfig {
  tipoPeriodo: 'SEMANAL' | 'QUINCENAL' | 'CATORCENAL';
  ejercicio: number;
  formatoEncabezadoFecha: 'M/D/YYYY' | 'DD/MM/YYYY'; // En la imagen de referencia es M/D/YYYY (ej. 10/8/2026)
  incluirFilaVaciaSeparadora: boolean;              // Fila 2 en blanco debajo del encabezado gris (como en el formato)
  separarExtrasDoblesTriplesLFT: boolean;           // Tope 9 horas dobles por semana según LFT
  detectarPrimaDominicalAuto: boolean;              // Detecta automáticamente asistencia en domingo / guardia como Prima Dominical (SRDN)
  soloSupervisoresLiberados: boolean;               // Filtrar solo nóminas liberadas por supervisor
  reglasIncidencias: ContpaqiIncidenceRule[];
}

export const DEFAULT_INCIDENCE_RULES: ContpaqiIncidenceRule[] = [
  {
    id: 'FALTA',
    etiquetaSistema: 'Falta Injustificada',
    clave: 'FINJ',
    prefijoCantidad: true,
    nombreColA: 'PAGO 0',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'FALTA INJUSTIFICADA',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'PRIMA_DOMINICAL',
    etiquetaSistema: 'Prima Dominical / Semana Reducida',
    clave: 'SRDN',
    prefijoCantidad: true,
    nombreColA: 'GUARDIAS 12 HRS',
    observacionesModo: 'FIJO',
    observacionesFijo: 'SEMANA REDUCIDA',
    conceptoColC: 'PRIMA DOMINICAL',
    montoColF: 168.75,
    activa: true,
  },
  {
    id: 'RETARDO',
    etiquetaSistema: 'Retardo',
    clave: 'RET',
    prefijoCantidad: true,
    nombreColA: 'INCIDENCIA TIEMPO',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'RETARDO',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'ASISTENCIA',
    etiquetaSistema: 'Asistencia Normal',
    clave: 'ASIS',
    prefijoCantidad: true,
    nombreColA: 'ASISTENCIA',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'ASISTENCIA',
    montoColF: 0,
    activa: false,
  },
  {
    id: 'VACACIONES',
    etiquetaSistema: 'Vacaciones',
    clave: 'VAC',
    prefijoCantidad: true,
    nombreColA: 'PRESTACIONES',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'VACACIONES',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'PERMISO_CON_GOCE',
    etiquetaSistema: 'Permiso con Goce / Viaje',
    clave: 'PCS',
    prefijoCantidad: true,
    nombreColA: 'PERMISOS',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'PERMISO CON GOCE',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'PERMISO_SIN_GOCE',
    etiquetaSistema: 'Permiso sin Goce de Sueldo',
    clave: 'PSS',
    prefijoCantidad: true,
    nombreColA: 'PAGO 0',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'PERMISO SIN GOCE',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'HOME_OFFICE',
    etiquetaSistema: 'Solicitud de Home Office',
    clave: 'HOFF',
    prefijoCantidad: true,
    nombreColA: 'ASISTENCIA REMOTA',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'HOME OFFICE',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'OTRA_JUSTIFICACION',
    etiquetaSistema: 'Otra Justificación (Ej. Permiso Paternidad)',
    clave: 'PCS',
    prefijoCantidad: true,
    nombreColA: 'PERMISOS ESPECIALES',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'PERMISO ESPECIAL / PATERNIDAD',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'INCAPACIDAD',
    etiquetaSistema: 'Incapacidad IMSS / Médica',
    clave: 'EG',
    prefijoCantidad: true,
    nombreColA: 'INCAPACIDADES',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'INCAPACIDAD',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'PASE_MEDICO',
    etiquetaSistema: 'Pase Médico',
    clave: 'PMED',
    prefijoCantidad: true,
    nombreColA: 'PERMISOS',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'PASE MEDICO',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'CHECADA_SIN_GAFETE',
    etiquetaSistema: 'Checada sin Gafete (Validada Supervisor)',
    clave: 'CSG',
    prefijoCantidad: true,
    nombreColA: 'AJUSTE CHECADA',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'CHECADA SIN GAFETE',
    montoColF: 0,
    activa: false,
  },
  {
    id: 'DESCANSO',
    etiquetaSistema: 'Día de Descanso',
    clave: 'DESC',
    prefijoCantidad: true,
    nombreColA: 'DESCANSO SEMANAL',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'DESCANSO',
    montoColF: 0,
    activa: false,
  },
  {
    id: 'FESTIVO',
    etiquetaSistema: 'Día Festivo Oficial',
    clave: 'FEST',
    prefijoCantidad: true,
    nombreColA: 'DIA FESTIVO',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'FESTIVO',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'RST',
    etiquetaSistema: 'RST (Descanso Trabajado / Guardia)',
    clave: 'RST',
    prefijoCantidad: true,
    nombreColA: 'GUARDIAS 12 HRS',
    observacionesModo: 'FIJO',
    observacionesFijo: 'SEMANA REDUCIDA',
    conceptoColC: 'RST',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'INGRESO',
    etiquetaSistema: 'Ingreso de Empleado',
    clave: 'ING',
    prefijoCantidad: true,
    nombreColA: 'ALTAS',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'INGRESO DE EMPLEADO',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'HORAS_EXTRAS_DOBLES',
    etiquetaSistema: 'Horas Extras Dobles (≤ 9h LFT)',
    clave: '1HE',
    prefijoCantidad: true,
    nombreColA: 'TIEMPO EXTRA',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'HORAS EXTRAS DOBLES',
    montoColF: 0,
    activa: true,
  },
  {
    id: 'HORAS_EXTRAS_TRIPLES',
    etiquetaSistema: 'Horas Extras Triples (> 9h LFT)',
    clave: '2HE',
    prefijoCantidad: true,
    nombreColA: 'TIEMPO EXTRA',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'HORAS EXTRAS TRIPLES',
    montoColF: 0,
    activa: true,
  },
];

export const DEFAULT_CONTPAQI_CONFIG: ContpaqiConfig = {
  tipoPeriodo: 'SEMANAL',
  ejercicio: 2026,
  formatoEncabezadoFecha: 'M/D/YYYY',
  incluirFilaVaciaSeparadora: true,
  separarExtrasDoblesTriplesLFT: true,
  detectarPrimaDominicalAuto: true,
  soloSupervisoresLiberados: false,
  reglasIncidencias: DEFAULT_INCIDENCE_RULES,
};

const CONTPAQI_CONFIG_KEY = 'attendance_pro_v10_contpaqi_config_v2';

export function loadContpaqiConfig(): ContpaqiConfig {
  try {
    const raw = localStorage.getItem(CONTPAQI_CONFIG_KEY);
    if (!raw) return DEFAULT_CONTPAQI_CONFIG;
    const parsed = JSON.parse(raw);
    const savedRules: ContpaqiIncidenceRule[] = Array.isArray(parsed.reglasIncidencias)
      ? parsed.reglasIncidencias
      : [];

    // Asegurar que todas las reglas base existan manteniendo personalizaciones del usuario
    const mergedRules: ContpaqiIncidenceRule[] = DEFAULT_INCIDENCE_RULES.map(defRule => {
      const found = savedRules.find(r => r.id === defRule.id);
      return found ? { ...defRule, ...found } : defRule;
    });

    // Agregar reglas personalizadas creadas por el usuario
    savedRules.forEach(r => {
      if (r.esPersonalizada && !mergedRules.some(m => m.id === r.id)) {
        mergedRules.push(r);
      }
    });

    return {
      ...DEFAULT_CONTPAQI_CONFIG,
      ...parsed,
      reglasIncidencias: mergedRules,
    };
  } catch {
    return DEFAULT_CONTPAQI_CONFIG;
  }
}

export function saveContpaqiConfig(cfg: ContpaqiConfig): void {
  try {
    localStorage.setItem(CONTPAQI_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error('Error guardando configuración CONTPAQi:', e);
  }
}

/**
 * Fila exacta del formato solicitado por Nóminas / CONTPAQi:
 * NOMBRE | OBSERVACIONES | CONCEPTO | NUM EMPLEADO | NOMBRE | MONTO | Fecha1 | Fecha2 | ... | Fecha7
 */
export interface ContpaqiFormatRow {
  rowKey: string;
  ruleId: IncidenceRuleId;
  nombreColA: string;          // Ej. "PAGO 0", "GUARDIAS 12 HRS"
  observacionesColB: string;   // Ej. "PATRICIA CONSEJO", "SEMANA REDUCIDA"
  conceptoColC: string;        // Ej. "FALTA INJUSTIFICADA", "PRIMA DOMINICAL"
  numEmpleadoColD: string;     // 5 dígitos ej. "00227", "00620"
  nombreEmpleadoColE: string;  // Ej. "PATRICIA FERNANDA ROSETE LOPEZ DE LLERGO"
  montoColF: number;           // 0 -> "-", 168.75 -> 168.75
  supervisor: string;
  estatusLiberacion: 'LIBERADO' | 'PENDIENTE';
  origenSupervisor: boolean;
  totalOcurrenciasSemana: number;
  celdasPorFecha: Record<string, string>; // isoDate -> ej. "1FINJ", "1SRDN", ""
}

export interface ContpaqiMovementRow {
  codigoEmpleado: string;     // 5 dígitos ej. "00615"
  nombreEmpleado: string;
  supervisor: string;
  estatusLiberacion: 'LIBERADO' | 'PENDIENTE';
  ejercicio: number;
  tipoPeriodo: string;
  numeroPeriodo: number;
  fechaISO: string;           // YYYY-MM-DD
  fechaContpaqi: string;      // DD/MM/YYYY
  claveIncidencia: string;    // Ej. 1FINJ, 1SRDN, 1VAC, etc.
  nombreColA: string;
  observacionesColB: string;
  conceptoDescripcion: string;
  monto: number;
  valor: number;              // 1 (día) o cantidad de horas
  unidad: 'DÍAS' | 'HORAS';
  origenSupervisor: boolean;
  respaldoArchivo?: string;
}

export function formatISOToHeaderDate(isoDate: string, fmt: 'M/D/YYYY' | 'DD/MM/YYYY'): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const [year, month, day] = parts;
  if (fmt === 'M/D/YYYY') {
    return `${month}/${day}/${year}`;
  }
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function formatISOToDDMMYYYY(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function buildCellCode(rule: ContpaqiIncidenceRule, cantidad = 1): string {
  const cleanClave = (rule.clave || '').trim().toUpperCase();
  if (!cleanClave) return '';
  if (!rule.prefijoCantidad) return cleanClave;
  const qtyStr = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(1);
  // Si el usuario ya escribió "1FINJ" en la clave y cantidad es 1, no duplicar a "11FINJ"
  if (cantidad === 1 && /^\d+/.test(cleanClave) && cleanClave !== '1HE' && cleanClave !== '2HE') {
    return cleanClave;
  }
  return `${qtyStr}${cleanClave}`;
}

function resolveObservacionesColB(rule: ContpaqiIncidenceRule, supervisorName: string): string {
  if (rule.observacionesModo === 'FIJO' && rule.observacionesFijo.trim()) {
    return rule.observacionesFijo.trim().toUpperCase();
  }
  return (supervisorName || 'SIN SUPERVISOR').trim().toUpperCase();
}

/**
 * Identifica qué reglas de incidencia aplican a un día específico de un colaborador
 */
function matchDayRules(
  day: ProcessedDay,
  cfg: ContpaqiConfig,
  rulesMap: Map<string, ContpaqiIncidenceRule>
): { rule: ContpaqiIncidenceRule; cantidad: number }[] {
  const matched: { rule: ContpaqiIncidenceRule; cantidad: number }[] = [];
  const inc = (day.incidencia || '').trim().toUpperCase();
  const adv = (day.advertencia || '').trim().toUpperCase();
  const dayNameUpper = (day.dayName || '').trim().toUpperCase();

  // 1. Verificar primero reglas personalizadas por palabra clave
  cfg.reglasIncidencias.forEach(r => {
    if (r.esPersonalizada && r.palabraClaveMatch) {
      const kw = r.palabraClaveMatch.trim().toUpperCase();
      if (kw && inc.includes(kw)) {
        matched.push({ rule: r, cantidad: 1 });
      }
    }
  });

  // 2. Clasificación estándar exhaustiva de todas las incidencias del sistema
  if (inc.includes('FALTA') || adv.includes('FALTA CONFIRMADA')) {
    const r = rulesMap.get('FALTA');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('PRIMA DOMINICAL') || inc.includes('SEMANA REDUCIDA') || inc.includes('SRDN')) {
    const r = rulesMap.get('PRIMA_DOMINICAL');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('VACACIONES') || inc === 'VAC') {
    const r = rulesMap.get('VACACIONES');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('SIN GOCE')) {
    const r = rulesMap.get('PERMISO_SIN_GOCE');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('HOME OFFICE') || inc.includes('REMOTO')) {
    const r = rulesMap.get('HOME_OFFICE');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.startsWith('OTRA:') || inc === 'OTRO' || inc.includes('PATERNIDAD') || inc.includes('MATRIMONIO') || inc.includes('DEFUNCI')) {
    const r = rulesMap.get('OTRA_JUSTIFICACION');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('CON GOCE') || inc.includes('VIAJE') || inc.includes('COMISI')) {
    const r = rulesMap.get('PERMISO_CON_GOCE');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('INCAPACIDAD')) {
    const r = rulesMap.get('INCAPACIDAD');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('PASE') || inc.includes('MEDICO') || inc.includes('MÉDICO')) {
    const r = rulesMap.get('PASE_MEDICO');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc === 'RST') {
    const r = rulesMap.get('RST');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('FESTIVO')) {
    const r = rulesMap.get('FESTIVO');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('INGRESO')) {
    const r = rulesMap.get('INGRESO');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('CHECADA SIN GAFETE') || inc.includes('CHECADO SIN GAFETE') || day.tipoModificacionSupervisor === 'formato_checada_sin_gafete') {
    const rCSG = rulesMap.get('CHECADA_SIN_GAFETE');
    if (rCSG && rCSG.activa) {
      matched.push({ rule: rCSG, cantidad: 1 });
    }
    const rAsis = rulesMap.get('ASISTENCIA');
    if (rAsis && rAsis.activa) {
      matched.push({ rule: rAsis, cantidad: 1 });
    }
  } else if (inc.includes('DESCANSO') || (!day.horarioProgramado && day.hNormal === 0 && day.hExtra === 0 && !inc)) {
    const r = rulesMap.get('DESCANSO');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('RETARDO') || adv.includes('RETARDO')) {
    const rRet = rulesMap.get('RETARDO');
    if (rRet) matched.push({ rule: rRet, cantidad: 1 });
    // Si también tienen activa la exportación de Asistencia y asistió con retardo:
    const rAsis = rulesMap.get('ASISTENCIA');
    if (rAsis && rAsis.activa && (day.hNormal > 0 || day.entrada !== '--:--')) {
      matched.push({ rule: rAsis, cantidad: 1 });
    }
  } else if (inc === 'ASISTENCIA' || day.hNormal > 0 || (day.entrada && day.entrada !== '--:--')) {
    const rAsis = rulesMap.get('ASISTENCIA');
    if (rAsis) matched.push({ rule: rAsis, cantidad: 1 });
  }

  // 3. Detección automática de Prima Dominical / Semana Reducida si laboró en Domingo
  if (
    cfg.detectarPrimaDominicalAuto &&
    dayNameUpper.startsWith('DOM') &&
    (day.hNormal > 0 || day.hExtra > 0 || (day.entrada && day.entrada !== '--:--')) &&
    !inc.includes('FALTA') &&
    !matched.some(m => m.rule.id === 'PRIMA_DOMINICAL')
  ) {
    const rPrima = rulesMap.get('PRIMA_DOMINICAL');
    if (rPrima) {
      matched.push({ rule: rPrima, cantidad: 1 });
    }
  }

  return matched;
}

/**
 * Construye tanto las filas horizontales del Formato de Incidencias (idéntico a la captura)
 * como las filas verticales de movimientos TDD.
 */
export function buildContpaqiPayrollData(
  reports: EmployeeReport[],
  weekNumber: number,
  releases: Record<string, PayrollRelease>,
  cfg: ContpaqiConfig
): {
  formatRows: ContpaqiFormatRow[];
  movements: ContpaqiMovementRow[];
  datesInPeriod: { isoDate: string; dayName: string; headerLabel: string }[];
} {
  const formatRows: ContpaqiFormatRow[] = [];
  const movements: ContpaqiMovementRow[] = [];

  const rulesMap = new Map<string, ContpaqiIncidenceRule>();
  cfg.reglasIncidencias.forEach(r => rulesMap.set(r.id, r));

  // Recolectar las 7 fechas únicas ordenadas del periodo
  const dateMap = new Map<string, string>();
  reports.forEach(r => {
    r.dias.forEach(d => {
      if (!dateMap.has(d.isoDate)) {
        dateMap.set(d.isoDate, d.dayName);
      }
    });
  });

  const datesInPeriod = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([isoDate, dayName]) => ({
      isoDate,
      dayName,
      headerLabel: formatISOToHeaderDate(isoDate, cfg.formatoEncabezadoFecha),
    }));

  // Mapa para agrupar por (Empleado + ReglaIncidencia) para construir la matriz horizontal exacta de la imagen
  const groupedFormatRows = new Map<string, ContpaqiFormatRow>();

  const registerRuleOccurrence = (
    rep: EmployeeReport,
    day: ProcessedDay,
    rule: ContpaqiIncidenceRule,
    cantidad: number,
    unidad: 'DÍAS' | 'HORAS',
    estatusLiberacion: 'LIBERADO' | 'PENDIENTE'
  ) => {
    if (!rule.activa) return;

    const supName = (rep.empleado.jefe || 'SIN SUPERVISOR').trim().toUpperCase();
    const empId5 = String(rep.empleado.id).trim().padStart(5, '0');
    const empNameUpper = (rep.empleado.nombre || '').trim().toUpperCase();
    const nombreColA = (rule.nombreColA || 'GENERAL').trim().toUpperCase();
    const observacionesColB = resolveObservacionesColB(rule, supName);
    const conceptoColC = (rule.conceptoColC || rule.etiquetaSistema).trim().toUpperCase();
    const cellCode = buildCellCode(rule, cantidad);

    const rowKey = `${rule.id}__${empId5}`;
    let existing = groupedFormatRows.get(rowKey);
    if (!existing) {
      const emptyDates: Record<string, string> = {};
      datesInPeriod.forEach(dt => {
        emptyDates[dt.isoDate] = '';
      });
      existing = {
        rowKey,
        ruleId: rule.id,
        nombreColA,
        observacionesColB,
        conceptoColC,
        numEmpleadoColD: empId5,
        nombreEmpleadoColE: empNameUpper,
        montoColF: Number(rule.montoColF || 0),
        supervisor: supName,
        estatusLiberacion,
        origenSupervisor: Boolean(day.modificadoPorSupervisor),
        totalOcurrenciasSemana: 0,
        celdasPorFecha: emptyDates,
      };
      groupedFormatRows.set(rowKey, existing);
    }

    if (day.modificadoPorSupervisor) {
      existing.origenSupervisor = true;
    }
    existing.celdasPorFecha[day.isoDate] = cellCode;
    existing.totalOcurrenciasSemana += cantidad;

    movements.push({
      codigoEmpleado: empId5,
      nombreEmpleado: empNameUpper,
      supervisor: supName,
      estatusLiberacion,
      ejercicio: cfg.ejercicio,
      tipoPeriodo: cfg.tipoPeriodo,
      numeroPeriodo: weekNumber,
      fechaISO: day.isoDate,
      fechaContpaqi: formatISOToDDMMYYYY(day.isoDate),
      claveIncidencia: cellCode,
      nombreColA,
      observacionesColB,
      conceptoDescripcion: conceptoColC,
      monto: Number(rule.montoColF || 0),
      valor: cantidad,
      unidad,
      origenSupervisor: Boolean(day.modificadoPorSupervisor),
      respaldoArchivo: day.formatoSubidoNombre,
    });
  };

  reports.forEach(rep => {
    const supName = rep.empleado.jefe || 'SIN SUPERVISOR';
    const releaseKey = `${weekNumber}_${supName}`;
    const isReleased = releases[releaseKey]?.status === 'liberado';
    const estatusLiberacion: 'LIBERADO' | 'PENDIENTE' = isReleased ? 'LIBERADO' : 'PENDIENTE';

    if (cfg.soloSupervisoresLiberados && !isReleased) {
      return;
    }

    let horasExtrasAcumuladasSemana = 0;

    rep.dias.forEach(d => {
      // 1. Evaluar incidencias de día (Falta, Prima Dominical, Retardo, Asistencia, Vacaciones, Permisos, etc.)
      const dayMatches = matchDayRules(d, cfg, rulesMap);
      dayMatches.forEach(({ rule, cantidad }) => {
        registerRuleOccurrence(rep, d, rule, cantidad, 'DÍAS', estatusLiberacion);
      });

      // 2. Evaluar Horas Extras (Dobles y Triples)
      if (d.hExtra > 0) {
        const prevExtra = horasExtrasAcumuladasSemana;
        const newExtraTotal = Number((prevExtra + d.hExtra).toFixed(2));
        horasExtrasAcumuladasSemana = newExtraTotal;

        const rDobles = rulesMap.get('HORAS_EXTRAS_DOBLES');
        const rTriples = rulesMap.get('HORAS_EXTRAS_TRIPLES');

        if (cfg.separarExtrasDoblesTriplesLFT) {
          let hrsDoblesDia = 0;
          let hrsTriplesDia = 0;

          if (newExtraTotal <= 9) {
            hrsDoblesDia = Number(d.hExtra.toFixed(2));
          } else if (prevExtra >= 9) {
            hrsTriplesDia = Number(d.hExtra.toFixed(2));
          } else {
            hrsDoblesDia = Number((9 - prevExtra).toFixed(2));
            hrsTriplesDia = Number((d.hExtra - hrsDoblesDia).toFixed(2));
          }

          if (hrsDoblesDia > 0 && rDobles) {
            registerRuleOccurrence(rep, d, rDobles, hrsDoblesDia, 'HORAS', estatusLiberacion);
          }
          if (hrsTriplesDia > 0 && rTriples) {
            registerRuleOccurrence(rep, d, rTriples, hrsTriplesDia, 'HORAS', estatusLiberacion);
          }
        } else if (rDobles) {
          registerRuleOccurrence(
            rep,
            d,
            rDobles,
            Number(d.hExtra.toFixed(2)),
            'HORAS',
            estatusLiberacion
          );
        }
      }
    });
  });

  // Ordenar las filas primero por el orden del catálogo de reglas (ej. FALTA INJUSTIFICADA primero, luego PRIMA DOMINICAL, etc., como en la captura) y luego por NUM EMPLEADO
  const ruleOrderMap = new Map<string, number>();
  cfg.reglasIncidencias.forEach((r, idx) => ruleOrderMap.set(r.id, idx));

  const sortedFormatRows = Array.from(groupedFormatRows.values()).sort((a, b) => {
    const orderA = ruleOrderMap.get(a.ruleId) ?? 999;
    const orderB = ruleOrderMap.get(b.ruleId) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.numEmpleadoColD.localeCompare(b.numEmpleadoColD);
  });

  formatRows.push(...sortedFormatRows);

  return { formatRows, movements, datesInPeriod };
}

/**
 * Genera y descarga el archivo Excel (.xlsx) con el formato EXACTO solicitado en la captura:
 * Columnas:
 * NOMBRE | OBSERVACIONES | CONCEPTO | NUM EMPLEADO | NOMBRE | MONTO | 10/8/2026 | 10/9/2026 | ...
 */
export async function exportContpaqiExcel(
  reports: EmployeeReport[],
  weekNumber: number,
  releases: Record<string, PayrollRelease>,
  cfg: ContpaqiConfig
): Promise<string> {
  const { formatRows, movements, datesInPeriod } = buildContpaqiPayrollData(
    reports,
    weekNumber,
    releases,
    cfg
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendancePRO — Módulo CONTPAQi Nóminas';
  workbook.created = new Date();

  // =========================================================================
  // PESTAÑA 1: FORMATO OFICIAL DE INCIDENCIAS (IDÉNTICO A LA CAPTURA DE USUARIO)
  // NOMBRE | OBSERVACIONES | CONCEPTO | NUM EMPLEADO | NOMBRE | MONTO | Fechas...
  // =========================================================================
  const wsFormat = workbook.addWorksheet('Incidencias_CONTPAQi', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = [
    'NOMBRE',
    'OBSERVACIONES',
    'CONCEPTO',
    'NUM EMPLEADO',
    'NOMBRE',
    'MONTO',
    ...datesInPeriod.map(d => d.headerLabel),
  ];

  // Fila 1: Encabezado gris (#C0C0C0) con texto negro centrado y bordes delgados
  const headerRow = wsFormat.getRow(1);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Times New Roman', size: 10, bold: false, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF808080' } },
      bottom: { style: 'medium', color: { argb: 'FF404040' } },
      left: { style: 'thin', color: { argb: 'FF808080' } },
      right: { style: 'thin', color: { argb: 'FF808080' } },
    };
  });

  let currentRowIdx = 2;

  // Fila 2: Fila vacía separadora opcional (idéntica a la imagen proporcionada)
  if (cfg.incluirFilaVaciaSeparadora) {
    const emptyRow = wsFormat.getRow(currentRowIdx);
    emptyRow.values = headers.map(() => '');
    emptyRow.height = 19;
    emptyRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
    currentRowIdx++;
  }

  // Filas de datos
  formatRows.forEach(row => {
    const r = wsFormat.getRow(currentRowIdx++);
    const montoVal: string | number = row.montoColF > 0 ? Number(row.montoColF.toFixed(2)) : '-';

    r.values = [
      row.nombreColA,
      row.observacionesColB,
      row.conceptoColC,
      row.numEmpleadoColD,
      row.nombreEmpleadoColE,
      montoVal,
      ...datesInPeriod.map(d => row.celdasPorFecha[d.isoDate] || ''),
    ];
    r.height = 19;

    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > headers.length) return;
      cell.font = {
        name: 'Times New Roman',
        size: 10,
        color: { argb: 'FF000000' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 6 && typeof montoVal === 'number' ? 'right' : 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      };

      // Columna 4: NUM EMPLEADO siempre texto de 5 dígitos ('00227', '00615')
      if (colNumber === 4) {
        cell.numFmt = '@';
      }
      // Columna 6: MONTO numérico con 2 decimales cuando es mayor a 0
      if (colNumber === 6 && typeof montoVal === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  wsFormat.columns = [
    { width: 22 }, // NOMBRE (Ej. PAGO 0, GUARDIAS 12 HRS)
    { width: 26 }, // OBSERVACIONES (Ej. PATRICIA CONSEJO, SEMANA REDUCIDA)
    { width: 26 }, // CONCEPTO (Ej. FALTA INJUSTIFICADA, PRIMA DOMINICAL)
    { width: 18 }, // NUM EMPLEADO (Ej. 00227)
    { width: 42 }, // NOMBRE EMPLEADO
    { width: 14 }, // MONTO
    ...datesInPeriod.map(() => ({ width: 13 })), // 7 Fechas
  ];

  // =========================================================================
  // PESTAÑA 2: DESGLOSE VERTICAL DE MOVIMIENTOS (TABLA TDD CONTPAQi)
  // =========================================================================
  const wsTDD = workbook.addWorksheet('Movimientos_TDD_Vertical', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const tddHeaders = [
    'NUM EMPLEADO',
    'NOMBRE',
    'NOMBRE GRUPO',
    'OBSERVACIONES',
    'CONCEPTO',
    'CLAVE CONTPAQi',
    'FECHA MOVIMIENTO',
    'VALOR',
    'UNIDAD',
    'MONTO',
    'ESTATUS SUPERVISOR',
  ];

  const headerRowTDD = wsTDD.getRow(1);
  headerRowTDD.values = tddHeaders;
  headerRowTDD.height = 22;
  headerRowTDD.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  movements.forEach((m, idx) => {
    const r = wsTDD.getRow(2 + idx);
    r.values = [
      m.codigoEmpleado,
      m.nombreEmpleado,
      m.nombreColA,
      m.observacionesColB,
      m.conceptoDescripcion,
      m.claveIncidencia,
      m.fechaContpaqi,
      m.valor,
      m.unidad,
      m.monto > 0 ? m.monto : '-',
      m.estatusLiberacion,
    ];
    r.height = 19;
    r.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
      };
      if (colNumber === 1) cell.numFmt = '@';
    });
  });

  wsTDD.columns = [
    { width: 16 },
    { width: 38 },
    { width: 20 },
    { width: 24 },
    { width: 26 },
    { width: 16 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 18 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `Incidencias_CONTPAQi_Sem${weekNumber}_${cfg.ejercicio}.xlsx`;
  saveAs(blob, fileName);
  return fileName;
}

/**
 * Descarga archivo .TXT delimitado por tabuladores con la misma estructura de columnas
 */
export function exportContpaqiTxt(
  reports: EmployeeReport[],
  weekNumber: number,
  releases: Record<string, PayrollRelease>,
  cfg: ContpaqiConfig
): string {
  const { formatRows, datesInPeriod } = buildContpaqiPayrollData(reports, weekNumber, releases, cfg);

  const header = [
    'NOMBRE',
    'OBSERVACIONES',
    'CONCEPTO',
    'NUM EMPLEADO',
    'NOMBRE',
    'MONTO',
    ...datesInPeriod.map(d => d.headerLabel),
  ].join('\t');

  const lines = formatRows.map(row =>
    [
      row.nombreColA,
      row.observacionesColB,
      row.conceptoColC,
      row.numEmpleadoColD,
      row.nombreEmpleadoColE,
      row.montoColF > 0 ? row.montoColF.toFixed(2) : '-',
      ...datesInPeriod.map(d => row.celdasPorFecha[d.isoDate] || ''),
    ].join('\t')
  );

  const content = [header, ...lines].join('\r\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const fileName = `Incidencias_CONTPAQi_Sem${weekNumber}_${cfg.ejercicio}.txt`;
  saveAs(blob, fileName);
  return fileName;
}
