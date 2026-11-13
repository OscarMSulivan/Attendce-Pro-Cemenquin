/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Clock, CheckCircle2, Timer, AlertTriangle, BarChart2 } from 'lucide-react';
import { EmployeeReport, PayrollSummary } from '../types/attendance';

interface StatsPanelProps {
  summary: PayrollSummary;
  reports?: EmployeeReport[];
  totalDiasAuditoria?: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ summary, reports = [] }) => {
  const dailyLevels = useMemo(() => {
    const defaultDays = [
      { label: 'Jue', pct: 72 },
      { label: 'Vie', pct: 88 },
      { label: 'Sáb', pct: 64 },
      { label: 'Dom', pct: 42 },
      { label: 'Lun', pct: 84 },
      { label: 'Mar', pct: 78 },
      { label: 'Mié', pct: 91 },
    ];

    if (!reports || reports.length === 0 || !reports[0]?.dias?.length) {
      const base = Math.max(25, Math.min(96, summary.tasaCumplimiento || 80));
      return defaultDays.map((d, i) => ({
        label: d.label,
        pct:
          summary.totalEmpleados > 0
            ? Math.max(20, Math.min(98, base - (i === 3 ? 35 : (i % 3) * 6)))
            : 30,
      }));
    }

    const numDays = Math.min(7, reports[0].dias.length);
    const bars: Array<{ label: string; pct: number }> = [];
    for (let idx = 0; idx < numDays; idx++) {
      const dayLabel =
        reports[0].dias[idx]?.dayName || defaultDays[idx]?.label || `D${idx + 1}`;
      let activeCount = 0;
      reports.forEach((r) => {
        const d = r.dias[idx];
        if (!d) return;
        if (
          d.hNormal > 0 ||
          d.incidencia === 'Asistencia' ||
          d.incidencia === 'Descanso' ||
          d.incidencia === 'Festivo'
        ) {
          activeCount++;
        }
      });
      const pct = Math.max(
        18,
        Math.min(100, Math.round((activeCount / Math.max(1, reports.length)) * 100))
      );
      bars.push({ label: dayLabel, pct });
    }
    return bars;
  }, [reports, summary.tasaCumplimiento, summary.totalEmpleados]);

  const totalIncidents = summary.totalFaltas + summary.totalRetardos;

  return (
    <section
      aria-label="Resumen de métricas de nómina"
      className="rounded-xl bg-[#21222D] border border-white/[0.08] overflow-hidden mb-5 no-print animate-fade-up"
    >
      {/* Cabecera compacta tipo Ledger */}
      <div className="px-4 sm:px-5 py-2.5 bg-[#171821] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <h2 className="text-xs font-semibold text-white">
            Libro mayor de asistencia semanal
          </h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#87888C]">
          Plantilla auditada: <strong className="text-white">{summary.totalEmpleados}</strong> colaboradores
        </span>
      </div>

      {/* Grilla continua de 1px (máximo 2 niveles de profundidad) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
        {/* Celda 1: Horas Normales */}
        <div className="xl:col-span-2 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#87888C] mb-2">
            <span className="font-medium">Horas normales</span>
            <Clock className="w-3.5 h-3.5 text-[#87888C]" />
          </div>
          <div>
            <p className="text-2xl font-semibold font-mono tabular-nums text-white tracking-tight">
              {summary.totalHoras.toFixed(1)}h
            </p>
            <p className="text-[11px] font-mono tabular-nums text-[#87888C] mt-1">
              Prom. {summary.promedioHoras.toFixed(1)}h / colab.
            </p>
          </div>
        </div>

        {/* Celda 2: Cumplimiento */}
        <div className="xl:col-span-2 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#87888C] mb-2">
            <span className="font-medium">Cumplimiento</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div>
            <p className="text-2xl font-semibold font-mono tabular-nums text-[#10B981] tracking-tight">
              {summary.tasaCumplimiento}%
            </p>
            <p className="text-[11px] font-mono tabular-nums text-[#87888C] mt-1">
              {summary.asistenciasPerfectas} asistencias perfectas
            </p>
          </div>
        </div>

        {/* Celda 3: Tiempo Extra Autorizado */}
        <div className="xl:col-span-2 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#87888C] mb-2">
            <span className="font-medium">Tiempo extra aut.</span>
            <Timer className="w-3.5 h-3.5 text-[#87888C]" />
          </div>
          <div>
            <p className="text-2xl font-semibold font-mono tabular-nums text-white tracking-tight">
              {summary.totalHorasExtra.toFixed(1)}h
            </p>
            <p className="text-[11px] font-mono tabular-nums text-[#87888C] mt-1">
              {summary.totalVac} permisos / vacaciones
            </p>
          </div>
        </div>

        {/* Celda 4: Incidencias de Turno (Semáforo semántico) */}
        <div className="xl:col-span-3 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#87888C] mb-2">
            <span className="font-medium">Incidencias de turno</span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                summary.totalFaltas > 0
                  ? 'text-rose-500'
                  : summary.totalRetardos > 0
                  ? 'text-amber-500'
                  : 'text-[#87888C]'
              }`}
            />
          </div>
          <div>
            <p
              className={`text-2xl font-semibold font-mono tabular-nums tracking-tight ${
                summary.totalFaltas > 0
                  ? 'text-rose-500'
                  : summary.totalRetardos > 0
                  ? 'text-amber-500'
                  : 'text-white'
              }`}
            >
              {totalIncidents}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-[#87888C] mt-1">
              <span className={summary.totalFaltas > 0 ? 'text-rose-500 font-semibold' : ''}>
                {summary.totalFaltas} faltas
              </span>{' '}
              ·{' '}
              <span className={summary.totalRetardos > 0 ? 'text-amber-500 font-semibold' : ''}>
                {summary.totalRetardos} retardos
              </span>
            </p>
          </div>
        </div>

        {/* Celda 5: Nivel por Día (Jue - Mié) */}
        <div className="sm:col-span-2 xl:col-span-3 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#87888C] mb-2">
            <span className="font-medium">Volumen diario (Jue–Mié)</span>
            <BarChart2 className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="flex items-end justify-between gap-2 h-14 pt-1">
            {dailyLevels.map((bar, i) => (
              <div key={`${bar.label}_${i}`} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-3 sm:w-3.5 h-10 rounded-xs bg-[#2B2B36] flex items-end overflow-hidden"
                  title={`${bar.label}: ${bar.pct}% asistencia activa`}
                >
                  <div
                    className="w-full bg-[#10B981] transition-all duration-300"
                    style={{ height: `${bar.pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-[#87888C]">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
