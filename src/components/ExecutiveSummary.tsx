/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  UserCheck,
  Send,
  Building2,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Flame,
  FileCheck
} from 'lucide-react';
import { EmployeeReport, PayrollSummary } from '../types/attendance';
import { PayrollDispersal, PayrollRelease } from '../types/portal';
import { DispersalCountdownTimer } from './portal/DispersalCountdownTimer';
import { calcularMinutosRetardoDia } from '../services/contpaqiExportService';

interface ExecutiveSummaryProps {
  summary: PayrollSummary;
  reports?: EmployeeReport[];
  selectedSupervisor?: string;
  onSelectSupervisor?: (supervisor: string) => void;
  dispersals?: PayrollDispersal[];
  releases?: Record<string, PayrollRelease>;
  supervisors?: string[];
  semanaNumero?: number;
  semanaPeriodo?: string;
  onNavigateToMonitor?: () => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  summary,
  reports = [],
  selectedSupervisor = '',
  onSelectSupervisor,
  dispersals = [],
  releases = {},
  supervisors = [],
  semanaNumero,
  semanaPeriodo,
  onNavigateToMonitor,
}) => {
  // Lista unificada de supervisores detectados en reportes o catálogo
  const supervisorList = useMemo(() => {
    const set = new Set<string>(supervisors);
    reports.forEach((r) => {
      if (r.empleado.jefe) set.add(r.empleado.jefe.trim());
    });
    return Array.from(set).sort();
  }, [supervisors, reports]);

  // Última dispersión registrada (preferentemente de la semana activa)
  const activeDispersal = useMemo(() => {
    if (semanaNumero) {
      const match = dispersals.find((d) => d.semanaNumero === semanaNumero);
      if (match) return match;
    }
    return dispersals[0] || null;
  }, [dispersals, semanaNumero]);

  // Estado por supervisor de su última nómina dispersada
  const supervisorStatusList = useMemo(() => {
    return supervisorList.map((supName) => {
      const releaseKey = semanaNumero ? `${semanaNumero}_${supName}` : Object.keys(releases).find((k) => k.endsWith(`_${supName}`));
      const release = releaseKey ? releases[releaseKey] : undefined;

      const isNotified = Boolean(
        activeDispersal &&
          !activeDispersal.cancelada &&
          activeDispersal.supervisoresNotificados?.some(
            (s) => s.toUpperCase() === supName.toUpperCase()
          )
      );

      const isCancelled = Boolean(
        activeDispersal &&
          (activeDispersal.cancelada ||
            activeDispersal.supervisoresCancelados?.some(
              (s) => s.toUpperCase() === supName.toUpperCase()
            ))
      );

      const isReleased = release?.status === 'liberado';
      const isPending = isNotified && !isReleased;

      // Cantidad de empleados bajo este supervisor en el reporte
      const empCount = reports.filter(
        (r) => r.empleado.jefe?.trim().toUpperCase() === supName.toUpperCase()
      ).length;

      // Tiempo límite configurado
      const deadline = activeDispersal?.limiteLiberacion;
      const isOverdue = Boolean(
        isPending && deadline && new Date(deadline).getTime() < Date.now()
      );

      let statusBadge: {
        label: string;
        bg: string;
        border: string;
        text: string;
      };

      if (isCancelled) {
        statusBadge = {
          label: 'Cancelada',
          bg: 'bg-rose-50 dark:bg-rose-500/15',
          border: 'border-rose-200 dark:border-rose-500/30',
          text: 'text-rose-700 dark:text-rose-400',
        };
      } else if (isReleased) {
        statusBadge = {
          label: 'Liberada ✓',
          bg: 'bg-teal-50 dark:bg-[#A9DFD8]/15',
          border: 'border-teal-200 dark:border-[#A9DFD8]/35',
          text: 'text-teal-800 dark:text-[#A9DFD8]',
        };
      } else if (isOverdue) {
        statusBadge = {
          label: 'Plazo Vencido ⚠️',
          bg: 'bg-rose-50 dark:bg-rose-500/15',
          border: 'border-rose-300 dark:border-rose-500/40',
          text: 'text-rose-700 dark:text-rose-400',
        };
      } else if (isPending) {
        statusBadge = {
          label: 'Dispersada (En Revisión)',
          bg: 'bg-sky-50 dark:bg-[#20AEF3]/15',
          border: 'border-sky-200 dark:border-[#20AEF3]/35',
          text: 'text-sky-800 dark:text-[#20AEF3]',
        };
      } else {
        statusBadge = {
          label: 'Sin Dispersar',
          bg: 'bg-slate-100 dark:bg-white/5',
          border: 'border-slate-200 dark:border-white/10',
          text: 'text-slate-600 dark:text-slate-400',
        };
      }

      return {
        name: supName,
        empCount,
        isReleased,
        isPending,
        isCancelled,
        isNotified,
        isOverdue,
        deadline,
        release,
        statusBadge,
      };
    });
  }, [supervisorList, releases, activeDispersal, reports, semanaNumero]);

  // Supervisores pendientes de mandar/liberar su lista
  const pendingSupervisors = useMemo(() => {
    return supervisorStatusList.filter((s) => !s.isReleased);
  }, [supervisorStatusList]);

  // Supervisores que superaron el límite de tiempo
  const overdueSupervisors = useMemo(() => {
    return supervisorStatusList.filter((s) => s.isOverdue);
  }, [supervisorStatusList]);

  // Estadísticas clave de incidencias para nóminas
  const incidentStats = useMemo(() => {
    let finjCount = 0;
    let finjEmpleados = new Set<string>();
    let retardoCount = 0;
    let retardoMinutos = 0;
    let extraHoursTotal = 0;
    let extraHoursPending = 0;
    let formatosCount = 0;

    reports.forEach((r) => {
      let empHasFinj = false;
      r.dias.forEach((d) => {
        const inc = (d.incidencia || '').toUpperCase();
        if (inc.includes('FINJ') || inc.includes('INJUSTIFICADA') || inc.includes('FALTA')) {
          finjCount++;
          empHasFinj = true;
        }
        if (inc.includes('RETARDO') || (d.advertencia && d.advertencia.toLowerCase().includes('retardo'))) {
          retardoCount++;
          retardoMinutos += calcularMinutosRetardoDia(d);
        }
        if (d.hExtra > 0) {
          extraHoursTotal += d.hExtra;
          if (!d.horasExtrasAutorizadas) {
            extraHoursPending += d.hExtra;
          }
        }
        if (d.formatoSubidoNombre) {
          formatosCount++;
        }
      });
      if (empHasFinj) finjEmpleados.add(r.empleado.id);
    });

    return {
      finjCount,
      finjEmpleadosCount: finjEmpleados.size,
      retardoCount,
      retardoMinutos,
      extraHoursTotal: Number(extraHoursTotal.toFixed(1)),
      extraHoursPending: Number(extraHoursPending.toFixed(1)),
      formatosCount,
    };
  }, [reports]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 mb-6">
      {/* =========================================================================
       * TARJETA 1 (5 cols): Cumplimiento y Estado de Última Nómina Dispersada
       * ========================================================================= */}
      <div className="md:col-span-2 xl:col-span-5 rounded-2xl p-4 sm:p-6 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] shadow-lg flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/30 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8] shrink-0">
                <ListChecks className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  Estado de Nómina por Supervisor
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#87888C]">
                  {activeDispersal
                    ? `Semana ${activeDispersal.semanaNumero} · Dispersada por ${activeDispersal.dispersadoPor}`
                    : 'Sin registro de dispersión en la semana activa'}
                </p>
              </div>
            </div>

            {selectedSupervisor && onSelectSupervisor && (
              <button
                type="button"
                onClick={() => onSelectSupervisor('')}
                className="text-[11px] font-bold text-teal-700 dark:text-[#A9DFD8] hover:underline cursor-pointer"
              >
                Ver todos
              </button>
            )}
          </div>

          {/* Encabezado de la tabla */}
          <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-200 dark:border-white/[0.06] text-xs font-semibold text-slate-500 dark:text-[#87888C]">
            <span className="col-span-1">#</span>
            <span className="col-span-5">Lista / Supervisor</span>
            <span className="col-span-6 text-right">Última Nómina Dispersada</span>
          </div>

          {/* Lista de supervisores con su estado real */}
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05] max-h-60 overflow-y-auto pr-1">
            {supervisorStatusList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-[#87888C]">
                Carga la lista de empleados para visualizar el estado de cada supervisor.
              </div>
            ) : (
              supervisorStatusList.map((sup, idx) => {
                const isSelected = selectedSupervisor === sup.name;
                return (
                  <div
                    key={sup.name}
                    onClick={() => {
                      if (onSelectSupervisor) {
                        onSelectSupervisor(isSelected ? '' : sup.name);
                      }
                    }}
                    className={`grid grid-cols-12 gap-2 items-center py-2.5 text-xs transition-colors cursor-pointer rounded-xl px-2 ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/40'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="col-span-1 font-mono text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="col-span-5 min-w-0 pr-1">
                      <p className="font-bold text-slate-800 dark:text-[#E8E8EA] truncate text-xs">
                        {sup.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-[#87888C] font-mono">
                        {sup.empCount} colaboradores
                      </p>
                    </div>

                    <div className="col-span-6 flex items-center justify-end gap-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border whitespace-nowrap ${sup.statusBadge.bg} ${sup.statusBadge.border} ${sup.statusBadge.text}`}
                      >
                        {sup.statusBadge.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer con enlace al semáforo */}
        {onNavigateToMonitor && (
          <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs mt-3">
            <span className="text-slate-500 dark:text-[#87888C] text-[11px]">
              Liberadas: <strong className="text-teal-700 dark:text-[#A9DFD8]">{supervisorStatusList.filter(s => s.isReleased).length}</strong> de{' '}
              <strong className="text-slate-700 dark:text-slate-200">{supervisorStatusList.length}</strong>
            </span>
            <button
              type="button"
              onClick={onNavigateToMonitor}
              className="text-xs font-bold text-teal-700 dark:text-[#A9DFD8] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Semáforo Detallado</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
       * TARJETA 2 (4 cols): Listas Pendientes de Mandar y Límite de Tiempo
       * (Reemplaza la antigua gráfica de Balance de Horas)
       * ========================================================================= */}
      <div className="md:col-span-1 xl:col-span-4 rounded-2xl p-4 sm:p-6 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] shadow-lg flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                  overdueSupervisors.length > 0
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                    : 'bg-sky-500/15 dark:bg-[#20AEF3]/15 border-sky-500/30 text-sky-600 dark:text-[#20AEF3]'
                }`}
              >
                {overdueSupervisors.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  Listas Pendientes de Mandar
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#87888C]">
                  {pendingSupervisors.length > 0
                    ? `${pendingSupervisors.length} supervisor(es) por liberar`
                    : '¡Todas las listas han sido liberadas!'}
                </p>
              </div>
            </div>

            {overdueSupervisors.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                {overdueSupervisors.length} Vencida(s)
              </span>
            )}
          </div>

          {/* Banner de Límite General si existe */}
          {activeDispersal?.limiteLiberacion && (
            <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-[#20AEF3]" />
                Límite fijado:
              </span>
              <DispersalCountdownTimer
                limiteLiberacion={activeDispersal.limiteLiberacion}
                compact
              />
            </div>
          )}

          {/* Listado de supervisores pendientes */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {pendingSupervisors.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-teal-50/50 dark:bg-white/[0.02] border border-teal-200/60 dark:border-white/[0.04]">
                <CheckCircle2 className="w-7 h-7 text-teal-600 dark:text-[#A9DFD8] mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  Todas las listas al día
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#87888C] mt-0.5">
                  Los supervisores han validado y liberado sus listas a tiempo.
                </p>
              </div>
            ) : (
              pendingSupervisors.map((sup) => (
                <div
                  key={sup.name}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    sup.isOverdue
                      ? 'bg-rose-50/60 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                      : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.05]'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {sup.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#87888C]">
                      {sup.empCount} colaboradores asignados
                    </p>
                  </div>

                  <div className="shrink-0">
                    <DispersalCountdownTimer
                      limiteLiberacion={sup.deadline}
                      isReleased={sup.isReleased}
                      isCancelled={sup.isCancelled}
                      compact
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#87888C] mt-3">
          <span>
            {overdueSupervisors.length > 0 ? (
              <strong className="text-rose-600 dark:text-rose-400">
                ⚠️ Requiere recordatorio a supervisor
              </strong>
            ) : (
              'En tiempo y forma para cierre'
            )}
          </span>
          <span className="font-mono font-bold">
            {pendingSupervisors.length} pendientes
          </span>
        </div>
      </div>

      {/* =========================================================================
       * TARJETA 3 (3 cols): Inteligencia y Semáforo de Incidencias Críticas
       * (Reemplaza el antiguo velocímetro de Total Horas)
       * ========================================================================= */}
      <div className="md:col-span-1 xl:col-span-3 rounded-2xl p-4 sm:p-6 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] shadow-lg flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-[#FEB95A]/15 border border-amber-500/30 dark:border-[#FEB95A]/30 flex items-center justify-center text-amber-700 dark:text-[#FEB95A] shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                Incidencias de Nómina
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#87888C]">
                Semáforo para cálculo y CONTPAQi®
              </p>
            </div>
          </div>

          {/* 4 Mini-KPIs de Incidencias Limpias */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* FINJ */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.05]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
                Faltas (FINJ)
              </span>
              <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                {incidentStats.finjCount}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-[#87888C] block truncate">
                {incidentStats.finjEmpleadosCount} empleados afec.
              </span>
            </div>

            {/* Retardos */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.05]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-[#FEB95A] block mb-0.5">
                Retardos
              </span>
              <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                {incidentStats.retardoCount}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-[#87888C] block truncate">
                -{incidentStats.retardoMinutos} min a descontar
              </span>
            </div>

            {/* Horas Extras */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.05]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-[#F2C8ED] block mb-0.5">
                Horas Extras
              </span>
              <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                {incidentStats.extraHoursTotal}h
              </p>
              <span className="text-[10px] text-slate-500 dark:text-[#87888C] block truncate">
                {incidentStats.extraHoursPending > 0
                  ? `${incidentStats.extraHoursPending}h por autorizar`
                  : 'Todas autorizadas ✓'}
              </span>
            </div>

            {/* Formatos sin Gafete */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.05]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-[#A9DFD8] block mb-0.5">
                Formatos
              </span>
              <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                {incidentStats.formatosCount}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-[#87888C] block truncate">
                Checadas justificadas
              </span>
            </div>
          </div>
        </div>

        {/* Total horas procesadas al pie */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs mt-3">
          <span className="text-[11px] text-slate-500 dark:text-[#87888C]">
            Total Horas Generadas:
          </span>
          <span className="font-mono font-extrabold text-teal-700 dark:text-[#A9DFD8]">
            {(summary.totalHoras + summary.totalHorasExtra).toFixed(1)} hrs
          </span>
        </div>
      </div>
    </div>
  );
};
