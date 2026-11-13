/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  AlertOctagon,
  Flame,
  ShieldAlert,
  Filter,
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  ArrowLeftRight,
  CreditCard,
  Briefcase,
  Ban,
  Paperclip,
  Download,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  ShieldCheck,
  XCircle,
  Lock
} from 'lucide-react';
import { Employee, EmployeeReport, ProcessedDay, ScheduleConfig } from '../types/attendance';
import { FESTIVOS_OFICIALES, OPCIONES_INCIDENCIA, OPCIONES_INCIDENCIA_SUPERVISOR, formatScheduleHoursSummary } from '../utils/calendarUtils';
import { getScheduleForDay, resolveScheduleCodeInCatalog } from '../core/attendanceEngine';
import { ResolutionMode } from './portal/MissingPunchFormatModal';
import saveAs from 'file-saver';

export type AnomalySeverity = 'critical' | 'warning';

export type AnomalyCategory =
  | 'extreme_workday'
  | 'impossible_punch'
  | 'out_of_shift'
  | 'calculation_mismatch';

export interface CellAnomaly {
  severity: AnomalySeverity;
  category: AnomalyCategory;
  shortLabel: string;
  detail: string;
}

export interface DayDataAnomalies {
  hasAnomalies: boolean;
  highestSeverity: AnomalySeverity | null;
  entrada?: CellAnomaly;
  salida?: CellAnomaly;
  hNormal?: CellAnomaly;
  hExtra?: CellAnomaly;
  incidencia?: CellAnomaly;
  all: CellAnomaly[];
  canSwapInvertedPunches: boolean;
}

function parseTimeMinutes(hhmm: string | undefined | null): number | null {
  if (!hhmm || hhmm === '--:--') return null;
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function formatSignedHours(minutesDiff: number): string {
  const sign = minutesDiff >= 0 ? '+' : '-';
  const absHrs = (Math.abs(minutesDiff) / 60).toFixed(1);
  return `${sign}${absHrs}h`;
}

/**
 * Analiza una fila diaria (ProcessedDay) para detectar inconsistencias en las celdas:
 * - Jornadas extremadamente largas (> 12h advertencia, >= 14h crítico)
 * - Checadas imposibles, invertidas (salida <= entrada en turno diurno) o duplicadas (< 45 min)
 * - Checadas fuera del rango lógico del turno programado (desfases > 3h en entrada o > 4.5h en salida)
 * - Inconsistencias entre la incidencia asignada y las horas calculadas (ej. Falta con horas > 0, o Asistencia con 0h)
 */
export function analyzeDayDataAnomalies(day: ProcessedDay): DayDataAnomalies {
  const all: CellAnomaly[] = [];
  let entradaAnomaly: CellAnomaly | undefined;
  let salidaAnomaly: CellAnomaly | undefined;
  let hNormalAnomaly: CellAnomaly | undefined;
  let hExtraAnomaly: CellAnomaly | undefined;
  let incidenciaAnomaly: CellAnomaly | undefined;
  let canSwapInvertedPunches = false;

  const entMin = parseTimeMinutes(day.entrada);
  const salMin = parseTimeMinutes(day.salida);
  const schedEntMin = parseTimeMinutes(day.horarioProgramado?.entrada);
  const schedSalMin = parseTimeMinutes(day.horarioProgramado?.salida);
  const cruzaMedianoche = Boolean(day.horarioProgramado?.cruzaMedianoche);

  const totalWorkedHours = (day.hNormal || 0) + (day.hExtra || 0);
  const incLower = (day.incidencia || '').toLowerCase();
  const isAbsenceIncidence =
    incLower.includes('falta') ||
    incLower.includes('incapacidad') ||
    incLower.includes('vacaciones') ||
    incLower.includes('permiso sin goce');

  // 1. Checadas imposibles o invertidas cuando existen Entrada y Salida
  if (entMin !== null && salMin !== null) {
    const rawDiffMin = salMin - entMin;
    const effectiveSpanMin =
      rawDiffMin < 0
        ? cruzaMedianoche
          ? rawDiffMin + 1440
          : rawDiffMin
        : rawDiffMin;

    if (!cruzaMedianoche && rawDiffMin < 0) {
      canSwapInvertedPunches = true;
      const invAnomaly: CellAnomaly = {
        severity: 'critical',
        category: 'impossible_punch',
        shortLabel: 'Checada invertida',
        detail: `La salida (${day.salida}) es anterior a la entrada (${day.entrada}) en un turno que no cruza medianoche. Puede provocar horas en 0 o cálculo erróneo.`,
      };
      entradaAnomaly = invAnomaly;
      salidaAnomaly = invAnomaly;
      all.push(invAnomaly);
    } else if (Math.abs(rawDiffMin) <= 30) {
      const dupAnomaly: CellAnomaly = {
        severity: 'critical',
        category: 'impossible_punch',
        shortLabel: `Lapso ${Math.abs(rawDiffMin)}m`,
        detail: `Entrada (${day.entrada}) y Salida (${day.salida}) tienen solo ${Math.abs(rawDiffMin)} min de diferencia (posible checada duplicada en el mismo minuto/bloque).`,
      };
      entradaAnomaly = dupAnomaly;
      salidaAnomaly = dupAnomaly;
      all.push(dupAnomaly);
    } else if (effectiveSpanMin > 16 * 60) {
      const spanHrs = (effectiveSpanMin / 60).toFixed(1);
      const impossibleSpan: CellAnomaly = {
        severity: 'critical',
        category: 'extreme_workday',
        shortLabel: `Rango ${spanHrs}h`,
        detail: `El tiempo transcurrido entre Entrada (${day.entrada}) y Salida (${day.salida}) es de ${spanHrs} horas (> 16h), lo que sugiere una checada del día siguiente o turno mal cerrado.`,
      };
      salidaAnomaly = impossibleSpan;
      all.push(impossibleSpan);
    }
  }

  // 2. Checadas fuera del rango de turno programado
  if (day.horarioProgramado && schedEntMin !== null && schedSalMin !== null) {
    if (entMin !== null && !entradaAnomaly) {
      let diffEnt = entMin - schedEntMin;
      if (cruzaMedianoche && Math.abs(diffEnt) > 720) {
        diffEnt = diffEnt > 0 ? diffEnt - 1440 : diffEnt + 1440;
      }
      // Más de 2.5 horas antes o más de 3.5 horas después del inicio del turno
      if (diffEnt < -150 || diffEnt > 210) {
        const isCritical = Math.abs(diffEnt) >= 300; // >= 5 horas de desfase
        entradaAnomaly = {
          severity: isCritical ? 'critical' : 'warning',
          category: 'out_of_shift',
          shortLabel: `Fuera turno (${formatSignedHours(diffEnt)})`,
          detail: `Entrada registrada a las ${day.entrada} vs. turno programado ${day.horarioProgramado.entrada} (${formatSignedHours(diffEnt)} de desfase). Verifica si tiene asignado otro turno.`,
        };
        all.push(entradaAnomaly);
      }
    }

    if (salMin !== null && !salidaAnomaly) {
      let diffSal = salMin - schedSalMin;
      if (cruzaMedianoche && Math.abs(diffSal) > 720) {
        diffSal = diffSal > 0 ? diffSal - 1440 : diffSal + 1440;
      }
      // Salida más de 3 horas antes (sin permiso/pase) o más de 4.5 horas después del cierre de turno
      const hasEarlyExitJustification =
        incLower.includes('permiso') || incLower.includes('pase');
      if ((!hasEarlyExitJustification && diffSal < -180) || diffSal > 270) {
        const isCritical = Math.abs(diffSal) >= 360; // >= 6 horas de desfase
        salidaAnomaly = {
          severity: isCritical ? 'critical' : 'warning',
          category: 'out_of_shift',
          shortLabel: `Fuera turno (${formatSignedHours(diffSal)})`,
          detail: `Salida registrada a las ${day.salida} vs. fin de turno ${day.horarioProgramado.salida} (${formatSignedHours(diffSal)} de desfase).`,
        };
        all.push(salidaAnomaly);
      }
    }
  } else if (!day.horarioProgramado && (entMin !== null || salMin !== null)) {
    // Checada en día de Descanso programado
    if (entMin !== null && salMin === null && !entradaAnomaly) {
      entradaAnomaly = {
        severity: 'warning',
        category: 'out_of_shift',
        shortLabel: 'Incompleta en descanso',
        detail: `Se registró entrada (${day.entrada}) en día de Descanso programado pero no hay checada de salida.`,
      };
      all.push(entradaAnomaly);
    } else if (salMin !== null && entMin === null && !salidaAnomaly) {
      salidaAnomaly = {
        severity: 'warning',
        category: 'out_of_shift',
        shortLabel: 'Incompleta en descanso',
        detail: `Se registró salida (${day.salida}) en día de Descanso programado pero no hay checada de entrada.`,
      };
      all.push(salidaAnomaly);
    }
  }

  // 3. Jornadas extremadamente largas (H. Normal / H. Extra)
  if (totalWorkedHours >= 14) {
    const extremeAnomaly: CellAnomaly = {
      severity: 'critical',
      category: 'extreme_workday',
      shortLabel: `Jornada extrema (${totalWorkedHours.toFixed(1)}h)`,
      detail: `La jornada total calculada (${totalWorkedHours.toFixed(2)}h = ${day.hNormal.toFixed(2)}h norm + ${day.hExtra.toFixed(2)}h extra) supera las 14 horas diarias. Revisa antes de exportar a nómina.`,
    };
    hNormalAnomaly = extremeAnomaly;
    if (day.hExtra > 0) hExtraAnomaly = extremeAnomaly;
    all.push(extremeAnomaly);
  } else if (totalWorkedHours > 12) {
    const longAnomaly: CellAnomaly = {
      severity: 'warning',
      category: 'extreme_workday',
      shortLabel: `Jornada >12h (${totalWorkedHours.toFixed(1)}h)`,
      detail: `La jornada total (${totalWorkedHours.toFixed(2)}h) excede las 12 horas en un solo día. Confirma que el tiempo extra sea correcto.`,
    };
    hNormalAnomaly = longAnomaly;
    if (day.hExtra > 0) hExtraAnomaly = longAnomaly;
    all.push(longAnomaly);
  }

  if (day.hExtra >= 5 && !hExtraAnomaly) {
    hExtraAnomaly = {
      severity: day.hExtra >= 7 ? 'critical' : 'warning',
      category: 'extreme_workday',
      shortLabel: `Extra alto (${day.hExtra.toFixed(1)}h)`,
      detail: `Se calcularon ${day.hExtra.toFixed(2)} horas extras en un solo día. Verifica que no se deba a un horario programado incorrecto o checada desfasada.`,
    };
    all.push(hExtraAnomaly);
  }

  // 4. Inconsistencias entre Incidencia y Horas Calculadas
  if (isAbsenceIncidence && totalWorkedHours > 0) {
    const mismatch: CellAnomaly = {
      severity: 'critical',
      category: 'calculation_mismatch',
      shortLabel: 'Falta/Ausencia con horas',
      detail: `El día está marcado como "${day.incidencia}" pero tiene ${totalWorkedHours.toFixed(2)}h calculadas. Esto puede duplicar pago e incidencia al exportar.`,
    };
    hNormalAnomaly = hNormalAnomaly || mismatch;
    incidenciaAnomaly = mismatch;
    all.push(mismatch);
  } else if (
    day.horarioProgramado &&
    entMin !== null &&
    salMin !== null &&
    totalWorkedHours === 0 &&
    !isAbsenceIncidence
  ) {
    const zeroHoursMismatch: CellAnomaly = {
      severity: 'critical',
      category: 'calculation_mismatch',
      shortLabel: '0.00h con 2 checadas',
      detail: `Existen checadas de entrada (${day.entrada}) y salida (${day.salida}), pero el cálculo arrojó 0.00 horas trabajadas.`,
    };
    hNormalAnomaly = hNormalAnomaly || zeroHoursMismatch;
    incidenciaAnomaly = zeroHoursMismatch;
    all.push(zeroHoursMismatch);
  }

  const highestSeverity: AnomalySeverity | null = all.some((a) => a.severity === 'critical')
    ? 'critical'
    : all.length > 0
    ? 'warning'
    : null;

  return {
    hasAnomalies: all.length > 0,
    highestSeverity,
    entrada: entradaAnomaly,
    salida: salidaAnomaly,
    hNormal: hNormalAnomaly,
    hExtra: hExtraAnomaly,
    incidencia: incidenciaAnomaly,
    all,
    canSwapInvertedPunches,
  };
}

interface AttendanceTableProps {
  reports: EmployeeReport[];
  onUpdateDayIncidence: (employeeId: string, isoDate: string, newIncidence: string) => void;
  onUpdateDayTimes: (employeeId: string, isoDate: string, newEntrada: string, newSalida: string) => void;
  onUpdateDayNote?: (employeeId: string, isoDate: string, note: string) => void;
  onOpenFormatAssistant?: (employee: Employee, day: ProcessedDay, mode: ResolutionMode) => void;
  onQuickConfirmFalta?: (employeeId: string, isoDate: string) => void;
  horarios?: Record<string, ScheduleConfig>;
  onAssignSchedule?: (employeeId: string, scheduleCode: string) => void;
  filteredCount: number;
  isSupervisorMode?: boolean;
  onToggleOvertimeApproval?: (employeeId: string, isoDate: string, autorizada: boolean) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  reports,
  onUpdateDayIncidence,
  onUpdateDayTimes,
  onUpdateDayNote,
  onOpenFormatAssistant,
  onQuickConfirmFalta,
  horarios,
  onAssignSchedule,
  filteredCount,
  isSupervisorMode = false,
  onToggleOvertimeApproval,
}) => {
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [onlyWithAnomalies, setOnlyWithAnomalies] = useState<boolean>(false);

  // Resumen global de inconsistencias en los reportes actuales
  const anomalyStats = useMemo(() => {
    let employeesWithAnomalies = 0;
    let totalDaysWithAnomalies = 0;
    let extremeWorkdays = 0;
    let impossibleOrInverted = 0;
    let outOfShift = 0;
    let calculationMismatches = 0;
    const byEmployeeId: Record<string, { count: number; critical: number }> = {};

    for (const rep of reports) {
      const matchedCatalogCode = horarios ? resolveScheduleCodeInCatalog(horarios, rep.empleado.horario) : '';
      const activeScheduleCode =
        matchedCatalogCode ||
        (horarios?.['ADMO'] ? 'ADMO' : horarios ? Object.keys(horarios)[0] || 'ADMO' : 'ADMO');

      let empAnomalyDays = 0;
      let empCriticalDays = 0;

      for (const d of rep.dias) {
        const resolvedDayHorario = horarios
          ? getScheduleForDay(horarios, activeScheduleCode, d.dayOfWeek)
          : d.horarioProgramado;
        const effectiveDay =
          resolvedDayHorario !== d.horarioProgramado
            ? { ...d, horarioProgramado: resolvedDayHorario }
            : d;

        const analysis = analyzeDayDataAnomalies(effectiveDay);
        if (analysis.hasAnomalies) {
          empAnomalyDays++;
          totalDaysWithAnomalies++;
          if (analysis.highestSeverity === 'critical') empCriticalDays++;
          if (analysis.all.some((a) => a.category === 'extreme_workday')) extremeWorkdays++;
          if (analysis.all.some((a) => a.category === 'impossible_punch')) impossibleOrInverted++;
          if (analysis.all.some((a) => a.category === 'out_of_shift')) outOfShift++;
          if (analysis.all.some((a) => a.category === 'calculation_mismatch')) calculationMismatches++;
        }
      }

      byEmployeeId[rep.empleado.id] = { count: empAnomalyDays, critical: empCriticalDays };
      if (empAnomalyDays > 0) {
        employeesWithAnomalies++;
      }
    }

    return {
      employeesWithAnomalies,
      totalDaysWithAnomalies,
      extremeWorkdays,
      impossibleOrInverted,
      outOfShift,
      calculationMismatches,
      byEmployeeId,
    };
  }, [reports, horarios]);

  const displayedReports = useMemo(() => {
    if (!onlyWithAnomalies) return reports;
    return reports.filter((r) => (anomalyStats.byEmployeeId[r.empleado.id]?.count || 0) > 0);
  }, [reports, onlyWithAnomalies, anomalyStats]);

  if (reports.length === 0) {
    return (
      <div className="rounded-xl p-16 text-center bg-slate-900/60 border border-dashed border-slate-800 text-slate-400 animate-fade-up">
        <Clock className="w-10 h-10 text-amber-500/50 mx-auto mb-3 animate-float-slow" />
        <h4 className="text-base font-bold text-slate-200">Panel de Auditoría Listo</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          {isSupervisorMode
            ? 'No hay registros que coincidan con el filtro seleccionado.'
            : 'Carga los archivos requeridos y haz clic en "Generar Reporte" para auditar y calcular la nómina semanal.'}
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(displayedReports.length / pageSize);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const startIdx = (safePage - 1) * pageSize;
  const paginatedReports = displayedReports.slice(startIdx, startIdx + pageSize);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Barra de Auditoría Pre-Exportación (Detección de Datos Inconsistentes) */}
      {anomalyStats.totalDaysWithAnomalies > 0 ? (
        <div className="rounded-xl p-3.5 bg-gradient-to-r from-rose-950/50 via-amber-950/35 to-slate-900/90 border border-rose-500/40 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 no-print">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                  Auditoría Pre-Exportación: {anomalyStats.totalDaysWithAnomalies} día(s) con datos inconsistentes en {anomalyStats.employeesWithAnomalies} empleado(s)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/30 font-semibold">
                  Revisar antes de exportar Excel / CONTPAQi
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {anomalyStats.impossibleOrInverted > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/35">
                    <AlertOctagon className="w-3 h-3 text-rose-400" />
                    {anomalyStats.impossibleOrInverted} checada(s) invertida(s) / duplicada(s)
                  </span>
                )}
                {anomalyStats.extremeWorkdays > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/35">
                    <Flame className="w-3 h-3 text-orange-400" />
                    {anomalyStats.extremeWorkdays} jornada(s) extrema(s) (&gt;12h o extra excesivo)
                  </span>
                )}
                {anomalyStats.outOfShift > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {anomalyStats.outOfShift} fuera de rango de turno
                  </span>
                )}
                {anomalyStats.calculationMismatches > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/35">
                    <AlertTriangle className="w-3 h-3 text-purple-400" />
                    {anomalyStats.calculationMismatches} contradicción(es) incidencia vs. horas
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOnlyWithAnomalies((prev) => !prev);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              onlyWithAnomalies
                ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-950/50'
                : 'bg-slate-900/90 hover:bg-rose-950/60 text-rose-200 border-rose-500/40'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              {onlyWithAnomalies
                ? `Mostrando solo inconsistencias (${anomalyStats.employeesWithAnomalies}) — Ver todos`
                : `Filtrar solo empleados con inconsistencias (${anomalyStats.employeesWithAnomalies})`}
            </span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl px-3.5 py-2.5 bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-300 no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Validación Pre-Exportación OK:</strong> No se detectaron jornadas extremadamente largas, checadas invertidas ni horas fuera del rango de turno.
            </span>
          </div>
        </div>
      )}

      {/* Barra de paginación superior */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2 text-xs text-slate-400 no-print">
        <span>
          Mostrando <strong className="text-slate-200">{ Math.min(displayedReports.length, startIdx + 1) }</strong> a{' '}
          <strong className="text-slate-200">{ Math.min(displayedReports.length, startIdx + pageSize) }</strong> de{' '}
          <strong className="text-slate-200">{ displayedReports.length }</strong> empleados
          {filteredCount !== displayedReports.length && ` (filtrados de ${filteredCount})`}
        </span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={1000}>Todos</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-2">
              {safePage} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de tarjetas de empleados */}
      <div className="space-y-6">
        {paginatedReports.map((rep) => (
          <EmployeeCard
            key={rep.empleado.id}
            report={rep}
            onUpdateDayIncidence={onUpdateDayIncidence}
            onUpdateDayTimes={onUpdateDayTimes}
            onUpdateDayNote={onUpdateDayNote}
            onOpenFormatAssistant={onOpenFormatAssistant}
            onQuickConfirmFalta={onQuickConfirmFalta}
            horarios={horarios}
            onAssignSchedule={isSupervisorMode ? undefined : onAssignSchedule}
            isSupervisorMode={isSupervisorMode}
            onToggleOvertimeApproval={onToggleOvertimeApproval}
          />
        ))}
      </div>

      {/* Paginación inferior */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4 no-print">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-400 font-mono px-3">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

interface EmployeeCardProps {
  report: EmployeeReport;
  onUpdateDayIncidence: (employeeId: string, isoDate: string, newIncidence: string) => void;
  onUpdateDayTimes: (employeeId: string, isoDate: string, newEntrada: string, newSalida: string) => void;
  onUpdateDayNote?: (employeeId: string, isoDate: string, note: string) => void;
  onOpenFormatAssistant?: (employee: Employee, day: ProcessedDay, mode: ResolutionMode) => void;
  onQuickConfirmFalta?: (employeeId: string, isoDate: string) => void;
  horarios?: Record<string, ScheduleConfig>;
  onAssignSchedule?: (employeeId: string, scheduleCode: string) => void;
  isSupervisorMode?: boolean;
  onToggleOvertimeApproval?: (employeeId: string, isoDate: string, autorizada: boolean) => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  report,
  onUpdateDayIncidence,
  onUpdateDayTimes,
  onUpdateDayNote,
  onOpenFormatAssistant,
  onQuickConfirmFalta,
  horarios,
  onAssignSchedule,
  isSupervisorMode = false,
  onToggleOvertimeApproval,
}) => {
  const { empleado, dias, totalNormal, faltas, retardos } = report;

  const matchedCatalogCode = horarios ? resolveScheduleCodeInCatalog(horarios, empleado.horario) : '';
  const activeScheduleCode = matchedCatalogCode || (horarios?.['ADMO'] ? 'ADMO' : (horarios ? Object.keys(horarios)[0] || 'ADMO' : 'ADMO'));
  const activeScheduleConfig = horarios?.[activeScheduleCode];
  const hoursSummaryText = formatScheduleHoursSummary(activeScheduleConfig);

  const effectiveDaysWithAnomalies = useMemo(() => {
    return dias.map((d) => {
      const resolvedDayHorario = horarios
        ? getScheduleForDay(horarios, activeScheduleCode, d.dayOfWeek)
        : d.horarioProgramado;
      const effectiveDay =
        resolvedDayHorario !== d.horarioProgramado
          ? { ...d, horarioProgramado: resolvedDayHorario }
          : d;
      const anomalies = analyzeDayDataAnomalies(effectiveDay);
      return { effectiveDay, anomalies };
    });
  }, [dias, horarios, activeScheduleCode]);

  const anomalyDaysCount = effectiveDaysWithAnomalies.filter((x) => x.anomalies.hasAnomalies).length;
  const hasCriticalAnomalies = effectiveDaysWithAnomalies.some(
    (x) => x.anomalies.highestSeverity === 'critical'
  );

  const supModCount = dias.filter(d => d.modificadoPorSupervisor).length;
  const authorizedExtra = dias.reduce(
    (acc, d) => acc + (d.horasExtrasAutorizadas === true ? d.hExtra : 0),
    0
  );
  const detectedExtra = dias.reduce((acc, d) => acc + d.hExtra, 0);
  const hasUnresolvedMissingPunches = dias.some(d => {
    const isFestivo = Boolean(FESTIVOS_OFICIALES[d.isoDate]);
    const isScheduledWorkday = Boolean(d.horarioProgramado) && !isFestivo;
    const tieneEnt = d.entrada !== '--:--' && Boolean(d.entrada);
    const tieneSal = d.salida !== '--:--' && Boolean(d.salida);
    return isScheduledWorkday && (!tieneEnt || !tieneSal) && !d.modificadoPorSupervisor;
  });
  const sinIncidencias = faltas === 0 && retardos === 0 && !hasUnresolvedMissingPunches && anomalyDaysCount === 0;

  return (
    <div
      className={`rounded-xl overflow-hidden bg-slate-900/90 border shadow-md transition-all hover-lift ${
        hasCriticalAnomalies
          ? 'border-rose-500/60 shadow-rose-950/30'
          : anomalyDaysCount > 0
          ? 'border-amber-500/50 shadow-amber-950/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Encabezado del empleado */}
      <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shrink-0">
            {empleado.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-100">{empleado.nombre}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                #{empleado.id}
              </span>

              {/* Si es RH/Admin permite editar horario; si es Supervisor solo muestra el horario asignado y de qué hora a qué hora es */}
              {!isSupervisorMode && horarios && onAssignSchedule ? (
                <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-0.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[9px] uppercase font-bold text-amber-300">Horario:</span>
                  <select
                    value={activeScheduleCode}
                    onChange={(e) => onAssignSchedule(empleado.id, e.target.value)}
                    className="bg-transparent text-[10px] font-mono font-bold text-amber-300 outline-none cursor-pointer"
                    title="Cambiar programación de horario de este colaborador (Exclusivo RH/Admin)"
                  >
                    {Object.entries(horarios).map(([code, cfg]) => (
                      <option key={code} value={code} className="bg-slate-900 text-slate-100">
                        {code} — {cfg.nombre} ({formatScheduleHoursSummary(cfg)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[10px] font-mono">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Horario Asignado: <strong className="text-amber-200">{activeScheduleCode} ({activeScheduleConfig?.nombre || 'Administrativo'})</strong>
                    <span className="text-slate-300 ml-1.5">· De {hoursSummaryText}</span>
                  </span>
                </div>
              )}

              {anomalyDaysCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded flex items-center gap-1 border ${
                    hasCriticalAnomalies
                      ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 animate-pulse'
                      : 'bg-orange-500/20 text-orange-200 border-orange-500/45'
                  }`}
                  title="Se detectaron celdas con jornadas extremas, checadas fuera de turno o invertidas"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  {anomalyDaysCount} día(s) con datos inconsistentes
                </span>
              )}

              {sinIncidencias && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Sin incidencias
                </span>
              )}

              {supModCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  {supModCount} día(s) validado(s) por Supervisor
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supervisor: <strong className="text-slate-300">{empleado.jefe}</strong>
              <span className="text-slate-500 mx-1.5">·</span>
              <span className="text-amber-300/90 font-mono text-[10px]">
                Jornada: {hoursSummaryText}
              </span>
            </p>
          </div>
        </div>

        {/* Totales de Horas */}
        <div className="flex items-center gap-4 self-end sm:self-auto text-right">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">H. Normales</p>
            <p className="text-xl font-black font-mono text-slate-100">{totalNormal.toFixed(2)}</p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <p className="text-[9px] uppercase font-bold tracking-wider text-amber-400">H. Extras (Aut.)</p>
            <p className="text-xl font-black font-mono text-amber-400">{authorizedExtra.toFixed(2)}</p>
            {detectedExtra > 0 && (
              <p className="text-[9px] font-mono font-bold text-slate-400">
                Detectadas: {detectedExtra.toFixed(2)}h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de días */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <th className="p-3 pl-4">Fecha</th>
              <th className="p-3">Día</th>
              <th className="p-3 text-center">Horario Prog.</th>
              <th className="p-3">Entrada</th>
              <th className="p-3">Salida</th>
              <th className="p-3 text-center">H. Normal</th>
              <th className="p-3 text-center">H. Extra</th>
              <th className="p-3 pr-4">Incidencia / Formatos y Validación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {effectiveDaysWithAnomalies.map(({ effectiveDay, anomalies }) => (
              <DayRow
                key={effectiveDay.isoDate}
                employee={empleado}
                day={effectiveDay}
                anomalies={anomalies}
                onChangeIncidence={(val) => onUpdateDayIncidence(empleado.id, effectiveDay.isoDate, val)}
                onChangeTimes={(newEnt, newSal) => onUpdateDayTimes(empleado.id, effectiveDay.isoDate, newEnt, newSal)}
                onChangeNote={onUpdateDayNote ? (note) => onUpdateDayNote(empleado.id, effectiveDay.isoDate, note) : undefined}
                onOpenFormatAssistant={onOpenFormatAssistant}
                onQuickConfirmFalta={onQuickConfirmFalta ? () => onQuickConfirmFalta(empleado.id, effectiveDay.isoDate) : undefined}
                isSupervisorMode={isSupervisorMode}
                onToggleOvertimeApproval={onToggleOvertimeApproval ? (aut) => onToggleOvertimeApproval(empleado.id, effectiveDay.isoDate, aut) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface DayRowProps {
  employee: Employee;
  day: ProcessedDay;
  anomalies: DayDataAnomalies;
  onChangeIncidence: (val: string) => void;
  onChangeTimes: (newEntrada: string, newSalida: string) => void;
  onChangeNote?: (note: string) => void;
  onOpenFormatAssistant?: (employee: Employee, day: ProcessedDay, mode: ResolutionMode) => void;
  onQuickConfirmFalta?: () => void;
  isSupervisorMode?: boolean;
  onToggleOvertimeApproval?: (autorizada: boolean) => void;
}

const DayRow: React.FC<DayRowProps> = ({
  employee,
  day,
  anomalies,
  onChangeIncidence,
  onChangeTimes,
  onChangeNote,
  onOpenFormatAssistant,
  onQuickConfirmFalta,
  isSupervisorMode = false,
  onToggleOvertimeApproval,
}) => {
  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
  const isFestivo = Boolean(FESTIVOS_OFICIALES[day.isoDate]);
  const isScheduledWorkday = Boolean(day.horarioProgramado) && !isFestivo;

  const tieneEnt = day.entrada !== '--:--' && Boolean(day.entrada);
  const tieneSal = day.salida !== '--:--' && Boolean(day.salida);
  const faltanChecadasEnDiaLaboral =
    isScheduledWorkday &&
    (!tieneEnt || !tieneSal) &&
    !day.modificadoPorSupervisor &&
    day.incidencia !== 'Vacaciones' &&
    !day.incidencia.toLowerCase().includes('permiso') &&
    !day.incidencia.toLowerCase().includes('incapacidad') &&
    !day.incidencia.toLowerCase().includes('pase');

  // Verificar si originalmente al colaborador le faltaban AMBAS checadas (ni Entrada ni Salida)
  // o si solamente le faltaba UNA checada.
  const origEnt = day.entradaOriginal ?? '--:--';
  const origSal = day.salidaOriginal ?? '--:--';
  const teniaEntOriginal = Boolean(origEnt && origEnt !== '--:--');
  const teniaSalOriginal = Boolean(origSal && origSal !== '--:--');
  const sinNingunaChecadaOriginal = !teniaEntOriginal && !teniaSalOriginal;

  // Si el supervisor agregó una checada manualmente pero aún no ha subido el archivo del formato de checada
  const checadaAgregadaSinArchivoFormato =
    day.modificadoPorSupervisor &&
    (day.tipoModificacionSupervisor === 'checada_agregada' ||
      day.tipoModificacionSupervisor === 'formato_checada_sin_gafete') &&
    !day.formatoSubidoNombre;

  const requiereFormatoObligatorioPorFaltaAmbas =
    checadaAgregadaSinArchivoFormato && sinNingunaChecadaOriginal;

  // Clases condicionales de fila
  let rowBg = 'hover:bg-slate-800/40 transition-colors';
  if (anomalies.highestSeverity === 'critical') {
    rowBg += ' bg-rose-950/25 border-l-4 border-l-rose-500';
  } else if (day.modificadoPorSupervisor) {
    if (day.tipoModificacionSupervisor === 'falta_confirmada') {
      rowBg += ' bg-rose-950/20 border-l-4 border-l-rose-500';
    } else {
      rowBg += ' bg-purple-950/25 border-l-4 border-l-purple-500';
    }
  } else if (anomalies.highestSeverity === 'warning') {
    rowBg += ' bg-orange-950/20 border-l-4 border-l-orange-500';
  } else if (day.huerfana || faltanChecadasEnDiaLaboral) {
    rowBg += ' bg-amber-950/20 border-l-4 border-l-amber-500';
  } else if (day.rowClass === 'row-success') {
    rowBg += ' bg-emerald-950/10 border-l-2 border-l-emerald-500/60';
  } else if (day.rowClass === 'row-danger') {
    rowBg += ' bg-rose-950/15 border-l-2 border-l-rose-500';
  }

  const tieneChecadaUnica = tieneEnt !== tieneSal;
  const mostrarBotonSwitch = tieneChecadaUnica || anomalies.canSwapInvertedPunches;
  const crudos = day.registrosCrudosDia || [];
  const mostrarPillsCrudos =
    crudos.length > 0 &&
    (day.huerfana || anomalies.hasAnomalies || crudos.length > 2 || crudos.some(c => c.codigo === 'RST'));

  const handleSwapTimes = () => {
    onChangeTimes(day.salida, day.entrada);
  };

  const handleDownloadAttachedFormat = () => {
    if (!day.formatoSubidoBase64 || !day.formatoSubidoNombre) return;
    try {
      const commaIdx = day.formatoSubidoBase64.indexOf(',');
      const mimeMatch = day.formatoSubidoBase64.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const rawBase64 = commaIdx >= 0 ? day.formatoSubidoBase64.slice(commaIdx + 1) : day.formatoSubidoBase64;
      const byteCharacters = atob(rawBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
      saveAs(blob, day.formatoSubidoNombre);
    } catch (e) {
      console.error('Error downloading format attachment', e);
    }
  };

  // REGLAS DE BLOQUEO DE ENTRADA Y SALIDA:
  // 1) Si es día de Descanso programado (horarioProgramado === null) y no tiene checadas, bloquear ambas (el empleado descansó).
  // 2) Si el trabajador ya tiene sus entradas y salidas bien, bloquear ambas.
  // 3) Si le falta 1, bloquear la que sí tenga y permitir hacer switch (flechas) o agregar la faltante.
  const esDiaDescanso = day.horarioProgramado === null;
  const tieneEntradaValida = Boolean(day.entrada && day.entrada !== '--:--');
  const tieneSalidaValida = Boolean(day.salida && day.salida !== '--:--');

  const ambasCompletas = tieneEntradaValida && tieneSalidaValida;
  const isEntradaBloqueada = (esDiaDescanso && !tieneEntradaValida) || ambasCompletas || tieneEntradaValida;
  const isSalidaBloqueada = (esDiaDescanso && !tieneSalidaValida) || ambasCompletas || tieneSalidaValida;

  return (
    <tr className={rowBg}>
      {/* Fecha */}
      <td className="p-3 pl-4 text-slate-300 font-medium whitespace-nowrap align-top">
        <div className="flex flex-col gap-1">
          <span>{day.isoDate}</span>
          {anomalies.hasAnomalies && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded w-fit ${
                anomalies.highestSeverity === 'critical'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
              }`}
              title={anomalies.all.map((a) => a.detail).join(' | ')}
            >
              <AlertOctagon className="w-2.5 h-2.5 shrink-0" />
              {anomalies.highestSeverity === 'critical' ? 'Dato Crítico' : 'Revisar Dato'}
            </span>
          )}
        </div>
      </td>

      {/* Día de la semana */}
      <td className="p-3 font-sans align-top">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
          isWeekend ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-300'
        }`}>
          {day.dayName}
        </span>
      </td>

      {/* Horario programado */}
      <td className="p-3 text-center whitespace-nowrap align-top">
        {day.horarioProgramado ? (
          <div className="inline-flex flex-col items-center">
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-200 font-semibold border border-amber-500/25">
              De {day.horarioProgramado.entrada} a {day.horarioProgramado.salida} hrs
              {day.horarioProgramado.cruzaMedianoche && (
                <span title="Turno nocturno (cruza medianoche)">
                  <Moon className="w-3 h-3 text-amber-400 inline" />
                </span>
              )}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            Descanso
          </span>
        )}
      </td>

      {/* Celda Entrada con indicador visual de inconsistencia */}
      <td
        className={`p-3 whitespace-nowrap align-top transition-colors ${
          anomalies.entrada
            ? anomalies.entrada.severity === 'critical'
              ? 'bg-rose-950/40 ring-1 ring-inset ring-rose-500/50'
              : 'bg-orange-950/30 ring-1 ring-inset ring-orange-500/40'
            : ''
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {isEntradaBloqueada ? (
              <div
                className={`w-24 rounded px-2 py-1 text-xs font-mono font-bold flex items-center justify-between border select-none ${
                  anomalies.entrada
                    ? anomalies.entrada.severity === 'critical'
                      ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-sm shadow-rose-950'
                      : 'bg-orange-950/60 border-orange-500/80 text-orange-200'
                    : day.modificadoPorSupervisor && day.entrada !== day.entradaOriginal
                    ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-200'
                }`}
                title={
                  anomalies.entrada
                    ? anomalies.entrada.detail
                    : 'Checada de entrada registrada y protegida contra edición'
                }
              >
                <span>{day.entrada}</span>
                {anomalies.entrada ? (
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ml-1 shrink-0 ${
                      anomalies.entrada.severity === 'critical' ? 'text-rose-400 animate-bounce' : 'text-orange-400'
                    }`}
                  />
                ) : (
                  <Lock className="w-3 h-3 text-slate-500 ml-1 shrink-0" />
                )}
              </div>
            ) : (
              <input
                type="time"
                value={day.entrada === '--:--' ? '' : day.entrada}
                onChange={(e) => onChangeTimes(e.target.value || '--:--', day.salida)}
                className="w-24 rounded px-1.5 py-0.5 text-xs bg-slate-950/90 border border-amber-500/60 text-amber-200 font-mono outline-none focus:border-amber-400"
                title="Falta checada de entrada: ingresa la hora correspondiente"
              />
            )}
          </div>

          {anomalies.entrada && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded w-fit ${
                anomalies.entrada.severity === 'critical'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                  : 'bg-orange-500/20 text-orange-200 border border-orange-500/35'
              }`}
              title={anomalies.entrada.detail}
            >
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              {anomalies.entrada.shortLabel}
            </span>
          )}

          {day.modificadoPorSupervisor && day.entrada !== (day.entradaOriginal || '--:--') && (
            <span className="text-[9px] text-purple-300 font-sans">
              Orig: {day.entradaOriginal || 'Sin checada'}
            </span>
          )}
        </div>
      </td>

      {/* Celda Salida con indicador visual de inconsistencia */}
      <td
        className={`p-3 whitespace-nowrap align-top transition-colors ${
          anomalies.salida
            ? anomalies.salida.severity === 'critical'
              ? 'bg-rose-950/40 ring-1 ring-inset ring-rose-500/50'
              : 'bg-orange-950/30 ring-1 ring-inset ring-orange-500/40'
            : ''
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {mostrarBotonSwitch && (
              <button
                type="button"
                onClick={handleSwapTimes}
                className={`p-1 rounded transition-all no-print cursor-pointer flex items-center gap-1 shadow-sm border ${
                  anomalies.canSwapInvertedPunches
                    ? 'bg-rose-500/30 hover:bg-rose-500/40 text-rose-200 border-rose-400 animate-pulse'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                }`}
                title={
                  anomalies.canSwapInvertedPunches
                    ? 'Corregir checadas invertidas intercambiando Entrada ⇄ Salida'
                    : 'Mover checada física única entre Entrada ⇄ Salida (Switch de RST / Huérfana)'
                }
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold font-sans hidden sm:inline">
                  {anomalies.canSwapInvertedPunches ? 'Invertir' : 'Switch'}
                </span>
              </button>
            )}
            {isSalidaBloqueada ? (
              <div
                className={`w-24 rounded px-2 py-1 text-xs font-mono font-bold flex items-center justify-between border select-none ${
                  anomalies.salida
                    ? anomalies.salida.severity === 'critical'
                      ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-sm shadow-rose-950'
                      : 'bg-orange-950/60 border-orange-500/80 text-orange-200'
                    : day.modificadoPorSupervisor && day.salida !== day.salidaOriginal
                    ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-200'
                }`}
                title={
                  anomalies.salida
                    ? anomalies.salida.detail
                    : 'Checada de salida registrada y protegida contra edición'
                }
              >
                <span>{day.salida}</span>
                {anomalies.salida ? (
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ml-1 shrink-0 ${
                      anomalies.salida.severity === 'critical' ? 'text-rose-400 animate-bounce' : 'text-orange-400'
                    }`}
                  />
                ) : (
                  <Lock className="w-3 h-3 text-slate-500 ml-1 shrink-0" />
                )}
              </div>
            ) : (
              <input
                type="time"
                value={day.salida === '--:--' ? '' : day.salida}
                onChange={(e) => onChangeTimes(day.entrada, e.target.value || '--:--')}
                className="w-24 rounded px-1.5 py-0.5 text-xs bg-slate-950/90 border border-amber-500/60 text-amber-200 font-mono outline-none focus:border-amber-400"
                title="Falta checada de salida: ingresa la hora correspondiente"
              />
            )}
          </div>

          {anomalies.salida && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded w-fit ${
                anomalies.salida.severity === 'critical'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                  : 'bg-orange-500/20 text-orange-200 border border-orange-500/35'
              }`}
              title={anomalies.salida.detail}
            >
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              {anomalies.salida.shortLabel}
            </span>
          )}

          {day.modificadoPorSupervisor && day.salida !== (day.salidaOriginal || '--:--') && (
            <span className="text-[9px] text-purple-300 font-sans">
              Orig: {day.salidaOriginal || 'Sin checada'}
            </span>
          )}
        </div>
      </td>

      {/* Celda H. Normal con indicador visual de jornada extrema o contradicción */}
      <td
        className={`p-3 text-center font-bold align-top transition-colors ${
          anomalies.hNormal
            ? anomalies.hNormal.severity === 'critical'
              ? 'bg-rose-950/40 ring-1 ring-inset ring-rose-500/50 text-rose-300'
              : 'bg-orange-950/30 ring-1 ring-inset ring-orange-500/40 text-orange-300'
            : 'text-emerald-400'
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <span>{day.hNormal > 0 ? day.hNormal.toFixed(2) : '-'}</span>
          {anomalies.hNormal && (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                anomalies.hNormal.severity === 'critical'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                  : 'bg-orange-500/20 text-orange-200 border border-orange-500/35'
              }`}
              title={anomalies.hNormal.detail}
            >
              <Flame className="w-2.5 h-2.5 shrink-0" />
              {anomalies.hNormal.shortLabel}
            </span>
          )}
        </div>
      </td>

      {/* Celda H. Extra y Pregunta de Autorización de Tiempo Extra */}
      <td
        className={`p-3 text-center align-top whitespace-nowrap transition-colors ${
          anomalies.hExtra
            ? anomalies.hExtra.severity === 'critical'
              ? 'bg-rose-950/40 ring-1 ring-inset ring-rose-500/50'
              : 'bg-orange-950/30 ring-1 ring-inset ring-orange-500/40'
            : ''
        }`}
      >
        {day.hExtra > 0 ? (
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`font-bold font-mono text-xs ${
                anomalies.hExtra ? 'text-rose-300' : 'text-amber-400'
              }`}
              title={anomalies.hExtra?.detail}
            >
              {day.hExtra.toFixed(2)}h
            </span>

            {anomalies.hExtra && (
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded ${
                  anomalies.hExtra.severity === 'critical'
                    ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                    : 'bg-orange-500/20 text-orange-200 border border-orange-500/35'
                }`}
                title={anomalies.hExtra.detail}
              >
                <Flame className="w-2.5 h-2.5 shrink-0" />
                {anomalies.hExtra.shortLabel}
              </span>
            )}

            {/* Prompt interactivo: ¿Tiempo extra autorizado? */}
            <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px]">
              <span className="text-[9px] uppercase font-bold text-amber-300">
                ¿Autorizado?
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleOvertimeApproval && onToggleOvertimeApproval(true)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-all cursor-pointer ${
                    day.horasExtrasAutorizadas === true
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-emerald-300 border border-slate-700'
                  }`}
                  title="Marcar tiempo extra como AUTORIZADO (se exporta a CONTPAQi)"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>SÍ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleOvertimeApproval && onToggleOvertimeApproval(false)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-all cursor-pointer ${
                    day.horasExtrasAutorizadas === false
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-rose-300 border border-slate-700'
                  }`}
                  title="Marcar tiempo extra como NO AUTORIZADO (no se exporta a CONTPAQi)"
                >
                  <XCircle className="w-3 h-3 text-rose-400" />
                  <span>NO</span>
                </button>
              </div>

              {day.horasExtrasAutorizadas === true && (
                <span className="text-[8px] font-mono font-bold text-emerald-300">
                  ✓ Para CONTPAQi
                </span>
              )}
              {day.horasExtrasAutorizadas === false && (
                <span className="text-[8px] font-mono font-bold text-rose-300">
                  ✕ Sin pago extra
                </span>
              )}
              {day.horasExtrasAutorizadas === undefined && (
                <span className="text-[8px] text-amber-300/80 animate-pulse">
                  Pendiente validación
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>

      {/* Incidencia, formatos, advertencias y acciones de resolución */}
      <td className="p-3 pr-4 font-sans min-w-[290px] align-top">
        <div className="flex flex-col gap-2">
          {/* Bloqueo estricto para supervisores únicamente en días de Asistencia completa original o Descanso/Festivo sin modificar y sin anomalías */}
          {isSupervisorMode &&
          !day.modificadoPorSupervisor &&
          !day.huerfana &&
          !anomalies.hasAnomalies &&
          ((day.incidencia === 'Asistencia' && tieneEntradaValida && tieneSalidaValida) ||
            day.incidencia === 'Descanso' ||
            day.incidencia === 'Festivo') ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">
                {day.incidencia}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto italic">
                (Bloqueado para edición)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {(() => {
                const baseOptions = isSupervisorMode
                  ? OPCIONES_INCIDENCIA_SUPERVISOR
                  : OPCIONES_INCIDENCIA;
                const currentInc = day.incidencia || '';
                const allOptions =
                  currentInc && !baseOptions.includes(currentInc)
                    ? [...baseOptions, currentInc]
                    : baseOptions;
                return (
                  <select
                    value={currentInc}
                    onChange={(e) => onChangeIncidence(e.target.value)}
                    className={`flex-1 text-xs rounded-md px-2 py-1 bg-slate-950 border outline-none transition-colors ${
                      anomalies.incidencia
                        ? 'border-rose-500 text-rose-200 font-bold focus:border-rose-400'
                        : day.modificadoPorSupervisor
                        ? 'border-purple-500/60 text-purple-200 font-semibold focus:border-purple-400'
                        : 'border-slate-800 text-slate-200 focus:border-amber-500/60'
                    }`}
                  >
                    {allOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'Falta Confirmada'
                          ? 'Falta Confirmada (No asistió)'
                          : opt || '(Sin incidencia)'}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
          )}

          {/* ALERTA DE INCONSISTENCIA DE DATOS (PRE-EXPORTACIÓN) */}
          {anomalies.hasAnomalies && (
            <div
              className={`p-2 rounded-lg border text-[10px] space-y-1.5 ${
                anomalies.highestSeverity === 'critical'
                  ? 'bg-rose-500/15 border-rose-500/45 text-rose-200'
                  : 'bg-orange-500/15 border-orange-500/40 text-orange-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>
                    {anomalies.highestSeverity === 'critical'
                      ? 'DATO INCONSISTENTE DETECTADO'
                      : 'ADVERTENCIA DE RANGO / JORNADA'}
                  </span>
                </span>
                {anomalies.canSwapInvertedPunches && (
                  <button
                    type="button"
                    onClick={handleSwapTimes}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    Invertir Entrada ⇄ Salida
                  </button>
                )}
              </div>
              <ul className="space-y-1 pl-1">
                {anomalies.all.map((anom, idx) => (
                  <li key={idx} className="leading-snug text-[10px] flex items-start gap-1.5">
                    <span className="font-bold shrink-0">•</span>
                    <span>{anom.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* DISTINTIVO CUANDO EL SUPERVISOR AGREGÓ CHECADA / FORMATO / FALTA */}
          {day.modificadoPorSupervisor && (
            <div
              className={`p-2 rounded-lg border text-[10px] space-y-1.5 ${
                day.tipoModificacionSupervisor === 'falta_confirmada'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  : 'bg-purple-500/15 border-purple-500/40 text-purple-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="flex items-center gap-1">
                  {day.tipoModificacionSupervisor === 'falta_confirmada' ? (
                    <>
                      <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>FALTA CONFIRMADA POR SUPERVISOR (No vino)</span>
                    </>
                  ) : day.tipoModificacionSupervisor === 'formato_permiso' ? (
                    <>
                      <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>FORMATO DE PERMISO ({day.incidencia})</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>CHECADA AGREGADA POR SUPERVISOR</span>
                    </>
                  )}
                </span>

                {onOpenFormatAssistant && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenFormatAssistant(
                        employee,
                        day,
                        day.tipoModificacionSupervisor === 'falta_confirmada'
                          ? 'falta'
                          : day.tipoModificacionSupervisor === 'formato_permiso'
                          ? 'permiso'
                          : 'checada_sin_gafete'
                      )
                    }
                    className="text-[9px] underline text-slate-300 hover:text-white cursor-pointer"
                  >
                    Editar
                  </button>
                )}
              </div>

              {day.notaSupervisorDia && (
                <p className="text-[10px] text-slate-300 italic leading-snug">
                  &ldquo;{day.notaSupervisorDia}&rdquo;
                </p>
              )}

              {/* Archivo de formato subido */}
              {day.formatoSubidoNombre ? (
                <div className="flex items-center justify-between bg-slate-950/70 px-2 py-1 rounded border border-purple-500/30">
                  <span className="flex items-center gap-1 text-emerald-300 font-semibold truncate">
                    <Paperclip className="w-3 h-3 text-emerald-400 shrink-0" />
                    {day.formatoSubidoNombre}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadAttachedFormat}
                    className="text-[10px] font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1 ml-2 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Descargar
                  </button>
                </div>
              ) : checadaAgregadaSinArchivoFormato ? (
                requiereFormatoObligatorioPorFaltaAmbas ? (
                  <div className="p-2 rounded bg-rose-500/20 border border-rose-500/50 text-rose-200 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold flex items-start gap-1 leading-snug">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        🚫 Respaldo Obligatorio: El colaborador no tenía ni Entrada ni Salida. Debes adjuntar el archivo que lo respalde para poder liberar la nómina.
                      </span>
                    </span>
                    {onOpenFormatAssistant && (
                      <button
                        type="button"
                        onClick={() => onOpenFormatAssistant(employee, day, 'checada_sin_gafete')}
                        className="self-start px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-bold text-[10px] transition-all cursor-pointer shadow"
                      >
                        📎 Adjuntar Archivo de Respaldo Obligatorio
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-950/60 px-2 py-1 rounded border border-purple-500/20 text-[10px]">
                    <span className="text-emerald-300 font-semibold">
                      ✓ Solo faltaba 1 checada (Formato no forzoso)
                    </span>
                    {onOpenFormatAssistant && (
                      <button
                        type="button"
                        onClick={() => onOpenFormatAssistant(employee, day, 'checada_sin_gafete')}
                        className="text-purple-300 hover:text-purple-200 underline cursor-pointer ml-2"
                      >
                        Adjuntar opcional
                      </button>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* ASISTENTE INTELIGENTE: DÍA LABORAL SIN LAS 2 CHECADAS */}
          {faltanChecadasEnDiaLaboral && onOpenFormatAssistant && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 no-print">
              <div className="flex items-start gap-1.5 text-[10px] font-bold text-amber-300 leading-tight">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {!tieneEnt && !tieneSal
                    ? `Sin Entrada ni Salida en día laboral (${day.horarioProgramado?.entrada}-${day.horarioProgramado?.salida}). Si agregas checada requiere archivo de respaldo:`
                    : `Solo falta 1 checada según horario (${day.horarioProgramado?.entrada}-${day.horarioProgramado?.salida}). Formato opcional:`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenFormatAssistant(employee, day, 'checada_sin_gafete')}
                  className="px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Checada sin Gafete</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenFormatAssistant(employee, day, 'permiso')}
                  className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Briefcase className="w-3 h-3" />
                  <span>Permiso</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onQuickConfirmFalta
                      ? onQuickConfirmFalta()
                      : onOpenFormatAssistant(employee, day, 'falta')
                  }
                  className="px-2 py-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Ban className="w-3 h-3" />
                  <span>Es Falta (No vino)</span>
                </button>
              </div>
            </div>
          )}

          {/* Advertencia estándar si no está en el asistente arriba */}
          {day.advertencia && !faltanChecadasEnDiaLaboral && !day.modificadoPorSupervisor && (
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${
              day.huerfana ? 'text-amber-400 animate-pulse' : 'text-slate-400'
            }`}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {day.advertencia}
            </span>
          )}

          {/* Comentario rápido del día (bloqueado para supervisores si es Asistencia o Descanso) */}
          {onChangeNote && (
            isSupervisorMode && (day.incidencia === 'Asistencia' || day.incidencia === 'Descanso' || day.incidencia === 'Festivo') && !anomalies.hasAnomalies ? null : (
              <input
                type="text"
                value={day.notaSupervisorDia || ''}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="Agregar nota o comentario para RH..."
                className="w-full text-[11px] rounded px-2 py-1 bg-slate-950/60 border border-slate-800/80 text-slate-300 placeholder:text-slate-600 outline-none focus:border-purple-500/60"
              />
            )
          )}

          {mostrarPillsCrudos && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5 no-print">
              <span className="text-[9px] uppercase font-bold text-slate-500">Checador:</span>
              {crudos.map((c, idx) => (
                <span
                  key={idx}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    c.codigo === 'RST'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  title={`Marca registrada: ${c.hora} (${c.codigo})`}
                >
                  {c.hora} <strong className="opacity-75">{c.codigo}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

