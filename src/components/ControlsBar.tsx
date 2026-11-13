/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
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
  ListChecks,
  Clock,
  FolderDown,
} from 'lucide-react';
import { PayrollWeekOption } from '../utils/calendarUtils';
import { OvertimeRulesConfig, ReadingMode } from '../types/attendance';
import { HeadlessSelect, SelectOption } from './ui/HeadlessSelect';

interface ControlsBarProps {
  payrollWeeks: PayrollWeekOption[];
  selectedWeek: string;
  onSelectWeek: (val: string) => void;
  selectedYear?: number;
  onSelectYear?: (year: number) => void;
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
  onExportAllExcel?: () => void;
  onSendEmail: () => void;
  onPrint: () => void;
  canGenerate: boolean;
  canDisperse?: boolean;
  isWeekDispersed?: boolean;
  canExport: boolean;
  canExportAll?: boolean;
  isGenerating: boolean;
  isExporting: boolean;
  isExportingAll?: boolean;
  isSupervisor?: boolean;
  onReleasePayroll?: () => void;
  isPayrollReleased?: boolean;
  releaseTooltip?: string;
  isDelegated?: boolean;
  overtimeRules?: OvertimeRulesConfig;
  onOpenOvertimeConfig?: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  payrollWeeks,
  selectedWeek,
  onSelectWeek,
  selectedYear = 2026,
  onSelectYear,
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
  onExportAllExcel,
  onSendEmail,
  onPrint,
  canGenerate,
  canDisperse = false,
  isWeekDispersed = false,
  canExport,
  canExportAll = false,
  isGenerating,
  isExporting,
  isExportingAll = false,
  isSupervisor,
  onReleasePayroll,
  isPayrollReleased,
  releaseTooltip,
  overtimeRules,
  onOpenOvertimeConfig,
}) => {
  const weekOptions: SelectOption[] = useMemo(() => {
    return payrollWeeks.map((w) => ({
      value: w.value,
      label: w.label,
      badge: `Sem ${w.weekNumber}`,
    }));
  }, [payrollWeeks]);

  const readingModeOptions: SelectOption[] = useMemo(
    () => [
      {
        value: 'checadas_reales',
        label: 'Por Checadas Reales',
        sublabel: 'Une RST + Horario programado',
      },
      {
        value: 'jerarquia_eventos',
        label: 'Por Eventos + Rescate RST',
        sublabel: 'Respeta marcas con rescate automático',
      },
    ],
    []
  );

  const supervisorOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: '',
        label: `Todos los supervisores (${supervisors.length})`,
        sublabel: 'Vista global consolidada',
      },
      ...supervisors.map((sup) => ({
        value: sup,
        label: sup,
      })),
    ];
  }, [supervisors]);

  return (
    <section className="rounded-xl p-4 sm:p-5 bg-[#21222D] border border-white/[0.08] mb-5 no-print animate-fade-up">
      {/* Fila 1: Selectores de Periodo, Modo de Lectura, Supervisor y Búsqueda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Periodo de Nómina + Selector Multi-Año */}
        <div className="relative">
          {onSelectYear && (
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1 font-mono tabular-nums">
              {[2025, 2026, 2027, 2028].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => onSelectYear(yr)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40'
                      : 'text-[#87888C] hover:text-white bg-[#171821] border border-white/[0.06]'
                  }`}
                  title={`Cambiar calendario fiscal a ${yr}`}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}
          <HeadlessSelect
            label="Periodo de nómina"
            icon={<CalendarDays className="w-3.5 h-3.5 text-[#FEB95A]" />}
            value={selectedWeek}
            onChange={onSelectWeek}
            options={weekOptions}
            searchable={payrollWeeks.length > 6}
          />
        </div>

        {/* Modo de Lectura (Checadas vs Eventos) */}
        <HeadlessSelect
          label="Modo de lectura biométrica"
          icon={<Cpu className="w-3.5 h-3.5 text-[#A9DFD8]" />}
          value={readingMode}
          onChange={(val) => onReadingModeChange(val as ReadingMode)}
          options={readingModeOptions}
        />

        {/* Filtrar por Supervisor */}
        <HeadlessSelect
          label="Filtrar por supervisor"
          icon={<UserCheck className="w-3.5 h-3.5 text-[#20AEF3]" />}
          value={selectedSupervisor}
          onChange={onSelectSupervisor}
          options={supervisorOptions}
          searchable={supervisors.length > 5}
        />

        {/* Búsqueda rápida */}
        <div>
          <label className="text-xs font-semibold text-[#87888C] mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#A9DFD8]" />
            Búsqueda rápida
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ID o nombre: 00615, Óscar..."
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] transition-colors font-mono tabular-nums"
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
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3.5 border-t border-white/[0.08]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label className="text-xs font-semibold text-[#87888C] whitespace-nowrap flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#87888C]" />
            Destinatario:
          </label>
          <input
            type="email"
            value={emailDestino}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="nomina@cemenquin.com"
            className="w-full rounded-lg px-3 py-1.5 text-xs bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] transition-colors font-mono"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Paso 1: Botón Primario Generar Reporte */}
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!canGenerate || isGenerating}
            title="Genera el reporte de asistencia únicamente para revisión interna de Nóminas / RH"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isGenerating ? 'Calculando...' : 'Generar reporte'}
          </button>

          {/* Botón para abrir Configuración de Tiempo Extra directamente desde Nómina */}
          {onOpenOvertimeConfig && (
            <button
              type="button"
              onClick={onOpenOvertimeConfig}
              title="Configurar a partir de cuántos minutos cuenta el Tiempo Extra y bloquear llegadas anticipadas"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#171821] hover:bg-[#2B2B36] text-[#FEB95A] border border-[#FEB95A]/35 transition-colors cursor-pointer whitespace-nowrap font-mono tabular-nums"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                Regla TE{' '}
                {overtimeRules
                  ? `(≥${overtimeRules.minutosMinimosParaExtra}m${
                      overtimeRules.ignorarEntradaAnticipada ? ' · s/ant.' : ''
                    })`
                  : ''}
              </span>
            </button>
          )}

          {!isSupervisor && onDisperseActiveList && (
            <button
              type="button"
              onClick={onDisperseActiveList}
              disabled={!canDisperse}
              title={
                !canDisperse
                  ? 'Primero genera el reporte para poder dispersar la lista'
                  : `Dispersar directamente en 1 clic la lista actual (${activeListSupervisorLabel || 'Lista en pantalla'})`
              }
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${
                isActiveListDispersed
                  ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40 hover:bg-[#A9DFD8]/25'
                  : 'bg-[#20AEF3] hover:bg-[#1b9bd9] text-[#171821]'
              }`}
            >
              {isActiveListDispersed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>
                    Dispersada {activeListSupervisorLabel ? `(${activeListSupervisorLabel})` : ''} ✓
                  </span>
                </>
              ) : (
                <>
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>
                    Dispersar {activeListSupervisorLabel ? `(${activeListSupervisorLabel})` : 'lista actual'}
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
                  : 'Dispersar todas las listas de nómina en un solo botón y enviar notificación a todos los supervisores'
              }
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${
                isWeekDispersed && dispersedSupervisorsCount >= supervisors.length
                  ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/40 hover:bg-[#A9DFD8]/25'
                  : 'bg-[#171821] hover:bg-[#2B2B36] text-white border border-white/[0.08]'
              }`}
            >
              {isWeekDispersed && dispersedSupervisorsCount >= supervisors.length ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span className="font-mono tabular-nums">
                    Todas dispersadas ({dispersedSupervisorsCount}/{supervisors.length}) ✓
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>
                    Dispersar todas{' '}
                    <span className="font-mono tabular-nums">
                      ({dispersedSupervisorsCount}/{supervisors.length})
                    </span>
                  </span>
                </>
              )}
            </button>
          )}

          {/* Botón Excel 1 (Individual / Lista Actual) */}
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!canExport || isExporting || isExportingAll}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#171821] hover:bg-[#2B2B36] text-[#A9DFD8] border border-[#A9DFD8]/35 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            title={
              !canExport
                ? 'Primero genera el reporte de asistencia para descargar la lista en Excel'
                : 'Descargar archivo Excel de la lista actual o supervisor seleccionado'
            }
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#A9DFD8]" />
            <span>{isExporting ? 'Exportando...' : 'Excel actual'}</span>
          </button>

          {/* Botón Excel 2 (Descargar Todas las Listas de Golpe) */}
          {onExportAllExcel && (
            <button
              type="button"
              onClick={onExportAllExcel}
              disabled={!canExportAll || isExporting || isExportingAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#171821] hover:bg-[#2B2B36] text-[#20AEF3] border border-[#20AEF3]/35 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              title={
                !canExportAll
                  ? 'Disponible únicamente después de haber generado las listas con el botón "Generar reporte"'
                  : `Descargar de golpe todas las listas individuales en archivos Excel separados (${supervisors.length} supervisores)`
              }
            >
              <FolderDown className="w-3.5 h-3.5 text-[#20AEF3]" />
              <span>
                {isExportingAll ? (
                  'Descargando...'
                ) : (
                  <>
                    Excel lote <span className="font-mono tabular-nums">({supervisors.length})</span>
                  </>
                )}
              </span>
            </button>
          )}

          {/* Botón Liberar Nómina a RH (Para Supervisores) */}
          {isSupervisor && onReleasePayroll && (
            <button
              type="button"
              onClick={onReleasePayroll}
              disabled={!canExport}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
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

          {/* Botón Enviar por Correo */}
          <button
            type="button"
            onClick={onSendEmail}
            disabled={!canExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#171821] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            title={
              !canExport
                ? 'Primero genera el reporte para poder enviarlo por correo'
                : 'Abrir ventana para configurar el mensaje y enviar la nómina por correo'
            }
          >
            <Mail className="w-3.5 h-3.5 text-[#FEB95A]" />
            <span>Correo</span>
          </button>

          {/* Botón Imprimir */}
          <button
            type="button"
            onClick={onPrint}
            disabled={!canExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#171821] hover:bg-[#2B2B36] text-[#87888C] hover:text-white border border-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>
    </section>
  );
};
