/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Send,
  FolderClock,
  PlusCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Users,
  Eye,
  Ban,
  FileSpreadsheet,
  Search,
  Sparkles,
  ChevronRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { PayrollDispersal, PayrollRelease } from '../../types/portal';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';
import { HeadlessModal } from '../ui/HeadlessModal';

export type DispersionWorkspaceMode = 'prompt' | 'new' | 'existing';

interface DispersionModeSelectorProps {
  mode: DispersionWorkspaceMode;
  onSelectMode: (mode: DispersionWorkspaceMode) => void;
  dispersals: PayrollDispersal[];
  releases: Record<string, PayrollRelease>;
  currentWeekNumber: number;
  currentWeekPeriod: string;
  reportesCount: number;
  hasEmployees: boolean;
  hasEvents: boolean;
  onOpenDispersedPayroll: (dispersal: PayrollDispersal) => void;
  onStartNewPayroll: (clearCurrentReport?: boolean) => void;
  onNavigateToSemaforo: (dispersal?: PayrollDispersal) => void;
  onToggleClosePayroll?: (dispersal: PayrollDispersal, shouldClose: boolean) => void;
  onCancelAndDeletePayroll?: (options?: {
    semanaNumero?: number;
    semanaPeriodo?: string;
    motivo?: string;
  }) => void;
}

export const DispersionModeSelector: React.FC<DispersionModeSelectorProps> = ({
  mode,
  onSelectMode,
  dispersals,
  releases,
  currentWeekNumber,
  currentWeekPeriod,
  reportesCount,
  hasEmployees,
  hasEvents,
  onOpenDispersedPayroll,
  onStartNewPayroll,
  onNavigateToSemaforo,
  onToggleClosePayroll,
  onCancelAndDeletePayroll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'cancelled'>('all');
  const [cancelModalTarget, setCancelModalTarget] = useState<{
    semanaNumero: number;
    semanaPeriodo: string;
    label: string;
  } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  const sortedDispersals = [...dispersals].sort((a, b) => {
    const timeA = new Date(a.fechaDispersion).getTime() || 0;
    const timeB = new Date(b.fechaDispersion).getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.semanaNumero - a.semanaNumero;
  });

  const filteredDispersals = sortedDispersals.filter((d) => {
    if (statusFilter === 'active' && (d.cancelada || d.cerrada)) return false;
    if (statusFilter === 'closed' && (!d.cerrada || d.cancelada)) return false;
    if (statusFilter === 'cancelled' && !d.cancelada) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(d.semanaNumero).includes(q) ||
      d.semanaPeriodo.toLowerCase().includes(q) ||
      d.dispersadoPor.toLowerCase().includes(q) ||
      d.supervisoresNotificados.some((s) => s.toLowerCase().includes(q))
    );
  });

  const activeDispersalObj = dispersals.find((d) => d.semanaNumero === currentWeekNumber);

  const openCancelConfirm = (semanaNum: number, semanaPer: string, label: string) => {
    setCancelMotivo('');
    setCancelModalTarget({
      semanaNumero: semanaNum,
      semanaPeriodo: semanaPer,
      label,
    });
  };

  const handleConfirmCancelPayroll = () => {
    if (!cancelModalTarget) return;
    if (onCancelAndDeletePayroll) {
      onCancelAndDeletePayroll({
        semanaNumero: cancelModalTarget.semanaNumero,
        semanaPeriodo: cancelModalTarget.semanaPeriodo,
        motivo: cancelMotivo.trim() || undefined,
      });
    } else {
      onStartNewPayroll(true);
    }
    setCancelModalTarget(null);
    setCancelMotivo('');
  };

  const renderCancelConfirmModal = () => {
    if (!cancelModalTarget) return null;
    return (
      <HeadlessModal
        isOpen={Boolean(cancelModalTarget)}
        onClose={() => setCancelModalTarget(null)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <Ban className="w-5 h-5 shrink-0" />
            <span className="font-bold text-base text-slate-900 dark:text-white">
              Cancelar, Cerrar y Borrar Nómina
            </span>
          </div>
        }
        subtitle={`Semana ${cancelModalTarget.semanaNumero} (${(
          cancelModalTarget.semanaPeriodo || ''
        ).replace('|', ' al ')})`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            ¿Confirmas que deseas <strong>cancelar y cerrar</strong>{' '}
            <strong>{cancelModalTarget.label}</strong>? Se cerrará esta nómina y se borrará toda la
            información ya obtenida (cálculo de asistencia en pantalla, dispersión, liberaciones y
            eventos cargados de esa semana) para que puedas empezar en limpio.
          </p>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              Motivo de la Cancelación (Opcional):
            </label>
            <textarea
              rows={2}
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Ej: Se cerrará esta nómina para cargar un nuevo archivo o periodo..."
              className="w-full text-xs rounded-xl p-3 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setCancelModalTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelPayroll}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              <span>Cancelar y Borrar Nómina</span>
            </button>
          </div>
        </div>
      </HeadlessModal>
    );
  };

  // ============================================================================
  // BARRA PERSISTENTE SUPERIOR CUANDO EL USUARIO YA ESTÁ TRABAJANDO EN EL MÓDULO
  // ============================================================================
  if (mode !== 'prompt') {
    const isWorkingExisting = mode === 'existing' || Boolean(activeDispersalObj);
    const cleanPeriodo = (currentWeekPeriod || '').replace('|', ' al ');

    return (
      <>
        <div className="mb-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] px-4 sm:px-5 py-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectMode('prompt')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-white dark:text-[#A9DFD8] border border-slate-900 dark:border-[#A9DFD8]/35 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Regresar a Selección / Consultar Dispersadas ({dispersals.length})</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block" />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {mode === 'existing'
                    ? `Trabajando Nómina ya Dispersada — Semana ${currentWeekNumber}`
                    : `Preparando / Dispersando Nueva Nómina — Semana ${currentWeekNumber}`}
                </span>
                {cleanPeriodo && (
                  <span className="text-xs font-mono text-slate-500 dark:text-[#87888C]">
                    · {cleanPeriodo}
                  </span>
                )}
                {activeDispersalObj && !activeDispersalObj.cancelada && (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                        activeDispersalObj.cerrada
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/35'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                      }`}
                    >
                      {activeDispersalObj.cerrada ? '🔒 Cerrada (Oculta a supervisores)' : '● Abierta'}
                    </span>
                    <span className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8]">
                      · {activeDispersalObj.supervisoresNotificados.length} listas dispersadas
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {sortedDispersals.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#87888C]">
                  Cambiar a dispersada:
                </span>
                <select
                  value={
                    activeDispersalObj ? String(activeDispersalObj.semanaNumero) : ''
                  }
                  onChange={(e) => {
                    const weekNum = Number(e.target.value);
                    const found = dispersals.find((d) => d.semanaNumero === weekNum);
                    if (found) {
                      onOpenDispersedPayroll(found);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-xs font-mono font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Elegir semana dispersada...
                  </option>
                  {sortedDispersals.map((d) => (
                    <option key={d.id} value={String(d.semanaNumero)}>
                      Sem {d.semanaNumero} · {d.cancelada ? 'Cancelada' : d.cerrada ? 'Cerrada' : 'Abierta'} ({d.semanaPeriodo.replace('|', ' a ')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onStartNewPayroll(true)}
              className="px-3 py-1.5 rounded-xl border border-teal-500/35 bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-[#A9DFD8] text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Limpiar vista actual y preparar una dispersión de nómina completamente nueva"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nueva Dispersión</span>
            </button>

            {activeDispersalObj && !activeDispersalObj.cancelada && onToggleClosePayroll && (
              <button
                type="button"
                onClick={() =>
                  onToggleClosePayroll(activeDispersalObj, !activeDispersalObj.cerrada)
                }
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeDispersalObj.cerrada
                    ? 'border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300'
                }`}
                title={
                  activeDispersalObj.cerrada
                    ? 'Volver a abrir esta nómina para que aparezca a los supervisores'
                    : 'Cerrar esta nómina para que desaparezca de la vista de supervisores (se mantiene en historial)'
                }
              >
                {activeDispersalObj.cerrada ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Reabrir Nómina</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Cerrar Nómina</span>
                  </>
                )}
              </button>
            )}

            {isWorkingExisting && (
              <button
                type="button"
                onClick={() => onNavigateToSemaforo(activeDispersalObj)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 hover:bg-slate-100 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-sky-700 dark:text-[#20AEF3] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver Semáforo</span>
              </button>
            )}

            {(reportesCount > 0 || Boolean(activeDispersalObj) || hasEvents) && (
              <button
                type="button"
                onClick={() =>
                  openCancelConfirm(
                    currentWeekNumber,
                    currentWeekPeriod,
                    `la Nómina de la Semana ${currentWeekNumber}`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/35 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Cancelar y cerrar esta nómina borrando la información ya obtenida"
              >
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span>Cancelar Nómina</span>
              </button>
            )}
          </div>
        </div>
        {renderCancelConfirmModal()}
      </>
    );
  }

  // ============================================================================
  // PANTALLA DE SELECCIÓN AL ENTRAR AL MÓDULO DE DISPERSIÓN DE NÓMINA
  // ============================================================================
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Encabezado de Bienvenida al Módulo de Dispersión */}
      <div className="rounded-2xl bg-gradient-to-br from-[#21222D] via-[#1B1C26] to-[#171821] border border-white/[0.08] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#A9DFD8]/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 max-w-3xl relative z-10">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shadow-lg bg-[#0B193D] shrink-0">
            <img
              src="/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg"
              alt="Cemenquin"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-[#A9DFD8] uppercase tracking-wider">
              CemenQtime · Módulo de Dispersión y Cálculo de Nómina
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
              ¿Qué deseas realizar en este momento?
            </h2>
            <p className="text-xs sm:text-sm text-[#87888C] mt-1">
              Elige si deseas preparar y dispersar una nueva nómina semanal, o bien abrir y trabajar una nómina que ya fue dispersada previamente. En cualquier momento podrás regresar a esta pantalla.
            </p>
          </div>
        </div>

        {/* Dos Tarjetas de Decisión Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 relative z-10">
          {/* Opción 1: Dispersar una Nueva Nómina */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#171821] p-5 flex flex-col justify-between gap-5 hover:border-[#A9DFD8]/40 transition-colors">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  1. Dispersar una Nueva Nómina
                </h3>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Carga o actualiza el archivo de eventos del reloj checador, selecciona el periodo semanal, genera el cálculo de asistencia y dispersa las listas a los supervisores.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-3 text-xs text-slate-300 font-mono tabular-nums">
                <span>
                  Catálogo:{' '}
                  <strong className="text-white">
                    {hasEmployees ? 'Cargado ✓' : 'Pendiente'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Checadas:{' '}
                  <strong className="text-white">
                    {hasEvents ? 'Cargadas ✓' : 'Pendientes'}
                  </strong>
                </span>
                {reportesCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      En pantalla: <strong className="text-teal-600 dark:text-[#A9DFD8]">{reportesCount} emp.</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onStartNewPayroll(true)}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Abrir Nueva Dispersión (En Blanco)</span>
              </button>

              {reportesCount > 0 && (
                <button
                  type="button"
                  onClick={() => onStartNewPayroll(false)}
                  className="px-3.5 py-2.5 rounded-xl border border-teal-500/40 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Continuar en Pantalla (Sem {currentWeekNumber})</span>
                </button>
              )}

              {(reportesCount > 0 || hasEvents) && (
                <button
                  type="button"
                  onClick={() =>
                    openCancelConfirm(
                      currentWeekNumber,
                      currentWeekPeriod,
                      `la Nómina en Pantalla (Semana ${currentWeekNumber})`
                    )
                  }
                  className="px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Cancelar y cerrar esta nómina borrando la información ya obtenida"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cancelar Nómina</span>
                </button>
              )}
            </div>
          </div>

          {/* Opción 2: Trabajar o Consultar una Nómina ya Dispersada */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#171821] p-5 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-sky-500/15 dark:bg-[#20AEF3]/15 border border-sky-500/30 dark:border-[#20AEF3]/30 flex items-center justify-center text-sky-700 dark:text-[#20AEF3]">
                <FolderClock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  2. Consultar o Trabajar una Nómina ya Dispersada
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#87888C] mt-1 leading-relaxed">
                  Abre una nómina del historial para revisar sus registros, auditar modificaciones, cerrarla para ocultarla a supervisores o reabrirla.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums flex-wrap">
                <span>
                  Total:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {dispersals.length}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Abiertas:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-300">
                    {dispersals.filter((d) => !d.cancelada && !d.cerrada).length}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Cerradas:{' '}
                  <strong className="text-amber-600 dark:text-amber-300">
                    {dispersals.filter((d) => !d.cancelada && d.cerrada).length}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {sortedDispersals.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenDispersedPayroll(sortedDispersals[0])}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-[#20AEF3] dark:hover:bg-[#1b9bd9] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FolderClock className="w-3.5 h-3.5" />
                    <span>
                      Abrir Última Dispersada (Semana {sortedDispersals[0].semanaNumero})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToSemaforo(sortedDispersals[0])}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white hover:bg-slate-100 dark:bg-[#21222D] dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Ir al Semáforo de Liberación
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-500 dark:text-[#87888C] py-2">
                  Aún no hay nóminas dispersadas en el historial. Dispersa tu primera nómina con la opción de la izquierda.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historial Completo de Nóminas ya Dispersadas para Consultar o Trabajar */}
      <div className="rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Historial de Nóminas Dispersadas ({filteredDispersals.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#87888C] mt-0.5">
              Cierra cualquier nómina (ej. Semana 46) para que desaparezca de la vista de supervisores sin perder su historial, o ábrela para consultarla.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#171821]">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Abiertas' },
                { id: 'closed', label: 'Cerradas' },
                { id: 'cancelled', label: 'Canceladas' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatusFilter(t.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === t.id
                      ? 'bg-white dark:bg-[#21222D] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar semana o supervisor..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-white outline-none"
              />
            </div>
          </div>
        </div>

        {filteredDispersals.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {dispersals.length === 0
                ? 'Todavía no se ha dispersado ninguna nómina'
                : 'No se encontraron nóminas dispersadas con ese filtro'}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#87888C] max-w-md mx-auto">
              Cuando disperses una nómina semanal a los supervisores, quedará guardada aquí con su respaldo para que puedas consultarla, cerrarla o trabajarla en cualquier momento.
            </p>
            <button
              type="button"
              onClick={() => onStartNewPayroll(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Abrir Nueva Dispersión</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
            {filteredDispersals.map((disp) => {
              const totalNotified = disp.supervisoresNotificados.length;
              const releasedForWeek = disp.supervisoresNotificados.filter((sup) => {
                const key = `${disp.semanaNumero}_${sup.trim().toUpperCase()}`;
                return releases[key]?.status === 'liberado';
              }).length;
              const allReleased = totalNotified > 0 && releasedForWeek >= totalNotified;
              const cleanPer = disp.semanaPeriodo.replace('|', ' al ');
              const empCount =
                disp.empleadosCount ??
                (Array.isArray(disp.reportesSnapshot) ? disp.reportesSnapshot.length : undefined);

              return (
                <div
                  key={disp.id}
                  className="p-5 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                        Semana {disp.semanaNumero}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-[#87888C]">
                        · {cleanPer}
                      </span>

                      {disp.cancelada ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/35">
                          Cancelada
                        </span>
                      ) : disp.cerrada ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Cerrada (Oculta a supervisores)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35">
                          ● Abierta
                        </span>
                      )}

                      {!disp.cancelada && !disp.cerrada && (
                        allReleased ? (
                          <span className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8]">
                            · 100% Liberada
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-sky-600 dark:text-[#20AEF3]">
                            · {releasedForWeek}/{totalNotified} liberadas
                          </span>
                        )
                      )}

                      {!disp.cancelada && !disp.cerrada && disp.limiteLiberacion && (
                        <DispersalCountdownTimer
                          limiteLiberacion={disp.limiteLiberacion}
                          isReleased={allReleased}
                          isCancelled={disp.cancelada}
                          compact
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#87888C] flex-wrap font-mono tabular-nums">
                      <span>
                        Dispersada por: <strong className="text-slate-700 dark:text-slate-200">{disp.dispersadoPor}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Fecha:{' '}
                        {new Date(disp.fechaDispersion).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {empCount !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Colaboradores: <strong className="text-slate-800 dark:text-white">{empCount}</strong>
                          </span>
                        </>
                      )}
                      {disp.totalHorasNormales !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            H. Normales:{' '}
                            <strong className="text-slate-800 dark:text-white">
                              {disp.totalHorasNormales.toFixed(1)}h
                            </strong>
                          </span>
                        </>
                      )}
                      {disp.totalHorasExtras !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            H. Extra:{' '}
                            <strong className="text-amber-600 dark:text-[#FEB95A]">
                              {disp.totalHorasExtras.toFixed(1)}h
                            </strong>
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-[#87888C] truncate max-w-3xl">
                      Listas notificadas ({totalNotified}):{' '}
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {disp.supervisoresNotificados.join(' · ')}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0 self-end lg:self-center">
                    {!disp.cancelada && onToggleClosePayroll && (
                      <button
                        type="button"
                        onClick={() => onToggleClosePayroll(disp, !disp.cerrada)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          disp.cerrada
                            ? 'border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                            : 'border-amber-300 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-300'
                        }`}
                        title={
                          disp.cerrada
                            ? 'Reabrir nómina para que vuelva a aparecer con los supervisores'
                            : 'Cerrar nómina para que desaparezca con los supervisores (se guarda en historial)'
                        }
                      >
                        {disp.cerrada ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Reabrir</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Cerrar Nómina</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        openCancelConfirm(
                          disp.semanaNumero,
                          disp.semanaPeriodo,
                          `la Nómina de la Semana ${disp.semanaNumero}`
                        )
                      }
                      className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Cancelar y borrar esta nómina y sus cálculos"
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-500" />
                      <span>Cancelar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateToSemaforo(disp)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white hover:bg-slate-100 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-500 dark:text-[#20AEF3]" />
                      <span>Ver Semáforo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenDispersedPayroll(disp)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Abrir y Trabajar Nómina</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {renderCancelConfirmModal()}
    </div>
  );
};
