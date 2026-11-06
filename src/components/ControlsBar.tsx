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
  onDisperseActiveList?: () => void;
  activeListSupervisorLabel?: string;
  isActiveListDispersed?: boolean;
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
  onDisperseActiveList,
  activeListSupervisorLabel,
  isActiveListDispersed = false,
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
    <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg mb-6 no-print animate-fade-up">
      {/* Fila 1: Selectores de Periodo, Modo de Lectura, Supervisor y Búsqueda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Periodo de Nómina */}
        <div>
          <label className="text-xs font-semibold text-[#87888C] block mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#FEB95A]" />
            Periodo de Nómina
          </label>
          <select
            value={selectedWeek}
            onChange={(e) => onSelectWeek(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-xs font-medium bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] transition-all"
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
          <label className="text-xs font-semibold text-[#87888C] block mb-1.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#A9DFD8]" />
            Modo de Lectura Biométrica
          </label>
          <select
            value={readingMode}
            onChange={(e) => onReadingModeChange(e.target.value as ReadingMode)}
            className="w-full rounded-xl px-3 py-2 text-xs font-medium bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] transition-all"
            title="Elige cómo emparejar las entradas y salidas cuando existen eventos RST o múltiples marcas"
          >
            <option value="checadas_reales">Por Checadas Reales (Une RST + Horario)</option>
            <option value="jerarquia_eventos">Por Eventos + Rescate RST</option>
          </select>
        </div>

        {/* Filtrar por Supervisor */}
        <div>
          <label className="text-xs font-semibold text-[#87888C] block mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#20AEF3]" />
            Filtrar por Supervisor
          </label>
          <select
            value={selectedSupervisor}
            onChange={(e) => onSelectSupervisor(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-xs font-medium bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] transition-all"
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
          <label className="text-xs font-semibold text-[#87888C] block mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#F2C8ED]" />
            Búsqueda Rápida
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ej: 00615, 00979, Óscar, Eudis..."
              className="w-full rounded-xl pl-8 pr-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] transition-all font-mono"
            />
            <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-2.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#87888C] hover:text-white bg-[#21222D] px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fila 2: Correo y Botones de Acción */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label className="text-xs font-semibold text-[#87888C] whitespace-nowrap flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#FEB95A]" />
            Correo:
          </label>
          <input
            type="email"
            value={emailDestino}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="nomina@empresa.com"
            className="w-full rounded-xl px-3 py-1.5 text-xs bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Paso 1: Botón Generar Reporte en Mint Teal (#A9DFD8) */}
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!canGenerate || isGenerating}
            title="Genera el reporte de asistencia únicamente para revisión interna de Nóminas / RH"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] shadow-md shadow-[#A9DFD8]/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isGenerating ? 'Generando...' : 'Generar Reporte'}
          </button>

          {/* Paso 2A: Dispersar directamente la Lista Generada / Seleccionada en este momento (Sin abrir pop-up) */}
          {!isSupervisor && onDisperseActiveList && (
            <button
              type="button"
              onClick={onDisperseActiveList}
              disabled={!canDisperse}
              title={
                !canDisperse
                  ? 'Primero genera el reporte para poder dispersar la lista'
                  : `Dispersar directamente en 1 clic la lista actual (${activeListSupervisorLabel || 'Lista en pantalla'}) sin abrir ventana emergente`
              }
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${
                isActiveListDispersed
                  ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40 hover:bg-[#A9DFD8]/25'
                  : 'bg-[#20AEF3] hover:bg-[#1b9bd9] text-[#171821]'
              }`}
            >
              {isActiveListDispersed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>
                    Lista Dispersada {activeListSupervisorLabel ? `(${activeListSupervisorLabel})` : ''} ✓
                  </span>
                </>
              ) : (
                <>
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>
                    Dispersar Lista {activeListSupervisorLabel ? `(${activeListSupervisorLabel})` : 'Actual'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Paso 2B: Dispersar Todas las Listas en un solo clic */}
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
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${
                isWeekDispersed && dispersedSupervisorsCount >= supervisors.length
                  ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40 hover:bg-[#A9DFD8]/25'
                  : 'bg-[#171821] hover:bg-[#2B2B36] text-[#F2C8ED] border border-[#F2C8ED]/35'
              }`}
            >
              {isWeekDispersed && dispersedSupervisorsCount >= supervisors.length ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>Todas Dispersadas ({dispersedSupervisorsCount}/{supervisors.length}) ✓</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#F2C8ED]" />
                  <span>Dispersar Todas ({dispersedSupervisorsCount}/{supervisors.length})</span>
                </>
              )}
            </button>
          )}

          {/* Botón Excel */}
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!canExport || isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#171821] hover:bg-[#2B2B36] text-[#A9DFD8] border border-[#A9DFD8]/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            title="Exportar archivo Excel por cada supervisor con formato ejecutivo"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#A9DFD8]" />
            {isExporting ? 'Exportando...' : 'Descargar Excel'}
          </button>

          {/* Botón Liberar Nómina a RH (Para Supervisores) */}
          {isSupervisor && onReleasePayroll && (
            <button
              type="button"
              onClick={onReleasePayroll}
              disabled={!canExport}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                isPayrollReleased
                  ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40'
                  : 'bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821]'
              }`}
              title={releaseTooltip || 'Revisar y liberar formalmente la nómina a Recursos Humanos'}
            >
              {isPayrollReleased ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>Liberada a RH ✓</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#171821] hover:bg-[#2B2B36] text-[#FEB95A] border border-[#FEB95A]/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            title="Abrir cliente de correo con formato y enlaces a formularios"
          >
            <Mail className="w-3.5 h-3.5 text-[#FEB95A]" />
            Correo
          </button>

          {/* Botón Imprimir */}
          <button
            type="button"
            onClick={onPrint}
            disabled={!canExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#171821] hover:bg-[#2B2B36] text-[#87888C] hover:text-white border border-white/[0.08] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};
