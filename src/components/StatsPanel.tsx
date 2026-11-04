/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, AlertTriangle, CalendarCheck, ShieldAlert } from 'lucide-react';
import { PayrollSummary } from '../types/attendance';

interface StatsPanelProps {
  summary: PayrollSummary;
  totalDiasAuditoria?: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ summary }) => {
  const horasMax = Math.max(1, summary.totalEmpleados * 48);
  const pctHoras = Math.min(100, (summary.totalHoras / horasMax) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Horas Totales */}
      <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 border-t-2 border-t-blue-500 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Horas Totales</p>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold font-mono text-slate-100 tracking-tight">
          {summary.totalHoras.toFixed(2)}
        </h2>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-blue-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${pctHoras}%` }} 
          />
        </div>
        <p className="text-xs mt-2.5 text-slate-400 flex items-center justify-between">
          <span>H. Extras:</span>
          <span className="font-semibold font-mono text-amber-400">
            {summary.totalHorasExtra.toFixed(2)} hrs
          </span>
        </p>
      </div>

      {/* 2. Faltas */}
      <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 border-t-2 border-t-rose-500 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Faltas / Incompletos</p>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold font-mono text-rose-400 tracking-tight">
          {summary.totalFaltas}
        </h2>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-rose-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, summary.totalFaltas * 5)}%` }} 
          />
        </div>
        <p className="text-xs mt-2.5 text-slate-400 flex items-center justify-between">
          <span>Cumplimiento:</span>
          <span className="font-semibold font-mono text-emerald-400">
            {summary.tasaCumplimiento}%
          </span>
        </p>
      </div>

      {/* 3. Incidencias / Vacaciones */}
      <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 border-t-2 border-t-amber-500 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Incidencias / Vac</p>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold font-mono text-amber-400 tracking-tight">
          {summary.totalVac}
        </h2>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-amber-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, summary.totalVac * 8)}%` }} 
          />
        </div>
        <p className="text-xs mt-2.5 text-slate-400 flex items-center justify-between">
          <span>Aprobadas:</span>
          <span className="font-semibold font-mono text-emerald-400">
            {summary.totalVac} días
          </span>
        </p>
      </div>

      {/* 4. Alertas / Retardos */}
      <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 border-t-2 border-t-yellow-500 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alertas Jornada</p>
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold font-mono text-yellow-400 tracking-tight">
          {summary.totalRetardos + summary.totalRetardosExcesivos}
        </h2>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-yellow-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, (summary.totalRetardos + summary.totalRetardosExcesivos) * 10)}%` }} 
          />
        </div>
        <p className="text-xs mt-2.5 text-slate-400 flex items-center justify-between">
          <span>Retardos:</span>
          <span className="font-semibold font-mono text-yellow-400">
            {summary.totalRetardos} <span className="text-slate-500">|</span> <span className="text-rose-400">{summary.totalRetardosExcesivos} exc.</span>
          </span>
        </p>
      </div>
    </div>
  );
};
