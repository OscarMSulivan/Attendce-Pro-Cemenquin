/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Play, 
  FileSpreadsheet, 
  Mail, 
  Printer, 
  Search, 
  UserCheck, 
  CalendarDays,
  Cpu,
  Send,
  CheckCircle2,
  ListChecks
} from 'lucide-react';
import { PayrollWeekOption } from '../utils/calendarUtils';
import { ReadingMode } from '../types/attendance';

interface ControlsBarProps {
  payrollWeeks: PayrollWeekOption[];
  selectedWeek: string;
  onSelectWeek: (val: string) => void;
  supervisors: string[];
  selectedSupervisor: string;
  onSelectSupervisor: (val: string) => void;
  readingMode: ReadingMode;
  onReadingModeChange: (mode: ReadingMode) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  emailDestino: string;
  onEmailChange: (val: string) => void;
  onGenerateReport: () => void;
  onDisperseAllPayroll?: () => void;
  onOpenDisperseByList?: () => void;
  dispersedSupervisorsCount?: number;
  onExportExcel: () => void;
  onSendEmail: () => void;
  onPrint: () => void;
  canGenerate: boolean;
  canDisperse?: boolean;
  isWeekDispersed?: boolean;
  canExport: boolean;
  isGenerating: boolean;
  isExporting: boolean;
  isSupervisor?: boolean;
  onReleasePayroll?: () => void;
  isPayrollReleased?: boolean;
  releaseTooltip?: string;
  isDelegated?: boolean;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  payrollWeeks,
  selectedWeek,
  onSelectWeek,
  supervisors,
  selectedSupervisor,
  onSelectSupervisor,
  readingMode,
  onReadingModeChange,
  searchQuery,
  onSearchChange,
  emailDestino,
  onEmailChange,
  onGenerateReport,
  onDisperseAllPayroll,
  onOpenDisperseByList,
  dispersedSupervisorsCount = 0,
  onExportExcel,
  onSendEmail,
  onPrint,
  canGenerate,
  canDisperse = false,
  isWeekDispersed = false,
  canExport,
  isGenerating,
  isExporting,
  isSupervisor,
  onReleasePayroll,
  isPayrollReleased,
  releaseTooltip,
}) => {
  return (
    <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 shadow-md mb-6 no-print animate-fade-up">
      {/* Fila 1: Selectores de Periodo, Modo de Lectura, Supervisor y Búsqueda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Periodo de Nómina */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
            Periodo de Nómina
          </label>
          <select
            value={selectedWeek}
            onChange={(e) => onSelectWeek(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/60 transition-all"
          >
            {payrollWeeks.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        {/* Modo de Lectura (Checadas vs Eventos) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            Modo de Lectura Biométrica
          </label>
          <select
            value={readingMode}
            onChange={(e) => onReadingModeChange(e.target.value as ReadingMode)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium bg-slate-950 border border-emerald-500/30 text-slate-200 outline-none focus:border-emerald-500 transition-all"
            title="Elige cómo emparejar las entradas y salidas cuando existen eventos RST o múltiples marcas"
          >
            <option value="checadas_reales">Por Checadas Reales (Une RST + Horario)</option>
            <option value="jerarquia_eventos">Por Eventos + Rescate RST</option>
          </select>
        </div>

        {/* Filtrar por Supervisor */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            Filtrar por Supervisor
          </label>
          <select
            value={selectedSupervisor}
            onChange={(e) => onSelectSupervisor(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/60 transition-all"
          >
            <option value="">Todos los supervisores ({supervisors.length})</option>
            {supervisors.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </div>

        {/* Búsqueda rápida */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-amber-400" />
            Búsqueda Rápida
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ej: 00615, 00979, Óscar, Eudis..."
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 px-1 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fila 2: Correo y Botones de Acción */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap flex items-center gap-1">
            <Mail className="w-3 h-3 text-amber-400" />
            Correo:
          </label>
          <input
            type="email"
            value={emailDestino}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="nomina@empresa.com"
            className="w-full rounded-lg px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/60 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Paso 1: Botón Generar Reporte (Exclusivo para Nóminas / RH) */}
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!canGenerate || isGenerating}
            title="Genera el reporte de asistencia únicamente para revisión interna de Nóminas / RH"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isGenerating ? 'Generando...' : 'Generar Reporte'}
          </button>

          {/* Paso 2A: Opción 1 — Botón Dispersar Lista por Lista (Notifica en sistema y correo empresarial) */}
          {!isSupervisor && onOpenDisperseByList && (
            <button
              type="button"
              onClick={onOpenDisperseByList}
              disabled={!canDisperse}
              title={
                !canDisperse
                  ? 'Primero genera el reporte para poder dispersar lista por lista'
                  : 'Abrir panel para dispersar lista por lista individualmente y enviar notificación en sistema + correo empresarial'
              }
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dispersar por Lista ({dispersedSupervisorsCount}/{supervisors.length})</span>
            </button>
          )}

          {/* Paso 2B: Opción 2 — Botón Dispersar Todas las Listas en un solo clic */}
          {!isSupervisor && onDisperseAllPayroll && (
            <button
              type="button"
              onClick={onDisperseAllPayroll}
              disabled={!canDisperse}
              title={
                !canDisperse
                  ? 'Primero genera el reporte de nómina para poder dispersar todas las listas'
                  : 'Dispersar todas las listas de nómina en un solo botón y enviar notificación en sistema y por correo empresarial a todos los supervisores'
              }
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md ${
                isWeekDispersed && dispersedSupervisorsCount >= supervisors.length
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/25 ring-1 ring-white/15'
              }`}
            >
              {isWeekDispersed && dispersedSupervisorsCount >= supervisors.length ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Todas Dispersadas ✓</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispersar Todas</span>
                </>
              )}
            </button>
          )}

          {/* Botón Excel */}
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!canExport || isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Exportar archivo Excel por cada supervisor con formato ejecutivo"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {isExporting ? 'Exportando...' : 'Descargar Excel'}
          </button>

          {/* Botón Liberar Nómina a RH (Para Supervisores) */}
          {isSupervisor && onReleasePayroll && (
            <button
              type="button"
              onClick={onReleasePayroll}
              disabled={!canExport}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md ${
                isPayrollReleased
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30 ring-1 ring-white/20'
              }`}
              title={releaseTooltip || 'Revisar y liberar formalmente la nómina a Recursos Humanos'}
            >
              {isPayrollReleased ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Liberada a RH ✓</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-blue-200" />
                  <span>Liberar a RH</span>
                </>
              )}
            </button>
          )}

          {/* Botón Correo */}
          <button
            type="button"
            onClick={onSendEmail}
            disabled={!canExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Abrir cliente de correo con formato y enlaces a formularios"
          >
            <Mail className="w-3.5 h-3.5" />
            Correo
          </button>

          {/* Botón Imprimir */}
          <button
            type="button"
            onClick={onPrint}
            disabled={!canExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};
