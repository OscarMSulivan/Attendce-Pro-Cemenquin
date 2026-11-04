/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BarChart3, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
import { PayrollSummary } from '../types/attendance';

interface ExecutiveSummaryProps {
  summary: PayrollSummary;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ summary }) => {
  const totalHorasGeneradas = summary.totalHoras + summary.totalHorasExtra;
  const pctNormal = totalHorasGeneradas > 0 ? (summary.totalHoras / totalHorasGeneradas) * 100 : 100;
  const pctExtra = totalHorasGeneradas > 0 ? (summary.totalHorasExtra / totalHorasGeneradas) * 100 : 0;

  const entriesIncidencias = Object.entries(summary.incidenciasConteo).sort((a, b) => b[1] - a[1]);
  const totalIncidencias = entriesIncidencias.reduce((sum, [, val]) => sum + val, 0);

  const getIncidenceColor = (name: string, index: number) => {
    const upper = name.toUpperCase();
    if (upper.includes('ASISTENCIA')) return 'bg-emerald-500 text-emerald-400 border-emerald-500/30';
    if (upper.includes('VACAC')) return 'bg-amber-500 text-amber-400 border-amber-500/30';
    if (upper.includes('FALTA')) return 'bg-rose-500 text-rose-400 border-rose-500/30';
    if (upper.includes('RETARDO')) return 'bg-yellow-500 text-yellow-400 border-yellow-500/30';
    if (upper.includes('DESCANSO')) return 'bg-blue-500 text-blue-400 border-blue-500/30';
    if (upper.includes('FESTIVO')) return 'bg-purple-500 text-purple-400 border-purple-500/30';
    const fallback = ['bg-indigo-500', 'bg-cyan-500', 'bg-teal-500', 'bg-pink-500'];
    return `${fallback[index % fallback.length]} text-slate-200 border-slate-700`;
  };

  return (
    <div className="rounded-xl p-6 bg-slate-900/90 border border-slate-800 shadow-lg mb-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Resumen Ejecutivo del Periodo
        </h3>
        <span className="text-xs text-slate-400">
          Base activa: <strong className="text-slate-200 font-mono">{summary.totalEmpleados}</strong> empleados
        </span>
      </div>

      {/* KPIs superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Promedio Hrs/Empleado</p>
            <p className="text-2xl font-black font-mono text-blue-400">{summary.promedioHoras.toFixed(2)}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Asistencia Perfecta</p>
            <p className="text-2xl font-black font-mono text-emerald-400">{summary.asistenciasPerfectas}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tasa de Cumplimiento</p>
            <p className="text-2xl font-black font-mono text-amber-400">{summary.tasaCumplimiento}%</p>
          </div>
        </div>
      </div>

      {/* Gráficos de distribución en 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Distribución de Horas */}
        <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Distribución de Horas</span>
            <span className="text-slate-300 font-mono">{totalHorasGeneradas.toFixed(2)} hrs totales</span>
          </h4>

          {/* Barra proporcional visual */}
          <div className="h-4 w-full rounded-full overflow-hidden bg-slate-800 flex mb-3">
            <div 
              style={{ width: `${pctNormal}%` }} 
              className="bg-blue-500 transition-all duration-500 h-full" 
              title={`Horas Normales: ${summary.totalHoras.toFixed(2)} (${pctNormal.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctExtra}%` }} 
              className="bg-amber-500 transition-all duration-500 h-full" 
              title={`Horas Extras: ${summary.totalHorasExtra.toFixed(2)} (${pctExtra.toFixed(1)}%)`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                H. Normales:
              </span>
              <strong className="font-mono text-slate-100">{summary.totalHoras.toFixed(2)} ({pctNormal.toFixed(1)}%)</strong>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                H. Extras:
              </span>
              <strong className="font-mono text-amber-400">{summary.totalHorasExtra.toFixed(2)} ({pctExtra.toFixed(1)}%)</strong>
            </div>
          </div>
        </div>

        {/* Distribución de Incidencias */}
        <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Incidencias Registradas</span>
            <span className="text-slate-300 font-mono">{totalIncidencias} eventos</span>
          </h4>

          {entriesIncidencias.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Sin incidencias registradas en este periodo.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {entriesIncidencias.slice(0, 6).map(([nombre, count], idx) => {
                const pct = totalIncidencias > 0 ? (count / totalIncidencias) * 100 : 0;
                return (
                  <div key={nombre} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 font-medium truncate">{nombre}</span>
                      <span className="font-mono text-slate-400">
                        <strong className="text-slate-100">{count}</strong> ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getIncidenceColor(nombre, idx).split(' ')[0]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
