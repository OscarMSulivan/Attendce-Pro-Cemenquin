/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizarHorarioDia } from '../core/eventsHierarchy';

export const NOMBRES_DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const NOMBRES_DIAS_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Días festivos oficiales en México (2026 y 2027)
export const FESTIVOS_OFICIALES: Record<string, string> = {
  // 2026
  '2026-01-01': 'Año Nuevo',
  '2026-02-02': 'Día de la Constitución',
  '2026-03-16': 'Natalicio de Benito Juárez',
  '2026-05-01': 'Día del Trabajo',
  '2026-09-16': 'Día de la Independencia',
  '2026-11-16': 'Revolución Mexicana',
  '2026-12-25': 'Navidad',
  // 2027
  '2027-01-01': 'Año Nuevo',
  '2027-02-01': 'Día de la Constitución',
  '2027-03-15': 'Natalicio de Benito Juárez',
  '2027-05-01': 'Día del Trabajo',
  '2027-09-16': 'Día de la Independencia',
  '2027-11-15': 'Revolución Mexicana',
  '2027-12-25': 'Navidad',
};

export const OPCIONES_INCIDENCIA = [
  "",
  "Asistencia",
  "Retardo",
  "Falta Injustificada",
  "Checado sin Gafete",
  "Permiso sin Goce",
  "Pase Medico",
  "Descanso",
  "Festivo"
];

// Opciones disponibles para selección manual por parte del Supervisor
// Festivos, Vacaciones, Permisos con goce, Incapacidades y Primas Dominicales son automáticos o por solicitud formal
export const OPCIONES_INCIDENCIA_SUPERVISOR = [
  "",
  "Retardo",
  "Falta Injustificada",
  "Checado sin Gafete",
  "Permiso sin Goce",
  "Pase Medico"
];

/**
 * Obtiene el día de la semana (0=Dom..6=Sáb) de forma determinista
 * sin sufrir desfases por huso horario (timezones).
 */
export function getDayOfWeekFromISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  // Usar Date constructor en hora local a las 12:00 para evitar cualquier borde de medianoche
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.getDay();
}

/**
 * Suma o resta días a una fecha ISO "YYYY-MM-DD"
 */
export function addDaysToISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Retorna la lista de fechas ISO en el rango [inicioISO, finISO]
 */
export function getDateRangeISO(startISO: string, endISO: string): string[] {
  const result: string[] = [];
  let current = startISO;
  let safety = 0;
  while (current <= endISO && safety < 100) {
    result.push(current);
    current = addDaysToISO(current, 1);
    safety++;
  }
  return result;
}

export interface PayrollWeekOption {
  value: string; // "YYYY-MM-DD|YYYY-MM-DD"
  label: string;
  weekNumber: number;
  startISO: string;
  endISO: string;
}

/**
 * Genera las 52 semanas de nómina del año solicitado (por defecto 2026).
 * Alineado con el ciclo de nómina Jueves a Miércoles (o correspondiente a inicio de año).
 */
export function generatePayrollWeeks(year = 2026): PayrollWeekOption[] {
  const weeks: PayrollWeekOption[] = [];
  // En el sistema original: comienza en el primer jueves del año
  let f = new Date(year, 0, 1, 12, 0, 0);
  f.setDate(f.getDate() + ((4 - f.getDay() + 7) % 7));

  for (let i = 1; i <= 52; i++) {
    const startY = f.getFullYear();
    const startM = String(f.getMonth() + 1).padStart(2, '0');
    const startD = String(f.getDate()).padStart(2, '0');
    const sF = `${startY}-${startM}-${startD}`;

    const fin = new Date(f.getTime());
    fin.setDate(fin.getDate() + 6);
    const endY = fin.getFullYear();
    const endM = String(fin.getMonth() + 1).padStart(2, '0');
    const endD = String(fin.getDate()).padStart(2, '0');
    const eF = `${endY}-${endM}-${endD}`;

    weeks.push({
      value: `${sF}|${eF}`,
      label: `Semana ${i}: del ${sF} al ${eF}`,
      weekNumber: i,
      startISO: sF,
      endISO: eF
    });

    f.setDate(f.getDate() + 7);
  }

  return weeks;
}

/**
 * Normaliza cualquier ID de empleado asegurando formato estándar de 5 dígitos con ceros a la izquierda (ej: 615 -> 00615)
 */
export function normalizeEmployeeId(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '';
  const str = id.toString().trim();
  if (!str) return '';
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? str : parsed.toString().padStart(5, '0');
}

/**
 * Normaliza el nombre del supervisor actualizando relevos (ej: Omar Avalos -> Eudis Zenon)
 */
export function normalizeSupervisorName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.toString().trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (upper.includes('OMAR') && upper.includes('AVALOS')) {
    return 'EUDIS ZENON';
  }
  return trimmed;
}


/**
 * Detecta automáticamente la semana de nómina (Jueves a Miércoles) que mejor coincide
 * con un conjunto de fechas ISO de checadas biométricas.
 */
export function detectPayrollWeekFromDates(
  dates: string[],
  availableWeeks: PayrollWeekOption[]
): PayrollWeekOption | null {
  if (!dates || dates.length === 0 || !availableWeeks || availableWeeks.length === 0) {
    return null;
  }

  // Contar frecuencias de checadas por fecha
  const dateCounts: Record<string, number> = {};
  for (const d of dates) {
    if (d && typeof d === 'string') {
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
  }

  let bestWeek: PayrollWeekOption | null = null;
  let maxOverlap = 0;

  for (const week of availableWeeks) {
    let currentScore = 0;
    for (const [isoDate, count] of Object.entries(dateCounts)) {
      if (isoDate >= week.startISO && isoDate <= week.endISO) {
        currentScore += count;
      }
    }

    if (currentScore > maxOverlap) {
      maxOverlap = currentScore;
      bestWeek = week;
    }
  }

  return bestWeek;
}

/**
 * Formatea en texto claro de qué hora a qué hora es un horario programado
 * (ej. "Lun-Vie: 08:00 a 16:00 hrs · Sáb: 08:00 a 13:30 hrs")
 */
export function formatScheduleHoursSummary(
  cfg?: {
    nombre?: string;
    dias?: Record<number, { entrada: string; salida: string; comida?: number; cruzaMedianoche?: boolean } | null>;
    turnos?: Record<number, { entrada: string; salida: string; comida?: number; cruzaMedianoche?: boolean } | null>;
  } | null
): string {
  const map = cfg?.dias || cfg?.turnos;
  if (!cfg || !map) return 'Lun-Vie: 08:00 a 16:00 hrs · Sáb: 08:00 a 13:30 hrs';

  const groups: Array<{ days: string[]; range: string }> = [];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Lun a Dom
  const dayNames: Record<number, string> = {
    1: 'Lun',
    2: 'Mar',
    3: 'Mié',
    4: 'Jue',
    5: 'Vie',
    6: 'Sáb',
    0: 'Dom',
  };

  for (const d of dayOrder) {
    const rawShift = map[d];
    if (!rawShift || !rawShift.entrada || !rawShift.salida) continue;
    const shift = normalizarHorarioDia({
      entrada: rawShift.entrada,
      salida: rawShift.salida,
      comida: rawShift.comida ?? 60,
      cruzaMedianoche: Boolean(rawShift.cruzaMedianoche),
    });
    if (!shift) continue;
    const rangeStr = `${shift.entrada} a ${shift.salida} hrs${shift.cruzaMedianoche ? ' (+1d)' : ''}`;
    const last = groups[groups.length - 1];
    if (last && last.range === rangeStr) {
      last.days.push(dayNames[d]);
    } else {
      groups.push({ days: [dayNames[d]], range: rangeStr });
    }
  }

  if (groups.length === 0) return 'Sin turnos activos';

  return groups
    .map(g => {
      const dayLabel =
        g.days.length > 2
          ? `${g.days[0]}-${g.days[g.days.length - 1]}`
          : g.days.join(', ');
      return `${dayLabel}: ${g.range}`;
    })
    .join(' · ');
}



