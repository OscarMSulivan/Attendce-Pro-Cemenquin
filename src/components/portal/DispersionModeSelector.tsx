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
} from 'lucide-react';
import { PayrollDispersal, PayrollRelease } from '../../types/portal';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');

  const sortedDispersals = [...dispersals].sort((a, b) => {
    const timeA = new Date(a.fechaDispersion).getTime() || 0;
    const timeB = new Date(b.fechaDispersion).getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.semanaNumero - a.semanaNumero;
  });

  const filteredDispersals = sortedDispersals.filter((d) => {
    if (statusFilter === 'active' && d.cancelada) return false;
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

  // ============================================================================
  // BARRA PERSISTENTE SUPERIOR CUANDO EL USUARIO YA ESTÁ TRABAJANDO EN EL MÓDULO
  // ============================================================================
  if (mode !== 'prompt') {
    const isWorkingExisting = mode === 'existing' || Boolean(activeDispersalObj);
    const cleanPeriodo = (currentWeekPeriod || '').replace('|', ' al ');

    return (
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
                <span className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8]">
                  · {activeDispersalObj.supervisoresNotificados.length} listas dispersadas
                </span>
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
                    Semana {d.semanaNumero} ({d.semanaPeriodo.replace('|', ' a ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'existing' && (
            <button
              type="button"
              onClick={() => onStartNewPayroll(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 hover:bg-slate-100 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" />
              <span>Dispersar Otra Nómina</span>
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
        </div>
      </div>
    );
  }

  // ============================================================================
  // PANTALLA DE SELECCIÓN AL ENTRAR AL MÓDULO DE DISPERSIÓN DE NÓMINA
  // ============================================================================
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Encabezado de Bienvenida al Módulo de Dispersión */}
      <div className="rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8] uppercase tracking-wider">
            Módulo de Dispersión y Cálculo de Nómina
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            ¿Qué deseas realizar en este momento?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#87888C] mt-1">
            Elige si deseas preparar y dispersar una nueva nómina semanal, o bien abrir y trabajar una nómina que ya fue dispersada previamente. En cualquier momento podrás regresar a esta pantalla.
          </p>
        </div>

        {/* Dos Tarjetas de Decisión Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* Opción 1: Dispersar una Nueva Nómina */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#171821] p-5 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/30 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  1. Dispersar una Nueva Nómina
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#87888C] mt-1 leading-relaxed">
                  Carga o actualiza el archivo de eventos del reloj checador, selecciona el periodo semanal, genera el cálculo de asistencia y dispersa las listas a los supervisores.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                <span>
                  Catálogo:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {hasEmployees ? 'Cargado ✓' : 'Pendiente'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Checadas:{' '}
                  <strong className="text-slate-900 dark:text-white">
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
                onClick={() => onStartNewPayroll(false)}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {reportesCount > 0
                    ? `Continuar / Dispersar Nómina en Pantalla (Sem ${currentWeekNumber})`
                    : 'Preparar y Dispersar Nueva Nómina'}
                </span>
              </button>

              {reportesCount > 0 && (
                <button
                  type="button"
                  onClick={() => onStartNewPayroll(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white hover:bg-slate-100 dark:bg-[#21222D] dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Limpiar y Empezar Desde Cero
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
                  Abre una nómina que ya fue dispersada para revisar sus registros, auditar las modificaciones de los supervisores, agregar listas faltantes o consultar su estatus de liberación.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                <span>
                  Nóminas dispersadas:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {dispersals.length}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Activas:{' '}
                  <strong className="text-sky-600 dark:text-[#20AEF3]">
                    {dispersals.filter((d) => !d.cancelada).length}
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
              Selecciona cualquier nómina dispersada para abrir su tabla de asistencia, trabajar sus registros o consultar qué supervisores ya liberaron.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#171821]">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Activas' },
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
              Cuando disperses una nómina semanal a los supervisores, quedará guardada aquí con su respaldo para que puedas consultarla o trabajarla en cualquier momento.
            </p>
            <button
              type="button"
              onClick={() => onStartNewPayroll(false)}
              className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Ir a Dispersar una Nueva Nómina</span>
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
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          · Dispersión Cancelada
                        </span>
                      ) : allReleased ? (
                        <span className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8]">
                          · 100% Liberada por Supervisores
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-sky-600 dark:text-[#20AEF3]">
                          · En Revisión ({releasedForWeek}/{totalNotified} liberadas)
                        </span>
                      )}

                      {!disp.cancelada && disp.limiteLiberacion && (
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

                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
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
    </div>
  );
};
