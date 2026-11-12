/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  FileText,
  FileSpreadsheet,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Upload,
  FileCheck,
  Send,
  Zap,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  PortalUser,
  PayrollDispersal,
  userHasModuleAccess,
  getUserAllowedModules,
} from '../../types/portal';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';

const CEMENQUIN_LOGO_URL =
  '/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg';

interface WelcomeDashboardProps {
  currentUser: PortalUser;
  selectedWeek: string;
  currentWeekNumber: number;
  reportesCount: number;
  hasEmployees: boolean;
  hasEvents: boolean;
  onNavigateTab: (tab: string) => void;
  // Métricas del supervisor o RH
  pendingIncidentsCount: number;
  pendingReleasesCount: number;
  isPayrollReleased?: boolean;
  supervisorPendingOvertimeCount?: number;
  supervisorPendingMissingPunchCount?: number;
  supervisorBlockingNoFormatCount?: number;
  supervisorTotalPendingTasks?: number;
  assignedSupervisorList?: string;
  onOpenSchedules?: () => void;
  onOpenAssign?: () => void;
  activeDispersal?: PayrollDispersal;
  horasLimiteLiberacion?: number;
}

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  currentUser,
  selectedWeek,
  currentWeekNumber,
  reportesCount,
  hasEmployees,
  hasEvents,
  onNavigateTab,
  pendingIncidentsCount,
  pendingReleasesCount,
  isPayrollReleased = false,
  supervisorPendingOvertimeCount = 0,
  supervisorPendingMissingPunchCount = 0,
  supervisorBlockingNoFormatCount = 0,
  supervisorTotalPendingTasks = 0,
  assignedSupervisorList,
  activeDispersal,
  horasLimiteLiberacion = 24,
}) => {
  const isSupervisor = currentUser.role === 'supervisor';
  const isRH = currentUser.role === 'rh';

  getUserAllowedModules(currentUser);

  const effectiveHorasLimite = activeDispersal?.horasLimite ?? horasLimiteLiberacion;
  const effectiveLimiteLiberacion = React.useMemo(() => {
    if (!activeDispersal) return undefined;
    if (activeDispersal.limiteLiberacion) return activeDispersal.limiteLiberacion;
    if (activeDispersal.fechaDispersion && effectiveHorasLimite > 0) {
      const dispTime = new Date(activeDispersal.fechaDispersion).getTime();
      if (!isNaN(dispTime)) {
        return new Date(dispTime + effectiveHorasLimite * 3600000).toISOString();
      }
    }
    return undefined;
  }, [activeDispersal, effectiveHorasLimite]);

  const isCancelledForUser = Boolean(
    activeDispersal &&
      (activeDispersal.cancelada ||
        (isSupervisor &&
          assignedSupervisorList &&
          activeDispersal.supervisoresCancelados?.some(
            (s) => s.trim().toUpperCase() === assignedSupervisorList.trim().toUpperCase()
          )))
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* 1. HERO BANNER DE BIENVENIDA — FREE DARK ADMIN DASHBOARD + CEMENQUIN */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#21222D] via-[#1B1C26] to-[#171821] border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.45)] relative overflow-hidden">
        {/* Glows atmosféricos */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#A9DFD8]/12 blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#20AEF3]/12 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 max-w-3xl">
            {/* Logo corporativo Cemenquin */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#0B193D] shrink-0">
              <img
                src={CEMENQUIN_LOGO_URL}
                alt="Cemenquin"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-lg bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  CemenQtime · Módulo de Recursos Humanos
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#171821] border border-white/[0.07] text-xs text-[#87888C] font-mono font-semibold">
                  Semana {currentWeekNumber} ({selectedWeek.replace('|', ' al ')})
                </span>
                {activeDispersal && (
                  <DispersalCountdownTimer
                    limiteLiberacion={effectiveLimiteLiberacion}
                    isReleased={isSupervisor ? isPayrollReleased : false}
                    isCancelled={isCancelledForUser}
                  />
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Hola, <span className="text-[#A9DFD8]">{currentUser.name}</span>
              </h1>

              <p className="text-xs sm:text-sm text-[#87888C] leading-relaxed">
                {isSupervisor ? (
                  <>
                    Tienes asignada la lista de nómina:{' '}
                    <strong className="text-white font-mono">
                      {assignedSupervisorList || currentUser.supervisorName || 'Tu Área'}
                    </strong>
                    . Revisa tus checadas, autoriza tiempos extras y valida tus días laborales para liberar a Recursos Humanos.
                  </>
                ) : isRH ? (
                  <>
                    Panel central del Módulo de Recursos Humanos. Coordina la carga de archivos biométricos, monitorea el semáforo de liberación de supervisores y gestiona incidencias.
                  </>
                ) : (
                  <>
                    Administrador General de CemenQtime. Tienes control de accesos por módulos, gestión de credenciales, configuración de turnos y supervisión global de asistencia.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Estado de Acción Rápida */}
          <div className="shrink-0 flex flex-col gap-2.5">
            {isSupervisor && !userHasModuleAccess(currentUser, 'nomina') ? (
              supervisorTotalPendingTasks > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="px-5 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>Tienes {supervisorTotalPendingTasks} tarea(s) pendiente(s)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : isPayrollReleased ? (
                <div className="px-5 py-3.5 rounded-2xl bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#A9DFD8]" />
                  <span>Tu nómina de la Semana {currentWeekNumber} ya está liberada</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="px-5 py-3.5 rounded-2xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(169,223,216,0.2)] flex items-center gap-2 cursor-pointer transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Trabajar / Liberar Mi Lista</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {userHasModuleAccess(currentUser, 'nomina') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('nomina')}
                    className="px-4 py-3 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs flex items-center gap-2 shadow-[0_8px_20px_rgba(169,223,216,0.18)] cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Dispersión de Nómina</span>
                  </button>
                )}
                {userHasModuleAccess(currentUser, 'trabajar_listas') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('trabajar_listas')}
                    className="px-4 py-3 rounded-xl bg-[#20AEF3] hover:bg-[#1a9ad9] text-[#171821] font-extrabold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Trabajar Listas</span>
                  </button>
                )}
                {userHasModuleAccess(currentUser, 'semaforo') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('semaforo')}
                    className="px-4 py-3 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#A9DFD8] border border-white/[0.08] font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Semáforo ({pendingReleasesCount} pendientes)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. PANEL BENTO DE ACCIONES PRIORITARIAS — ESTILO DARK ADMIN DASHBOARD */}
      <div className="p-6 rounded-2xl bg-[#21222D] border border-white/[0.07] space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                Resumen Operativo y Pendientes Prioritarios
              </h2>
              <p className="text-[11px] text-[#87888C]">
                Estado en tiempo real de tus tareas en la Semana {currentWeekNumber}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[#A9DFD8] bg-[#A9DFD8]/10 border border-[#A9DFD8]/25 px-2.5 py-1 rounded-md font-mono font-bold uppercase tracking-wider">
            En Tiempo Real
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarjeta 1: Tareas del supervisor o Estado de la semana */}
          {isSupervisor && !userHasModuleAccess(currentUser, 'nomina') ? (
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                supervisorPendingOvertimeCount > 0
                  ? 'bg-[#171821] border-[#FEB95A]/40 shadow-[0_0_25px_rgba(254,185,90,0.06)]'
                  : 'bg-[#171821] border-white/[0.06]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-[#FEB95A] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Tiempos Extras
                  </span>
                  <span className="font-mono text-xs font-extrabold text-[#FEB95A]">
                    {supervisorPendingOvertimeCount} pend.
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  {supervisorPendingOvertimeCount > 0
                    ? `${supervisorPendingOvertimeCount} jornada(s) con horas extras por autorizar`
                    : '✓ Todos los tiempos extras validados'}
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  {supervisorPendingOvertimeCount > 0
                    ? 'Confirma con SÍ o NO si autorizas el tiempo extra detectado para su pago.'
                    : 'No tienes horas extras pendientes de validación en esta semana.'}
                </p>
              </div>
              {supervisorPendingOvertimeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-[#FEB95A] hover:bg-[#fca939] text-[#171821] font-extrabold text-xs self-start cursor-pointer transition-colors"
                >
                  Autorizar Tiempos Extras
                </button>
              )}
            </div>
          ) : (
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                !hasEmployees || !hasEvents
                  ? 'bg-[#171821] border-[#FEB95A]/40'
                  : 'bg-[#171821] border-white/[0.06]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-[#FEB95A] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Carga y Dispersión de Nómina
                  </span>
                  <span className="font-mono text-xs font-extrabold text-[#FEB95A]">
                    {reportesCount} emp.
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  {!hasEmployees || !hasEvents
                    ? 'Faltan archivos para procesar la semana'
                    : `✓ Archivos cargados (${reportesCount} empleados en cálculo)`}
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  {!hasEmployees
                    ? 'Sube el archivo Excel de empleados para sincronizar nombres y turnos.'
                    : !hasEvents
                    ? 'Sube el archivo de checadas biométricas de la semana.'
                    : 'La base de datos de asistencia está activa y lista para dispersar.'}
                </p>
              </div>
              {(!hasEmployees || !hasEvents) && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-[#FEB95A] hover:bg-[#fca939] text-[#171821] font-extrabold text-xs self-start cursor-pointer transition-colors"
                >
                  Ir a Dispersión de Nómina
                </button>
              )}
            </div>
          )}

          {/* Tarjeta 2: Checadas incompletas o Semáforo */}
          {isSupervisor && !userHasModuleAccess(currentUser, 'semaforo') ? (
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                  ? 'bg-[#171821] border-rose-500/40'
                  : 'bg-[#171821] border-white/[0.06]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Checadas y Formatos
                  </span>
                  <span className="font-mono text-xs font-extrabold text-rose-400">
                    {supervisorPendingMissingPunchCount}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  {supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                    ? `${supervisorPendingMissingPunchCount} checada(s) faltantes o sin respaldo`
                    : '✓ Asistencias y checadas al 100%'}
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  {supervisorPendingMissingPunchCount > 0
                    ? 'Agrega la hora de entrada/salida faltante o confirma falta/permiso.'
                    : 'Todas las jornadas de tu equipo tienen entrada y salida válidas.'}
                </p>
              </div>
              {(supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0) && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs self-start cursor-pointer transition-colors"
                >
                  Resolver Checadas Faltantes
                </button>
              )}
            </div>
          ) : (
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                pendingReleasesCount > 0
                  ? 'bg-[#171821] border-[#A9DFD8]/40'
                  : 'bg-[#171821] border-white/[0.06]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-[#A9DFD8] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Semáforo de Liberación
                  </span>
                  <span className="font-mono text-xs font-extrabold text-[#A9DFD8]">
                    {pendingReleasesCount} pend.
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  {pendingReleasesCount > 0
                    ? `${pendingReleasesCount} lista(s) pendientes de liberación`
                    : '✓ Todas las listas de supervisores liberadas'}
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Supervisa el estatus de entrega de cada supervisor y notifícales por correo o sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('semaforo')}
                className="mt-4 px-3.5 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs self-start cursor-pointer transition-colors"
              >
                Ver Semáforo de Nóminas
              </button>
            </div>
          )}

          {/* Tarjeta 3: Incidencias y Permisos */}
          <div
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              pendingIncidentsCount > 0
                ? 'bg-[#171821] border-[#20AEF3]/40'
                : 'bg-[#171821] border-white/[0.06]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-[#20AEF3] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Solicitudes e Incidencias
                </span>
                <span className="font-mono text-xs font-extrabold text-[#20AEF3]">
                  {pendingIncidentsCount}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white">
                {pendingIncidentsCount > 0
                  ? `${pendingIncidentsCount} solicitud(es) de permiso por dictaminar`
                  : '✓ Sin solicitudes pendientes'}
              </h4>
              <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                {isSupervisor
                  ? 'Permisos sin goce y checadas con 1 omisión se aprueban directo; las demás pasan a RH.'
                  : 'Dictamina solicitudes, cambios de horario y formatos firmados de los supervisores.'}
              </p>
            </div>
            {userHasModuleAccess(currentUser, 'incidencias') && (
              <button
                type="button"
                onClick={() => onNavigateTab('incidencias')}
                className="mt-4 px-3.5 py-2 rounded-xl bg-[#20AEF3] hover:bg-[#1a9ad9] text-[#171821] font-extrabold text-xs self-start cursor-pointer transition-colors"
              >
                Abrir Bandeja de Incidencias
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. SELECCIÓN DE MÓDULOS HABILITADOS — BENTO GRID */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#87888C] flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#A9DFD8]" />
            <span>Módulos Habilitados para tu Perfil</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Módulo 1A: Dispersión y Cálculo de Nómina */}
          {userHasModuleAccess(currentUser, 'nomina') && (
            <div
              onClick={() => onNavigateTab('nomina')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#20AEF3]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] mb-3.5 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#20AEF3] transition-colors">
                  Dispersión de Nómina
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Carga archivos biométricos, genera el cálculo semanal global y dispersa las listas a los supervisores.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#20AEF3] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Abrir Dispersión</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 1B: Trabajar Listas Asignadas */}
          {userHasModuleAccess(currentUser, 'trabajar_listas') && (
            <div
              onClick={() => onNavigateTab('trabajar_listas')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#A9DFD8]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] mb-3.5 group-hover:scale-105 transition-transform">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#A9DFD8] transition-colors">
                  Trabajar Listas
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Revisa checadas, justifica faltas, autoriza tiempos extras y libera la lista asignada ({assignedSupervisorList || 'Tus listas'}).
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#A9DFD8] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Trabajar Lista(s)</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 2: Semáforo */}
          {userHasModuleAccess(currentUser, 'semaforo') && (
            <div
              onClick={() => onNavigateTab('semaforo')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#A9DFD8]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] mb-3.5 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#A9DFD8] transition-colors">
                  Semáforo de Nóminas
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Monitoreo de liberación semanal, estatus en tiempo real y notificación por correo y sistema.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#A9DFD8] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Ver Semáforo</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 3: Bandeja de Incidencias */}
          {userHasModuleAccess(currentUser, 'incidencias') && (
            <div
              onClick={() => onNavigateTab('incidencias')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#FEB95A]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] mb-3.5 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#FEB95A] transition-colors">
                  {isSupervisor ? 'Mis Solicitudes de Permiso' : 'Bandeja de Incidencias'}
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  {isSupervisor
                    ? 'Genera solicitudes de permiso, cambios de horario o vacaciones y da seguimiento.'
                    : 'Dictamina solicitudes, cambios de horario y autoriza formatos firmados.'}
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#FEB95A] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Abrir Incidencias</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 4: Exportación Layout */}
          {userHasModuleAccess(currentUser, 'contpaqi') && (
            <div
              onClick={() => onNavigateTab('contpaqi')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#F2C8ED]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#F2C8ED]/15 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED] mb-3.5 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#F2C8ED] transition-colors">
                  Exportación de Nómina
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Generación de layout Excel con claves de incidencias (FINJ, RET, 1HE, 2HE) y cálculo de descuentos.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#F2C8ED] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Abrir Exportación</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 5: Tiempo Límite de Liberación */}
          {userHasModuleAccess(currentUser, 'tiempo_limite') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#FEB95A]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] mb-3.5 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#FEB95A] transition-colors">
                  Tiempo Límite de Liberación
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Define las horas permitidas ({horasLimiteLiberacion}h actuales) para que los supervisores trabajen y liberen su lista.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#FEB95A] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Configurar Plazo</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 6: Servidor y Credenciales SMTP */}
          {userHasModuleAccess(currentUser, 'smtp_correo') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#20AEF3]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] mb-3.5 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#20AEF3] transition-colors">
                  Credenciales Correo SMTP
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Configura servidor, puerto, usuario y clave de aplicación para el envío automático de correos.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#20AEF3] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Configurar SMTP</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 7: Usuarios y Listas */}
          {userHasModuleAccess(currentUser, 'usuarios') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] hover:border-[#F2C8ED]/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#F2C8ED]/15 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED] mb-3.5 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-[#F2C8ED] transition-colors">
                  Usuarios y Permisos
                </h4>
                <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                  Crea usuarios, asigna contraseñas, define qué módulos pueden ver y qué listas trabajan.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#F2C8ED] mt-4 pt-3 border-t border-white/[0.05]">
                <span>Gestionar Usuarios</span>
                <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
