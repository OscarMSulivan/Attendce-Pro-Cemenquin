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
import { PortalUser, userHasModuleAccess, getUserAllowedModules } from '../../types/portal';
import { EmployeeReport } from '../../types/attendance';

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
}) => {
  const isSupervisor = currentUser.role === 'supervisor';
  const isRH = currentUser.role === 'rh';
  const isAdmin = currentUser.role === 'admin';

  const userModules = getUserAllowedModules(currentUser);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* 1. HERO BANNER DE BIENVENIDA */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#21222D] via-[#21222D] to-[#1c2230] border border-[#2C2D3C] shadow-2xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#A9DFD8]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-[#20AEF3]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-xl bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30 font-bold text-xs uppercase tracking-wider">
                Bienvenido al Sistema
              </span>
              <span className="text-xs text-[#8C8D9B] font-mono">
                Semana {currentWeekNumber} ({selectedWeek})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hola, <span className="text-[#A9DFD8]">{currentUser.name}</span> 👋
            </h1>

            <p className="text-sm text-[#8C8D9B] leading-relaxed">
              {isSupervisor ? (
                <>
                  Tienes asignada la lista de nómina: <strong className="text-white font-mono">{assignedSupervisorList || currentUser.supervisorName || 'Tu Área'}</strong>. Revisa tus checadas, autoriza tiempos extras y valida tus días laborales para liberar a RH.
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
            {isSupervisor ? (
              supervisorTotalPendingTasks > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="px-5 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>Tienes {supervisorTotalPendingTasks} tarea(s) pendiente(s)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : isPayrollReleased ? (
                <div className="px-5 py-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Tu nómina de la Semana {currentWeekNumber} ya está liberada a RH</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="px-5 py-3 rounded-2xl bg-[#A9DFD8] hover:bg-[#95d0c8] text-[#171821] font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Listo para Liberar Nómina</span>
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
                    <Calendar className="w-4 h-4" />
                    <span>Trabajar Periodo Nómina</span>
                  </button>
                )}
                {userHasModuleAccess(currentUser, 'semaforo') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('semaforo')}
                    className="px-4 py-2.5 rounded-xl bg-[#21222D] hover:bg-[#2A2B36] text-[#A9DFD8] border border-[#2C2D3C] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
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
      <div className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#2C2D3C] pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FEB95A]" />
            <h2 className="text-sm font-extrabold text-white">
              ¿Qué tienes pendiente de hacer en el sistema?
            </h2>
          </div>
          <span className="text-[10px] text-[#8C8D9B] font-mono">Acciones Prioritarias</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tarjeta 1: Tareas del supervisor o Estado de la semana */}
          {isSupervisor ? (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              supervisorPendingOvertimeCount > 0
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-[#171821] border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#FEB95A] block mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tiempos Extras
                </span>
                <h4 className="text-xs font-bold text-white">
                  {supervisorPendingOvertimeCount > 0
                    ? `${supervisorPendingOvertimeCount} jornada(s) con horas extras por autorizar`
                    : '✓ Todos los tiempos extras validados'}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  {supervisorPendingOvertimeCount > 0
                    ? 'Debes confirmar con SÍ o NO si autorizas el tiempo extra detectado para mandarlo a CONTPAQi.'
                    : 'No tienes horas extras pendientes de validación en esta semana.'}
                </p>
              </div>
              {supervisorPendingOvertimeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-[#FEB95A] hover:bg-[#e0a248] text-[#171821] font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Autorizar Tiempos Extras
                </button>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              !hasEmployees || !hasEvents
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-[#171821] border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#FEB95A] block mb-1 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Carga de Archivos de Nómina
                </span>
                <h4 className="text-xs font-bold text-white">
                  {!hasEmployees || !hasEvents
                    ? 'Faltan archivos para procesar la semana'
                    : `✓ Archivos cargados (${reportesCount} empleados en cálculo)`}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  {!hasEmployees
                    ? 'Sube el archivo Excel de empleados para sincronizar nombres y turnos.'
                    : !hasEvents
                    ? 'Sube el archivo de checadas biométricas de la semana.'
                    : 'La base de datos de asistencia está activa y lista para trabajar.'}
                </p>
              </div>
              {(!hasEmployees || !hasEvents) && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-[#FEB95A] hover:bg-[#e0a248] text-[#171821] font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Ir al Cargador de Archivos
                </button>
              )}
            </div>
          )}

          {/* Tarjeta 2: Checadas incompletas o Semáforo */}
          {isSupervisor ? (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-[#171821] border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Checadas y Formatos
                </span>
                <h4 className="text-xs font-bold text-white">
                  {supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0
                    ? `${supervisorPendingMissingPunchCount} checada(s) faltantes o sin respaldo`
                    : '✓ Asistencias y checadas al 100%'}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  {supervisorPendingMissingPunchCount > 0
                    ? 'Agrega la hora de entrada/salida faltante o confirma falta/permiso con goce.'
                    : 'Todas las jornadas de tu equipo tienen entrada y salida válidas.'}
                </p>
              </div>
              {(supervisorPendingMissingPunchCount > 0 || supervisorBlockingNoFormatCount > 0) && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('nomina')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] self-start cursor-pointer"
                >
                  Resolver Checadas Faltantes
                </button>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              pendingReleasesCount > 0
                ? 'bg-[#A9DFD8]/10 border-[#A9DFD8]/40'
                : 'bg-[#171821] border-[#2C2D3C]'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#A9DFD8] block mb-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Semáforo de Liberación
                </span>
                <h4 className="text-xs font-bold text-white">
                  {pendingReleasesCount > 0
                    ? `${pendingReleasesCount} lista(s) pendientes de liberación`
                    : '✓ Todas las listas de supervisores liberadas'}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  Supervisa el estatus de entrega de cada supervisor y notifícales por correo o sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('semaforo')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-[#A9DFD8] hover:bg-[#95d0c8] text-[#171821] font-extrabold text-[10px] self-start cursor-pointer"
              >
                Ver Semáforo de Nóminas
              </button>
            </div>
          )}

          {/* Tarjeta 3: Incidencias y Permisos */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            pendingIncidentsCount > 0
              ? 'bg-[#20AEF3]/10 border-[#20AEF3]/40'
              : 'bg-[#171821] border-[#2C2D3C]'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#20AEF3] block mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Solicitudes e Incidencias
              </span>
              <h4 className="text-xs font-bold text-white">
                {pendingIncidentsCount > 0
                  ? `${pendingIncidentsCount} solicitud(es) de permiso por dictaminar`
                  : '✓ Sin solicitudes pendientes'}
              </h4>
              <p className="text-[11px] text-[#8C8D9B] mt-1">
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8D9B]">
          ¿Qué quieres trabajar ahora? — Módulos Habilitados para tu Perfil
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Módulo 1: Nómina */}
          {userHasModuleAccess(currentUser, 'nomina') && (
            <div
              onClick={() => onNavigateTab('nomina')}
              className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] hover:border-[#20AEF3]/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] mb-3 group-hover:scale-110 transition-transform">
                  <Home className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#20AEF3] transition-colors">
                  {isSupervisor ? 'Trabajar Mi Lista de Nómina' : 'Dashboard y Asistencia'}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  {isSupervisor
                    ? `Gestiona checadas y valida el turno de ${assignedSupervisorList || 'tu personal'}.`
                    : 'Revisa asistencia por listas, asigna turnos y audita checadas crudas.'}
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#20AEF3] mt-4">
                <span>{isSupervisor ? 'Trabajar Nómina' : 'Abrir Dashboard'}</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 2: Semáforo */}
          {userHasModuleAccess(currentUser, 'semaforo') && (
            <div
              onClick={() => onNavigateTab('semaforo')}
              className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] hover:border-[#A9DFD8]/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] mb-3 group-hover:scale-110 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#A9DFD8] transition-colors">
                  Semáforo de Nóminas
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  Monitoreo de liberación semanal, estatus en tiempo real y dispersión por correo y sistema.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#A9DFD8] mt-4">
                <span>Ver Semáforo</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 3: Bandeja de Incidencias */}
          {userHasModuleAccess(currentUser, 'incidencias') && (
            <div
              onClick={() => onNavigateTab('incidencias')}
              className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] hover:border-[#FEB95A]/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#FEB95A] transition-colors">
                  {isSupervisor ? 'Mis Solicitudes de Permiso' : 'Bandeja de Incidencias'}
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  {isSupervisor
                    ? 'Genera solicitudes de permiso con goce, vacaciones y da seguimiento a firmas.'
                    : 'Dictamina solicitudes, autoriza formatos firmados y adjunta comprobantes.'}
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#FEB95A] mt-4">
                <span>Abrir Incidencias</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 4: CONTPAQi Nóminas */}
          {userHasModuleAccess(currentUser, 'contpaqi') && (
            <div
              onClick={() => onNavigateTab('contpaqi')}
              className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] hover:border-[#F2C8ED]/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#F2C8ED]/15 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED] mb-3 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#F2C8ED] transition-colors">
                  CONTPAQi® Nóminas
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  Generación de layout Excel con claves simplificadas (FINJ, RET, 1HE, 2HE) y cálculo de descuentos.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-[#F2C8ED] mt-4">
                <span>Exportar a CONTPAQi</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}

          {/* Módulo 5: Usuarios y Listas (Solo Admin o con permiso) */}
          {userHasModuleAccess(currentUser, 'usuarios') && (
            <div
              onClick={() => onNavigateTab('usuarios')}
              className="p-5 rounded-2xl bg-[#21222D] border border-[#2C2D3C] hover:border-purple-500/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  Usuarios y Permisos
                </h4>
                <p className="text-[11px] text-[#8C8D9B] mt-1">
                  Crea usuarios, asigna contraseñas, define qué módulos pueden ver y qué listas trabajan.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-purple-400 mt-4">
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
