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
  | 'RETARDO'
  | 'HORAS_EXTRAS_DOBLES'
  | 'HORAS_EXTRAS_TRIPLES'
  | string;

export interface ContpaqiIncidenceRule {
  id: IncidenceRuleId;
  etiquetaSistema: string;     // Nombre amigable en el configurador
  clave: string;               // Clave CONTPAQi (ej. "FINJ", "RET", "1HE", "2HE")
  prefijoCantidad: boolean;    // Si true, antepone el número al código en las celdas de fecha (ej. "1FINJ", "21HE")
  nombreColA: string;          // Columna A ("NOMBRE"): ej. "PAGO 0", "DESCUENTO RETARDO", "TIEMPO EXTRA"
  observacionesModo: 'SUPERVISOR' | 'FIJO';
  observacionesFijo: string;
  conceptoColC: string;        // Columna C ("CONCEPTO"): ej. "FALTA INJUSTIFICADA", "RETARDO"
  montoColF: number;           // Columna F ("MONTO") base o tarifa
  activa: boolean;
  esPersonalizada?: boolean;
  palabraClaveMatch?: string;
}

export interface ContpaqiConfig {
  tipoPeriodo: 'SEMANAL' | 'QUINCENAL' | 'CATORCENAL';
  ejercicio: number;
  formatoEncabezadoFecha: 'M/D/YYYY' | 'DD/MM/YYYY';
  incluirFilaVaciaSeparadora: boolean;
  separarExtrasDoblesTriplesLFT: boolean;
  soloSupervisoresLiberados: boolean;
  // Configuración de cálculo de descuento por retardo
  modoDescuentoRetardo: 'POR_MINUTO' | 'POR_EVENTO' | 'SOLO_TIEMPO';
  costoPorMinutoRetardo: number;       // Ej. $2.50 por minuto de retardo (o 0 si solo se reportan minutos/horas)
  incluirMinutosEnCeldaRetardo: boolean; // Si true, muestra ej. "1RET (18m)" o los minutos a descontar
  reglasIncidencias: ContpaqiIncidenceRule[];
}

/**
 * Catálogo simplificado con únicamente las 4 incidencias esenciales solicitadas por Nóminas:
 * 1. FINJ — Falta Injustificada
 * 2. RETARDO — Retardo (con cálculo automático de tiempo/monto a descontar)
 * 3. HORAS_EXTRAS_DOBLES — Horas Extras Dobles (≤ 9h LFT)
 * 4. HORAS_EXTRAS_TRIPLES — Horas Extras Triples (> 9h LFT)
 * Nota: Cuando la celda está vacía ("") = Asistencia normal.
 */
export const DEFAULT_INCIDENCE_RULES: ContpaqiIncidenceRule[] = [
  {
    id: 'FALTA',
    etiquetaSistema: 'Falta Injustificada (FINJ)',
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
    id: 'RETARDO',
    etiquetaSistema: 'Retardo (Cálculo de Descuento)',
    clave: 'RET',
    prefijoCantidad: true,
    nombreColA: 'DESCUENTO RETARDO',
    observacionesModo: 'SUPERVISOR',
    observacionesFijo: '',
    conceptoColC: 'RETARDO',
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
  soloSupervisoresLiberados: false,
  modoDescuentoRetardo: 'POR_MINUTO',
  costoPorMinutoRetardo: 2.5,
  incluirMinutosEnCeldaRetardo: true,
  reglasIncidencias: DEFAULT_INCIDENCE_RULES,
};

// Nueva versión de llave para limpiar el exceso de reglas anteriores y dejar solo las 4 esenciales + personalizadas
const CONTPAQI_CONFIG_KEY = 'attendance_pro_v10_contpaqi_config_v3_simplified';

export function loadContpaqiConfig(): ContpaqiConfig {
  try {
    const raw = localStorage.getItem(CONTPAQI_CONFIG_KEY);
    if (!raw) return DEFAULT_CONTPAQI_CONFIG;
    const parsed = JSON.parse(raw);
    const savedRules: ContpaqiIncidenceRule[] = Array.isArray(parsed.reglasIncidencias)
      ? parsed.reglasIncidencias
      : [];

    // Mantener las 4 reglas esenciales en orden + las personalizadas que el usuario haya creado
    const mergedRules: ContpaqiIncidenceRule[] = DEFAULT_INCIDENCE_RULES.map(defRule => {
      const found = savedRules.find(r => r.id === defRule.id);
      return found ? { ...defRule, ...found } : defRule;
    });

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

export interface ContpaqiFormatRow {
  rowKey: string;
  ruleId: IncidenceRuleId;
  nombreColA: string;
  observacionesColB: string;
  conceptoColC: string;
  numEmpleadoColD: string;
  nombreEmpleadoColE: string;
  montoColF: number;
  minutosRetardoAcumulados?: number;
  horasDescuentoRetardo?: number;
  supervisor: string;
  estatusLiberacion: 'LIBERADO' | 'PENDIENTE';
  origenSupervisor: boolean;
  totalOcurrenciasSemana: number;
  celdasPorFecha: Record<string, string>;
}

export interface ContpaqiMovementRow {
  codigoEmpleado: string;
  nombreEmpleado: string;
  supervisor: string;
  estatusLiberacion: 'LIBERADO' | 'PENDIENTE';
  ejercicio: number;
  tipoPeriodo: string;
  numeroPeriodo: number;
  fechaISO: string;
  fechaContpaqi: string;
  claveIncidencia: string;
  nombreColA: string;
  observacionesColB: string;
  conceptoDescripcion: string;
  monto: number;
  minutosRetardo?: number;
  valor: number;
  unidad: 'DÍAS' | 'HORAS' | 'MINUTOS';
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

function parseTimeMinutes(timeStr?: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Calcula cuántos minutos de retardo tuvo el colaborador en ese día comparando
 * su hora de entrada real contra la hora de entrada de su horario programado.
 */
export function calcularMinutosRetardoDia(day: ProcessedDay): number {
  const realMin = parseTimeMinutes(day.entrada);
  if (realMin === null) return 15; // Si fue marcado manualmente como Retardo sin hora exacta, estimar 15 min

  if (day.horarioProgramado && day.horarioProgramado.entrada) {
    const schedMin = parseTimeMinutes(day.horarioProgramado.entrada);
    if (schedMin !== null) {
      let diff = realMin - schedMin;
      if (diff < -720) diff += 1440;
      if (diff > 0) return diff;
    }
  }

  // Fallback si el horario estándar entra a las 08:00 (480 min)
  if (realMin > 480 && realMin < 720) {
    return realMin - 480;
  }
  return 15;
}

function buildCellCode(
  rule: ContpaqiIncidenceRule,
  cantidad = 1,
  minutosRetardo?: number,
  incluirMinutosRetardo?: boolean
): string {
  const cleanClave = (rule.clave || '').trim().toUpperCase();
  if (!cleanClave) return '';

  let baseCode = cleanClave;
  if (rule.prefijoCantidad) {
    const qtyStr = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(1);
    if (cantidad === 1 && /^\d+/.test(cleanClave) && cleanClave !== '1HE' && cleanClave !== '2HE') {
      baseCode = cleanClave;
    } else {
      baseCode = `${qtyStr}${cleanClave}`;
    }
  }

  if (rule.id === 'RETARDO' && incluirMinutosRetardo && minutosRetardo && minutosRetardo > 0) {
    return `${baseCode} (-${minutosRetardo}m)`;
  }

  return baseCode;
}

function resolveObservacionesColB(rule: ContpaqiIncidenceRule, supervisorName: string): string {
  if (rule.observacionesModo === 'FIJO' && rule.observacionesFijo.trim()) {
    return rule.observacionesFijo.trim().toUpperCase();
  }
  return (supervisorName || 'SIN SUPERVISOR').trim().toUpperCase();
}

/**
 * Identifica qué reglas de incidencia aplican a un día específico.
 * Nota: Cuando es Asistencia normal o Descanso, regresa vacío (celda vacía = Asistencia).
 */
function matchDayRules(
  day: ProcessedDay,
  cfg: ContpaqiConfig,
  rulesMap: Map<string, ContpaqiIncidenceRule>
): { rule: ContpaqiIncidenceRule; cantidad: number; minutosRetardo?: number }[] {
  const matched: { rule: ContpaqiIncidenceRule; cantidad: number; minutosRetardo?: number }[] = [];
  const inc = (day.incidencia || '').trim().toUpperCase();
  const adv = (day.advertencia || '').trim().toUpperCase();

  // 1. Verificar primero reglas personalizadas agregadas por el usuario
  cfg.reglasIncidencias.forEach(r => {
    if (r.esPersonalizada && r.palabraClaveMatch) {
      const kw = r.palabraClaveMatch.trim().toUpperCase();
      if (kw && inc.includes(kw)) {
        matched.push({ rule: r, cantidad: 1 });
      }
    }
  });

  // 2. Clasificación de las incidencias esenciales (Falta Injustificada y Retardo)
  // Si es Asistencia o Descanso -> queda vacío ("")
  if (inc.includes('FALTA') || adv.includes('FALTA CONFIRMADA')) {
    const r = rulesMap.get('FALTA');
    if (r) matched.push({ rule: r, cantidad: 1 });
  } else if (inc.includes('RETARDO') || adv.includes('RETARDO')) {
    const rRet = rulesMap.get('RETARDO');
    if (rRet) {
      const minRet = calcularMinutosRetardoDia(day);
      matched.push({ rule: rRet, cantidad: 1, minutosRetardo: minRet });
    }
  }

  return matched;
}

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

  const groupedFormatRows = new Map<string, ContpaqiFormatRow>();

  const registerRuleOccurrence = (
    rep: EmployeeReport,
    day: ProcessedDay,
    rule: ContpaqiIncidenceRule,
    cantidad: number,
    unidad: 'DÍAS' | 'HORAS' | 'MINUTOS',
    estatusLiberacion: 'LIBERADO' | 'PENDIENTE',
    minutosRetardoDia = 0
  ) => {
    if (!rule.activa) return;

    const supName = (rep.empleado.jefe || 'SIN SUPERVISOR').trim().toUpperCase();
    const empId5 = String(rep.empleado.id).trim().padStart(5, '0');
    const empNameUpper = (rep.empleado.nombre || '').trim().toUpperCase();
    const nombreColA = (rule.nombreColA || 'GENERAL').trim().toUpperCase();
    const observacionesColB = resolveObservacionesColB(rule, supName);
    const conceptoColC = (rule.conceptoColC || rule.etiquetaSistema).trim().toUpperCase();
    const cellCode = buildCellCode(
      rule,
      cantidad,
      minutosRetardoDia,
      cfg.incluirMinutosEnCeldaRetardo
    );

    // Calcular el monto del día para esta incidencia
    let montoEvento = Number(rule.montoColF || 0);
    if (rule.id === 'RETARDO') {
      if (cfg.modoDescuentoRetardo === 'POR_MINUTO') {
        montoEvento = Number((minutosRetardoDia * (cfg.costoPorMinutoRetardo || 0)).toFixed(2));
      } else if (cfg.modoDescuentoRetardo === 'POR_EVENTO') {
        montoEvento = Number(rule.montoColF || 0);
      } else {
        montoEvento = 0;
      }
    }

    const rowKey = `${rule.id}__${empId5}`;
    let existing = groupedFormatRows.get(rowKey);
    if (!existing) {
      const emptyDates: Record<string, string> = {};
      datesInPeriod.forEach(dt => {
        emptyDates[dt.isoDate] = ''; // Vacío = Asistencia normal
      });
      existing = {
        rowKey,
        ruleId: rule.id,
        nombreColA,
        observacionesColB,
        conceptoColC,
        numEmpleadoColD: empId5,
        nombreEmpleadoColE: empNameUpper,
        montoColF: 0,
        minutosRetardoAcumulados: 0,
        horasDescuentoRetardo: 0,
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

    if (rule.id === 'RETARDO') {
      existing.minutosRetardoAcumulados = (existing.minutosRetardoAcumulados || 0) + minutosRetardoDia;
      existing.horasDescuentoRetardo = Number(((existing.minutosRetardoAcumulados || 0) / 60).toFixed(2));
      existing.montoColF = Number((existing.montoColF + montoEvento).toFixed(2));
      // Mostrar en CONCEPTO el detalle del tiempo a descontar
      existing.conceptoColC = `${conceptoColC} (-${existing.minutosRetardoAcumulados} MIN / ${existing.horasDescuentoRetardo} HRS)`;
    } else {
      existing.montoColF = Number(rule.montoColF || 0);
    }

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
      conceptoDescripcion:
        rule.id === 'RETARDO'
          ? `${conceptoColC} (Descuento: ${minutosRetardoDia} min)`
          : conceptoColC,
      monto: montoEvento,
      minutosRetardo: minutosRetardoDia > 0 ? minutosRetardoDia : undefined,
      valor: rule.id === 'RETARDO' && minutosRetardoDia > 0 ? minutosRetardoDia : cantidad,
      unidad: rule.id === 'RETARDO' && minutosRetardoDia > 0 ? 'MINUTOS' : unidad,
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
      // 1. Evaluar incidencias de día (Falta Injustificada, Retardo con cálculo de descuento y personalizadas)
      const dayMatches = matchDayRules(d, cfg, rulesMap);
      dayMatches.forEach(({ rule, cantidad, minutosRetardo }) => {
        registerRuleOccurrence(
          rep,
          d,
          rule,
          cantidad,
          'DÍAS',
          estatusLiberacion,
          minutosRetardo || 0
        );
      });

      // 2. Evaluar Horas Extras Autorizadas (Dobles ≤ 9h y Triples > 9h)
      if (d.hExtra > 0 && d.horasExtrasAutorizadas === true) {
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

      if (colNumber === 4) {
        cell.numFmt = '@';
      }
      if (colNumber === 6 && typeof montoVal === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  wsFormat.columns = [
    { width: 22 },
    { width: 26 },
    { width: 32 },
    { width: 18 },
    { width: 42 },
    { width: 14 },
    ...datesInPeriod.map(() => ({ width: 14 })),
  ];

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
    'MONTO DESCUENTO / PAGO',
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
    { width: 32 },
    { width: 16 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 22 },
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
