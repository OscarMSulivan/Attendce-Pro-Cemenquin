/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { BarChart2, ClipboardCheck, CalendarCheck, UserCheck } from 'lucide-react';
import { EmployeeReport, PayrollSummary } from '../types/attendance';

interface StatsPanelProps {
  summary: PayrollSummary;
  reports?: EmployeeReport[];
  totalDiasAuditoria?: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ summary, reports = [] }) => {
  // Calcular barras diarias de nivel de asistencia para el gráfico "Level"
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
        pct: summary.totalEmpleados > 0 ? Math.max(20, Math.min(98, base - (i === 3 ? 35 : (i % 3) * 6))) : 30,
      }));
    }

    const numDays = Math.min(7, reports[0].dias.length);
    const bars: Array<{ label: string; pct: number }> = [];
    for (let idx = 0; idx < numDays; idx++) {
      const dayLabel = reports[0].dias[idx]?.dayName || defaultDays[idx]?.label || `D${idx + 1}`;
      let activeCount = 0;
      reports.forEach(r => {
        const d = r.dias[idx];
        if (!d) return;
        if (d.hNormal > 0 || d.incidencia === 'Asistencia' || d.incidencia === 'Descanso' || d.incidencia === 'Festivo') {
          activeCount++;
        }
      });
      const pct = Math.max(18, Math.min(100, Math.round((activeCount / Math.max(1, reports.length)) * 100)));
      bars.push({ label: dayLabel, pct });
    }
    return bars;
  }, [reports, summary.tasaCumplimiento, summary.totalEmpleados]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
      {/* Tarjeta Izquierda (8 cols): "Today's Sales" style -> Resumen de Asistencia */}
      <div className="xl:col-span-8 rounded-2xl p-4 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Resumen de Asistencia
            </h2>
            <p className="text-xs text-[#87888C] mt-0.5">
              Indicadores clave de la nómina semanal activa
            </p>
          </div>
          <span className="text-xs text-[#87888C] font-mono tabular-nums">
            {summary.totalEmpleados} colaboradores
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Sub-tarjeta 1: Horas Normales (Amber #FEB95A) */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#FEB95A]/10 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] mb-3">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                {summary.totalHoras.toFixed(1)}h
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Horas Normales
              </p>
              <p className="text-[10px] font-medium text-[#FEB95A] mt-1 font-mono tabular-nums">
                Prom. {summary.promedioHoras.toFixed(1)}h por empleado
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 2: Cumplimiento Global (Mint Teal #A9DFD8) */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#A9DFD8]/10 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] mb-3">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                {summary.tasaCumplimiento}%
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Cumplimiento
              </p>
              <p className="text-[10px] font-medium text-[#A9DFD8] mt-1 font-mono tabular-nums">
                {summary.asistenciasPerfectas} asistencias perfectas
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 3: Tiempo Extra Autorizado (Soft Rose #F2C8ED) */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#F2C8ED]/10 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED] mb-3">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                {summary.totalHorasExtra.toFixed(1)}h
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Tiempo Extra Aut.
              </p>
              <p className="text-[10px] font-medium text-[#F2C8ED] mt-1 font-mono tabular-nums">
                {summary.totalVac} permisos / vacaciones
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 4: Faltas y Retardos (Sky Blue #20AEF3) */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#20AEF3]/10 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] mb-3">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                {summary.totalFaltas + summary.totalRetardos}
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Incidencias Turno
              </p>
              <p className="text-[10px] font-medium text-[#20AEF3] mt-1 font-mono tabular-nums">
                {summary.totalFaltas} faltas · {summary.totalRetardos} retardos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta Derecha (4 cols): "Level" style -> Nivel Diario de Asistencia */}
      <div className="xl:col-span-4 rounded-2xl p-4 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Nivel por Día
          </h3>
          <p className="text-xs text-[#87888C] mt-0.5">
            Volumen de asistencia vs plantilla
          </p>
        </div>

        {/* Barras verticales estilo "Level" con pista oscura y relleno Mint Teal */}
        <div className="flex items-end justify-between gap-2.5 h-32 px-2 my-4">
          {dailyLevels.map((bar, i) => (
            <div key={`${bar.label}_${i}`} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-3.5 sm:w-4 h-24 rounded-md bg-[#2B2B36] flex items-end overflow-hidden"
                title={`${bar.label}: ${bar.pct}% cumplimiento`}
              >
                <div
                  className="w-full rounded-md bg-[#A9DFD8] transition-all duration-500"
                  style={{ height: `${bar.pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#87888C]">{bar.label}</span>
            </div>
          ))}
        </div>

        {/* Leyenda inferior con divisor vertical */}
        <div className="pt-3 border-t border-white/[0.06] grid grid-cols-2 divide-x divide-white/[0.08] text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-[#87888C]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A9DFD8]" />
            <span>Asistencia</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-[#87888C]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2B2B36] border border-white/15" />
            <span>Plantilla</span>
          </div>
        </div>
      </div>
    </div>
  );
};
