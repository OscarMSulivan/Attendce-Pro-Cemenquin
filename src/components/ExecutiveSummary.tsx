/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { EmployeeReport, PayrollSummary } from '../types/attendance';

interface ExecutiveSummaryProps {
  summary: PayrollSummary;
  reports?: EmployeeReport[];
  selectedSupervisor?: string;
  onSelectSupervisor?: (supervisor: string) => void;
}

const ACCENT_PALETTE = [
  {
    bar: '#FEB95A',
    badgeBg: 'rgba(254, 185, 90, 0.12)',
    badgeBorder: 'rgba(254, 185, 90, 0.45)',
    badgeText: '#FEB95A',
  },
  {
    bar: '#A9DFD8',
    badgeBg: 'rgba(169, 223, 216, 0.12)',
    badgeBorder: 'rgba(169, 223, 216, 0.45)',
    badgeText: '#A9DFD8',
  },
  {
    bar: '#20AEF3',
    badgeBg: 'rgba(32, 174, 243, 0.12)',
    badgeBorder: 'rgba(32, 174, 243, 0.45)',
    badgeText: '#20AEF3',
  },
  {
    bar: '#F2C8ED',
    badgeBg: 'rgba(242, 200, 237, 0.12)',
    badgeBorder: 'rgba(242, 200, 237, 0.45)',
    badgeText: '#F2C8ED',
  },
];

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  summary,
  reports = [],
  selectedSupervisor = '',
  onSelectSupervisor,
}) => {
  const totalHorasGeneradas = summary.totalHoras + summary.totalHorasExtra;

  // Calcular ranking por supervisor (estilo "Top Products" de la imagen de referencia)
  const supervisorRows = useMemo(() => {
    if (reports && reports.length > 0) {
      const map: Record<string, { empCount: number; diasTotales: number; faltas: number; horas: number }> = {};
      reports.forEach(r => {
        const sup = r.empleado.jefe || 'GENERAL';
        if (!map[sup]) {
          map[sup] = { empCount: 0, diasTotales: 0, faltas: 0, horas: 0 };
        }
        map[sup].empCount += 1;
        map[sup].diasTotales += Math.max(1, r.dias.length);
        map[sup].faltas += r.faltas;
        map[sup].horas += r.totalNormal;
      });

      return Object.entries(map)
        .map(([name, st]) => {
          const pct = Math.max(
            0,
            Math.min(100, Math.round(((st.diasTotales - st.faltas) / Math.max(1, st.diasTotales)) * 100))
          );
          return {
            name,
            subtitle: `${st.empCount} colab. · ${st.horas.toFixed(0)}h`,
            pct,
            isSupervisor: true,
          };
        })
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5);
    }

    // Si aún no hay reportes generados por supervisor, mostrar distribución de incidencias o indicadores base
    const entriesIncidencias = Object.entries(summary.incidenciasConteo).sort((a, b) => b[1] - a[1]);
    const totalInc = entriesIncidencias.reduce((acc, [, v]) => acc + v, 0);
    if (entriesIncidencias.length > 0) {
      return entriesIncidencias.slice(0, 4).map(([name, count]) => ({
        name,
        subtitle: `${count} registros`,
        pct: Math.min(100, Math.round((count / Math.max(1, totalInc)) * 100)),
        isSupervisor: false,
      }));
    }

    return [
      { name: 'Asistencia Regular', subtitle: 'Listo para procesar', pct: 86, isSupervisor: false },
      { name: 'Puntualidad de Turno', subtitle: 'Sin retardos críticos', pct: 74, isSupervisor: false },
      { name: 'Horarios Asignados', subtitle: 'Catálogo activo', pct: 65, isSupervisor: false },
      { name: 'Tiempo Extra Validado', subtitle: 'Control por supervisor', pct: 48, isSupervisor: false },
    ];
  }, [reports, summary.incidenciasConteo]);

  // Calcular puntos de la gráfica de área "Balance de Horas" (estilo "Customer Fulfilment")
  const areaChartPaths = useMemo(() => {
    const numPoints = 7;
    const normValues: number[] = [];
    const extraValues: number[] = [];

    if (reports && reports.length > 0 && reports[0]?.dias?.length) {
      for (let i = 0; i < Math.min(numPoints, reports[0].dias.length); i++) {
        let sumN = 0;
        let sumE = 0;
        reports.forEach(r => {
          const d = r.dias[i];
          if (d) {
            sumN += d.hNormal;
            sumE += d.hExtra;
          }
        });
        normValues.push(sumN);
        extraValues.push(sumE);
      }
    } else {
      normValues.push(78, 68, 82, 62, 86, 66, 92);
      extraValues.push(35, 48, 28, 30, 38, 34, 46);
    }

    while (normValues.length < numPoints) normValues.push(70);
    while (extraValues.length < numPoints) extraValues.push(30);

    const maxNorm = Math.max(10, ...normValues);
    const maxExtra = Math.max(5, ...extraValues, maxNorm * 0.5);

    const width = 280;
    const stepX = width / (numPoints - 1);

    const topPts = normValues.map((v, idx) => {
      const x = Math.round(idx * stepX);
      const y = Math.round(14 + (1 - v / maxNorm) * 42);
      return { x, y };
    });

    const botPts = extraValues.map((v, idx) => {
      const x = Math.round(idx * stepX);
      const y = Math.round(56 + (1 - v / maxExtra) * 32);
      return { x, y };
    });

    const topLine = topPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const topArea = `${topLine} L${width},105 L0,105 Z`;

    const botLine = botPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const botArea = `${botLine} L${width},105 L0,105 Z`;

    return { topPts, botPts, topLine, topArea, botLine, botArea };
  }, [reports]);

  // Calcular arco del tacómetro semicircular (estilo "Earnings" 80% gauge)
  const compliancePct = Math.max(0, Math.min(100, Math.round(summary.tasaCumplimiento || 0)));
  const radius = 64;
  const circumference = Math.PI * radius; // Semicírculo
  const strokeDashoffset = circumference - (compliancePct / 100) * circumference;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 mb-6">
      {/* 1. Tarjeta "Top Products" style (5 cols): Cumplimiento por Supervisor / Equipo */}
      <div className="md:col-span-2 xl:col-span-5 rounded-2xl p-4 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {reports.length > 0 ? 'Cumplimiento por Supervisor' : 'Indicadores de Nómina'}
            </h3>
            {selectedSupervisor && onSelectSupervisor && (
              <button
                type="button"
                onClick={() => onSelectSupervisor('')}
                className="text-[11px] font-semibold text-[#A9DFD8] hover:underline cursor-pointer"
              >
                Ver todos
              </button>
            )}
          </div>

          {/* Encabezado de tabla minimalista idéntico a la referencia */}
          <div className="grid grid-cols-12 gap-2 pb-2.5 border-b border-white/[0.06] text-xs font-medium text-[#87888C]">
            <span className="col-span-2">#</span>
            <span className="col-span-5">Nombre</span>
            <span className="col-span-3">Cumplimiento</span>
            <span className="col-span-2 text-right">Nivel</span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {supervisorRows.map((row, idx) => {
              const color = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
              const isSelected = selectedSupervisor === row.name;
              return (
                <div
                  key={row.name}
                  onClick={() => {
                    if (row.isSupervisor && onSelectSupervisor) {
                      onSelectSupervisor(isSelected ? '' : row.name);
                    }
                  }}
                  className={`grid grid-cols-12 gap-2 items-center py-3 text-xs transition-colors ${
                    row.isSupervisor && onSelectSupervisor ? 'cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 -mx-1' : ''
                  } ${isSelected ? 'bg-[#A9DFD8]/10 rounded-lg px-1 -mx-1' : ''}`}
                >
                  <span className="col-span-2 font-mono tabular-nums text-[#E8E8EA] font-semibold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="col-span-5 min-w-0 pr-2">
                    <p className="text-[#E8E8EA] font-medium truncate" title={row.name}>
                      {row.name}
                    </p>
                    <p className="text-[10px] text-[#87888C] font-mono truncate">{row.subtitle}</p>
                  </div>
                  <div className="col-span-3 pr-2">
                    <div className="w-full h-1.5 rounded-full bg-[#2B2B36] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${row.pct}%`, backgroundColor: color.bar }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-semibold border"
                      style={{
                        backgroundColor: color.badgeBg,
                        borderColor: color.badgeBorder,
                        color: color.badgeText,
                      }}
                    >
                      {row.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Tarjeta "Customer Fulfilment" style (4 cols): Balance de Horas Semanal */}
      <div className="md:col-span-1 xl:col-span-4 rounded-2xl p-4 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Balance de Horas
          </h3>
          <p className="text-xs text-[#87888C] mt-0.5">
            Horas normales vs tiempo extra autorizado
          </p>
        </div>

        {/* Gráfico SVG de doble área con degradados Mint Teal y Soft Rose */}
        <div className="my-3">
          <svg viewBox="0 0 280 108" className="w-full h-28 overflow-visible">
            <defs>
              <linearGradient id="mintAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A9DFD8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#A9DFD8" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="roseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2C8ED" stopOpacity="0.40" />
                <stop offset="100%" stopColor="#F2C8ED" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <path d={areaChartPaths.topArea} fill="url(#mintAreaGrad)" />
            <path d={areaChartPaths.botArea} fill="url(#roseAreaGrad)" />

            <path
              d={areaChartPaths.topLine}
              fill="none"
              stroke="#A9DFD8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={areaChartPaths.botLine}
              fill="none"
              stroke="#F2C8ED"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {areaChartPaths.topPts.map((p, i) => (
              <circle
                key={`t_${i}`}
                cx={p.x}
                cy={p.y}
                r="2.8"
                fill="#A9DFD8"
                stroke="#171821"
                strokeWidth="1.2"
              />
            ))}
            {areaChartPaths.botPts.map((p, i) => (
              <circle
                key={`b_${i}`}
                cx={p.x}
                cy={p.y}
                r="2.8"
                fill="#F2C8ED"
                stroke="#171821"
                strokeWidth="1.2"
              />
            ))}
          </svg>
        </div>

        {/* Footer de 2 columnas con divisor vertical idéntico a la imagen */}
        <div className="pt-3 border-t border-white/[0.06] grid grid-cols-2 divide-x divide-white/[0.08]">
          <div className="pr-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#87888C]">
              <span className="w-2 h-2 rounded-full bg-[#A9DFD8]" />
              <span>H. Normales</span>
            </div>
            <p className="text-sm font-bold font-mono tabular-nums text-white mt-1">
              {summary.totalHoras.toFixed(1)} hrs
            </p>
          </div>
          <div className="pl-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#87888C]">
              <span className="w-2 h-2 rounded-full bg-[#F2C8ED]" />
              <span>H. Extras Aut.</span>
            </div>
            <p className="text-sm font-bold font-mono tabular-nums text-white mt-1">
              {summary.totalHorasExtra.toFixed(1)} hrs
            </p>
          </div>
        </div>
      </div>

      {/* 3. Tarjeta "Earnings" Gauge style (3 cols): Eficiencia y Tasa de Cumplimiento */}
      <div className="md:col-span-1 xl:col-span-3 rounded-2xl p-4 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Total Horas
          </h3>
          <p className="text-xs text-[#87888C] mt-0.5">
            Acumulado de nómina
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#A9DFD8] mt-2 tracking-tight">
            {totalHorasGeneradas.toFixed(2)}h
          </p>
          <p className="text-[11px] text-[#87888C] mt-1">
            Promedio de {summary.promedioHoras.toFixed(1)}h por empleado en la semana
          </p>
        </div>

        {/* Tacómetro semicircular Mint Teal idéntico a la tarjeta "Earnings 80%" */}
        <div className="flex flex-col items-center justify-end pt-3">
          <div className="relative w-40 h-24 flex items-end justify-center overflow-hidden">
            <svg viewBox="0 0 160 90" className="w-full h-full">
              {/* Pista de fondo */}
              <path
                d="M 16 80 A 64 64 0 0 1 144 80"
                fill="none"
                stroke="#2B2B36"
                strokeWidth="18"
                strokeLinecap="butt"
              />
              {/* Arco activo Mint Teal */}
              <path
                d="M 16 80 A 64 64 0 0 1 144 80"
                fill="none"
                stroke="#A9DFD8"
                strokeWidth="18"
                strokeLinecap="butt"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute bottom-1 text-center">
              <span className="text-2xl font-extrabold font-mono tabular-nums text-white">
                {compliancePct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
