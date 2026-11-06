/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
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
import { ResolutionMode } from './portal/MissingPunchFormatModal';
import saveAs from 'file-saver';

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

  const totalPages = Math.ceil(reports.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedReports = reports.slice(startIdx, startIdx + pageSize);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Barra de paginación superior */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2 text-xs text-slate-400 no-print">
        <span>
          Mostrando <strong className="text-slate-200">{Math.min(reports.length, startIdx + 1)}</strong> a{' '}
          <strong className="text-slate-200">{Math.min(reports.length, startIdx + pageSize)}</strong> de{' '}
          <strong className="text-slate-200">{reports.length}</strong> empleados
          {filteredCount !== reports.length && ` (filtrados de ${filteredCount})`}
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
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-2">
              {currentPage} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
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
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-400 font-mono px-3">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
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
  const sinIncidencias = faltas === 0 && retardos === 0 && !hasUnresolvedMissingPunches;

  const activeScheduleCode = empleado.horario && horarios?.[empleado.horario] ? empleado.horario : 'ADMO';
  const activeScheduleConfig = horarios?.[activeScheduleCode];
  const hoursSummaryText = formatScheduleHoursSummary(activeScheduleConfig);

  return (
    <div className="rounded-xl overflow-hidden bg-slate-900/90 border border-slate-800 shadow-md transition-all hover:border-slate-700 hover-lift">
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
            {dias.map((d) => (
              <DayRow
                key={d.isoDate}
                employee={empleado}
                day={d}
                onChangeIncidence={(val) => onUpdateDayIncidence(empleado.id, d.isoDate, val)}
                onChangeTimes={(newEnt, newSal) => onUpdateDayTimes(empleado.id, d.isoDate, newEnt, newSal)}
                onChangeNote={onUpdateDayNote ? (note) => onUpdateDayNote(empleado.id, d.isoDate, note) : undefined}
                onOpenFormatAssistant={onOpenFormatAssistant}
                onQuickConfirmFalta={onQuickConfirmFalta ? () => onQuickConfirmFalta(empleado.id, d.isoDate) : undefined}
                isSupervisorMode={isSupervisorMode}
                onToggleOvertimeApproval={onToggleOvertimeApproval ? (aut) => onToggleOvertimeApproval(empleado.id, d.isoDate, aut) : undefined}
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
  if (day.modificadoPorSupervisor) {
    if (day.tipoModificacionSupervisor === 'falta_confirmada') {
      rowBg += ' bg-rose-950/20 border-l-4 border-l-rose-500';
    } else {
      rowBg += ' bg-purple-950/25 border-l-4 border-l-purple-500';
    }
  } else if (day.huerfana || faltanChecadasEnDiaLaboral) {
    rowBg += ' bg-amber-950/20 border-l-4 border-l-amber-500';
  } else if (day.rowClass === 'row-success') {
    rowBg += ' bg-emerald-950/10 border-l-2 border-l-emerald-500/60';
  } else if (day.rowClass === 'row-danger') {
    rowBg += ' bg-rose-950/15 border-l-2 border-l-rose-500';
  }

  const tieneChecadaUnica = tieneEnt !== tieneSal;
  const crudos = day.registrosCrudosDia || [];
  const mostrarPillsCrudos = crudos.length > 0 && (day.huerfana || crudos.length > 2 || crudos.some(c => c.codigo === 'RST'));

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

  return (
    <tr className={rowBg}>
      {/* Fecha */}
      <td className="p-3 pl-4 text-slate-300 font-medium whitespace-nowrap align-top">
        {day.isoDate}
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

      {/* Entrada (Editable) */}
      <td className="p-3 whitespace-nowrap align-top">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={day.entrada === '--:--' ? '' : day.entrada}
              onChange={(e) => onChangeTimes(e.target.value || '--:--', day.salida)}
              className={`w-24 rounded px-1.5 py-0.5 text-xs bg-slate-950/90 border outline-none ${
                day.modificadoPorSupervisor && day.entrada !== day.entradaOriginal
                  ? 'border-purple-500 text-purple-200 font-bold ring-1 ring-purple-500/30'
                  : day.entrada === '--:--'
                  ? 'border-slate-800 text-rose-400'
                  : 'border-slate-800 text-slate-100 font-semibold focus:border-amber-500'
              }`}
              title="Haz clic para ajustar o agregar manualmente la hora de Entrada"
            />
            {day.entrada !== '--:--' && (
              <button
                type="button"
                onClick={() => onChangeTimes('--:--', day.salida)}
                className="text-[10px] text-slate-600 hover:text-rose-400 no-print cursor-pointer"
                title="Limpiar entrada"
              >
                ×
              </button>
            )}
          </div>
          {day.modificadoPorSupervisor && day.entrada !== (day.entradaOriginal || '--:--') && (
            <span className="text-[9px] text-purple-300 font-sans">
              Orig: {day.entradaOriginal || 'Sin checada'}
            </span>
          )}
        </div>
      </td>

      {/* Salida (Editable + Botón intercambiar si es huérfana) */}
      <td className="p-3 whitespace-nowrap align-top">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {tieneChecadaUnica && (
              <button
                type="button"
                onClick={handleSwapTimes}
                className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all no-print cursor-pointer"
                title="Mover checada entre Entrada ⇄ Salida"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
            )}
            <input
              type="time"
              value={day.salida === '--:--' ? '' : day.salida}
              onChange={(e) => onChangeTimes(day.entrada, e.target.value || '--:--')}
              className={`w-24 rounded px-1.5 py-0.5 text-xs bg-slate-950/90 border outline-none ${
                day.modificadoPorSupervisor && day.salida !== day.salidaOriginal
                  ? 'border-purple-500 text-purple-200 font-bold ring-1 ring-purple-500/30'
                  : day.salida === '--:--'
                  ? 'border-slate-800 text-rose-400'
                  : 'border-slate-800 text-slate-100 font-semibold focus:border-amber-500'
              }`}
              title="Haz clic para ajustar o agregar manualmente la hora de Salida"
            />
            {day.salida !== '--:--' && (
              <button
                type="button"
                onClick={() => onChangeTimes(day.entrada, '--:--')}
                className="text-[10px] text-slate-600 hover:text-rose-400 no-print cursor-pointer"
                title="Limpiar salida"
              >
                ×
              </button>
            )}
          </div>
          {day.modificadoPorSupervisor && day.salida !== (day.salidaOriginal || '--:--') && (
            <span className="text-[9px] text-purple-300 font-sans">
              Orig: {day.salidaOriginal || 'Sin checada'}
            </span>
          )}
        </div>
      </td>

      {/* H. Normal */}
      <td className="p-3 text-center font-bold text-emerald-400 align-top">
        {day.hNormal > 0 ? day.hNormal.toFixed(2) : '-'}
      </td>

      {/* H. Extra y Pregunta de Autorización de Tiempo Extra */}
      <td className="p-3 text-center align-top whitespace-nowrap">
        {day.hExtra > 0 ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-bold text-amber-400 font-mono text-xs">
              {day.hExtra.toFixed(2)}h
            </span>

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
          {/* Bloqueo estricto para supervisores en días de Asistencia normal o Descanso */}
          {isSupervisorMode && (day.incidencia === 'Asistencia' || day.incidencia === 'Descanso' || day.incidencia === 'Festivo') ? (
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
              <select
                value={day.incidencia}
                onChange={(e) => onChangeIncidence(e.target.value)}
                className="flex-1 text-xs rounded-md px-2 py-1 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/60"
              >
                {(isSupervisorMode ? OPCIONES_INCIDENCIA_SUPERVISOR : OPCIONES_INCIDENCIA).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || '(Sin incidencia)'}
                  </option>
                ))}
                <option value="Falta Confirmada">Falta Confirmada (No asistió)</option>
              </select>
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
            isSupervisorMode && (day.incidencia === 'Asistencia' || day.incidencia === 'Descanso' || day.incidencia === 'Festivo') ? null : (
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
