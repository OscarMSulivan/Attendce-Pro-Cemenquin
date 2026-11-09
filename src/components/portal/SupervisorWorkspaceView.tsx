/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users, 
  Calendar, 
  Send, 
  Search, 
  ShieldCheck, 
  Palmtree, 
  FileCheck,
  CalendarClock,
  Sparkles,
  Paperclip,
  Filter
} from 'lucide-react';
import { 
  PortalUser, 
  PayrollRelease, 
  PayrollDispersal, 
  IncidentRequest,
  PortalNotification,
  getUserAllowedLists
} from '../../types/portal';
import { Employee, EmployeeReport, ProcessedDay, ScheduleConfig } from '../../types/attendance';
import { FESTIVOS_OFICIALES, formatScheduleHoursSummary } from '../../utils/calendarUtils';
import { AttendanceTable } from '../AttendanceTable';
import {
  DayResolutionPayload,
  MissingPunchFormatModal,
  ResolutionMode
} from './MissingPunchFormatModal';
import { Bell, Mail } from 'lucide-react';

interface SupervisorWorkspaceViewProps {
  currentUser: PortalUser;
  dispersals: PayrollDispersal[];
  releases: Record<string, PayrollRelease>;
  notifications?: PortalNotification[];
  onMarkNotificationRead?: (notificationId: string) => void;
  assignedEmployees: Employee[];
  weeklyReports: EmployeeReport[];
  incidents: IncidentRequest[];
  horarios: Record<string, ScheduleConfig>;
  currentWeekNumber: number;
  currentWeekPeriod: string;
  onDownloadProcessedExcel: (supervisorName: string) => void;
  onLiberarNomina: (
    supervisorName: string,
    semanaNumero: number,
    semanaPeriodo: string,
    comentarios: string,
    archivoTrabajado?: { nombre: string; base64: string }
  ) => void;
  onOpenNewIncidentModal: (preselectedEmployeeId?: string) => void;
  onUpdateDayIncidence: (employeeId: string, isoDate: string, newIncidence: string) => void;
  onUpdateDayTimes: (employeeId: string, isoDate: string, newEntrada: string, newSalida: string) => void;
  onUpdateDayNote: (employeeId: string, isoDate: string, note: string) => void;
  onResolveMissingPunchDay: (payload: DayResolutionPayload) => void;
  onQuickConfirmFalta: (employeeId: string, isoDate: string) => void;
  onToggleOvertimeApproval?: (employeeId: string, isoDate: string, autorizada: boolean) => void;
}

export const SupervisorWorkspaceView: React.FC<SupervisorWorkspaceViewProps> = ({
  currentUser,
  dispersals,
  releases,
  notifications = [],
  onMarkNotificationRead,
  assignedEmployees,
  weeklyReports,
  incidents,
  horarios,
  currentWeekNumber,
  currentWeekPeriod,
  onDownloadProcessedExcel,
  onLiberarNomina,
  onOpenNewIncidentModal,
  onUpdateDayIncidence,
  onUpdateDayTimes,
  onUpdateDayNote,
  onResolveMissingPunchDay,
  onQuickConfirmFalta,
  onToggleOvertimeApproval,
}) => {
  const [activeModule, setActiveModule] = useState<'nominas' | 'equipo' | 'solicitudes'>('nominas');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listFilterMode, setListFilterMode] = useState<'all' | 'missing_punches' | 'modified'>('all');
  const [showLogsPanel, setShowLogsPanel] = useState(false);

  // Estado para el asistente de Formato de Checada / Permiso / Falta
  const [formatModalTarget, setFormatModalTarget] = useState<{
    employee: Employee;
    day: ProcessedDay;
    mode: ResolutionMode;
  } | null>(null);

  // Todas las listas de nómina asignadas a este usuario supervisor
  const userAssignedLists = useMemo(() => {
    const lists = getUserAllowedLists(currentUser);
    return lists.length > 0 ? lists : [currentUser.supervisorName || currentUser.name.toUpperCase()];
  }, [currentUser]);

  const [selectedListForWork, setSelectedListForWork] = useState<string>(
    () => userAssignedLists[0] || ''
  );

  // Mantener sincronizada la lista activa si cambia el usuario
  const targetSupervisor = userAssignedLists.includes(selectedListForWork)
    ? selectedListForWork
    : userAssignedLists[0] || currentUser.name.toUpperCase();

  // Filtrar empleados y reportes de la semana correspondientes a la lista seleccionada actualmente
  const activeListEmployees = useMemo(() => {
    if (userAssignedLists.length <= 1) return assignedEmployees;
    return assignedEmployees.filter(
      e => (e.jefe || '').trim().toUpperCase() === targetSupervisor
    );
  }, [assignedEmployees, userAssignedLists.length, targetSupervisor]);

  const activeListWeeklyReports = useMemo(() => {
    if (userAssignedLists.length <= 1) return weeklyReports;
    return weeklyReports.filter(
      r => (r.empleado.jefe || '').trim().toUpperCase() === targetSupervisor
    );
  }, [weeklyReports, userAssignedLists.length, targetSupervisor]);

  // Estados para el modal de liberación de nómina
  const [isWorkingOnRelease, setIsWorkingOnRelease] = useState(false);
  const [releaseComments, setReleaseComments] = useState('');
  const [workedFile, setWorkedFile] = useState<{ nombre: string; base64: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Obtener estado de liberación de la semana actual
  const currentReleaseKey = `${currentWeekNumber}_${targetSupervisor}`;
  const currentRelease = releases[currentReleaseKey];
  const isLiberada = currentRelease?.status === 'liberado';

  // Buscar si RH dispersó la semana actual específicamente para esta lista de supervisor
  const currentDispersal = dispersals.find(d => d.semanaNumero === currentWeekNumber);
  const isDispersedToSupervisor = Boolean(
    currentDispersal &&
      currentDispersal.supervisoresNotificados.some(
        s => s.trim().toUpperCase() === targetSupervisor.trim().toUpperCase()
      )
  ) && activeListWeeklyReports.length > 0;

  // Notificación activa de dispersión para esta lista
  const activeListNotification = useMemo(() => {
    return notifications.find(
      n =>
        n.semanaNumero === currentWeekNumber &&
        (n.targetSupervisor || '').toUpperCase() === targetSupervisor.toUpperCase() &&
        !n.leida
    );
  }, [notifications, currentWeekNumber, targetSupervisor]);

  // Función auxiliar para saber si un día laboral tiene checadas incompletas sin resolver
  const isDayMissingPunchesUnresolved = (d: ProcessedDay): boolean => {
    const isFestivo = Boolean(FESTIVOS_OFICIALES[d.isoDate]);
    const isScheduledWorkday = Boolean(d.horarioProgramado) && !isFestivo;
    const tieneEnt = d.entrada !== '--:--' && Boolean(d.entrada);
    const tieneSal = d.salida !== '--:--' && Boolean(d.salida);
    const hasJustifiedIncidence =
      d.incidencia === 'Vacaciones' ||
      d.incidencia.toLowerCase().includes('permiso') ||
      d.incidencia.toLowerCase().includes('incapacidad') ||
      d.incidencia.toLowerCase().includes('pase');
    return isScheduledWorkday && (!tieneEnt || !tieneSal) && !d.modificadoPorSupervisor && !hasJustifiedIncidence;
  };

  // Métricas detalladas de la lista del supervisor y bloqueo cuando faltaban las 2 checadas sin archivo de respaldo
  const stats = useMemo(() => {
    if (!isDispersedToSupervisor) {
      return {
        normalHours: 0,
        extraHours: 0,
        detectedExtraHours: 0,
        missingPunchDaysCount: 0,
        supAddedPunchesCount: 0,
        supWithoutFormatCount: 0,
        blockingNoFormatItems: [] as Array<{ employee: Employee; day: ProcessedDay }>,
        pendingOvertimeItems: [] as Array<{ employee: Employee; day: ProcessedDay }>,
        pendingMissingPunchItems: [] as Array<{ employee: Employee; day: ProcessedDay }>,
        hasPendingTasks: false,
        formatsUploadedCount: 0,
        confirmedFaltasCount: 0,
      };
    }

    let normalHours = 0;
    let extraHours = 0;
    let detectedExtraHours = 0;
    let missingPunchDaysCount = 0;
    let supAddedPunchesCount = 0;
    let supWithoutFormatCount = 0;
    const blockingNoFormatItems: Array<{ employee: Employee; day: ProcessedDay }> = [];
    const pendingOvertimeItems: Array<{ employee: Employee; day: ProcessedDay }> = [];
    const pendingMissingPunchItems: Array<{ employee: Employee; day: ProcessedDay }> = [];
    let formatsUploadedCount = 0;
    let confirmedFaltasCount = 0;

    activeListWeeklyReports.forEach(r => {
      normalHours += r.totalNormal;
      r.dias.forEach(d => {
        // Validación de tiempo extra: si generó tiempo extra pero aún no se autorizó ni rechazó (undefined)
        if (d.hExtra > 0) {
          detectedExtraHours += d.hExtra;
          if (d.horasExtrasAutorizadas === true) {
            extraHours += d.hExtra;
          } else if (d.horasExtrasAutorizadas === undefined) {
            pendingOvertimeItems.push({ employee: r.empleado, day: d });
          }
        }
        // Validación de checadas incompletas / pendientes
        if (isDayMissingPunchesUnresolved(d)) {
          missingPunchDaysCount++;
          pendingMissingPunchItems.push({ employee: r.empleado, day: d });
        }
        if (d.modificadoPorSupervisor) {
          if (d.tipoModificacionSupervisor === 'falta_confirmada') {
            confirmedFaltasCount++;
          } else {
            supAddedPunchesCount++;
            const origEnt = d.entradaOriginal ?? '--:--';
            const origSal = d.salidaOriginal ?? '--:--';
            const teniaEntOrig = Boolean(origEnt && origEnt !== '--:--');
            const teniaSalOrig = Boolean(origSal && origSal !== '--:--');
            const faltabanAmbasOriginalmente = !teniaEntOrig && !teniaSalOrig;
            const incUpper = (d.incidencia || '').toUpperCase();
            const isMandatoryPermiso =
              incUpper.includes('VACACIONES') ||
              incUpper.includes('CON GOCE') ||
              incUpper.includes('VIAJE') ||
              incUpper.includes('HOME OFFICE') ||
              incUpper.startsWith('OTRA:') ||
              incUpper === 'OTRO';

            const requiresFormatForThisModification =
              ((d.tipoModificacionSupervisor === 'checada_agregada' ||
                d.tipoModificacionSupervisor === 'formato_checada_sin_gafete') &&
                faltabanAmbasOriginalmente) ||
              (d.tipoModificacionSupervisor === 'formato_permiso' && isMandatoryPermiso);

            if (requiresFormatForThisModification && !d.formatoSubidoNombre) {
              supWithoutFormatCount++;
              blockingNoFormatItems.push({ employee: r.empleado, day: d });
            }
          }
          if (d.formatoSubidoNombre) {
            formatsUploadedCount++;
          }
        }
      });
    });

    return {
      normalHours,
      extraHours,
      detectedExtraHours,
      missingPunchDaysCount,
      supAddedPunchesCount,
      supWithoutFormatCount,
      blockingNoFormatItems,
      pendingOvertimeItems,
      pendingMissingPunchItems,
      hasPendingTasks:
        blockingNoFormatItems.length > 0 ||
        pendingOvertimeItems.length > 0 ||
        pendingMissingPunchItems.length > 0,
      formatsUploadedCount,
      confirmedFaltasCount,
    };
  }, [isDispersedToSupervisor, activeListWeeklyReports]);

  // Filtrar reportes de la tabla interactiva del supervisor
  const filteredWeeklyReports = useMemo(() => {
    let list = activeListWeeklyReports;
    if (listFilterMode === 'missing_punches') {
      list = list.filter(r => r.dias.some(d => isDayMissingPunchesUnresolved(d)));
    } else if (listFilterMode === 'modified') {
      list = list.filter(r => r.dias.some(d => d.modificadoPorSupervisor));
    }

    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase().trim();
      const qNum = parseInt(q, 10);
      const qNumStr = !isNaN(qNum) ? qNum.toString() : '';
      list = list.filter(
        r =>
          r.empleado.nombre.toLowerCase().includes(q) ||
          r.empleado.id.toLowerCase().includes(q) ||
          (qNumStr && r.empleado.id.includes(qNumStr))
      );
    }
    return list;
  }, [activeListWeeklyReports, listFilterMode, listSearchQuery]);

  // Incidencias del supervisor: ÚNICAMENTE las solicitudes que él mismo ingresó
  const teamIncidents = incidents.filter(inc => inc.solicitanteId === currentUser.id);
  const pendingIncidentsCount = teamIncidents.filter(i => i.status === 'pendiente').length;

  // Manejo de carga de archivo Excel trabajado por el supervisor (opcional)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setUploadError('Por favor selecciona un archivo de Excel válido (.xlsx o .xls)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setWorkedFile({
        nombre: file.name,
        base64: base64String,
      });
    };
    reader.onerror = () => {
      setUploadError('Error al leer el archivo. Intenta de nuevo.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmLiberacion = () => {
    if (stats.pendingOvertimeItems.length > 0) {
      setUploadError(
        `Tienes ${stats.pendingOvertimeItems.length} registro(s) de tiempo extra pendiente(s) de autorizar (SÍ o NO). Debes validarlos antes de liberar.`
      );
      return;
    }

    if (stats.pendingMissingPunchItems.length > 0) {
      setUploadError(
        `Tienes ${stats.pendingMissingPunchItems.length} día(s) con checadas incompletas o alertas pendientes de resolver (agrega la checada o confirma falta / permiso).`
      );
      return;
    }

    if (stats.blockingNoFormatItems.length > 0) {
      setUploadError(
        `Tienes ${stats.blockingNoFormatItems.length} día(s) donde el colaborador no tenía ni Entrada ni Salida y agregaste checada sin adjuntar el archivo de respaldo.`
      );
      return;
    }

    onLiberarNomina(
      targetSupervisor,
      currentWeekNumber,
      currentWeekPeriod,
      releaseComments,
      workedFile || undefined
    );
    setIsWorkingOnRelease(false);
  };

  // Filtrado de empleados asignados en la pestaña "Mi Equipo"
  const filteredTeam = assignedEmployees.filter(emp => {
    const query = searchEmployeeQuery.toLowerCase().trim();
    if (!query) return true;
    const queryNum = parseInt(query, 10);
    const queryNumStr = !isNaN(queryNum) ? queryNum.toString() : '';
    return (
      emp.id.toLowerCase().includes(query) ||
      (queryNumStr && emp.id.includes(queryNumStr)) ||
      emp.nombre.toLowerCase().includes(query) ||
      (emp.puesto && emp.puesto.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Banner Animado de Notificación de Dispersión (Sistema + Correo Electrónico Empresarial) */}
      {activeListNotification && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-blue-950/80 to-slate-900 border border-indigo-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Nueva Notificación en Sistema
                </span>
                {activeListNotification.emailEnviado && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Copia enviada a {activeListNotification.recipientEmail || currentUser.email}
                  </span>
                )}
              </div>
              <h3 className="text-xs font-bold text-white mt-1">
                {activeListNotification.titulo}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {activeListNotification.mensaje}
              </p>
            </div>
          </div>
          {onMarkNotificationRead && (
            <button
              type="button"
              onClick={() => onMarkNotificationRead(activeListNotification.id)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer transition-all self-end sm:self-center"
            >
              Entendido ✓
            </button>
          )}
        </div>
      )}

      {/* Banner de Bienvenida y Estatus de Dispersión */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Portal de Supervisión
              </span>
              {currentUser.employeeId && (
                <span className="font-mono px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  ID: #{currentUser.employeeId}
                </span>
              )}
              {isDispersedToSupervisor ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Send className="w-3 h-3 text-emerald-400" /> Semana {currentWeekNumber} Dispersada por Nóminas / RH
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> En espera de dispersión por Nóminas / RH
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-slate-100 mt-2">
              Hola, {currentUser.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
              <span>
                Lista activa: <strong className="text-amber-300">{targetSupervisor}</strong> · {activeListEmployees.length} colaboradores en esta lista.
              </span>
              {userAssignedLists.length > 1 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cambiar lista asignada:</span>
                  {userAssignedLists.map((lName) => (
                    <button
                      key={lName}
                      type="button"
                      onClick={() => setSelectedListForWork(lName)}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        targetSupervisor === lName
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40'
                      }`}
                    >
                      {lName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estado de la Nómina Activa */}
          <div className="flex items-center gap-3">
            {!isDispersedToSupervisor ? (
              <div className="px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Nómina Semana {currentWeekNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-300">Aún no dispersada por RH</span>
                </div>
              </div>
            ) : isLiberada ? (
              <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                    Nómina Semana {currentWeekNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-100">Liberada a RH ✓</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 animate-pulse">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">
                    Nómina Semana {currentWeekNumber}
                  </span>
                  <span className="text-xs font-bold text-amber-200">Pendiente de Liberar</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWorkingOnRelease(true)}
                  className="ml-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Liberar a RH</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notificación de Suplencia si aplica */}
        {currentUser.delegatedSupervisor && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-amber-300">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Tienes asignado el rol suplente para autorizar y liberar las nóminas de <strong>{currentUser.delegatedSupervisor}</strong> por periodo vacacional.
            </span>
          </div>
        )}
      </div>

      {/* Navegación entre Módulos del Supervisor */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveModule('nominas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeModule === 'nominas'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Trabajar Lista de Nómina y Liberar</span>
          {isDispersedToSupervisor && !isLiberada && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('equipo')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeModule === 'equipo'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Mi Equipo y Horarios ({assignedEmployees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('solicitudes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeModule === 'solicitudes'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palmtree className="w-4 h-4" />
          <span>Solicitudes e Incidencias</span>
          {pendingIncidentsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {pendingIncidentsCount}
            </span>
          )}
        </button>
      </div>

      {/* MÓDULO 1: TRABAJAR LISTA DE NÓMINA EN EL SISTEMA Y LIBERAR */}
      {activeModule === 'nominas' && (
        <div className="space-y-6">
          {!isDispersedToSupervisor ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl text-center max-w-2xl mx-auto my-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                <Send className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-100">
                Nómina de Semana {currentWeekNumber} en preparación por Nóminas / RH
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                El área de Nóminas / Recursos Humanos aún no ha dispersado las listas de asistencia de esta semana.
                Una vez que Nóminas cargue los archivos, genere su reporte interno y presione el botón <strong className="text-indigo-300">Dispersar</strong>, podrás trabajar tu lista aquí mismo en el sistema, generar formatos de checada/permiso y liberarla.
              </p>
            </div>
          ) : (
            <>
              {/* Panel Superior de Control y Acciones de la Nómina del Supervisor */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Semana {currentWeekNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {currentWeekPeriod || 'Periodo Activo'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Dispersada por {currentDispersal?.dispersadoPor || 'RH / Nóminas'}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-100 mt-1">
                      Mesa de Trabajo de Nómina — {targetSupervisor}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Trabaja tu lista directamente aquí en el sistema: agrega checadas faltantes con su formato, registra permisos o confirma faltas según el horario programado, y libérala a RH.
                    </p>
                  </div>

                  {/* Botones de Acción Principales (Sin acceso al catálogo ni asignación de horarios para el supervisor) */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onDownloadProcessedExcel(targetSupervisor)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                      title="Descargar Excel con las checadas agregadas por supervisor resaltadas en color violeta"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel (Marcado para RH)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsWorkingOnRelease(true)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer ${
                        isLiberada
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/25'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isLiberada ? 'Actualizar Liberación a RH' : 'Liberar Nómina a RH'}</span>
                    </button>
                  </div>
                </div>

                {/* Indicadores de la Lista del Supervisor */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Colaboradores</span>
                    <span className="text-lg font-bold text-slate-100 font-mono">{activeListWeeklyReports.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas Normales</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">{stats.normalHours.toFixed(2)}h</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">Horas Extras (Aut.)</span>
                    <span className="text-lg font-bold text-amber-300 font-mono">{stats.extraHours.toFixed(2)}h</span>
                    {stats.detectedExtraHours > 0 && (
                      <span className="text-[9px] font-mono text-slate-400 block">
                        Detectadas: {stats.detectedExtraHours.toFixed(2)}h
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">Sin 2 Checadas</span>
                    <span className="text-lg font-bold text-amber-300 font-mono">{stats.missingPunchDaysCount} días</span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/30">
                    <span className="text-[10px] uppercase font-bold text-purple-300 block">Checadas Agregadas</span>
                    <span className="text-lg font-bold text-purple-200 font-mono">{stats.supAddedPunchesCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-950/25 border border-blue-500/30">
                    <span className="text-[10px] uppercase font-bold text-blue-300 block">Formatos / Faltas</span>
                    <span className="text-lg font-bold text-blue-200 font-mono">
                      {stats.formatsUploadedCount} / {stats.confirmedFaltasCount}
                    </span>
                  </div>
                </div>

                {/* Aviso / Bloqueo si el supervisor tiene pendientes: Horas Extras sin autorizar, checadas faltantes o formatos requeridos */}
                {stats.hasPendingTasks && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/15 border border-rose-500/50 space-y-3 text-xs text-rose-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                          <strong className="text-rose-300 block text-sm">
                            🚫 Tienes tareas pendientes por resolver antes de poder liberar la nómina:
                          </strong>
                          <span className="text-[11px] text-slate-300">
                            Revisa y resuelve los siguientes puntos para que Recursos Humanos reciba la lista completa:
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-rose-500/30">
                      {/* 1. Tiempos extras pendientes */}
                      {stats.pendingOvertimeItems.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/40 text-[11px] flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              {stats.pendingOvertimeItems.length} Tiempo(s) Extra sin Autorizar
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Debes presionar <strong>SÍ</strong> o <strong>NO</strong> en cada jornada con horas extras detectadas.
                            </p>
                          </div>
                          <span className="text-[9px] font-mono text-amber-400 mt-2 block">
                            Pendiente autorización
                          </span>
                        </div>
                      )}

                      {/* 2. Checadas incompletas / faltantes */}
                      {stats.pendingMissingPunchItems.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/40 text-[11px] flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              {stats.pendingMissingPunchItems.length} Checada(s) Incompletas
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Días laborales sin checadas completas. Agrega la hora faltante o confirma falta/permiso.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setListFilterMode('missing_punches')}
                            className="mt-2 text-[10px] font-bold px-2 py-1 rounded bg-rose-600/30 text-rose-200 border border-rose-500/40 hover:bg-rose-600/50 cursor-pointer self-start"
                          >
                            Filtrar Días con Checadas Faltantes
                          </button>
                        </div>
                      )}

                      {/* 3. Formatos obligatorios por falta de 2 checadas */}
                      {stats.blockingNoFormatItems.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-500/40 text-[11px] flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-purple-300 flex items-center gap-1.5 mb-1">
                              <Paperclip className="w-3.5 h-3.5 text-purple-400" />
                              {stats.blockingNoFormatItems.length} Respaldo(s) Obligatorios
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Días sin Entrada ni Salida con checada agregada que requieren formato firmado adjunto.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setListFilterMode('modified')}
                            className="mt-2 text-[10px] font-bold px-2 py-1 rounded bg-purple-600/30 text-purple-200 border border-purple-500/40 hover:bg-purple-600/50 cursor-pointer self-start"
                          >
                            Filtrar Filas para Adjuntar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Si ya fue liberada, mostrar resumen formal */}
                {isLiberada && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Nómina liberada exitosamente a Recursos Humanos</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {currentRelease?.fechaLiberacion ? new Date(currentRelease.fechaLiberacion).toLocaleString('es-MX') : ''}
                      </span>
                    </div>
                    {currentRelease?.comentariosSupervisor && (
                      <p className="text-slate-300 italic bg-slate-950/60 p-2.5 rounded-lg border border-emerald-500/20">
                        &ldquo;{currentRelease.comentariosSupervisor}&rdquo;
                      </p>
                    )}
                    {currentRelease?.excelTrabajadoNombre && (
                      <div className="flex items-center gap-2 text-slate-300 pt-1">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <span>Archivo Excel adjunto a RH: <strong>{currentRelease.excelTrabajadoNombre}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Barra de Filtros Rápidos para Trabajar la Lista en el Sistema */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                    <Filter className="w-3.5 h-3.5 text-blue-400" /> Filtrar Lista:
                  </span>
                  <button
                    type="button"
                    onClick={() => setListFilterMode('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      listFilterMode === 'all'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Todos ({weeklyReports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilterMode('missing_punches')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      listFilterMode === 'missing_punches'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-950 text-amber-300 hover:bg-amber-950/30 border border-amber-500/30'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Días Laborales sin las 2 Checadas ({stats.missingPunchDaysCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilterMode('modified')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      listFilterMode === 'modified'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-950 text-purple-300 hover:bg-purple-950/30 border border-purple-500/30'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Checadas / Formatos Validados por Mí ({stats.supAddedPunchesCount + stats.confirmedFaltasCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLogsPanel(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      showLogsPanel
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-950 text-indigo-300 hover:bg-indigo-950/30 border border-indigo-500/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{showLogsPanel ? 'Ocultar Logs de Lista' : 'Ver Bitácora / Logs de Cambios'}</span>
                  </button>
                </div>

                {/* Buscador en la lista de nómina */}
                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="Buscar por ID (ej. 00615) o nombre..."
                    className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* ÁREA DE LOGS / BITÁCORA DE MODIFICACIONES REALIZADAS A LA LISTA */}
              {showLogsPanel && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/30 shadow-lg space-y-3 animate-scale-in">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Bitácora de Modificaciones de la Lista ({targetSupervisor})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Historial detallado de todas las checadas agregadas, permisos, faltas confirmadas y autorizaciones de tiempo extra en esta lista.
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const logRows: Array<{
                      key: string;
                      empId: string;
                      empName: string;
                      isoDate: string;
                      dayName: string;
                      badge: string;
                      badgeClass: string;
                      detail: string;
                      note?: string;
                      file?: string;
                    }> = [];

                    activeListWeeklyReports.forEach(r => {
                      r.dias.forEach(d => {
                        if (
                          d.modificadoPorSupervisor ||
                          d.horasExtrasAutorizadas !== undefined ||
                          Boolean(d.notaSupervisorDia)
                        ) {
                          let badge = 'Modificación';
                          let badgeClass = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                          let detail = `Entrada: ${d.entrada} | Salida: ${d.salida} (Orig: ${d.entradaOriginal || '--:--'} a ${d.salidaOriginal || '--:--'})`;

                          if (d.tipoModificacionSupervisor === 'falta_confirmada') {
                            badge = 'Falta Confirmada';
                            badgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                            detail = 'El supervisor confirmó que el colaborador no asistió a laborar.';
                          } else if (d.tipoModificacionSupervisor === 'formato_permiso') {
                            badge = `Permiso (${d.incidencia})`;
                            badgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
                            detail = `Incidencia registrada: ${d.incidencia} (${d.hNormal.toFixed(2)}h normales)`;
                          } else if (
                            d.tipoModificacionSupervisor === 'checada_agregada' ||
                            d.tipoModificacionSupervisor === 'formato_checada_sin_gafete'
                          ) {
                            badge = 'Checada sin Gafete';
                            badgeClass = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                          }

                          if (d.horasExtrasAutorizadas === true) {
                            badge = `${badge} + Extra Autorizado (${d.hExtra.toFixed(2)}h)`;
                            badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                          } else if (d.horasExtrasAutorizadas === false && d.hExtra > 0) {
                            badge = `${badge} • Extra NO Autorizado (${d.hExtra.toFixed(2)}h)`;
                          }

                          logRows.push({
                            key: `${r.empleado.id}_${d.isoDate}`,
                            empId: r.empleado.id,
                            empName: r.empleado.nombre,
                            isoDate: d.isoDate,
                            dayName: d.dayName,
                            badge,
                            badgeClass,
                            detail,
                            note: d.notaSupervisorDia,
                            file: d.formatoSubidoNombre,
                          });
                        }
                      });
                    });

                    if (logRows.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          Aún no se han realizado modificaciones en esta lista.
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {logRows.map(item => (
                          <div
                            key={item.key}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-slate-100">
                                <span className="font-mono text-blue-300 mr-1">#{item.empId}</span>
                                {item.empName}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.badgeClass}`}>
                                {item.badge}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300">
                              {item.dayName} {item.isoDate} — {item.detail}
                            </div>
                            {item.note && (
                              <div className="text-[11px] text-slate-400 italic">
                                Nota: &ldquo;{item.note}&rdquo;
                              </div>
                            )}
                            {item.file && (
                              <div className="text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" /> Respaldo: {item.file}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TABLA INTERACTIVA DEL SUPERVISOR PARA TRABAJAR LA LISTA DESDE EL SISTEMA */}
              <AttendanceTable
                reports={filteredWeeklyReports}
                onUpdateDayIncidence={onUpdateDayIncidence}
                onUpdateDayTimes={onUpdateDayTimes}
                onUpdateDayNote={onUpdateDayNote}
                onOpenFormatAssistant={(employee, day, mode) =>
                  setFormatModalTarget({ employee, day, mode })
                }
                onQuickConfirmFalta={onQuickConfirmFalta}
                horarios={horarios}
                filteredCount={activeListWeeklyReports.length}
                isSupervisorMode={true}
                onToggleOvertimeApproval={onToggleOvertimeApproval}
              />
            </>
          )}
        </div>
      )}

      {/* MÓDULO 2: MI EQUIPO ASIGNADO Y CONSULTA DE HORARIOS PROGRAMADOS (SOLO LECTURA PARA SUPERVISOR) */}
      {activeModule === 'equipo' && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Colaboradores Asignados a {targetSupervisor} y Horarios Vigentes
              </h3>
              <p className="text-xs text-slate-400">
                Consulta el horario asignado por Recursos Humanos a cada colaborador y de qué hora a qué hora comprende su jornada.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Buscador de Colaboradores */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por ID (ej. 00615) o Nombre..."
                  value={searchEmployeeQuery}
                  onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {filteredTeam.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">No se encontraron empleados asignados con ese criterio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTeam.map((emp) => {
                const report = activeListWeeklyReports.find(r => r.empleado.id === emp.id);
                const schCode = emp.horario && horarios[emp.horario] ? emp.horario : 'ADMO';
                const schConfig = horarios[schCode];
                const schHoursText = formatScheduleHoursSummary(schConfig);

                return (
                  <div
                    key={emp.id}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between hover-lift"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                          ID: #{emp.id}
                        </span>
                        <span className="text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded px-2 py-0.5 font-bold flex items-center gap-1">
                          <CalendarClock className="w-3 h-3 text-amber-400" />
                          {schCode}: {schConfig?.nombre || 'Administrativo'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 mt-2 line-clamp-1">
                        {emp.nombre}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {emp.puesto || 'Puesto Operativo'}
                      </p>

                      {/* Detalle de qué hora a qué hora es su horario asignado */}
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 text-[10px] font-mono text-amber-200/90">
                        <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block mb-0.5">
                          Horario Asignado (Entrada a Salida):
                        </span>
                        <span>{schHoursText}</span>
                      </div>

                      {/* Métricas rápidas si ya se dispersó asistencia */}
                      {report && (
                        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-800 text-center font-mono">
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[8px] text-slate-500 block uppercase">Normal</span>
                            <span className="text-[11px] font-bold text-slate-300">{report.totalNormal.toFixed(1)}h</span>
                          </div>
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[8px] text-slate-500 block uppercase">Extra</span>
                            <span className="text-[11px] font-bold text-amber-400">{report.totalExtra.toFixed(1)}h</span>
                          </div>
                          <div className="p-1 rounded bg-slate-950">
                            <span className="text-[8px] text-slate-500 block uppercase">Asist.</span>
                            <span className="text-[11px] font-bold text-emerald-400">{report.asistencias}d</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        Jefe: {emp.jefe || targetSupervisor}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenNewIncidentModal(emp.id)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Palmtree className="w-3 h-3" />
                        <span>Solicitar Incidencia</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MÓDULO 3: SOLICITUDES E INCIDENCIAS */}
      {activeModule === 'solicitudes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Mis Solicitudes y Formatos Enviados a RH
              </h3>
              <p className="text-xs text-slate-400">
                Bandeja privada: Incluye las solicitudes y formatos de checada/permiso que has ingresado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenNewIncidentModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md self-start sm:self-auto cursor-pointer"
            >
              <Palmtree className="w-3.5 h-3.5" />
              <span>+ Nueva Solicitud</span>
            </button>
          </div>

          {teamIncidents.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
              <Palmtree className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">No hay solicitudes registradas aún para tu equipo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {teamIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {inc.tipo === 'Otro' && inc.especificacionOtro
                          ? `Otra Justificación: ${inc.especificacionOtro}`
                          : inc.tipo}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200">
                        {inc.esParaMi ? `${inc.empleadoNombre} (Supervisor)` : `${inc.empleadoNombre} (#${inc.empleadoId})`}
                      </h4>
                      {inc.status === 'aprobada' && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Aprobada por RH
                        </span>
                      )}
                      {inc.status === 'pendiente' && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Pendiente de Revisión
                        </span>
                      )}
                      {inc.status === 'rechazada' && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Rechazada
                        </span>
                      )}
                      {inc.archivoFormatoNombre && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" /> {inc.archivoFormatoNombre}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{inc.fechaInicio} al {inc.fechaFin}</span>
                      {inc.entradaPropuesta && inc.salidaPropuesta && (
                        <span className="text-purple-300">
                          • Checada validada: {inc.entradaPropuesta} - {inc.salidaPropuesta}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-1.5 italic">
                      &ldquo;{inc.motivo}&rdquo;
                    </p>

                    {inc.notasResolucion && (
                      <div className="mt-2 text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-400">
                        <strong className="text-slate-300">Respuesta de RH:</strong> {inc.notasResolucion}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono self-end md:self-center">
                    Enviado: {new Date(inc.fechaCreacion).toLocaleDateString('es-MX')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL ASISTENTE: GENERAR FORMATO DE CHECADA SIN GAFETE / PERMISO / CONFIRMAR FALTA */}
      {formatModalTarget && (
        <MissingPunchFormatModal
          employee={formatModalTarget.employee}
          day={formatModalTarget.day}
          initialMode={formatModalTarget.mode}
          supervisorName={targetSupervisor}
          onClose={() => setFormatModalTarget(null)}
          onConfirmResolution={(payload) => {
            onResolveMissingPunchDay(payload);
            setFormatModalTarget(null);
          }}
        />
      )}

      {/* MODAL: LIBERAR NÓMINA TRABAJADA A RH (DESDE EL SISTEMA O ADJUNTANDO EXCEL) */}
      {isWorkingOnRelease &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto my-auto shadow-2xl animate-scale-in">
              {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Liberar Lista de Nómina Trabajada a RH
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Semana {currentWeekNumber} • Supervisor: {targetSupervisor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkingOnRelease(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <div className="p-5 space-y-4 text-xs">
              {/* Resumen automático de modificaciones realizadas por el supervisor en el sistema */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                  Resumen de tu Lista Trabajada en el Sistema:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/30">
                    <span className="text-[9px] text-purple-300 block uppercase">Checadas Agregadas</span>
                    <span className="text-sm font-bold text-purple-200">{stats.supAddedPunchesCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-500/30">
                    <span className="text-[9px] text-blue-300 block uppercase">Formatos Subidos</span>
                    <span className="text-sm font-bold text-blue-200">{stats.formatsUploadedCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30">
                    <span className="text-[9px] text-rose-300 block uppercase">Faltas Confirmadas</span>
                    <span className="text-sm font-bold text-rose-200">{stats.confirmedFaltasCount}</span>
                  </div>
                </div>
                {/* Desglose detallado de pendientes que impiden la liberación */}
                {stats.hasPendingTasks && (
                  <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 space-y-3">
                    <p className="text-[11px] font-bold flex items-start gap-1.5 text-rose-100">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        🚫 No puedes liberar la nómina todavía. Tienes las siguientes tareas pendientes:
                      </span>
                    </p>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {/* Tiempos extras sin autorizar */}
                      {stats.pendingOvertimeItems.map(({ employee, day }) => (
                        <div
                          key={`modal-ot-${employee.id}-${day.isoDate}`}
                          className="p-2 rounded bg-slate-950/90 border border-amber-500/40 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div>
                            <span className="font-mono font-bold text-amber-300">#{employee.id}</span>{' '}
                            <span className="text-slate-200">{employee.nombre}</span>
                            <div className="text-[10px] text-amber-400/90 font-mono">
                              {day.dayName} {day.isoDate} • {day.hExtra.toFixed(2)}h extras pendientes de autorizar (SÍ / NO)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsWorkingOnRelease(false)}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[#171821] font-extrabold text-[10px] cursor-pointer shrink-0"
                          >
                            Ir a Autorizar
                          </button>
                        </div>
                      ))}

                      {/* Checadas incompletas */}
                      {stats.pendingMissingPunchItems.map(({ employee, day }) => (
                        <div
                          key={`modal-miss-${employee.id}-${day.isoDate}`}
                          className="p-2 rounded bg-slate-950/90 border border-rose-500/40 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div>
                            <span className="font-mono font-bold text-rose-300">#{employee.id}</span>{' '}
                            <span className="text-slate-200">{employee.nombre}</span>
                            <div className="text-[10px] text-rose-400/90 font-mono">
                              {day.dayName} {day.isoDate} • Ent: {day.entrada} | Sal: {day.salida} (Falta checada o permiso)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsWorkingOnRelease(false);
                              setFormatModalTarget({
                                employee,
                                day,
                                mode: 'checada_sin_gafete',
                              });
                            }}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer shrink-0"
                          >
                            Resolver Checada
                          </button>
                        </div>
                      ))}

                      {/* Checadas agregadas sin archivo de respaldo */}
                      {stats.blockingNoFormatItems.map(({ employee, day }) => (
                        <div
                          key={`modal-fmt-${employee.id}-${day.isoDate}`}
                          className="p-2 rounded bg-slate-950/90 border border-purple-500/40 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div>
                            <span className="font-mono font-bold text-purple-300">#{employee.id}</span>{' '}
                            <span className="text-slate-200">{employee.nombre}</span>
                            <div className="text-[10px] text-purple-400/90 font-mono">
                              {day.dayName} {day.isoDate} • Agregada sin checadas originales (requiere adjunto firmado)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsWorkingOnRelease(false);
                              setFormatModalTarget({
                                employee,
                                day,
                                mode: 'checada_sin_gafete',
                              });
                            }}
                            className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] cursor-pointer shrink-0"
                          >
                            📎 Adjuntar Respaldo
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Opción de adjuntar archivo Excel adicional si también lo trabajó por fuera */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Opcional: Adjuntar Archivo Excel Trabajado (.xlsx)
                </label>
                <div className="p-3.5 rounded-xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-slate-700 text-center relative cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 mx-auto text-blue-400 mb-1" />
                  {workedFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-400">{workedFile.nombre}</p>
                      <p className="text-[10px] text-slate-400">Archivo listo para enviar a RH</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-300">
                        Si trabajaste la lista aquí en el sistema no necesitas subir Excel (o haz clic para adjuntar uno)
                      </p>
                    </div>
                  )}
                </div>
                {uploadError && (
                  <p className="text-rose-400 text-[10px] mt-1 font-semibold">{uploadError}</p>
                )}
              </div>

              {/* Observaciones generales */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Comentarios y Notas de Liberación para RH / Nóminas
                </label>
                <textarea
                  rows={3}
                  value={releaseComments}
                  onChange={(e) => setReleaseComments(e.target.value)}
                  placeholder="Ej: Lista revisada y validada en sistema. Se anexaron formatos de checada sin gafete y se confirmaron faltas..."
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-[11px]">
                Al liberar, Recursos Humanos recibirá tu lista con todas las <strong>checadas agregadas por supervisor marcadas en color violeta</strong>, tus formatos adjuntos y las faltas confirmadas.
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWorkingOnRelease(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLiberacion}
                  disabled={stats.hasPendingTasks}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 transition-all ${
                    stats.hasPendingTasks
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {stats.hasPendingTasks
                      ? `Tienes ${stats.pendingOvertimeItems.length + stats.pendingMissingPunchItems.length + stats.blockingNoFormatItems.length} tarea(s) pendiente(s)`
                      : 'Confirmar y Liberar Nómina a RH'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
