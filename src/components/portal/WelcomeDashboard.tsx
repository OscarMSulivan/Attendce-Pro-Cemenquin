/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Home, 
  Activity, 
  FileText, 
  FileSpreadsheet, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Upload, 
  Calendar, 
  ShieldCheck, 
  FileCheck,
  Send,
  Zap
} from 'lucide-react';
import { PortalUser, PayrollDispersal, userHasModuleAccess, getUserAllowedModules } from '../../types/portal';
import { EmployeeReport } from '../../types/attendance';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';

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
  onOpenSchedules,
  onOpenAssign,
  activeDispersal,
  horasLimiteLiberacion = 24,
}) => {
  const isSupervisor = currentUser.role === 'supervisor';
  const isRH = currentUser.role === 'rh';
  const isAdmin = currentUser.role === 'admin';

  const userModules = getUserAllowedModules(currentUser);

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
            s => s.trim().toUpperCase() === assignedSupervisorList.trim().toUpperCase()
          )))
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* 1. HERO BANNER DE BIENVENIDA */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-gradient-to-br dark:from-[#21222D] dark:via-[#21222D] dark:to-[#1c2230] border border-slate-200 dark:border-[#2C2D3C] shadow-lg dark:shadow-2xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-teal-500/10 dark:bg-[#A9DFD8]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-sky-500/10 dark:bg-[#20AEF3]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-xl bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-800 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/30 font-bold text-xs uppercase tracking-wider">
                Bienvenido al Sistema
              </span>
              <span className="text-xs text-slate-600 dark:text-[#8C8D9B] font-mono font-medium">
                Semana {currentWeekNumber} ({selectedWeek})
              </span>
              {activeDispersal && (
                <DispersalCountdownTimer
                  limiteLiberacion={effectiveLimiteLiberacion}
                  isReleased={isSupervisor ? isPayrollReleased : false}
                  isCancelled={isCancelledForUser}
                />
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Hola, <span className="text-teal-700 dark:text-[#A9DFD8]">{currentUser.name}</span> 👋
            </h1>

            <p className="text-sm text-slate-600 dark:text-[#8C8D9B] leading-relaxed">
              {isSupervisor ? (
                <>
                  Tienes asignada la lista de nómina: <strong className="text-slate-900 dark:text-white font-mono">{assignedSupervisorList || currentUser.supervisorName || 'Tu Área'}</strong>. Revisa tus checadas, autoriza tiempos extras y valida tus días laborales para liberar a RH.
                </>
              ) : isRH ? (
                <>
                  Panel central de Recursos Humanos y Nóminas. Aquí puedes coordinar la carga de archivos biométricos, monitorear el semáforo de liberación de supervisores y generar el layout para CONTPAQi®.
                </>
              ) : (
                <>
                  Administrador General del sistema. Tienes control de accesos por módulos, gestión de credenciales, configuración de turnos y supervisión global de nóminas.
                </>
              )}
            </p>
          </div>

          {/* Estado de Acción Rápida */}
          <div className="shrink-0 flex flex-col gap-2">
            {isSupervisor && !userHasModuleAccess(currentUser, 'nomina') ? (
              supervisorTotalPendingTasks > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>Tienes {supervisorTotalPendingTasks} tarea(s) pendiente(s)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : isPayrollReleased ? (
                <div className="px-5 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tu nómina de la Semana {currentWeekNumber} ya está liberada a RH</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="px-5 py-3 rounded-2xl bg-teal-600 dark:bg-[#A9DFD8] hover:bg-teal-500 dark:hover:bg-[#95d0c8] text-white dark:text-[#171821] font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Trabajar / Liberar Mi Lista</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {userHasModuleAccess(currentUser, 'nomina') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('nomina')}
                    className="px-4 py-2.5 rounded-xl bg-[#20AEF3] hover:bg-[#1a9ad9] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Dispersión de Nómina</span>
                  </button>
                )}
                {userHasModuleAccess(currentUser, 'trabajar_listas') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('trabajar_listas')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Trabajar Listas</span>
                  </button>
                )}
                {userHasModuleAccess(currentUser, 'semaforo') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('semaforo')}
                    className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-[#21222D] dark:hover:bg-[#2A2B36] text-teal-800 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#2C2D3C] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
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

      {/* 2. PANEL DE "TIENES PENDIENTE POR HACER ESTO" */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] space-y-4 shadow-md dark:shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2C2D3C] pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-[#FEB95A]" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              ¿Qué tienes pendiente de hacer en el sistema?
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-[#8C8D9B] font-mono">Acciones Prioritarias</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tarjeta 1: Tareas del supervisor o Estado de la semana */}
          {isSupervisor && !userHasModuleAccess(currentUser, 'nomina') ? (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              supervisorPendingOvertimeCount > 0
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-[#FEB95A] block mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tiempos Extras
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {supervisorPendingOvertimeCount > 0
                    ? `${supervisorPendingOvertimeCount} jornada(s) con horas extras por autorizar`
                    : '✓ Todos los tiempos extras validados'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  {supervisorPendingOvertimeCount > 0
                    ? 'Debes confirmar con SÍ o NO si autorizas el tiempo extra detectado para mandarlo a CONTPAQi.'
                    : 'No tienes horas extras pendientes de validación en esta semana.'}
                </p>
              </div>
              {supervisorPendingOvertimeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Autorizar Tiempos Extras
                </button>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              !hasEmployees || !hasEvents
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-[#FEB95A] block mb-1 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Carga y Dispersión de Nómina
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {!hasEmployees || !hasEvents
                    ? 'Faltan archivos para procesar la semana'
                    : `✓ Archivos cargados (${reportesCount} empleados en cálculo)`}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
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
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Ir a Dispersión de Nómina
                </button>
              )}
            </div>
          )}

          {/* Tarjeta 2: Checadas incompletas o Semáforo */}
          {isSupervisor && !userHasModuleAccess(currentUser, 'semaforo') ? (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40'
                : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Checadas y Formatos
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                    ? `${supervisorPendingMissingPunchCount} checada(s) faltantes o sin respaldo`
                    : '✓ Asistencias y checadas al 100%'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  {supervisorPendingMissingPunchCount > 0
                    ? 'Agrega la hora de entrada/salida faltante o confirma falta/permiso con goce.'
                    : 'Todas las jornadas de tu equipo tienen entrada y salida válidas.'}
                </p>
              </div>
              {(supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0) && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('trabajar_listas')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Resolver Checadas Faltantes
                </button>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              pendingReleasesCount > 0
                ? 'bg-teal-50/70 dark:bg-[#A9DFD8]/10 border-teal-300 dark:border-[#A9DFD8]/40'
                : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-800 dark:text-[#A9DFD8] block mb-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Semáforo de Liberación
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {pendingReleasesCount > 0
                    ? `${pendingReleasesCount} lista(s) pendientes de liberación`
                    : '✓ Todas las listas de supervisores liberadas'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Supervisa el estatus de entrega de cada supervisor y notifícales por correo o sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('semaforo')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-teal-600 dark:bg-[#A9DFD8] hover:bg-teal-500 dark:hover:bg-[#95d0c8] text-white dark:text-[#171821] font-extrabold text-[10px] self-start cursor-pointer"
              >
                Ver Semáforo de Nóminas
              </button>
            </div>
          )}

          {/* Tarjeta 3: Incidencias y Permisos */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            pendingIncidentsCount > 0
              ? 'bg-sky-50 dark:bg-[#20AEF3]/10 border-sky-300 dark:border-[#20AEF3]/40'
              : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-[#20AEF3] block mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Solicitudes e Incidencias
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {pendingIncidentsCount > 0
                  ? `${pendingIncidentsCount} solicitud(es) de permiso por dictaminar`
                  : '✓ Sin solicitudes pendientes'}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                {isSupervisor
                  ? 'Revisa el estatus de las solicitudes y formatos firmados que ingresaste.'
                  : 'Autoriza o rechaza permisos con goce, vacaciones y formatos firmados de los supervisores.'}
              </p>
            </div>
            {userHasModuleAccess(currentUser, 'incidencias') && (
              <button
                type="button"
                onClick={() => onNavigateTab('incidencias')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-[#20AEF3] hover:bg-[#1a9ad9] text-white font-extrabold text-[10px] self-start cursor-pointer"
              >
                Abrir Bandeja de Incidencias
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. SELECCIÓN DE "¿QUÉ QUIERES TRABAJAR AHORA?" CON BASE EN PERMISOS */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#8C8D9B]">
          ¿Qué quieres trabajar ahora? — Módulos Habilitados para tu Perfil
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Módulo 1A: Dispersión y Cálculo de Nómina */}
          {userHasModuleAccess(currentUser, 'nomina') && (
            <div
              onClick={() => onNavigateTab('nomina')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-sky-400 dark:hover:border-[#20AEF3]/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-[#20AEF3]/15 border border-sky-200 dark:border-[#20AEF3]/30 flex items-center justify-center text-sky-600 dark:text-[#20AEF3] mb-3 group-hover:scale-110 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-[#20AEF3] transition-colors">
                  Módulo de Dispersión de Nómina
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Carga archivos biométricos, genera el cálculo semanal global y dispersa las listas de nómina a los supervisores.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-sky-600 dark:text-[#20AEF3] mt-4">
                <span>Abrir Dispersión de Nómina</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 1B: Trabajar Listas Asignadas */}
          {userHasModuleAccess(currentUser, 'trabajar_listas') && (
            <div
              onClick={() => onNavigateTab('trabajar_listas')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Módulo para Trabajar Listas
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Revisa checadas, justifica faltas, autoriza tiempos extras y libera la lista asignada ({assignedSupervisorList || 'Tus listas asignadas'}).
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-4">
                <span>Trabajar Lista(s)</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 2: Semáforo */}
          {userHasModuleAccess(currentUser, 'semaforo') && (
            <div
              onClick={() => onNavigateTab('semaforo')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-teal-400 dark:hover:border-[#A9DFD8]/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8] mb-3 group-hover:scale-110 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-[#A9DFD8] transition-colors">
                  Semáforo de Nóminas
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Monitoreo de liberación semanal, estatus en tiempo real y dispersión por correo y sistema.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-teal-700 dark:text-[#A9DFD8] mt-4">
                <span>Ver Semáforo</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 3: Bandeja de Incidencias */}
          {userHasModuleAccess(currentUser, 'incidencias') && (
            <div
              onClick={() => onNavigateTab('incidencias')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-amber-400 dark:hover:border-[#FEB95A]/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-[#FEB95A]/15 border border-amber-200 dark:border-[#FEB95A]/30 flex items-center justify-center text-amber-700 dark:text-[#FEB95A] mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-[#FEB95A] transition-colors">
                  {isSupervisor ? 'Mis Solicitudes de Permiso' : 'Bandeja de Incidencias'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  {isSupervisor
                    ? 'Genera solicitudes de permiso con goce, vacaciones y da seguimiento a firmas.'
                    : 'Dictamina solicitudes, autoriza formatos firmados y adjunta comprobantes.'}
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-amber-700 dark:text-[#FEB95A] mt-4">
                <span>Abrir Incidencias</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 4: CONTPAQi Nóminas */}
          {userHasModuleAccess(currentUser, 'contpaqi') && (
            <div
              onClick={() => onNavigateTab('contpaqi')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-purple-400 dark:hover:border-[#F2C8ED]/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-[#F2C8ED]/15 border border-purple-200 dark:border-[#F2C8ED]/30 flex items-center justify-center text-purple-700 dark:text-[#F2C8ED] mb-3 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-[#F2C8ED] transition-colors">
                  CONTPAQi® Nóminas
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Generación de layout Excel con claves simplificadas (FINJ, RET, 1HE, 2HE) y cálculo de descuentos.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-purple-700 dark:text-[#F2C8ED] mt-4">
                <span>Exportar a CONTPAQi</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 5: Tiempo Límite de Liberación */}
          {userHasModuleAccess(currentUser, 'tiempo_limite') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-orange-400 dark:hover:border-orange-500/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-300 transition-colors">
                  Tiempo Límite de Liberación
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Define las horas permitidas ({horasLimiteLiberacion}h actuales) para que los supervisores trabajen y liberen su lista.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-orange-600 dark:text-orange-400 mt-4">
                <span>Configurar Plazo</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 6: Servidor y Credenciales SMTP */}
          {userHasModuleAccess(currentUser, 'smtp_correo') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Credenciales Correo SMTP
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Configura servidor, puerto, usuario y clave de aplicación para el envío automático de correos de dispersión.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-4">
                <span>Configurar SMTP</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 7: Usuarios y Listas (Solo Admin o con permiso) */}
          {userHasModuleAccess(currentUser, 'usuarios') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] hover:border-purple-400 dark:hover:border-purple-500/60 transition-all cursor-pointer group shadow-md dark:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                  Usuarios y Permisos
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-1">
                  Crea usuarios, asigna contraseñas, define qué módulos pueden ver y qué listas trabajan.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-purple-700 dark:text-purple-400 mt-4">
                <span>Gestionar Usuarios</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
