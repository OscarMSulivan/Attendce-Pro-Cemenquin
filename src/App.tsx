/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SidebarNav } from './components/SidebarNav';
import { StatsPanel } from './components/StatsPanel';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { FileDropzoneSection } from './components/FileDropzoneSection';
import { ControlsBar } from './components/ControlsBar';
import { AttendanceTable } from './components/AttendanceTable';
import { ScheduleModal } from './components/ScheduleModal';
import { AssignScheduleModal } from './components/AssignScheduleModal';
import { RawPunchAuditModal } from './components/RawPunchAuditModal';
import { ConfigModal } from './components/ConfigModal';
import { OvertimeConfigModal } from './components/OvertimeConfigModal';

import { 
  AppConfig, 
  DEFAULT_OVERTIME_RULES,
  Employee, 
  EmployeeReport, 
  EventsDB, 
  OvertimeRulesConfig,
  PayrollSummary, 
  ReadingMode, 
  ScheduleConfig 
} from './types/attendance';
import { 
  generatePayrollWeeks, 
  PayrollWeekOption,
  detectPayrollWeekFromDates
} from './utils/calendarUtils';

import { 
  StorageService 
} from './services/storageService';
import { 
  calcularMetricasDia,
  consolidarEventosConHorarios, 
  generarReporteAsistencia 
} from './core/attendanceEngine';
import { parseEmployeesFile } from './parsers/employeeParser';
import { parseBiometricEventsFile } from './parsers/biometricParser';
import { parseVacationsFile } from './parsers/vacationParser';
import {
  exportPayrollExcelBySupervisor,
  exportAllSupervisorPayrollsExcel,
} from './services/excelExportService';
import saveAs from 'file-saver';

// Importaciones del Portal RH y Supervisores
import { UserSessionBar } from './components/portal/UserSessionBar';
import { RHPayrollMonitorView } from './components/portal/RHPayrollMonitorView';
import { SupervisorWorkspaceView } from './components/portal/SupervisorWorkspaceView';
import { IncidentsManagementView } from './components/portal/IncidentsManagementView';
import { AdminUsersView } from './components/portal/AdminUsersView';
import { NewIncidentModal } from './components/portal/NewIncidentModal';
import { SupervisorReleaseModal } from './components/portal/SupervisorReleaseModal';
import { SendPayrollEmailModal } from './components/portal/SendPayrollEmailModal';
import { ContpaqiExportView } from './components/portal/ContpaqiExportView';
import { LoginView } from './components/portal/LoginView';
import { DayResolutionPayload } from './components/portal/MissingPunchFormatModal';
import { WelcomeDashboard } from './components/portal/WelcomeDashboard';
import {
  DispersionModeSelector,
  DispersionWorkspaceMode,
} from './components/portal/DispersionModeSelector';
import { PortalService } from './services/portalService';
import { PushNotificationService } from './services/pushNotificationService';
import {
  PortalUser,
  IncidentRequest,
  PayrollRelease,
  PayrollDispersal,
  PortalNotification,
  PayrollModificationLog,
  IncidentType,
  EmailServerConfig,
  getUserAllowedLists,
  userHasModuleAccess,
  userHasAnyAdminPanelAccess,
  doesIncidentSkipRHValidation,
} from './types/portal';
import { ListChecks, Send, Mail, CheckCircle2 } from 'lucide-react';
import { ToastContainer, ToastItem, ToastType } from './components/Toast';


export default function App() {
  // Configuración y persistencia
  const [config, setConfig] = useState<AppConfig>(StorageService.loadConfig);
  const [horarios, setHorarios] = useState<Record<string, ScheduleConfig>>(StorageService.loadHorarios);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>(StorageService.loadAsignaciones);
  const [savedEmployeesInfo, setSavedEmployeesInfo] = useState<{ count: number; savedAt: string } | null>(null);

  // Bases de datos en memoria
  const [empleadosDB, setEmpleadosDB] = useState<Record<string, Employee>>({});
  const [eventosDB, setEventosDB] = useState<EventsDB>({});
  const [vacacionesDB, setVacacionesDB] = useState<Record<string, Record<string, string>>>({});

  // Carga y estado
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isLoadingVacations, setIsLoadingVacations] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingAll, setIsExportingAll] = useState<boolean>(false);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState<boolean>(false);

  // Semanas de nómina
  const payrollWeeks = useMemo<PayrollWeekOption[]>(() => generatePayrollWeeks(2026), []);
  const [selectedWeek, setSelectedWeek] = useState<string>(
    () => StorageService.loadReportesState()?.selectedWeek || payrollWeeks[0]?.value || ''
  );
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [emailDestino, setEmailDestino] = useState<string>(config.emailDestino || '');

  // Mensaje de estado
  const [statusMessage, setStatusMessage] = useState<string>('Esperando archivos de nómina...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  // Sistema de notificaciones Toast flotantes para feedback de acciones masivas y cambios críticos
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', title?: string, duration = 4500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, message, title, duration };
    setToasts(prev => [newToast, ...prev.slice(0, 3)]);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Reporte calculado (hidratado inicialmente desde localStorage para nunca perder ediciones locales)
  const [reportes, setReportes] = useState<EmployeeReport[]>(
    () => StorageService.loadReportesState()?.reportes || []
  );
  const [resumen, setResumen] = useState<PayrollSummary | null>(
    () => StorageService.loadReportesState()?.resumen || null
  );

  // Modales
  const [isSchedulesOpen, setIsSchedulesOpen] = useState<boolean>(false);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [isRawPunchesOpen, setIsRawPunchesOpen] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isOvertimeConfigOpen, setIsOvertimeConfigOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Estado del Portal Multirrol (Admin, RH, Supervisores)
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>(() => PortalService.loadUsers());
  const [activeUserId, setActiveUserId] = useState<string>(() => PortalService.loadActiveUserId());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => PortalService.isSessionAuthenticated());
  const [portalTab, setPortalTab] = useState<string>('nomina');
  const [dispersionMode, setDispersionMode] = useState<DispersionWorkspaceMode>('prompt');
  const [incidents, setIncidents] = useState<IncidentRequest[]>(() => PortalService.loadIncidents());
  const [releases, setReleases] = useState<Record<string, PayrollRelease>>(() => PortalService.loadReleases());
  const [dispersals, setDispersals] = useState<PayrollDispersal[]>(() => PortalService.loadDispersals());
  const [notifications, setNotifications] = useState<PortalNotification[]>(() => PortalService.loadNotifications());
  const [emailConfig, setEmailConfig] = useState<EmailServerConfig>(() => PortalService.loadEmailConfig());
  const [isNewIncidentModalOpen, setIsNewIncidentModalOpen] = useState<boolean>(false);
  const [initialIncidentEmployeeId, setInitialIncidentEmployeeId] = useState<string | undefined>(undefined);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState<boolean>(false);
  const [isDisperseByListModalOpen, setIsDisperseByListModalOpen] = useState<boolean>(false);
  const [disperseByListMsg, setDisperseByListMsg] = useState<string>('');
  const [disperseSendEmail, setDisperseSendEmail] = useState<boolean>(true);

  const [isServerHydrated, setIsServerHydrated] = useState<boolean>(false);

  // Hidratar estado completo desde el servidor Express (/api/portal/state) en Hostinger KVM 2
  useEffect(() => {
    PortalService.fetchServerState()
      .then(serverData => {
        if (serverData) {
          if (serverData.users && serverData.users.length > 0) {
            setPortalUsers(serverData.users.map(u => PortalService.normalizeUserRecord(u)));
          }
          if (serverData.incidents) {
            setIncidents(serverData.incidents);
          }
          if (serverData.releases) {
            setReleases(serverData.releases);
          }
          if (serverData.dispersals) {
            setDispersals(serverData.dispersals);
          }
          if (serverData.notifications) {
            setNotifications(serverData.notifications);
          }
          if (serverData.horarios && Object.keys(serverData.horarios).length > 0) {
            setHorarios(serverData.horarios);
            StorageService.saveHorarios(serverData.horarios);
          }
          if (serverData.asignaciones && Object.keys(serverData.asignaciones).length > 0) {
            setAsignaciones(serverData.asignaciones);
            StorageService.saveAsignaciones(serverData.asignaciones);
          }
          const serverEmailCfg =
            (serverData as any).emailConfig ||
            (serverData.config && typeof serverData.config === 'object'
              ? serverData.config.emailServer
              : undefined);

          if (serverEmailCfg && typeof serverEmailCfg === 'object') {
            const mergedEmail = {
              ...PortalService.loadEmailConfig(),
              ...serverEmailCfg,
            };
            setEmailConfig(mergedEmail);
            PortalService.saveEmailConfig(mergedEmail);
          }

          if (serverData.config && Object.keys(serverData.config).length > 0) {
            setConfig(prev => ({
              ...prev,
              ...serverData.config,
              ...(serverEmailCfg ? { emailServer: { ...PortalService.loadEmailConfig(), ...serverEmailCfg } } : {}),
            }));
          }

          if (serverData.empleadosDB && Object.keys(serverData.empleadosDB).length > 0) {
            setEmpleadosDB(serverData.empleadosDB);
            StorageService.saveEmployees(serverData.empleadosDB);
            setSavedEmployeesInfo({
              count: Object.keys(serverData.empleadosDB).length,
              savedAt: new Date().toISOString(),
            });
          } else {
            const localSaved = StorageService.loadSavedEmployees();
            if (localSaved && Object.keys(localSaved.empleados).length > 0) {
              setEmpleadosDB(localSaved.empleados);
            }
          }
          const hydratedHorarios =
            serverData.horarios && Object.keys(serverData.horarios).length > 0
              ? serverData.horarios
              : horarios;
          const hydratedEmpleados =
            serverData.empleadosDB && Object.keys(serverData.empleadosDB).length > 0
              ? serverData.empleadosDB
              : StorageService.loadSavedEmployees()?.empleados || empleadosDB;
          const hydratedVacaciones =
            serverData.vacacionesDB && Object.keys(serverData.vacacionesDB).length > 0
              ? serverData.vacacionesDB
              : vacacionesDB;
          const hydratedConfig =
            serverData.config && Object.keys(serverData.config).length > 0
              ? { ...config, ...serverData.config }
              : config;
          const hydratedWeek = serverData.selectedWeek || selectedWeek;

          if (serverData.vacacionesDB && Object.keys(serverData.vacacionesDB).length > 0) {
            setVacacionesDB(serverData.vacacionesDB);
          }
          if (serverData.selectedWeek) {
            setSelectedWeek(serverData.selectedWeek);
          }

          // Combinar reportes guardados en servidor y en localStorage para preservar cualquier modificación de incidencias
          const localRepState = StorageService.loadReportesState();
          const localReports =
            localRepState &&
            (!localRepState.selectedWeek || localRepState.selectedWeek === hydratedWeek)
              ? localRepState.reportes
              : [];
          const serverReports: EmployeeReport[] = Array.isArray(serverData.reportes)
            ? serverData.reportes
            : [];

          const findSavedDay = (empId: string, isoDate: string) => {
            const localEmp = localReports.find(r => r.empleado.id === empId);
            const localDay = localEmp?.dias.find(d => d.isoDate === isoDate);
            const srvEmp = serverReports.find(r => r.empleado.id === empId);
            const srvDay = srvEmp?.dias.find((d: any) => d.isoDate === isoDate);
            if (localDay && localDay.modificadoPorSupervisor) return localDay;
            if (srvDay && srvDay.modificadoPorSupervisor) return srvDay;
            return localDay || srvDay;
          };

          if (serverData.eventosDB && Object.keys(serverData.eventosDB).length > 0) {
            const reconsolidado = consolidarEventosConHorarios(
              serverData.eventosDB,
              hydratedEmpleados,
              hydratedHorarios,
              {
                modoLectura: hydratedConfig.modoLectura,
                minutosRebote: hydratedConfig.minutosRebote,
              }
            );
            setEventosDB(reconsolidado);

            if (
              (serverReports.length > 0 || localReports.length > 0) &&
              hydratedWeek &&
              Object.keys(hydratedEmpleados).length > 0
            ) {
              const [startISO, endISO] = hydratedWeek.split('|');
              const { reportes: recalculados } = generarReporteAsistencia(
                Object.values(hydratedEmpleados),
                reconsolidado,
                hydratedVacaciones,
                hydratedHorarios,
                startISO,
                endISO,
                {
                  jornadaBase: hydratedConfig.jornadaBase,
                  modoLectura: hydratedConfig.modoLectura,
                  minutosRebote: hydratedConfig.minutosRebote,
                  overtimeRules: hydratedConfig.overtimeRules || DEFAULT_OVERTIME_RULES,
                }
              );

              const merged = recalculados.map(newRep => {
                let sumN = 0;
                let sumE = 0;
                let empAsist = 0;
                let empFaltas = 0;
                let empRet = 0;

                const diasMerged = newRep.dias.map(nd => {
                  const pd = findSavedDay(newRep.empleado.id, nd.isoDate);
                  const wasEdited =
                    pd &&
                    (pd.modificadoPorSupervisor ||
                      Boolean(pd.notaSupervisorDia) ||
                      pd.horasExtrasAutorizadas !== undefined ||
                      Boolean(pd.formatoSubidoNombre) ||
                      (pd.incidencia !== undefined && pd.incidencia !== nd.incidencia));

                  const chosen = wasEdited
                    ? {
                        ...pd,
                        modificadoPorSupervisor: Boolean(
                          pd.modificadoPorSupervisor || pd.incidencia !== nd.incidencia
                        ),
                        horarioProgramado: nd.horarioProgramado,
                      }
                    : nd;

                  sumN += chosen.hNormal;
                  if (chosen.horasExtrasAutorizadas === true) sumE += chosen.hExtra;
                  const incUp = (chosen.incidencia || '').toUpperCase();
                  if (chosen.incidencia === 'Asistencia') empAsist++;
                  else if (incUp.includes('FALTA')) empFaltas++;
                  else if (incUp.includes('RETARDO')) empRet++;
                  return chosen;
                });

                const esPerfecta = empFaltas === 0 && empRet === 0 && empAsist > 0;
                return {
                  ...newRep,
                  dias: diasMerged,
                  totalNormal: sumN,
                  totalExtra: sumE,
                  asistencias: empAsist,
                  faltas: empFaltas,
                  retardos: empRet,
                  asistenciaPerfecta: esPerfecta,
                };
              });

              setReportes(merged);
              if (serverData.resumen) {
                setResumen(serverData.resumen);
              }
            } else if (serverReports.length > 0) {
              setReportes(serverReports);
              if (serverData.resumen) {
                setResumen(serverData.resumen);
              }
            }
          } else {
            if (serverReports.length > 0) {
              setReportes(serverReports);
            }
            if (serverData.resumen) {
              setResumen(serverData.resumen);
            }
          }
        }
      })
      .finally(() => {
        setIsServerHydrated(true);
      });
  }, []);

  // Guardar inmediatamente en localStorage cada vez que cambian reportes, resumen o semana seleccionada
  useEffect(() => {
    if (reportes.length > 0) {
      StorageService.saveReportesState({
        reportes,
        resumen,
        selectedWeek,
      });
    }
  }, [reportes, resumen, selectedWeek]);

  // Guardar automáticamente en el servidor Hostinger KVM 2 cualquier cambio en empleados, checadas, reportes trabajados o configuración
  useEffect(() => {
    if (!isServerHydrated) return;
    const timer = setTimeout(() => {
      PortalService.pushToServer({
        empleadosDB,
        eventosDB,
        vacacionesDB,
        reportes,
        resumen,
        selectedWeek,
        horarios,
        asignaciones,
        config: {
          ...config,
          emailServer: emailConfig,
        },
        emailConfig,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    isServerHydrated,
    empleadosDB,
    eventosDB,
    vacacionesDB,
    reportes,
    resumen,
    selectedWeek,
    horarios,
    asignaciones,
    config,
    emailConfig,
  ]);

  // Revisión periódica (cada 45s) de alertas automáticas cuando el plazo de liberación está por vencer
  useEffect(() => {
    if (!isServerHydrated) return;
    const hasActiveDispersalWithDeadline = dispersals.some(
      d => !d.cancelada && Boolean(d.limiteLiberacion)
    );
    if (!hasActiveDispersalWithDeadline) return;

    const checkExpiring = () => {
      if (typeof window === 'undefined' || window.location.protocol === 'file:') return;
      fetch('/api/notifications/check-expiring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data && data.ok && data.remindersSent > 0) {
            if (Array.isArray(data.dispersals)) {
              setDispersals(data.dispersals);
              PortalService.saveDispersals(data.dispersals);
            }
            if (Array.isArray(data.notifications)) {
              setNotifications(data.notifications);
              PortalService.saveNotifications(data.notifications);
            }
            showToast(
              `Se envió alerta automática por vencimiento próximo a ${data.remindersSent} supervisor(es) con nómina pendiente.`,
              'warning',
              'Alerta Automática por Vencimiento'
            );
          }
        })
        .catch(() => {});
    };

    checkExpiring();
    const interval = setInterval(checkExpiring, 45000);
    return () => clearInterval(interval);
  }, [isServerHydrated, dispersals, showToast]);

  // Usuario actual en sesión
  const currentUser = useMemo<PortalUser>(() => {
    return portalUsers.find(u => u.id === activeUserId) || portalUsers[0];
  }, [portalUsers, activeUserId]);

  // Sincronización automática de incidencias y vacaciones aprobadas con el motor de cálculo
  useEffect(() => {
    const approvedVacations = PortalService.extractApprovedIncidentsAsVacationsDB(incidents);
    setVacacionesDB(prev => {
      const merged = { ...prev };
      Object.keys(approvedVacations).forEach(empId => {
        merged[empId] = { ...(merged[empId] || {}), ...approvedVacations[empId] };
      });
      return merged;
    });
  }, [incidents]);

  // Referencias para detectar nuevos eventos en tiempo real sin duplicar alertas Push
  const knownNotifIdsRef = useRef<Set<string>>(new Set(notifications.map(n => n.id)));
  const knownIncidentStatusRef = useRef<Map<string, string>>(
    new Map(incidents.map(inc => [inc.id, inc.status]))
  );
  const knownReleasesRef = useRef<Map<string, string>>(
    new Map(Object.entries(releases).map(([k, v]) => [k, v.status]))
  );

  useEffect(() => {
    notifications.forEach(n => knownNotifIdsRef.current.add(n.id));
  }, [notifications]);

  useEffect(() => {
    incidents.forEach(inc => knownIncidentStatusRef.current.set(inc.id, inc.status));
  }, [incidents]);

  useEffect(() => {
    Object.entries(releases).forEach(([k, v]) => knownReleasesRef.current.set(k, v.status));
  }, [releases]);

  // Suscripción a eventos en tiempo real (Server-Sent Events + BroadcastChannel + Web Push API) sin recargar la página
  useEffect(() => {
    PushNotificationService.initServiceWorker();

    const unsubNav = PushNotificationService.onNotificationNavigate(data => {
      if (data.supervisor) {
        setSelectedSupervisor(data.supervisor);
      }
      if (data.targetTab) {
        setPortalTab(data.targetTab);
      }
    });

    const unsubStream = PushNotificationService.subscribe(payload => {
      const incomingState = payload.state;
      if (!incomingState) return;

      // 1. Actualizar usuarios si cambiaron
      if (Array.isArray(incomingState.users) && incomingState.users.length > 0) {
        const normalizedUsers = incomingState.users.map(u => PortalService.normalizeUserRecord(u));
        setPortalUsers(normalizedUsers);
      }

      // 2. Detectar nuevas notificaciones dirigidas al supervisor o RH en tiempo real
      if (Array.isArray(incomingState.notifications)) {
        const freshNotifs = incomingState.notifications.filter(
          n => !knownNotifIdsRef.current.has(n.id)
        );
        freshNotifs.forEach(n => knownNotifIdsRef.current.add(n.id));
        setNotifications(incomingState.notifications);

        if (isAuthenticated && currentUser && freshNotifs.length > 0) {
          const relevantNotifs = freshNotifs.filter(n =>
            PushNotificationService.isSupervisorTargetMatch(
              currentUser,
              n.targetSupervisor,
              n.targetUserId
            )
          );
          relevantNotifs.forEach(n => {
            const isCancel = n.titulo.toLowerCase().includes('cancelada');
            const isUrgent = n.titulo.toLowerCase().includes('vencer') || n.titulo.toLowerCase().includes('urgente');
            const isScheduleOrIncident =
              n.titulo.toLowerCase().includes('horario') ||
              n.titulo.toLowerCase().includes('incidencia');
            const targetTab = isScheduleOrIncident
              ? 'incidencias'
              : currentUser.role === 'supervisor'
              ? 'trabajar_listas'
              : 'semaforo';

            showToast(
              n.mensaje,
              isCancel || isUrgent ? 'warning' : 'info',
              n.titulo,
              6500
            );
            PushNotificationService.showNativeNotification({
              title: n.titulo,
              body: n.mensaje,
              tag: n.id,
              requireInteraction: isUrgent || isCancel,
              targetTab,
              supervisor: n.targetSupervisor !== 'ALL' ? n.targetSupervisor : undefined,
              semana: n.semanaNumero,
              soundKind: isCancel || isUrgent ? 'warning' : 'info',
            });
          });
        }
      }

      // 3. Detectar nuevas incidencias o cambios de estatus en incidencias en tiempo real
      if (Array.isArray(incomingState.incidents)) {
        const prevMap = knownIncidentStatusRef.current;
        const allowedSupLists = getUserAllowedLists(currentUser).map(s => s.toUpperCase());

        incomingState.incidents.forEach(inc => {
          const prevStatus = prevMap.get(inc.id);
          const incSup = (inc.supervisorNombre || '').toUpperCase();
          const belongsToSupervisor =
            inc.solicitanteId === currentUser?.id || allowedSupLists.includes(incSup);

          if (!prevStatus) {
            // Nueva incidencia creada en otra sesión
            prevMap.set(inc.id, inc.status);
            if (isAuthenticated && currentUser) {
              if (
                currentUser.role === 'admin' ||
                currentUser.role === 'rh' ||
                belongsToSupervisor
              ) {
                const title = `📋 Nueva Incidencia: ${inc.tipo}`;
                const body = `${inc.empleadoNombre} (#${inc.empleadoId}) · Lista ${inc.supervisorNombre} (${
                  inc.autoAprobadaPorSupervisor ? 'Aprobada por Supervisor' : 'Pendiente de revisión'
                })`;
                showToast(body, 'info', title, 5500);
                PushNotificationService.showNativeNotification({
                  title,
                  body,
                  tag: `inc_new_${inc.id}`,
                  targetTab: 'incidencias',
                  supervisor: inc.supervisorNombre,
                  soundKind: 'info',
                });
              }
            }
          } else if (prevStatus !== inc.status) {
            // Cambio de estatus (Aprobada / Rechazada por RH)
            prevMap.set(inc.id, inc.status);
            if (isAuthenticated && currentUser && belongsToSupervisor) {
              const isApproved = inc.status === 'aprobada';
              const title = isApproved
                ? `✅ Incidencia Aprobada: ${inc.tipo}`
                : `⚠️ Incidencia Rechazada: ${inc.tipo}`;
              const body = `Solicitud de ${inc.empleadoNombre} (#${inc.empleadoId}) fue ${inc.status} por ${
                inc.revisadoPor || 'RH'
              }.${inc.notasResolucion ? ` Nota: ${inc.notasResolucion}` : ''}`;
              showToast(body, isApproved ? 'success' : 'warning', title, 6000);
              PushNotificationService.showNativeNotification({
                title,
                body,
                tag: `inc_status_${inc.id}_${inc.status}`,
                targetTab: 'incidencias',
                supervisor: inc.supervisorNombre,
                soundKind: isApproved ? 'success' : 'warning',
              });
            }
          }
        });

        setIncidents(incomingState.incidents);
      }

      // 4. Actualizar dispersiones en tiempo real sin recargar la página
      if (Array.isArray(incomingState.dispersals)) {
        setDispersals(incomingState.dispersals);
      }

      // 5. Detectar liberaciones de nómina en tiempo real
      if (incomingState.releases && typeof incomingState.releases === 'object') {
        const prevRelMap = knownReleasesRef.current;
        Object.entries(incomingState.releases).forEach(([relKey, relObj]) => {
          if (!relObj) return;
          const prevRelStatus = prevRelMap.get(relKey);
          if (prevRelStatus !== relObj.status) {
            prevRelMap.set(relKey, relObj.status);
            if (
              isAuthenticated &&
              currentUser &&
              relObj.status === 'liberado' &&
              (currentUser.role === 'admin' || currentUser.role === 'rh')
            ) {
              const title = `🟢 Nómina Liberada — ${relObj.supervisorNombre}`;
              const body = `${relObj.liberadoPor || relObj.supervisorNombre} liberó la lista ${
                relObj.supervisorNombre
              } (Semana ${relObj.semanaNumero}) con ${relObj.empleadosCount} colaboradores.`;
              showToast(body, 'success', title, 6000);
              PushNotificationService.showNativeNotification({
                title,
                body,
                tag: `rel_${relKey}`,
                targetTab: 'semaforo',
                supervisor: relObj.supervisorNombre,
                semana: relObj.semanaNumero,
                soundKind: 'success',
              });
            }
          }
        });
        setReleases(incomingState.releases);
      }

      // 6. Actualizar reportes en vivo si el supervisor o RH está visualizando la semana activa
      if (Array.isArray(incomingState.reportes) && incomingState.reportes.length > 0) {
        setReportes(incomingState.reportes);
        if (incomingState.resumen) {
          setResumen(incomingState.resumen);
        }
      }
    });

    return () => {
      unsubNav();
      unsubStream();
    };
  }, [isAuthenticated, currentUser, showToast]);

  // Cargar estado inicial de empleados guardados
  useEffect(() => {
    const saved = StorageService.loadSavedEmployees();
    if (saved && saved.empleados && Object.keys(saved.empleados).length > 0) {
      setSavedEmployeesInfo({
        count: Object.keys(saved.empleados).length,
        savedAt: saved.savedAt
      });
    }
  }, []);

  // Lista de supervisores activos en el catálogo
  const supervisorsList = useMemo(() => {
    const list = [...new Set(Object.values(empleadosDB).map(e => e.jefe).filter(Boolean))].sort();
    return list;
  }, [empleadosDB]);

  // Supervisores / Listas permitidas para el Módulo "Trabajar Listas" según las listas asignadas al usuario
  const workListSupervisors = useMemo(() => {
    const explicitLists = getUserAllowedLists(currentUser);
    if (explicitLists.length > 0) {
      return explicitLists;
    }
    if (currentUser.role === 'admin' || userHasModuleAccess(currentUser, 'nomina')) {
      return supervisorsList;
    }
    return [];
  }, [currentUser, supervisorsList]);

  // Supervisores disponibles en el filtro global de Dispersión de Nómina
  const allowedSupervisors = useMemo(() => {
    if (
      currentUser.role === 'admin' ||
      currentUser.role === 'rh' ||
      userHasModuleAccess(currentUser, 'nomina')
    ) {
      return supervisorsList;
    }
    return workListSupervisors;
  }, [currentUser, supervisorsList, workListSupervisors]);

  // Sincronizar pestaña activa si el usuario cambia y no tiene permiso para la pestaña actual
  useEffect(() => {
    if (portalTab === 'nomina' && !userHasModuleAccess(currentUser, 'nomina')) {
      if (userHasModuleAccess(currentUser, 'trabajar_listas')) {
        setPortalTab('trabajar_listas');
      } else {
        setPortalTab('inicio');
      }
    } else if (
      portalTab === 'trabajar_listas' &&
      !userHasModuleAccess(currentUser, 'trabajar_listas')
    ) {
      if (userHasModuleAccess(currentUser, 'nomina')) {
        setPortalTab('nomina');
      } else {
        setPortalTab('inicio');
      }
    }
  }, [currentUser, portalTab]);

  // Si el usuario en sesión no tiene acceso a Dispersión global, restringir su filtro a sus listas asignadas
  useEffect(() => {
    if (!userHasModuleAccess(currentUser, 'nomina')) {
      if (!selectedSupervisor || !workListSupervisors.includes(selectedSupervisor)) {
        if (workListSupervisors.length > 0) {
          setSelectedSupervisor(workListSupervisors[0]);
        }
      }
    }
  }, [currentUser, workListSupervisors, selectedSupervisor]);

  // Cantidad de asignados por horario
  const assignedCountBySchedule = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(asignaciones).forEach(code => {
      if (code) counts[code] = (counts[code] || 0) + 1;
    });
    return counts;
  }, [asignaciones]);

  // Aplicar horarios asignados a empleados
  const mergeAsignaciones = useCallback((base: Record<string, Employee>, asig: Record<string, string>) => {
    const updated = { ...base };
    Object.keys(updated).forEach(id => {
      if (asig[id] !== undefined) {
        updated[id] = { ...updated[id], horario: asig[id] };
      }
    });
    return updated;
  }, []);

  // Recalcular resumen ejecutivo a partir de la lista actual de reportes
  const recomputeSummaryFromReports = useCallback((listaReportes: EmployeeReport[]): PayrollSummary => {
    let totalHoras = 0;
    let totalHorasExtra = 0;
    let totalF = 0;
    let totalV = 0;
    let totalR = 0;
    let totalRE = 0;
    let perfectas = 0;
    const conteoInc: Record<string, number> = {};
    let totalDiasAuditoria = 0;

    listaReportes.forEach(rep => {
      totalHoras += rep.totalNormal;
      totalHorasExtra += rep.totalExtra;
      totalF += rep.faltas;
      totalR += rep.retardos;
      if (rep.asistenciaPerfecta) perfectas++;

      rep.dias.forEach(d => {
        totalDiasAuditoria++;
        if (d.incidencia) {
          conteoInc[d.incidencia] = (conteoInc[d.incidencia] || 0) + 1;
          const up = d.incidencia.toUpperCase();
          if (up.includes('VAC')) totalV++;
          if (up.includes('EXCESIVO')) totalRE++;
        }
      });
    });

    const numEmp = listaReportes.length;
    const promedioHoras = numEmp > 0 ? Number((totalHoras / numEmp).toFixed(2)) : 0;
    const tasaFaltas = (totalF / Math.max(1, totalDiasAuditoria)) * 100;
    const tasaCumplimiento = Number(Math.max(0, 100 - tasaFaltas).toFixed(1));

    return {
      totalHoras,
      totalHorasExtra,
      totalFaltas: totalF,
      totalVac: totalV,
      totalRetardos: totalR,
      totalRetardosExcesivos: totalRE,
      totalEmpleados: numEmp,
      tasaCumplimiento,
      promedioHoras,
      asistenciasPerfectas: perfectas,
      incidenciasConteo: conteoInc
    };
  }, []);

  // Sincronizar tema dual (dark / light) amigable en mount y al cambiar
  useEffect(() => {
    const isDark = config.theme !== 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light-mode');
    }
  }, [config.theme]);

  // Manejar cambio de tema con feedback Toast
  const handleToggleTheme = () => {
    const newTheme: 'dark' | 'light' = config.theme === 'dark' ? 'light' : 'dark';
    const updated: AppConfig = { ...config, theme: newTheme };
    setConfig(updated);
    StorageService.saveConfig(updated);
    showToast(
      newTheme === 'dark' ? 'Tema Bento Oscuro activado (modo nocturno)' : 'Tema Ejecutivo Claro activado (modo diurno)',
      'info',
      'Tema Actualizado'
    );
  };

  // Manejar cambio de Modo de Lectura (Checadas Reales vs Jerarquía con rescate RST)
  const handleReadingModeChange = (newMode: ReadingMode) => {
    const updatedConfig: AppConfig = { ...config, modoLectura: newMode };
    setConfig(updatedConfig);
    StorageService.saveConfig(updatedConfig);

    if (Object.keys(eventosDB).length > 0) {
      const reconsolidado = consolidarEventosConHorarios(eventosDB, empleadosDB, horarios, {
        modoLectura: newMode,
        minutosRebote: updatedConfig.minutosRebote
      });
      setEventosDB(reconsolidado);

      if (reportes.length > 0 && selectedWeek) {
        const [startISO, endISO] = selectedWeek.split('|');
        const { reportes: calculados, resumen: sum } = generarReporteAsistencia(
          Object.values(empleadosDB),
          reconsolidado,
          vacacionesDB,
          horarios,
          startISO,
          endISO,
          {
            jornadaBase: updatedConfig.jornadaBase,
            modoLectura: newMode,
            minutosRebote: updatedConfig.minutosRebote,
            overtimeRules: updatedConfig.overtimeRules
          }
        );
        setReportes(calculados);
        setResumen(sum);
      }

      setStatusMessage(
        newMode === 'checadas_reales'
          ? '✓ Modo activo: Por Checadas Reales (une RST y eventos cronológicamente)'
          : '✓ Modo activo: Por Jerarquía de Eventos con rescate de RST'
      );
      setStatusType('success');
    }
  };

  // 1. Cargar Base de Empleados
  const handleLoadEmployees = async (file: File) => {
    setIsLoadingEmployees(true);
    setStatusMessage('Procesando catálogo de empleados...');
    setStatusType('info');

    try {
      const result = await parseEmployeesFile(file);
      const withAssignments = mergeAsignaciones(result.empleados, asignaciones);

      setEmpleadosDB(withAssignments);
      StorageService.saveEmployees(withAssignments);
      setSavedEmployeesInfo({
        count: result.count,
        savedAt: new Date().toISOString()
      });

      setStatusMessage(`✓ ${result.count} empleados cargados (${result.modo === 'excel_avanzado' ? 'Modo avanzado' : 'Modo estándar'})`);
      setStatusType('success');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`✗ Error al cargar empleados: ${err.message || 'Formato no soportado'}`);
      setStatusType('error');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  // Usar base guardada
  const handleUseSavedEmployees = () => {
    const saved = StorageService.loadSavedEmployees();
    if (!saved || !saved.empleados) return;

    const withAssignments = mergeAsignaciones(saved.empleados, asignaciones);
    setEmpleadosDB(withAssignments);
    const count = Object.keys(withAssignments).length;
    setStatusMessage(`✓ ${count} empleados cargados desde la base guardada`);
    setStatusType('success');
  };

  const handleClearSavedEmployees = () => {
    if (confirm('¿Eliminar la base de empleados guardada del almacenamiento local?')) {
      StorageService.clearSavedEmployees();
      setSavedEmployeesInfo(null);
      setStatusMessage('Base guardada eliminada');
      setStatusType('info');
    }
  };

  // 2. Cargar Eventos Biométricos
  const handleLoadEvents = async (file: File) => {
    setIsLoadingEvents(true);
    setStatusMessage('Procesando checadas y eventos del reloj biométrico...');
    setStatusType('info');

    try {
      const result = await parseBiometricEventsFile(file, empleadosDB);
      const consolidado = consolidarEventosConHorarios(result.eventosDB, empleadosDB, horarios, {
        modoLectura: config.modoLectura,
        minutosRebote: config.minutosRebote
      });

      setEventosDB(consolidado);

      // Detección automática de la semana de nómina a partir de las fechas de las checadas
      const allDates: string[] = [];
      Object.values(result.eventosDB).forEach(empDates => {
        Object.keys(empDates).forEach(d => allDates.push(d));
      });

      const autoDetectedWeek = detectPayrollWeekFromDates(allDates, payrollWeeks);
      if (autoDetectedWeek) {
        setSelectedWeek(autoDetectedWeek.value);
        setStatusMessage(
          `✓ ${result.totalEventos} checadas procesadas. Semana detectada automáticamente: Semana ${autoDetectedWeek.weekNumber} (${autoDetectedWeek.startISO} al ${autoDetectedWeek.endISO})`
        );
      } else {
        setStatusMessage(`✓ ${result.totalEventos} checadas biométricas procesadas (fusión RST activa)`);
      }
      setStatusType('success');

    } catch (err: any) {
      console.error(err);
      setStatusMessage(`✗ Error al cargar eventos: ${err.message || 'Verifica el archivo Excel'}`);
      setStatusType('error');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // 3. Cargar Vacaciones / Incidencias
  const handleLoadVacations = async (file: File) => {
    setIsLoadingVacations(true);
    setStatusMessage('Procesando vacaciones e incidencias...');
    setStatusType('info');

    try {
      const result = await parseVacationsFile(file);
      setVacacionesDB(result.vacacionesDB);
      setStatusMessage(`✓ ${result.totalRegistros} incidencias de vacaciones registradas`);
      setStatusType('success');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`✗ Error al cargar vacaciones: ${err.message || 'Formato no válido'}`);
      setStatusType('error');
    } finally {
      setIsLoadingVacations(false);
    }
  };

  // Generar Reporte de Asistencia
  const handleGenerateReport = () => {
    if (Object.keys(empleadosDB).length === 0) {
      alert('Debes cargar primero la base de empleados.');
      return;
    }
    if (Object.keys(eventosDB).length === 0) {
      alert('Debes cargar los eventos del checador biométrico.');
      return;
    }
    if (!selectedWeek) {
      alert('Selecciona un periodo de nómina.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Calculando jornadas, emparejando checadas RST y turnos nocturnos...');
    setStatusType('info');

    setTimeout(() => {
      try {
        const [startISO, endISO] = selectedWeek.split('|');
        const todosLosEmpleados = Object.values(empleadosDB);

        const reconsolidado = consolidarEventosConHorarios(eventosDB, empleadosDB, horarios, {
          modoLectura: config.modoLectura,
          minutosRebote: config.minutosRebote
        });
        setEventosDB(reconsolidado);

        const { reportes: calculados, resumen: sum } = generarReporteAsistencia(
          todosLosEmpleados,
          reconsolidado,
          vacacionesDB,
          horarios,
          startISO,
          endISO,
          {
            jornadaBase: config.jornadaBase,
            modoLectura: config.modoLectura,
            minutosRebote: config.minutosRebote,
            overtimeRules: config.overtimeRules
          }
        );

        setReportes(calculados);
        setResumen(sum);

        // El botón "Generar Reporte" lo genera únicamente para la persona de Nóminas/RH.
        // Limpiamos cualquier dispersión previa de esta semana hasta que Nóminas haga clic en "Dispersar".
        const targetWeekObj = payrollWeeks.find(w => w.value === selectedWeek);
        const targetWeekNum = targetWeekObj?.weekNumber || 1;
        setDispersals(prev => {
          const filtered = prev.filter(d => d.semanaNumero !== targetWeekNum);
          PortalService.saveDispersals(filtered);
          return filtered;
        });

        setStatusMessage(
          `✓ Reporte generado para Nóminas/RH (${calculados.length} colaboradores). Haz clic en "Dispersar" para enviar las nóminas a cada supervisor.`
        );
        setStatusType('success');
      } catch (err: any) {
        console.error(err);
        setStatusMessage(`✗ Error en cálculo: ${err.message}`);
        setStatusType('error');
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  // Sincronizar snapshot de la dispersión activa cada vez que se modifica algún día del reporte
  const syncActiveDispersalSnapshot = useCallback(
    (updatedReportes: EmployeeReport[], weekStr: string) => {
      if (updatedReportes.length === 0) return;
      const weekObj = payrollWeeks.find(w => w.value === weekStr);
      const weekNum = weekObj?.weekNumber;
      if (!weekNum) return;

      setDispersals(prev => {
        const idx = prev.findIndex(d => d.semanaNumero === weekNum);
        if (idx < 0) return prev;
        const totalNorm = updatedReportes.reduce((s, r) => s + r.totalNormal, 0);
        const totalExt = updatedReportes.reduce((s, r) => s + r.totalExtra, 0);
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          totalHorasNormales: totalNorm,
          totalHorasExtras: totalExt,
          reportesSnapshot: updatedReportes,
        };
        PortalService.saveDispersals(next);
        return next;
      });
    },
    [payrollWeeks]
  );

  // Actualización en tiempo real y almacenamiento permanente de una incidencia editada por el usuario
  const handleUpdateDayIncidence = (employeeId: string, isoDate: string, newIncidence: string) => {
    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== employeeId) return rep;

        let sumN = 0;
        let sumE = 0;
        let empAsist = 0;
        let empFaltas = 0;
        let empRet = 0;

        const updatedDias = rep.dias.map(d => {
          if (d.isoDate !== isoDate) {
            sumN += d.hNormal;
            if (d.horasExtrasAutorizadas === true) sumE += d.hExtra;
            if (d.incidencia === 'Asistencia') empAsist++;
            else if (d.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
            else if (d.incidencia.toUpperCase().includes('RETARDO')) empRet++;
            return d;
          }

          const incUpper = newIncidence.toUpperCase();
          const isFalta = incUpper.includes('FALTA');
          const isSinGoce = incUpper.includes('SIN GOCE');
          const isPaidOrJustified =
            newIncidence === 'Asistencia' ||
            incUpper.includes('VACACIONES') ||
            incUpper.includes('CON GOCE') ||
            incUpper.includes('PASE') ||
            incUpper.includes('INCAPACIDAD') ||
            incUpper.includes('CHECAD') ||
            incUpper.includes('RETARDO') ||
            incUpper.includes('FESTIVO');

          let nextHNormal = d.hNormal;
          let nextHExtra = d.hExtra;
          let nextHorasExtrasAut = d.horasExtrasAutorizadas;

          if (isFalta || isSinGoce || newIncidence === 'Descanso') {
            nextHNormal = 0;
            nextHExtra = 0;
            nextHorasExtrasAut = false;
          } else if (isPaidOrJustified && d.hNormal === 0 && d.horarioProgramado) {
            nextHNormal = config.jornadaBase || 8;
          }

          sumN += nextHNormal;
          if (nextHorasExtrasAut === true) sumE += nextHExtra;

          if (newIncidence === 'Asistencia' || (isPaidOrJustified && !incUpper.includes('RETARDO'))) {
            empAsist++;
          } else if (isFalta) {
            empFaltas++;
          } else if (incUpper.includes('RETARDO')) {
            empRet++;
          }

          let rowClass = d.rowClass;
          if (isFalta) rowClass = 'row-danger';
          else if (isSinGoce) rowClass = 'row-warning';
          else if (nextHNormal > 0 || isPaidOrJustified) rowClass = 'row-success';
          else rowClass = 'row-default';

          const tipoMod = isFalta
            ? ('falta_confirmada' as const)
            : incUpper.includes('CHECAD')
            ? ('formato_checada_sin_gafete' as const)
            : ('formato_permiso' as const);

          return {
            ...d,
            entradaOriginal: d.entradaOriginal ?? d.entrada,
            salidaOriginal: d.salidaOriginal ?? d.salida,
            incidencia: newIncidence,
            hNormal: nextHNormal,
            hExtra: nextHExtra,
            horasExtrasAutorizadas: nextHorasExtrasAut,
            huerfana: false,
            rowClass,
            modificadoPorSupervisor: true,
            tipoModificacionSupervisor: tipoMod,
            advertencia: newIncidence
              ? `🟣 INCIDENCIA REGISTRADA: ${newIncidence.toUpperCase()}`
              : '',
          };
        });

        const esPerfecta = empFaltas === 0 && empRet === 0 && empAsist > 0;

        return {
          ...rep,
          dias: updatedDias,
          totalNormal: sumN,
          totalExtra: sumE,
          asistencias: empAsist,
          faltas: empFaltas,
          retardos: empRet,
          asistenciaPerfecta: esPerfecta
        };
      });

      const nextResumen = recomputeSummaryFromReports(updated);
      setResumen(nextResumen);
      StorageService.saveReportesState({
        reportes: updated,
        resumen: nextResumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });

    setStatusMessage(
      `✓ Incidencia "${newIncidence || 'Sin incidencia'}" guardada y almacenada para colaborador #${employeeId} (${isoDate})`
    );
    setStatusType('success');
  };

  // Actualización en tiempo real cuando el usuario corrige o intercambia Entrada / Salida manualmente en la tabla
  const handleUpdateDayTimes = (employeeId: string, isoDate: string, newEntrada: string, newSalida: string) => {
    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== employeeId) return rep;

        let sumN = 0;
        let sumE = 0;
        let empAsist = 0;
        let empFaltas = 0;
        let empRet = 0;

        const updatedDias = rep.dias.map(d => {
          if (d.isoDate !== isoDate) {
            sumN += d.hNormal;
            if (d.horasExtrasAutorizadas === true) sumE += d.hExtra;
            if (d.incidencia === 'Asistencia') empAsist++;
            else if (d.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
            else if (d.incidencia.toUpperCase().includes('RETARDO')) empRet++;
            return d;
          }

          const vca = vacacionesDB[employeeId]?.[isoDate];
          const isRST = Boolean(eventosDB[employeeId]?.[isoDate]?.isRST);
          const metricas = calcularMetricasDia(
            newEntrada,
            newSalida,
            d.horarioProgramado,
            config.jornadaBase,
            isRST,
            vca,
            isoDate,
            Boolean(rep.empleado.horario),
            config.overtimeRules
          );

          const origEnt = d.entradaOriginal ?? d.entrada;
          const origSal = d.salidaOriginal ?? d.salida;
          const wasModified = newEntrada !== origEnt || newSalida !== origSal;
          const origBothMissing =
            (!origEnt || origEnt === '--:--') && (!origSal || origSal === '--:--');

          sumN += metricas.hNormal;
          if (d.horasExtrasAutorizadas === true) sumE += metricas.hExtra;
          if (metricas.incidencia === 'Asistencia') empAsist++;
          else if (metricas.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
          else if (metricas.incidencia.toUpperCase().includes('RETARDO')) empRet++;

          return {
            ...d,
            entradaOriginal: origEnt,
            salidaOriginal: origSal,
            entrada: newEntrada,
            salida: newSalida,
            hNormal: metricas.hNormal,
            hExtra: metricas.hExtra,
            incidencia: metricas.incidencia,
            advertencia: wasModified
              ? d.formatoSubidoNombre
                ? `🟣 CHECADA AGREGADA POR SUPERVISOR (Formato: ${d.formatoSubidoNombre})`
                : origBothMissing
                ? '🚫 OBLIGATORIO SUBIR RESPALDO (No tenía Entrada ni Salida)'
                : '🟣 CHECADA COMPLETADA POR SUPERVISOR (Faltaba 1 checada - Formato opcional)'
              : metricas.advertencia,
            huerfana: metricas.huerfana,
            rowClass: metricas.rowClass,
            modificadoPorSupervisor: wasModified,
            tipoModificacionSupervisor: wasModified ? ('checada_agregada' as const) : undefined,
          };
        });

        const esPerfecta = empFaltas === 0 && empRet === 0 && empAsist > 0;

        return {
          ...rep,
          dias: updatedDias,
          totalNormal: sumN,
          totalExtra: sumE,
          asistencias: empAsist,
          faltas: empFaltas,
          retardos: empRet,
          asistenciaPerfecta: esPerfecta
        };
      });

      const nextResumen = recomputeSummaryFromReports(updated);
      setResumen(nextResumen);
      StorageService.saveReportesState({
        reportes: updated,
        resumen: nextResumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });

    setStatusMessage('🟣 Checada modificada en la lista. Si el trabajador no tenía ni Entrada ni Salida, recuerda subir el archivo de respaldo obligatorio.');
    setStatusType('info');
  };

  // Actualizar nota o comentario del supervisor en un día específico y preservarlo
  const handleUpdateDayNote = (employeeId: string, isoDate: string, note: string) => {
    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== employeeId) return rep;
        return {
          ...rep,
          dias: rep.dias.map(d =>
            d.isoDate === isoDate
              ? {
                  ...d,
                  notaSupervisorDia: note,
                  modificadoPorSupervisor: Boolean(d.modificadoPorSupervisor || note.trim()),
                }
              : d
          ),
        };
      });
      StorageService.saveReportesState({
        reportes: updated,
        resumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });
  };

  // Autorizar o desautorizar tiempo extra detectado por el supervisor y recalcular el total de horas extras en tiempo real
  const handleToggleOvertimeApproval = (employeeId: string, isoDate: string, autorizada: boolean) => {
    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== employeeId) return rep;
        const updatedDias = rep.dias.map(d => {
          if (d.isoDate !== isoDate) return d;
          return {
            ...d,
            horasExtrasAutorizadas: autorizada,
            modificadoPorSupervisor: true,
            notaSupervisorDia: d.notaSupervisorDia || (autorizada ? 'Tiempo extra autorizado por supervisor' : 'Tiempo extra NO autorizado')
          };
        });
        const newTotalExtra = updatedDias.reduce(
          (acc, d) => acc + (d.horasExtrasAutorizadas === true ? d.hExtra : 0),
          0
        );
        return {
          ...rep,
          dias: updatedDias,
          totalExtra: newTotalExtra
        };
      });
      const nextResumen = recomputeSummaryFromReports(updated);
      setResumen(nextResumen);
      StorageService.saveReportesState({
        reportes: updated,
        resumen: nextResumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });
    setStatusMessage(
      autorizada
        ? `✓ Tiempo extra AUTORIZADO para #${employeeId}. Se sumó al total de Horas Extras y generará clave en CONTPAQi.`
        : `✕ Tiempo extra marcado como NO AUTORIZADO para #${employeeId}. No se computa en el total ni en CONTPAQi.`
    );
    setStatusType(autorizada ? 'success' : 'info');
  };

  // Confirmar rápidamente que el trabajador NO vino ese día laboral ("Es Falta")
  const handleQuickConfirmFalta = (employeeId: string, isoDate: string) => {
    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== employeeId) return rep;

        let sumN = 0;
        let sumE = 0;
        let empAsist = 0;
        let empFaltas = 0;
        let empRet = 0;

        const updatedDias = rep.dias.map(d => {
          if (d.isoDate !== isoDate) {
            sumN += d.hNormal;
            if (d.horasExtrasAutorizadas === true) sumE += d.hExtra;
            if (d.incidencia === 'Asistencia') empAsist++;
            else if (d.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
            else if (d.incidencia.toUpperCase().includes('RETARDO')) empRet++;
            return d;
          }

          empFaltas++;
          return {
            ...d,
            entradaOriginal: d.entradaOriginal ?? d.entrada,
            salidaOriginal: d.salidaOriginal ?? d.salida,
            entrada: '--:--',
            salida: '--:--',
            hNormal: 0,
            hExtra: 0,
            horasExtrasAutorizadas: false,
            incidencia: 'Falta Confirmada',
            advertencia: '🚫 FALTA CONFIRMADA POR SUPERVISOR (El trabajador no se presentó)',
            huerfana: false,
            rowClass: 'row-danger' as const,
            modificadoPorSupervisor: true,
            tipoModificacionSupervisor: 'falta_confirmada' as const,
            notaSupervisorDia: d.notaSupervisorDia || 'Confirmado por supervisor: El trabajador no se presentó a laborar ese día.'
          };
        });

        const esPerfecta = empFaltas === 0 && empRet === 0 && empAsist > 0;

        return {
          ...rep,
          dias: updatedDias,
          totalNormal: sumN,
          totalExtra: sumE,
          asistencias: empAsist,
          faltas: empFaltas,
          retardos: empRet,
          asistenciaPerfecta: esPerfecta
        };
      });

      const nextResumen = recomputeSummaryFromReports(updated);
      setResumen(nextResumen);
      StorageService.saveReportesState({
        reportes: updated,
        resumen: nextResumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });

    setStatusMessage('🚫 Día marcado como FALTA CONFIRMADA (el trabajador no se presentó ese día laboral).');
    setStatusType('info');
  };

  // Resolver un día laboral sin las 2 checadas desde el asistente "¿Quieres hacer un formato?"
  const handleResolveMissingPunchDay = (payload: DayResolutionPayload) => {
    const empObj =
      empleadosDB[payload.employeeId] ||
      reportes.find(r => r.empleado.id === payload.employeeId)?.empleado;
    const empName = empObj?.nombre || `Colaborador #${payload.employeeId}`;
    const supName = empObj?.jefe || currentSupervisorForRelease;

    setReportes(prevReportes => {
      const updated = prevReportes.map(rep => {
        if (rep.empleado.id !== payload.employeeId) return rep;

        let sumN = 0;
        let sumE = 0;
        let empAsist = 0;
        let empFaltas = 0;
        let empRet = 0;

        const updatedDias = rep.dias.map(d => {
          if (d.isoDate !== payload.isoDate) {
            sumN += d.hNormal;
            if (d.horasExtrasAutorizadas === true) sumE += d.hExtra;
            if (d.incidencia === 'Asistencia') empAsist++;
            else if (d.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
            else if (d.incidencia.toUpperCase().includes('RETARDO')) empRet++;
            return d;
          }

          const origEnt = d.entradaOriginal ?? d.entrada;
          const origSal = d.salidaOriginal ?? d.salida;

          if (payload.mode === 'falta') {
            empFaltas++;
            return {
              ...d,
              entradaOriginal: origEnt,
              salidaOriginal: origSal,
              entrada: '--:--',
              salida: '--:--',
              hNormal: 0,
              hExtra: 0,
              horasExtrasAutorizadas: false,
              incidencia: 'Falta Confirmada',
              advertencia: '🚫 FALTA CONFIRMADA POR SUPERVISOR (El trabajador no se presentó)',
              huerfana: false,
              rowClass: 'row-danger' as const,
              modificadoPorSupervisor: true,
              tipoModificacionSupervisor: 'falta_confirmada' as const,
              notaSupervisorDia: payload.motivo
            };
          }

          if (payload.mode === 'permiso') {
            const vcaLabel =
              payload.tipoIncidencia === 'Otro' && payload.especificacionOtro
                ? `Otra: ${payload.especificacionOtro}`
                : payload.tipoIncidencia !== 'Falta Confirmada'
                ? payload.tipoIncidencia
                : 'Permiso con goce';

            const hasValidTimes =
              payload.entrada !== '--:--' &&
              payload.salida !== '--:--' &&
              payload.entrada !== '' &&
              payload.salida !== '';

            const isRST = Boolean(eventosDB[payload.employeeId]?.[payload.isoDate]?.isRST);
            const metricas = hasValidTimes
              ? calcularMetricasDia(
                  payload.entrada,
                  payload.salida,
                  d.horarioProgramado,
                  config.jornadaBase,
                  isRST,
                  vcaLabel,
                  payload.isoDate,
                  Boolean(rep.empleado.horario),
                  config.overtimeRules
                )
              : {
                  hNormal: payload.tipoIncidencia === 'Permiso sin goce' ? 0 : config.jornadaBase,
                  hExtra: 0,
                  incidencia: vcaLabel,
                  advertencia: `📋 ${vcaLabel.toUpperCase()} REGISTRADO POR SUPERVISOR`,
                  huerfana: false,
                  rowClass: 'row-success' as const
                };

            sumN += metricas.hNormal;
            if (d.horasExtrasAutorizadas === true) sumE += metricas.hExtra;
            empAsist++;

            return {
              ...d,
              entradaOriginal: origEnt,
              salidaOriginal: origSal,
              entrada: hasValidTimes ? payload.entrada : d.entrada,
              salida: hasValidTimes ? payload.salida : d.salida,
              hNormal: metricas.hNormal,
              hExtra: metricas.hExtra,
              incidencia: vcaLabel,
              advertencia: `📋 ${vcaLabel.toUpperCase()} REGISTRADO POR SUPERVISOR`,
              huerfana: false,
              rowClass: 'row-success' as const,
              modificadoPorSupervisor: true,
              tipoModificacionSupervisor: 'formato_permiso' as const,
              notaSupervisorDia: payload.motivo,
              formatoSubidoNombre: payload.archivoNombre,
              formatoSubidoBase64: payload.archivoBase64
            };
          }

          // Modo 'checada_sin_gafete'
          const isRST = Boolean(eventosDB[payload.employeeId]?.[payload.isoDate]?.isRST);
          const metricas = calcularMetricasDia(
            payload.entrada,
            payload.salida,
            d.horarioProgramado,
            config.jornadaBase,
            isRST,
            undefined,
            payload.isoDate,
            Boolean(rep.empleado.horario),
            config.overtimeRules
          );

          sumN += metricas.hNormal;
          if (d.horasExtrasAutorizadas === true) sumE += metricas.hExtra;
          if (metricas.incidencia === 'Asistencia') empAsist++;
          else if (metricas.incidencia.toUpperCase().includes('FALTA')) empFaltas++;
          else if (metricas.incidencia.toUpperCase().includes('RETARDO')) empRet++;

          return {
            ...d,
            entradaOriginal: origEnt,
            salidaOriginal: origSal,
            entrada: payload.entrada,
            salida: payload.salida,
            hNormal: metricas.hNormal,
            hExtra: metricas.hExtra,
            incidencia: metricas.incidencia === 'Falta' ? 'Checada sin Gafete' : metricas.incidencia,
            advertencia: payload.archivoNombre
              ? `🟣 CHECADA AGREGADA POR SUPERVISOR (Respaldo: ${payload.archivoNombre})`
              : '🟣 CHECADA COMPLETADA POR SUPERVISOR (Faltaba 1 checada - Formato opcional)',
            huerfana: metricas.huerfana,
            rowClass: metricas.rowClass,
            modificadoPorSupervisor: true,
            tipoModificacionSupervisor: 'formato_checada_sin_gafete' as const,
            notaSupervisorDia: payload.motivo,
            formatoSubidoNombre: payload.archivoNombre,
            formatoSubidoBase64: payload.archivoBase64
          };
        });

        const esPerfecta = empFaltas === 0 && empRet === 0 && empAsist > 0;

        return {
          ...rep,
          dias: updatedDias,
          totalNormal: sumN,
          totalExtra: sumE,
          asistencias: empAsist,
          faltas: empFaltas,
          retardos: empRet,
          asistenciaPerfecta: esPerfecta
        };
      });

      const nextResumen = recomputeSummaryFromReports(updated);
      setResumen(nextResumen);
      StorageService.saveReportesState({
        reportes: updated,
        resumen: nextResumen,
        selectedWeek,
      });
      syncActiveDispersalSnapshot(updated, selectedWeek);
      return updated;
    });

    // Si es Checada sin Gafete o Permiso, registrar también la solicitud en el módulo de Incidencias para RH
    if (payload.mode === 'checada_sin_gafete' || payload.mode === 'permiso') {
      const tipoInc: IncidentType =
        payload.mode === 'checada_sin_gafete'
          ? 'Checado sin Gafete'
          : payload.tipoIncidencia !== 'Falta Confirmada'
          ? payload.tipoIncidencia
          : 'Permiso con goce';

      // Revisar si originalmente faltaban ambas checadas o solo 1 asistencia
      const existingEmpRep = reportes.find(r => r.empleado.id === payload.employeeId);
      const existingDay = existingEmpRep?.dias.find(d => d.isoDate === payload.isoDate);
      const origEnt = existingDay ? existingDay.entradaOriginal ?? existingDay.entrada : '--:--';
      const origSal = existingDay ? existingDay.salidaOriginal ?? existingDay.salida : '--:--';
      const hasExistingEnt = Boolean(origEnt && origEnt !== '--:--');
      const hasExistingSal = Boolean(origSal && origSal !== '--:--');
      const missingBothPunches = !hasExistingEnt && !hasExistingSal;

      const skipRH = doesIncidentSkipRHValidation(tipoInc, missingBothPunches);

      const newInc: IncidentRequest = {
        id: `inc_fmt_${Date.now()}`,
        empleadoId: payload.employeeId,
        empleadoNombre: empName,
        supervisorNombre: supName,
        solicitanteId: currentUser.id,
        solicitanteNombre: currentUser.name,
        solicitanteRol: currentUser.role,
        esParaMi: currentUser.employeeId === payload.employeeId,
        tipo: tipoInc,
        especificacionOtro: payload.especificacionOtro,
        fechaInicio: payload.isoDate,
        fechaFin: payload.isoDate,
        motivo: payload.motivo,
        status: skipRH ? 'aprobada' : 'pendiente',
        autoAprobadaPorSupervisor: skipRH,
        revisadoPor: skipRH ? `${currentUser.name} (Aprobación directa de Supervisor)` : undefined,
        fechaRevision: skipRH ? new Date().toISOString() : undefined,
        notasResolucion: skipRH
          ? tipoInc === 'Permiso sin goce'
            ? 'Aprobada directamente por el supervisor — Permiso sin goce no requiere validación de RH.'
            : 'Aprobada directamente por el supervisor — Checada sin gafete con 1 asistencia registrada no requiere validación de RH.'
          : undefined,
        fechaCreacion: new Date().toISOString(),
        entradaPropuesta: payload.mode === 'checada_sin_gafete' ? payload.entrada : undefined,
        salidaPropuesta: payload.mode === 'checada_sin_gafete' ? payload.salida : undefined,
        archivoFormatoNombre: payload.archivoNombre,
        archivoFormatoBase64: payload.archivoBase64
      };

      setIncidents(prev => {
        const updatedInc = [newInc, ...prev];
        PortalService.saveIncidents(updatedInc);
        return updatedInc;
      });
    }

    setStatusMessage(
      payload.mode === 'falta'
        ? `🚫 Falta confirmada para ${empName} (${payload.isoDate})`
        : payload.mode === 'permiso'
        ? `✓ Permiso y justificación aplicados para ${empName} (${payload.isoDate})`
        : `🟣 Checada agregada por supervisor y formato registrado para ${empName} (${payload.isoDate})`
    );
    setStatusType('success');
  };

  // Filtrado reactivo en memoria para la tabla (búsqueda y supervisor con aislamiento de rol)
  const filteredReports = useMemo(() => {
    let result = reportes;
    if (currentUser.role === 'supervisor') {
      const allowed = allowedSupervisors;
      if (selectedSupervisor && allowed.includes(selectedSupervisor)) {
        result = result.filter(r => r.empleado.jefe === selectedSupervisor);
      } else {
        result = result.filter(r => allowed.includes(r.empleado.jefe));
      }
    } else if (selectedSupervisor) {
      result = result.filter(r => r.empleado.jefe === selectedSupervisor);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qNum = parseInt(q, 10);
      const qNumStr = !isNaN(qNum) ? qNum.toString() : '';
      result = result.filter(r => 
        r.empleado.nombre.toLowerCase().includes(q) ||
        r.empleado.id.includes(q) ||
        (qNumStr && r.empleado.id.includes(qNumStr)) ||
        r.empleado.jefe.toLowerCase().includes(q)
      );
    }
    return result;
  }, [reportes, currentUser.role, allowedSupervisors, selectedSupervisor, searchQuery]);

  // Resumen reactivo para los empleados actualmente filtrados (por supervisor o búsqueda)
  const activeSummary = useMemo(() => {
    if (reportes.length === 0) return resumen;
    return recomputeSummaryFromReports(filteredReports);
  }, [reportes.length, filteredReports, resumen, recomputeSummaryFromReports]);

  // Exportar 1 archivo Excel correspondiente al supervisor / lista filtrada
  const handleExportExcel = async () => {
    if (filteredReports.length === 0) return;
    setIsExporting(true);
    setStatusMessage('Generando archivo Excel...');
    setStatusType('info');

    try {
      const currentWeekObj = payrollWeeks.find(w => w.value === selectedWeek);
      const weekNumber = currentWeekObj?.weekNumber || 1;

      const nombreArchivo = await exportPayrollExcelBySupervisor(
        filteredReports,
        weekNumber,
        selectedSupervisor
      );

      setStatusMessage(`✓ Archivo descargado: ${nombreArchivo}`);
      setStatusType('success');
      showToast(`Archivo "${nombreArchivo}" generado y descargado exitosamente.`, 'success', 'Excel Generado');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`✗ Error al exportar Excel: ${err.message}`);
      setStatusType('error');
    } finally {
      setIsExporting(false);
    }
  };

  // Descargar todas las listas de supervisores generadas de golpe
  const handleExportAllExcel = async () => {
    if (reportes.length === 0) {
      showToast('Primero debes generar las listas de asistencia para poder descargar todas de golpe.', 'warning', 'Genera las Listas Primero');
      return;
    }
    setIsExportingAll(true);
    setStatusMessage('Generando y descargando todas las listas de Excel por supervisor...');
    setStatusType('info');

    try {
      const currentWeekObj = payrollWeeks.find(w => w.value === selectedWeek);
      const weekNumber = currentWeekObj?.weekNumber || 1;

      const downloadedFiles = await exportAllSupervisorPayrollsExcel(
        reportes,
        weekNumber,
        allowedSupervisors.length > 0 ? allowedSupervisors : supervisorsList
      );

      setStatusMessage(`✓ Descargadas ${downloadedFiles.length} lista(s) Excel de la Semana ${weekNumber}`);
      setStatusType('success');
      showToast(
        `Se descargaron ${downloadedFiles.length} archivo(s) Excel correspondientes a todas las listas de la Semana ${weekNumber}.`,
        'success',
        'Descarga Masiva Completada'
      );
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`✗ Error en descarga masiva de Excel: ${err.message}`);
      setStatusType('error');
      showToast(`Error al descargar todas las listas: ${err.message}`, 'error', 'Error de Exportación');
    } finally {
      setIsExportingAll(false);
    }
  };

  // Abrir ventana emergente para configurar y enviar correo (a correo manual o al de los supervisores)
  const handleSendEmail = () => {
    setIsSendEmailModalOpen(true);
  };

  // Imprimir
  const handlePrint = () => {
    window.print();
  };

  // Recalcular reportes en vivo cuando cambia un horario programado (conservando modificaciones del supervisor)
  const recalculateReportsWithUpdatedSchedules = useCallback(
    (
      updatedEmployees: Record<string, Employee>,
      updatedHorarios: Record<string, ScheduleConfig>,
      currentEventos: EventsDB
    ) => {
      const reconsolidado = consolidarEventosConHorarios(currentEventos, updatedEmployees, updatedHorarios, {
        modoLectura: config.modoLectura,
        minutosRebote: config.minutosRebote
      });
      setEventosDB(reconsolidado);

      if (reportes.length > 0 && selectedWeek) {
        const [startISO, endISO] = selectedWeek.split('|');
        const { reportes: nuevosReportes } = generarReporteAsistencia(
          Object.values(updatedEmployees),
          reconsolidado,
          vacacionesDB,
          updatedHorarios,
          startISO,
          endISO,
          {
            jornadaBase: config.jornadaBase,
            modoLectura: config.modoLectura,
            minutosRebote: config.minutosRebote,
            overtimeRules: config.overtimeRules
          }
        );

        // Preservar las ediciones o formatos hechos por el supervisor en días específicos
        const mergedReportes = nuevosReportes.map(newRep => {
          const prevRep = reportes.find(r => r.empleado.id === newRep.empleado.id);
          if (!prevRep) return newRep;
          let sumN = 0;
          let sumE = 0;
          const diasMerged = newRep.dias.map(nd => {
            const pd = prevRep.dias.find(d => d.isoDate === nd.isoDate);
            if (pd && pd.modificadoPorSupervisor) {
              sumN += pd.hNormal;
              if (pd.horasExtrasAutorizadas === true) sumE += pd.hExtra;
              return { ...pd, horarioProgramado: nd.horarioProgramado };
            }
            sumN += nd.hNormal;
            if (nd.horasExtrasAutorizadas === true) sumE += nd.hExtra;
            return nd;
          });
          return { ...newRep, dias: diasMerged, totalNormal: sumN, totalExtra: sumE };
        });

        setReportes(mergedReportes);
        setResumen(recomputeSummaryFromReports(mergedReportes));
      }
    },
    [config.jornadaBase, config.minutosRebote, config.modoLectura, config.overtimeRules, recomputeSummaryFromReports, reportes, selectedWeek, vacacionesDB]
  );

  // Guardar Horario
  const handleSaveHorario = (code: string, newConfig: ScheduleConfig) => {
    const updated = { ...horarios, [code]: newConfig };
    setHorarios(updated);
    StorageService.saveHorarios(updated);

    if (Object.keys(eventosDB).length > 0) {
      recalculateReportsWithUpdatedSchedules(empleadosDB, updated, eventosDB);
    }

    setStatusMessage(`✓ Horario "${code}" guardado y sincronizado con la lista`);
    setStatusType('success');
    showToast(`Horario "${code}" guardado y sincronizado con el reporte.`, 'success', 'Turno Guardado');
  };

  // Eliminar Horario
  const handleDeleteHorario = (code: string) => {
    const updated = { ...horarios };
    delete updated[code];
    setHorarios(updated);
    StorageService.saveHorarios(updated);

    const updatedAsig = { ...asignaciones };
    Object.keys(updatedAsig).forEach(id => {
      if (updatedAsig[id] === code) delete updatedAsig[id];
    });
    setAsignaciones(updatedAsig);
    StorageService.saveAsignaciones(updatedAsig);

    setStatusMessage(`Horario "${code}" eliminado`);
    setStatusType('info');
    showToast(`Horario "${code}" eliminado del catálogo.`, 'info', 'Turno Eliminado');
  };

  // Asignar Horario Individual
  const handleAssignIndividual = (empId: string, scheduleCode: string) => {
    const updatedAsig = { ...asignaciones, [empId]: scheduleCode };
    setAsignaciones(updatedAsig);
    StorageService.saveAsignaciones(updatedAsig);

    const updatedEmp = { ...empleadosDB, [empId]: { ...empleadosDB[empId], horario: scheduleCode } };
    setEmpleadosDB(updatedEmp);
    StorageService.saveEmployees(updatedEmp);

    if (Object.keys(eventosDB).length > 0) {
      recalculateReportsWithUpdatedSchedules(updatedEmp, horarios, eventosDB);
    }
    setStatusMessage(`✓ Horario ${scheduleCode || 'ADMO'} asignado a colaborador #${empId}`);
    setStatusType('success');
    showToast(`Horario ${scheduleCode || 'ADMO'} asignado a colaborador #${empId}`, 'success', 'Horario Asignado');
  };

  // Asignar Horario Masivo
  const handleAssignBulk = (empIds: string[], scheduleCode: string) => {
    const updatedAsig = { ...asignaciones };
    const updatedEmp = { ...empleadosDB };

    empIds.forEach(id => {
      if (scheduleCode) updatedAsig[id] = scheduleCode;
      else delete updatedAsig[id];

      if (updatedEmp[id]) {
        updatedEmp[id] = { ...updatedEmp[id], horario: scheduleCode };
      }
    });

    setAsignaciones(updatedAsig);
    StorageService.saveAsignaciones(updatedAsig);
    setEmpleadosDB(updatedEmp);
    StorageService.saveEmployees(updatedEmp);

    if (Object.keys(eventosDB).length > 0) {
      recalculateReportsWithUpdatedSchedules(updatedEmp, horarios, eventosDB);
    }

    setStatusMessage(`✓ Horario asignado a ${empIds.length} colaboradores`);
    setStatusType('success');
    showToast(`Horario asignado a ${empIds.length} colaboradores en lote.`, 'success', 'Asignación Masiva');
  };

  // Exportar respaldo JSON
  const handleExportBackup = () => {
    const blob = StorageService.exportBackup(empleadosDB);
    const dateStr = new Date().toISOString().split('T')[0];
    saveAs(blob, `CemenQtime_Respaldo_${dateStr}.json`);
    setStatusMessage('✓ Respaldo exportado correctamente');
    setStatusType('success');
    showToast('Archivo de respaldo descargado correctamente.', 'success', 'Respaldo Generado');
  };

  // Importar respaldo JSON
  const handleImportBackup = async (file: File) => {
    try {
      const data = await StorageService.importBackup(file);
      if (data.horarios) setHorarios(data.horarios);
      if (data.asignaciones) setAsignaciones(data.asignaciones);
      if (data.empleados) {
        setEmpleadosDB(data.empleados);
        setSavedEmployeesInfo({
          count: Object.keys(data.empleados).length,
          savedAt: new Date().toISOString()
        });
      }
      if (data.config) setConfig(data.config);

      setStatusMessage('✓ Respaldo importado y restaurado correctamente');
      setStatusType('success');
      showToast('Respaldo importado y base de datos restaurada con éxito.', 'success', 'Respaldo Restaurado');
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`);
    }
  };

  const handleSaveConfig = (newConfig: Partial<AppConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    StorageService.saveConfig(updated);
    if (newConfig.emailDestino) setEmailDestino(newConfig.emailDestino);

    if (Object.keys(eventosDB).length > 0) {
      const reconsolidado = consolidarEventosConHorarios(eventosDB, empleadosDB, horarios, {
        modoLectura: updated.modoLectura,
        minutosRebote: updated.minutosRebote
      });
      setEventosDB(reconsolidado);
    }

    setStatusMessage('✓ Configuración actualizada');
    setStatusType('success');
    showToast('Configuración general y parámetros del sistema guardados con éxito.', 'success', 'Configuración Guardada');
  };

  // Guardar configuración de Reglas de Tiempo Extra y recalcular inmediatamente todos los reportes activos
  const handleSaveOvertimeRules = (newRules: OvertimeRulesConfig) => {
    const updatedConfig: AppConfig = {
      ...config,
      overtimeRules: newRules,
    };
    setConfig(updatedConfig);
    StorageService.saveConfig(updatedConfig);

    if (reportes.length > 0) {
      const recalculatedReportes = reportes.map(rep => {
        let sumN = 0;
        let sumE = 0;
        const updatedDias = rep.dias.map(d => {
          if (d.tipoModificacionSupervisor === 'falta_confirmada' || d.incidencia === 'Falta Confirmada') {
            return d;
          }
          const tieneEnt = d.entrada !== '--:--' && Boolean(d.entrada);
          const tieneSal = d.salida !== '--:--' && Boolean(d.salida);
          if (!tieneEnt || !tieneSal) {
            sumN += d.hNormal;
            return d;
          }

          const vca = vacacionesDB[rep.empleado.id]?.[d.isoDate];
          const isRST = Boolean(eventosDB[rep.empleado.id]?.[d.isoDate]?.isRST);
          const metricas = calcularMetricasDia(
            d.entrada,
            d.salida,
            d.horarioProgramado,
            updatedConfig.jornadaBase,
            isRST,
            vca,
            d.isoDate,
            Boolean(rep.empleado.horario),
            newRules
          );

          const effectiveAutorizada = metricas.hExtra > 0 ? d.horasExtrasAutorizadas : undefined;
          sumN += metricas.hNormal;
          if (effectiveAutorizada === true) {
            sumE += metricas.hExtra;
          }

          return {
            ...d,
            hNormal: metricas.hNormal,
            hExtra: metricas.hExtra,
            horasExtrasAutorizadas: effectiveAutorizada,
            advertencia: d.modificadoPorSupervisor ? d.advertencia : metricas.advertencia,
          };
        });

        return {
          ...rep,
          dias: updatedDias,
          totalNormal: sumN,
          totalExtra: sumE,
        };
      });

      setReportes(recalculatedReportes);
      setResumen(recomputeSummaryFromReports(recalculatedReportes));
    }

    setStatusMessage(
      `✓ Reglas de Tiempo Extra actualizadas: A partir de ${newRules.minutosMinimosParaExtra} min (${
        newRules.ignorarEntradaAnticipada ? 'Sin contar llegadas anticipadas' : 'Incluyendo llegadas anticipadas'
      }).`
    );
    setStatusType('success');
    showToast(
      `Tiempo extra configurado a partir de ${newRules.minutosMinimosParaExtra} min (${
        newRules.ignorarEntradaAnticipada ? 'descartando llegadas antes de la entrada' : 'con entrada exacta'
      }). Nómina recalculada.`,
      'success',
      'Reglas de Tiempo Extra Aplicadas'
    );
  };

  // Descargar versión portable .HTML bajo demanda sin inflar el bundle inicial
  const handleDownloadPortable = useCallback(async () => {
    try {
      const res = await fetch('/AttendancePRO_v10_Portable.html');
      if (!res.ok) throw new Error('No disponible');
      const blob = await res.blob();
      saveAs(blob, 'CemenQtime_Portable.html');
      setStatusMessage('✓ Archivo CemenQtime_Portable.html descargado');
      setStatusType('success');
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  // --- Handlers y cómputos del Portal Multirrol ---
  const currentWeekObj = useMemo(() => {
    return payrollWeeks.find(w => w.value === selectedWeek);
  }, [payrollWeeks, selectedWeek]);
  const currentWeekNumber = currentWeekObj?.weekNumber || 1;

  const currentSupervisorForRelease = useMemo(() => {
    if (selectedSupervisor) return selectedSupervisor;
    if (currentUser.supervisorName) return currentUser.supervisorName;
    return supervisorsList[0] || '';
  }, [selectedSupervisor, currentUser, supervisorsList]);

  const currentReleaseKey = `${currentWeekNumber}_${currentSupervisorForRelease}`;
  const currentRelease = releases[currentReleaseKey];
  const isPayrollReleased = currentRelease?.status === 'liberado';

  // Métricas del equipo del supervisor activo para modal de liberación
  const supervisorTeamReports = useMemo(() => {
    return reportes.filter(r => r.empleado.jefe === currentSupervisorForRelease);
  }, [reportes, currentSupervisorForRelease]);

  const supervisorTeamStats = useMemo(() => {
    let sumN = 0;
    let sumE = 0;
    let sumAlerts = 0;
    let pendingOT = 0;
    let pendingMissing = 0;
    supervisorTeamReports.forEach(r => {
      sumN += r.totalNormal;
      r.dias.forEach(d => {
        if (d.hExtra > 0) {
          if (d.horasExtrasAutorizadas === true) {
            sumE += d.hExtra;
          } else if (d.horasExtrasAutorizadas === undefined) {
            pendingOT++;
          }
        }
        const tieneEnt = d.entrada !== '--:--' && Boolean(d.entrada);
        const tieneSal = d.salida !== '--:--' && Boolean(d.salida);
        if (d.horarioProgramado && (!tieneEnt || !tieneSal) && !d.modificadoPorSupervisor && d.incidencia !== 'Vacaciones') {
          pendingMissing++;
        }
        if (d.advertencia || d.huerfana) {
          sumAlerts++;
        }
      });
    });
    return {
      empleadosCount: supervisorTeamReports.length,
      horasNormales: sumN,
      horasExtras: sumE,
      alertasCount: sumAlerts,
      pendingOvertimeCount: pendingOT,
      pendingMissingPunchCount: pendingMissing,
    };
  }, [supervisorTeamReports]);

  // Estado para redirección directa desde el botón del correo (?action=liberar_nomina&semana=X&supervisor=Y)
  const [pendingEmailAction, setPendingEmailAction] = useState<{
    action: string;
    semana?: number;
    supervisor?: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'liberar_nomina' || action === 'revisar_nomina') {
      const semanaRaw = params.get('semana');
      const supervisorRaw = params.get('supervisor');
      return {
        action,
        semana: semanaRaw ? Number(semanaRaw) : undefined,
        supervisor: supervisorRaw ? supervisorRaw.trim().toUpperCase() : undefined,
      };
    }
    return null;
  });

  const applyEmailRedirectAction = useCallback(
    (user: PortalUser, redirect: { action: string; semana?: number; supervisor?: string }) => {
      const allowedLists = getUserAllowedLists(user);
      if (redirect.supervisor) {
        if (
          user.role === 'admin' ||
          user.role === 'rh' ||
          allowedLists.includes(redirect.supervisor)
        ) {
          setSelectedSupervisor(redirect.supervisor);
        } else if (allowedLists.length > 0) {
          setSelectedSupervisor(allowedLists[0]);
        }
      } else if (allowedLists.length > 0) {
        setSelectedSupervisor(allowedLists[0]);
      }

      if (redirect.semana) {
        const matchedDispersal = dispersals.find(d => d.semanaNumero === redirect.semana);
        if (matchedDispersal) {
          if (matchedDispersal.semanaPeriodo) {
            setSelectedWeek(matchedDispersal.semanaPeriodo);
          }
          if (
            reportes.length === 0 &&
            Array.isArray(matchedDispersal.reportesSnapshot) &&
            matchedDispersal.reportesSnapshot.length > 0
          ) {
            const snap = matchedDispersal.reportesSnapshot as EmployeeReport[];
            setReportes(snap);
            setResumen(recomputeSummaryFromReports(snap));
          }
        }
      }

      if (userHasModuleAccess(user, 'trabajar_listas')) {
        setPortalTab('trabajar_listas');
      } else if (userHasModuleAccess(user, 'semaforo')) {
        setPortalTab('semaforo');
      } else if (userHasModuleAccess(user, 'nomina')) {
        setPortalTab('nomina');
        setDispersionMode('existing');
      } else {
        setPortalTab('inicio');
      }

      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      setPendingEmailAction(null);
      showToast(
        `Acceso directo desde correo: Lista ${redirect.supervisor || ''} ${
          redirect.semana ? `(Semana ${redirect.semana})` : ''
        } abierta para revisión y liberación.`,
        'info',
        'Revisión y Liberación de Nómina'
      );
    },
    [dispersals, recomputeSummaryFromReports, reportes.length, showToast]
  );

  // Si el usuario ya tiene sesión iniciada y abrió el link del correo, redirigir en cuanto cargue el estado del servidor
  useEffect(() => {
    if (isAuthenticated && isServerHydrated && pendingEmailAction && currentUser) {
      applyEmailRedirectAction(currentUser, pendingEmailAction);
    }
  }, [isAuthenticated, isServerHydrated, pendingEmailAction, currentUser, applyEmailRedirectAction]);

  // Cambiar usuario / rol o iniciar sesión
  const handleSwitchUser = (userId: string) => {
    setActiveUserId(userId);
    PortalService.setSessionAuthenticated(true, userId);
    setIsAuthenticated(true);
    const targetUser = portalUsers.find(u => u.id === userId);
    if (targetUser) {
      const lists = getUserAllowedLists(targetUser);
      if (lists.length > 0) {
        setSelectedSupervisor(lists[0]);
      }
      if (
        userHasModuleAccess(targetUser, 'trabajar_listas') &&
        !userHasModuleAccess(targetUser, 'nomina')
      ) {
        setPortalTab('trabajar_listas');
      } else if (userHasModuleAccess(targetUser, 'nomina')) {
        setPortalTab('nomina');
      } else {
        setPortalTab('inicio');
      }
    }
    setStatusMessage(`Sesión activa: ${targetUser?.name || userId}`);
    setStatusType('info');
  };

  const handleLoginSuccess = (user: PortalUser) => {
    handleSwitchUser(user.id);
    if (pendingEmailAction) {
      applyEmailRedirectAction(user, pendingEmailAction);
    } else {
      setPortalTab('inicio');
    }
  };

  const handleLogout = () => {
    PortalService.setSessionAuthenticated(false);
    setIsAuthenticated(false);
    setStatusMessage('Sesión cerrada correctamente');
    setStatusType('info');
  };

  // Guardar y eliminar usuarios (Admin)
  const handleSavePortalUser = (user: PortalUser) => {
    setPortalUsers(prev => {
      const idx = prev.findIndex(u => u.id === user.id);
      let updated: PortalUser[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = user;
      } else {
        updated = [...prev, user];
      }
      PortalService.saveUsers(updated);
      return updated;
    });
    setStatusMessage(`✓ Usuario "${user.name}" guardado correctamente`);
    setStatusType('success');
    showToast(`El usuario "${user.name}" y sus accesos fueron guardados en el sistema.`, 'success', 'Usuario Guardado');
  };

  const handleDeletePortalUser = (userId: string) => {
    setPortalUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      PortalService.saveUsers(updated);
      return updated;
    });
    setStatusMessage('Usuario eliminado del sistema');
    setStatusType('info');
    showToast('El usuario fue removido del sistema.', 'info', 'Usuario Eliminado');
  };

  // Incidencias (Aprobar, Rechazar, Crear)
  const handleApproveIncident = (incidentId: string, notes?: string) => {
    const targetInc = incidents.find(i => i.id === incidentId);
    setIncidents(prev => {
      const updated = prev.map(inc => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            status: 'aprobada' as const,
            revisadoPor: currentUser.name,
            fechaRevision: new Date().toISOString(),
            notasResolucion: notes || 'Aprobado por RH'
          };
        }
        return inc;
      });
      PortalService.saveIncidents(updated);
      return updated;
    });
    if (targetInc) {
      const supNotif: PortalNotification = {
        id: `notif_inc_ok_${incidentId}_${Date.now()}`,
        targetSupervisor: (targetInc.supervisorNombre || 'ALL').toUpperCase(),
        targetUserId: targetInc.solicitanteId,
        semanaNumero: currentWeekNumber,
        semanaPeriodo: selectedWeek,
        titulo: `✅ Incidencia Aprobada — ${targetInc.tipo} (${targetInc.empleadoNombre})`,
        mensaje: `RH (${currentUser.name}) aprobó la solicitud de ${targetInc.tipo} para ${targetInc.empleadoNombre} (#${targetInc.empleadoId}). ${
          notes ? `Nota: ${notes}` : 'Ya fue integrada a los cálculos de nómina.'
        }`,
        enviadoPor: currentUser.name,
        fechaEnvio: new Date().toISOString(),
        leida: false,
        emailEnviado: false,
      };
      setNotifications(prev => {
        const updatedNotifs = [supNotif, ...prev].slice(0, 100);
        PortalService.saveNotifications(updatedNotifs);
        return updatedNotifs;
      });
    }
    setStatusMessage('✓ Incidencia aprobada e integrada a los cálculos de nómina');
    setStatusType('success');
    showToast('La incidencia fue aprobada e integrada a los cálculos de nómina.', 'success', 'Incidencia Aprobada');
  };

  const handleRejectIncident = (incidentId: string, notes?: string) => {
    const targetInc = incidents.find(i => i.id === incidentId);
    setIncidents(prev => {
      const updated = prev.map(inc => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            status: 'rechazada' as const,
            revisadoPor: currentUser.name,
            fechaRevision: new Date().toISOString(),
            notasResolucion: notes || 'Rechazada por RH'
          };
        }
        return inc;
      });
      PortalService.saveIncidents(updated);
      return updated;
    });
    if (targetInc) {
      const supNotif: PortalNotification = {
        id: `notif_inc_rej_${incidentId}_${Date.now()}`,
        targetSupervisor: (targetInc.supervisorNombre || 'ALL').toUpperCase(),
        targetUserId: targetInc.solicitanteId,
        semanaNumero: currentWeekNumber,
        semanaPeriodo: selectedWeek,
        titulo: `⚠️ Incidencia Rechazada — ${targetInc.tipo} (${targetInc.empleadoNombre})`,
        mensaje: `RH (${currentUser.name}) rechazó la solicitud de ${targetInc.tipo} para ${targetInc.empleadoNombre} (#${targetInc.empleadoId}). ${
          notes ? `Motivo: ${notes}` : ''
        }`,
        enviadoPor: currentUser.name,
        fechaEnvio: new Date().toISOString(),
        leida: false,
        emailEnviado: false,
      };
      setNotifications(prev => {
        const updatedNotifs = [supNotif, ...prev].slice(0, 100);
        PortalService.saveNotifications(updatedNotifs);
        return updatedNotifs;
      });
    }
    setStatusMessage('Incidencia marcada como rechazada');
    setStatusType('info');
    showToast('La solicitud de incidencia fue rechazada.', 'info', 'Incidencia Rechazada');
  };

  const handleResetUserPassword = (userId: string, newPassword: string) => {
    setPortalUsers(prev => {
      const updated = prev.map(u => (u.id === userId ? { ...u, password: newPassword } : u));
      PortalService.saveUsers(updated);
      return updated;
    });
    setStatusMessage('✓ Contraseña restablecida exitosamente');
    setStatusType('success');
    showToast('Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.', 'success', 'Contraseña Restablecida');
  };

  const handleSubmitNewIncident = (newIncident: IncidentRequest) => {
    setIncidents(prev => {
      const updated = [newIncident, ...prev];
      PortalService.saveIncidents(updated);
      return updated;
    });

    // Si es Cambio de horario, enviar alerta inmediata a RH / Nóminas
    if (newIncident.tipo === 'Cambio de horario') {
      const vigenciaText = newIncident.esIndefinido
        ? `Indefinido / Permanente (desde ${newIncident.fechaInicio})`
        : `Del ${newIncident.fechaInicio} al ${newIncident.fechaFin}`;
      const rhAlertNotif: PortalNotification = {
        id: `notif_horario_${Date.now()}`,
        targetSupervisor: 'ALL',
        semanaNumero: currentWeekNumber,
        semanaPeriodo: selectedWeek,
        titulo: `🔔 Alerta RH: El supervisor solicitó un cambio de horario — Hay que aplicarlo en el sistema`,
        mensaje: `El supervisor ${newIncident.solicitanteNombre} solicitó un cambio de horario para ${newIncident.empleadoNombre} (#${newIncident.empleadoId}). Vigencia: ${vigenciaText}.${
          newIncident.horarioSolicitado ? ` Horario solicitado: ${newIncident.horarioSolicitado}.` : ''
        } Motivo: ${newIncident.motivo}. Hay que aplicarlo en el sistema.`,
        enviadoPor: newIncident.solicitanteNombre,
        fechaEnvio: new Date().toISOString(),
        leida: false,
        emailEnviado: false,
      };
      setNotifications(prev => {
        const updatedNotifs = [rhAlertNotif, ...prev].slice(0, 100);
        PortalService.saveNotifications(updatedNotifs);
        return updatedNotifs;
      });
    }

    // Si es Checado sin Gafete auto-aprobado por supervisor, reflejar la hora en la tabla activa si existe
    if (
      newIncident.autoAprobadaPorSupervisor &&
      newIncident.tipo === 'Checado sin Gafete' &&
      newIncident.entradaPropuesta &&
      newIncident.salidaPropuesta
    ) {
      handleUpdateDayTimes(
        newIncident.empleadoId,
        newIncident.fechaInicio,
        newIncident.entradaPropuesta,
        newIncident.salidaPropuesta
      );
    }

    setIsNewIncidentModalOpen(false);
    if (newIncident.autoAprobadaPorSupervisor) {
      setStatusMessage(`✓ ${newIncident.tipo} aprobada directamente por el supervisor (No requiere validación de RH)`);
      setStatusType('success');
      showToast(
        `${newIncident.tipo} aprobada automáticamente por el supervisor sin requerir validación de RH.`,
        'success',
        'Aprobación Directa Aplicada'
      );
    } else if (newIncident.tipo === 'Cambio de horario') {
      setStatusMessage('✓ Solicitud de Cambio de Horario enviada con alerta a RH para aplicarlo en sistema');
      setStatusType('success');
      showToast(
        'Se envió alerta al módulo de RH: "El supervisor solicitó un cambio de horario — Hay que aplicarlo en el sistema".',
        'info',
        'Cambio de Horario Solicitado'
      );
    } else {
      setStatusMessage('✓ Solicitud de incidencia enviada exitosamente a RH para revisión');
      setStatusType('success');
      showToast('Solicitud de incidencia enviada exitosamente a Recursos Humanos / Nóminas.', 'success', 'Incidencia Registrada');
    }
  };

  // Liberar nómina formalmente a RH (Supervisor)
  const handleConfirmRelease = (comments: string) => {
    const newRelease: PayrollRelease = {
      id: currentReleaseKey,
      semanaPeriodo: selectedWeek,
      semanaNumero: currentWeekNumber,
      supervisorNombre: currentSupervisorForRelease,
      status: 'liberado',
      liberadoPor: currentUser.name,
      fechaLiberacion: new Date().toISOString(),
      comentariosSupervisor: comments,
      empleadosCount: supervisorTeamStats.empleadosCount,
      horasNormales: supervisorTeamStats.horasNormales,
      horasExtras: supervisorTeamStats.horasExtras,
      alertasCount: supervisorTeamStats.alertasCount
    };

    setReleases(prev => {
      const updated = { ...prev, [currentReleaseKey]: newRelease };
      PortalService.saveReleases(updated);
      return updated;
    });

    setIsReleaseModalOpen(false);
    setStatusMessage(`✓ Nómina de ${currentSupervisorForRelease} liberada formalmente a RH`);
    setStatusType('success');
    showToast(`La nómina de ${currentSupervisorForRelease} (Semana ${currentWeekNumber}) fue liberada a RH.`, 'success', 'Nómina Liberada');
  };

  // Verificar si la semana actual ya fue dispersada (total o parcialmente) por Nóminas/RH
  const currentWeekDispersalObj = useMemo(() => {
    return dispersals.find(d => d.semanaNumero === currentWeekNumber);
  }, [dispersals, currentWeekNumber]);

  const isCurrentWeekDispersed = useMemo(() => {
    return reportes.length > 0 && Boolean(currentWeekDispersalObj);
  }, [reportes.length, currentWeekDispersalObj]);

  const dispersedSupervisorsCount = useMemo(() => {
    if (!currentWeekDispersalObj) return 0;
    const set = new Set(currentWeekDispersalObj.supervisoresNotificados.map(s => s.trim().toUpperCase()));
    return supervisorsList.filter(s => set.has(s.trim().toUpperCase())).length;
  }, [currentWeekDispersalObj, supervisorsList]);

  // Marcar notificación como leída
  const handleMarkNotificationRead = (notifId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => (n.id === notifId ? { ...n, leida: true } : n));
      PortalService.saveNotifications(updated);
      return updated;
    });
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, leida: true }));
      PortalService.saveNotifications(updated);
      return updated;
    });
  };

  // Descarga de Excel individual por supervisor desde el semáforo de RH o portal de supervisor
  const handleDownloadSupervisorExcel = async (supName: string) => {
    if (currentUser.role === 'supervisor' && !isCurrentWeekDispersed) {
      setStatusMessage('La nómina de esta semana aún no ha sido dispersada por Nóminas / RH.');
      setStatusType('warning');
      return;
    }
    const supReports = reportes.filter(r => r.empleado.jefe === supName);
    if (supReports.length === 0) {
      setStatusMessage(`No hay registros procesados para el supervisor "${supName}". Primero genera el reporte con el botón "Generar Reporte".`);
      setStatusType('warning');
      return;
    }
    setIsExporting(true);
    setStatusMessage(`Generando Excel para ${supName}...`);
    setStatusType('info');
    try {
      const fileName = await exportPayrollExcelBySupervisor(supReports, currentWeekNumber, supName);
      setStatusMessage(`✓ Archivo descargado: ${fileName}`);
      setStatusType('success');
      showToast(`Archivo "${fileName}" descargado para ${supName}.`, 'success', 'Excel Generado');
    } catch (e: any) {
      setStatusMessage(`Error al exportar: ${e.message}`);
      setStatusType('error');
    } finally {
      setIsExporting(false);
    }
  };

  // Guardar límite de horas de liberación configurado por el Administrador y opcionalmente actualizar semana activa
  const handleSaveHorasLimiteLiberacion = (
    horas: number,
    applyToCurrentWeek = true,
    resetFromNow = false
  ) => {
    const safeHoras = Math.max(1, Math.min(336, Number(horas) || 24));
    const updatedConfig: AppConfig = { ...config, horasLimiteLiberacion: safeHoras };
    setConfig(updatedConfig);
    StorageService.saveConfig(updatedConfig);

    if (applyToCurrentWeek && currentWeekDispersalObj) {
      const updatedDisp = PortalService.updateDispersalDeadlineHours(
        currentWeekNumber,
        safeHoras,
        resetFromNow
      );
      setDispersals(PortalService.loadDispersals());
      if (updatedDisp?.limiteLiberacion) {
        const formatted = new Date(updatedDisp.limiteLiberacion).toLocaleString([], {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        setStatusMessage(
          `✓ Límite de liberación actualizado a ${safeHoras}h (Semana ${currentWeekNumber} vence: ${formatted})`
        );
        setStatusType('success');
        showToast(
          `Plazo límite de liberación configurado en ${safeHoras} horas. La cuenta regresiva de la Semana ${currentWeekNumber} vence el ${formatted}.`,
          'success',
          'Límite de Liberación Actualizado'
        );
        return;
      }
    }

    setStatusMessage(`✓ Plazo límite de liberación por defecto actualizado a ${safeHoras} horas`);
    setStatusType('success');
    showToast(
      `El límite permitido para liberar nóminas después de dispersar se estableció en ${safeHoras} horas.`,
      'success',
      'Plazo por Horas Guardado'
    );
  };

  // Guardar credenciales y plantillas del servidor de correo de manera segura y sincronizar con el backend
  const handleSaveEmailConfig = (newEmailCfg: EmailServerConfig) => {
    const mergedCfg: EmailServerConfig = {
      ...PortalService.loadEmailConfig(),
      ...emailConfig,
      ...newEmailCfg,
    };
    setEmailConfig(mergedCfg);
    setConfig(prev => {
      const next = { ...prev, emailServer: mergedCfg };
      StorageService.saveConfig(next);
      return next;
    });
    PortalService.saveEmailConfig(mergedCfg);
    setStatusMessage(
      `✓ Configuración y plantillas de correo guardadas (${mergedCfg.smtpHost}:${mergedCfg.smtpPort})`
    );
    setStatusType('success');
    showToast(
      `La plantilla y configuración de correo (${mergedCfg.smtpHost}:${mergedCfg.smtpPort}) se guardaron de manera permanente.`,
      'success',
      'Plantilla y Correo Guardados'
    );
  };

  // Dispersar semana de nómina a los supervisores (soporta Dispersar Lista por Lista o Dispersar Todas con plazo y SMTP)
  const handleDisperseWeek = (
    semanaNum: number,
    semanaPer: string,
    mensaje?: string,
    targetSupervisors?: string[],
    sendCorporateEmail = true,
    horasLimite?: number,
    limiteLiberacion?: string
  ) => {
    if (reportes.length === 0) {
      setStatusMessage('Primero debes hacer clic en "Generar Reporte" antes de dispersar las nóminas a los supervisores.');
      setStatusType('warning');
      return;
    }
    const effectiveHorasLimite =
      horasLimite !== undefined ? horasLimite : config.horasLimiteLiberacion ?? 24;
    const targets = targetSupervisors && targetSupervisors.length > 0 ? targetSupervisors : supervisorsList;
    const totalNorm = reportes.reduce((s, r) => s + r.totalNormal, 0);
    const totalExt = reportes.reduce((s, r) => s + r.totalExtra, 0);
    const { dispersal, emailDispatches } = PortalService.recordDispersal(
      semanaNum,
      semanaPer,
      currentUser.name,
      targets,
      mensaje,
      portalUsers,
      sendCorporateEmail,
      effectiveHorasLimite,
      limiteLiberacion,
      {
        empleadosCount: reportes.length,
        totalHorasNormales: totalNorm,
        totalHorasExtras: totalExt,
        reportesSnapshot: reportes,
      }
    );
    setDispersals(PortalService.loadDispersals());
    setNotifications(PortalService.loadNotifications());

    const emailsList = emailDispatches.map(e => e.recipientEmail).join(', ');
    const finalDeadline = dispersal.limiteLiberacion || limiteLiberacion;
    const limiteInfo = finalDeadline
      ? ` · Plazo (${effectiveHorasLimite}h): ${new Date(finalDeadline).toLocaleString([], {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : '';
    if (targets.length === 1) {
      setStatusMessage(
        `✓ Lista de ${targets[0]} (Semana ${semanaNum}) dispersada${limiteInfo}. Notificación enviada en Sistema${sendCorporateEmail ? ` y al correo empresarial (${emailsList})` : ''}.`
      );
    } else {
      setStatusMessage(
        `✓ Todas las listas (${targets.length}) de Semana ${semanaNum} dispersadas${limiteInfo}. Notificaciones enviadas en Sistema${sendCorporateEmail ? ` y por correo empresarial (${emailsList})` : ''}.`
      );
    }
    setStatusType('success');
    showToast(
      targets.length === 1
        ? `Nómina dispersada para ${targets[0]} (Semana ${semanaNum})${limiteInfo}.`
        : `Dispersión completada: ${targets.length} listas enviadas a supervisores${limiteInfo}.`,
      'success',
      'Nómina Dispersada'
    );
  };

  // Cancelar nóminas dispersadas (por supervisor o global)
  const handleCancelDispersal = (
    semanaNum: number,
    targetSupervisors?: string[],
    motivo?: string
  ) => {
    PortalService.cancelDispersal(
      semanaNum,
      currentUser.name,
      targetSupervisors,
      motivo
    );
    setDispersals(PortalService.loadDispersals());
    setNotifications(PortalService.loadNotifications());
    setReleases(PortalService.loadReleases());

    const affected = targetSupervisors && targetSupervisors.length > 0
      ? targetSupervisors.join(', ')
      : 'Todas las listas';

    setStatusMessage(`⚠️ Dispersión de la Semana ${semanaNum} cancelada para: ${affected}. ${motivo ? `Motivo: ${motivo}` : ''}`);
    setStatusType('warning');
    showToast(
      `Dispersión cancelada para ${affected} (Semana ${semanaNum}). Notificación enviada a supervisores.`,
      'warning',
      'Dispersión Cancelada'
    );
  };

  // Descargar el archivo Excel devuelto por el supervisor con sus modificaciones
  const handleDownloadSupervisorReturnedExcel = (fileName: string, base64: string) => {
    try {
      const commaIndex = base64.indexOf(',');
      const rawBase64 = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
      const byteCharacters = atob(rawBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);
      setStatusMessage(`✓ Archivo devuelto por el supervisor descargado: ${fileName}`);
      setStatusType('success');
    } catch (e: any) {
      console.error('Error al descargar archivo del supervisor', e);
      setStatusMessage(`Error al descargar archivo devuelto: ${e.message}`);
      setStatusType('error');
    }
  };

  // Liberación y devolución de nómina trabajada desde el portal de supervisión
  const handleSupervisorLiberarNomina = (
    supervisorName: string,
    semanaNum: number,
    semanaPer: string,
    comentarios: string,
    archivoTrabajado?: { nombre: string; base64: string }
  ) => {
    const key = `${semanaNum}_${supervisorName}`;
    const supReports = reportes.filter(r => r.empleado.jefe === supervisorName);
    const empCount = supReports.length > 0
      ? supReports.length
      : Object.values(empleadosDB).filter(e => e.jefe === supervisorName).length;
    const totalNormal = supReports.reduce((s, r) => s + r.totalNormal, 0);
    const totalExtra = supReports.reduce((s, r) => s + r.totalExtra, 0);
    const totalAlertas = supReports.reduce((s, r) => s + r.dias.filter(d => d.advertencia).length, 0);

    const checadasAgregadasSupervisorCount = supReports.reduce(
      (s, r) =>
        s +
        r.dias.filter(
          d =>
            d.modificadoPorSupervisor &&
            (d.tipoModificacionSupervisor === 'checada_agregada' ||
              d.tipoModificacionSupervisor === 'formato_checada_sin_gafete')
        ).length,
      0
    );
    const formatosAdjuntosCount = supReports.reduce(
      (s, r) => s + r.dias.filter(d => Boolean(d.formatoSubidoNombre)).length,
      0
    );
    const faltasConfirmadasCount = supReports.reduce(
      (s, r) => s + r.dias.filter(d => d.tipoModificacionSupervisor === 'falta_confirmada').length,
      0
    );

    const newRelease: PayrollRelease = {
      id: key,
      semanaPeriodo: semanaPer,
      semanaNumero: semanaNum,
      supervisorNombre: supervisorName,
      status: 'liberado',
      liberadoPor: currentUser.name,
      fechaLiberacion: new Date().toISOString(),
      comentariosSupervisor: comentarios,
      empleadosCount: empCount,
      horasNormales: totalNormal,
      horasExtras: totalExtra,
      alertasCount: totalAlertas,
      excelTrabajadoNombre: archivoTrabajado?.nombre,
      excelTrabajadoBase64: archivoTrabajado?.base64,
      fechaSubidaExcelTrabajado: archivoTrabajado ? new Date().toISOString() : undefined,
      checadasAgregadasSupervisorCount,
      formatosAdjuntosCount,
      faltasConfirmadasCount,
    };

    setReleases(prev => {
      const updated = { ...prev, [key]: newRelease };
      PortalService.saveReleases(updated);
      return updated;
    });

    setStatusMessage(`✓ Nómina de ${supervisorName} liberada y enviada a Recursos Humanos`);
    setStatusType('success');
  };

  // Abrir modal de incidencias con colaborador preseleccionado
  const handleOpenIncidentModalForEmp = (empId?: string) => {
    setInitialIncidentEmployeeId(empId);
    setIsNewIncidentModalOpen(true);
  };


  // Contadores para el menú y badges
  const pendingIncidentsCount = useMemo(() => {
    if (currentUser.role === 'supervisor') {
      // Para supervisores: mostrar únicamente el conteo de las solicitudes que ellos mismos ingresaron
      return incidents.filter(i => i.solicitanteId === currentUser.id && i.status === 'pendiente').length;
    }
    // Para RH y Administrador: conteo global de todas las solicitudes pendientes por autorizar
    return incidents.filter(i => i.status === 'pendiente').length;
  }, [incidents, currentUser]);


  const pendingReleasesCount = useMemo(() => {
    return supervisorsList.filter(sup => {
      const key = `${currentWeekNumber}_${sup}`;
      return releases[key]?.status !== 'liberado';
    }).length;
  }, [supervisorsList, currentWeekNumber, releases]);

  // Supervisores presentes en la lista activa en pantalla para dispersión directa en 1 clic (sin pop-up)
  const activeListSupervisors = useMemo(() => {
    if (selectedSupervisor) return [selectedSupervisor];
    const fromFiltered = [...new Set(filteredReports.map(r => r.empleado.jefe).filter(Boolean))];
    return fromFiltered.length > 0 ? fromFiltered : supervisorsList;
  }, [selectedSupervisor, filteredReports, supervisorsList]);

  const activeListSupervisorLabel = useMemo(() => {
    if (selectedSupervisor) return selectedSupervisor;
    if (activeListSupervisors.length === 1) return activeListSupervisors[0];
    return `${activeListSupervisors.length} listas`;
  }, [selectedSupervisor, activeListSupervisors]);

  const isActiveListDispersed = useMemo(() => {
    if (!currentWeekDispersalObj || activeListSupervisors.length === 0) return false;
    const notifiedSet = new Set(
      currentWeekDispersalObj.supervisoresNotificados.map(s => s.trim().toUpperCase())
    );
    return activeListSupervisors.every(s => notifiedSet.has(s.trim().toUpperCase()));
  }, [currentWeekDispersalObj, activeListSupervisors]);

  // Bitácora / Logs automáticos de todas las modificaciones realizadas sobre las listas trabajadas
  const modificationLogs = useMemo<PayrollModificationLog[]>(() => {
    const logs: PayrollModificationLog[] = [];
    reportes.forEach(rep => {
      const supName = rep.empleado.jefe || 'GENERAL';
      rep.dias.forEach(d => {
        const hasSupMod = Boolean(d.modificadoPorSupervisor);
        const hasOvertimeDecision = d.horasExtrasAutorizadas !== undefined && d.hExtra > 0;
        const hasNote = Boolean(d.notaSupervisorDia && d.notaSupervisorDia.trim());

        if (!hasSupMod && !hasOvertimeDecision && !hasNote) return;

        let actionType: PayrollModificationLog['actionType'] = 'checada_agregada';
        let summary = `Entrada: ${d.entrada} | Salida: ${d.salida} (Orig: ${d.entradaOriginal || '--:--'} a ${d.salidaOriginal || '--:--'})`;

        if (d.tipoModificacionSupervisor === 'falta_confirmada') {
          actionType = 'falta_confirmada';
          summary = 'Falta confirmada por supervisor (0.00 hrs trabajadas)';
        } else if (d.tipoModificacionSupervisor === 'formato_permiso') {
          actionType = 'formato_permiso';
          summary = `Solicitud / Permiso registrado: ${d.incidencia} (${d.hNormal.toFixed(2)}h normales)`;
        } else if (
          d.tipoModificacionSupervisor === 'checada_agregada' ||
          d.tipoModificacionSupervisor === 'formato_checada_sin_gafete'
        ) {
          actionType = 'checada_agregada';
          summary = `Checada validada: ${d.entrada} a ${d.salida} (Orig: ${d.entradaOriginal || '--:--'} a ${d.salidaOriginal || '--:--'})`;
        } else if (hasOvertimeDecision) {
          actionType = d.horasExtrasAutorizadas ? 'tiempo_extra_autorizado' : 'tiempo_extra_rechazado';
          summary = d.horasExtrasAutorizadas
            ? `Tiempo extra AUTORIZADO: +${d.hExtra.toFixed(2)} hrs (Se envía a CONTPAQi)`
            : `Tiempo extra NO autorizado: ${d.hExtra.toFixed(2)} hrs (Sin pago extra)`;
        } else if (hasNote) {
          actionType = 'nota_supervisor';
          summary = `Incidencia: ${d.incidencia || 'Asistencia'} (${d.entrada} - ${d.salida})`;
        }

        if (
          hasOvertimeDecision &&
          actionType !== 'tiempo_extra_autorizado' &&
          actionType !== 'tiempo_extra_rechazado'
        ) {
          summary += d.horasExtrasAutorizadas
            ? ` • Extra Autorizado (+${d.hExtra.toFixed(2)}h)`
            : ` • Extra NO Autorizado (${d.hExtra.toFixed(2)}h)`;
        }

        logs.push({
          id: `log_${rep.empleado.id}_${d.isoDate}`,
          timestamp: d.isoDate,
          employeeId: rep.empleado.id,
          employeeName: rep.empleado.nombre,
          supervisorName: supName,
          isoDate: d.isoDate,
          dayName: d.dayName,
          actionType,
          summary,
          details: d.notaSupervisorDia || undefined,
          modifiedBy: supName,
          hasAttachment: Boolean(d.formatoSubidoNombre),
          attachmentName: d.formatoSubidoNombre,
        });
      });
    });
    return logs;
  }, [reportes]);

  // Cambiar de pestaña y mostrar siempre el selector al entrar a Dispersión de Nómina
  const handleNavigatePortalTab = useCallback((nextTab: string) => {
    if (nextTab === 'nomina') {
      setDispersionMode('prompt');
    }
    setPortalTab(nextTab);
  }, []);

  // Abrir una nómina ya dispersada para consultarla o trabajarla
  const handleOpenDispersedPayroll = useCallback(
    (disp: PayrollDispersal) => {
      if (disp.semanaPeriodo) {
        setSelectedWeek(disp.semanaPeriodo);
      }
      setSelectedSupervisor('');

      if (Array.isArray(disp.reportesSnapshot) && disp.reportesSnapshot.length > 0) {
        // Si ya tenemos reportes en memoria de esta misma semana con días modificados, preservar las ediciones
        const mergedSnap = (disp.reportesSnapshot as EmployeeReport[]).map(snapRep => {
          const currentRep =
            selectedWeek === disp.semanaPeriodo
              ? reportes.find(r => r.empleado.id === snapRep.empleado.id)
              : undefined;
          if (!currentRep) return snapRep;

          let sumN = 0;
          let sumE = 0;
          let empAsist = 0;
          let empFaltas = 0;
          let empRet = 0;

          const diasMerged = snapRep.dias.map(sd => {
            const cd = currentRep.dias.find(d => d.isoDate === sd.isoDate);
            const useCurrent =
              cd &&
              (cd.modificadoPorSupervisor ||
                Boolean(cd.notaSupervisorDia) ||
                cd.horasExtrasAutorizadas !== undefined ||
                cd.incidencia !== sd.incidencia);
            const chosen = useCurrent ? cd : sd;
            sumN += chosen.hNormal;
            if (chosen.horasExtrasAutorizadas === true) sumE += chosen.hExtra;
            const incUp = (chosen.incidencia || '').toUpperCase();
            if (chosen.incidencia === 'Asistencia') empAsist++;
            else if (incUp.includes('FALTA')) empFaltas++;
            else if (incUp.includes('RETARDO')) empRet++;
            return chosen;
          });

          return {
            ...snapRep,
            dias: diasMerged,
            totalNormal: sumN,
            totalExtra: sumE,
            asistencias: empAsist,
            faltas: empFaltas,
            retardos: empRet,
            asistenciaPerfecta: empFaltas === 0 && empRet === 0 && empAsist > 0,
          };
        });

        setReportes(mergedSnap);
        setResumen(recomputeSummaryFromReports(mergedSnap));
      } else if (
        Object.keys(empleadosDB).length > 0 &&
        Object.keys(eventosDB).length > 0 &&
        disp.semanaPeriodo &&
        disp.semanaPeriodo.includes('|')
      ) {
        const [startISO, endISO] = disp.semanaPeriodo.split('|');
        const { reportes: calculados, resumen: sum } = generarReporteAsistencia(
          Object.values(empleadosDB),
          eventosDB,
          vacacionesDB,
          horarios,
          startISO,
          endISO,
          {
            jornadaBase: config.jornadaBase,
            modoLectura: config.modoLectura,
            minutosRebote: config.minutosRebote,
            overtimeRules: config.overtimeRules,
          }
        );
        setReportes(calculados);
        setResumen(sum);
      }

      setDispersionMode('existing');
      setPortalTab('nomina');
      setStatusMessage(
        `✓ Consultando nómina dispersada: Semana ${disp.semanaNumero} (${disp.semanaPeriodo.replace(
          '|',
          ' al '
        )})`
      );
      setStatusType('info');
    },
    [empleadosDB, eventosDB, vacacionesDB, horarios, config, recomputeSummaryFromReports]
  );

  // Iniciar o continuar una nueva dispersión de nómina
  const handleStartNewPayroll = useCallback((clearCurrentReport = false) => {
    if (clearCurrentReport) {
      setReportes([]);
      setResumen(null);
      setSelectedSupervisor('');
      setStatusMessage('Listo para cargar archivos o seleccionar periodo para una nueva dispersión.');
      setStatusType('info');
    }
    setDispersionMode('new');
  }, []);

  // Si el usuario no ha iniciado sesión, mostrar el Módulo de Login
  if (!isAuthenticated) {
    return (
      <LoginView
        users={portalUsers}
        onLoginSuccess={handleLoginSuccess}
        onResetUserPassword={handleResetUserPassword}
        theme={config.theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#171821] text-slate-100 flex font-sans transition-colors">
      {/* Barra Lateral de Navegación Inspirada en el Dashboard */}
      <SidebarNav
        userRole={currentUser.role}
        currentUser={currentUser}
        activeTab={portalTab}
        onTabChange={handleNavigatePortalTab}
        pendingIncidentsCount={pendingIncidentsCount}
        pendingReleasesCount={pendingReleasesCount}
        onOpenSchedules={() => setIsSchedulesOpen(true)}
        onOpenAssign={() => setIsAssignOpen(true)}
        onOpenRawPunches={() => setIsRawPunchesOpen(true)}
        onOpenOvertimeConfig={() => setIsOvertimeConfigOpen(true)}
        onOpenSettings={() => setIsConfigOpen(true)}
        onDownloadPortable={handleDownloadPortable}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onLogout={handleLogout}
        hasEmployees={Object.keys(empleadosDB).length > 0}
        hasEvents={Object.keys(eventosDB).length > 0}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Encabezado Superior Unificado (Sin barras duplicadas de pestañas u opciones) */}
        <UserSessionBar
          currentUser={currentUser}
          allUsers={portalUsers}
          onSwitchUser={handleSwitchUser}
          onLogout={handleLogout}
          activeTab={portalTab}
          onTabChange={handleNavigatePortalTab}
          pendingIncidentsCount={pendingIncidentsCount}
          pendingReleasesCount={pendingReleasesCount}
          notifications={notifications}
          modificationLogs={modificationLogs}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          statusMessage={statusMessage}
          statusType={statusType}
          theme={config.theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Contenido principal según la pestaña activa del portal y el rol */}
        <main className="flex-1 max-w-[1600px] mx-auto w-full px-3 sm:px-5 lg:px-6 py-5 sm:py-6">
        {/* VISTA 0: PANEL DE INICIO Y BIENVENIDA */}
        {portalTab === 'inicio' && (
          <WelcomeDashboard
            currentUser={currentUser}
            selectedWeek={selectedWeek}
            currentWeekNumber={currentWeekNumber}
            reportesCount={reportes.length}
            hasEmployees={Object.keys(empleadosDB).length > 0}
            hasEvents={Object.keys(eventosDB).length > 0}
            onNavigateTab={handleNavigatePortalTab}
            pendingIncidentsCount={pendingIncidentsCount}
            pendingReleasesCount={pendingReleasesCount}
            isPayrollReleased={isPayrollReleased}
            supervisorPendingOvertimeCount={supervisorTeamStats.pendingOvertimeCount}
            supervisorPendingMissingPunchCount={supervisorTeamStats.pendingMissingPunchCount}
            supervisorTotalPendingTasks={
              (supervisorTeamStats.pendingOvertimeCount || 0) +
              (supervisorTeamStats.pendingMissingPunchCount || 0) +
              (supervisorTeamStats.alertasCount || 0)
            }
            assignedSupervisorList={allowedSupervisors[0] || currentUser.supervisorName}
            onOpenSchedules={() => setIsSchedulesOpen(true)}
            onOpenAssign={() => setIsAssignOpen(true)}
            activeDispersal={currentWeekDispersalObj}
            horasLimiteLiberacion={config.horasLimiteLiberacion}
          />
        )}

        {/* MÓDULO PARA TRABAJAR LISTAS (Cualquier usuario con el acceso 'trabajar_listas' habilitado) */}
        {portalTab === 'trabajar_listas' &&
          userHasModuleAccess(currentUser, 'trabajar_listas') && (
            <SupervisorWorkspaceView
              currentUser={currentUser}
              availableSupervisorLists={workListSupervisors}
              dispersals={dispersals}
              releases={releases}
              notifications={notifications}
              onMarkNotificationRead={handleMarkNotificationRead}
              assignedEmployees={Object.values(empleadosDB).filter(e => {
                const jefe = e.jefe?.trim().toUpperCase();
                return Boolean(jefe && workListSupervisors.includes(jefe));
              })}
              weeklyReports={
                isCurrentWeekDispersed || userHasModuleAccess(currentUser, 'nomina')
                  ? reportes.filter(r => {
                      const jefe = r.empleado.jefe?.trim().toUpperCase();
                      return Boolean(jefe && workListSupervisors.includes(jefe));
                    })
                  : []
              }
              incidents={incidents}
              horarios={horarios}
              currentWeekNumber={currentWeekNumber}
              currentWeekPeriod={selectedWeek}
              horasLimiteLiberacion={config.horasLimiteLiberacion}
              onDownloadProcessedExcel={handleDownloadSupervisorExcel}
              onLiberarNomina={handleSupervisorLiberarNomina}
              onOpenNewIncidentModal={handleOpenIncidentModalForEmp}
              onUpdateDayIncidence={handleUpdateDayIncidence}
              onUpdateDayTimes={handleUpdateDayTimes}
              onUpdateDayNote={handleUpdateDayNote}
              onResolveMissingPunchDay={handleResolveMissingPunchDay}
              onQuickConfirmFalta={handleQuickConfirmFalta}
              onToggleOvertimeApproval={handleToggleOvertimeApproval}
            />
          )}

        {/* MÓDULO DE DISPERSIÓN Y CÁLCULO DE NÓMINA (Cualquier usuario con el acceso 'nomina' habilitado) */}
        {portalTab === 'nomina' && userHasModuleAccess(currentUser, 'nomina') && (
          <>
            {/* Selector de Entrada (Nueva Dispersión vs Trabajar Dispersada) + Barra Superior de Regreso */}
            <DispersionModeSelector
              mode={dispersionMode}
              onSelectMode={setDispersionMode}
              dispersals={dispersals}
              releases={releases}
              currentWeekNumber={currentWeekNumber}
              currentWeekPeriod={selectedWeek}
              reportesCount={reportes.length}
              hasEmployees={Object.keys(empleadosDB).length > 0}
              hasEvents={Object.keys(eventosDB).length > 0}
              onOpenDispersedPayroll={handleOpenDispersedPayroll}
              onStartNewPayroll={handleStartNewPayroll}
              onNavigateToSemaforo={(disp) => {
                if (disp?.semanaPeriodo) {
                  setSelectedWeek(disp.semanaPeriodo);
                }
                setPortalTab('semaforo');
              }}
            />

            {dispersionMode !== 'prompt' && (
              <>
                {/* Panel de Estadísticas superiores */}
                {activeSummary && (
                  <StatsPanel summary={activeSummary} reports={filteredReports} />
                )}

                {/* Resumen Ejecutivo (Listas y Estado de Dispersión + Pendientes y Límite de Tiempo + Incidencias) */}
                {activeSummary && (
                  <ExecutiveSummary
                    summary={activeSummary}
                    reports={reportes}
                    selectedSupervisor={selectedSupervisor}
                    onSelectSupervisor={setSelectedSupervisor}
                    dispersals={dispersals}
                    releases={releases}
                    supervisors={supervisorsList}
                    semanaNumero={currentWeekNumber}
                    semanaPeriodo={selectedWeek}
                    onNavigateToMonitor={() => setPortalTab('semaforo')}
                  />
                )}

                {/* Panel de Carga de Archivos (Exclusivo RH / Nóminas) */}
                <FileDropzoneSection
                  onLoadEmployees={handleLoadEmployees}
                  onLoadEvents={handleLoadEvents}
                  onLoadVacations={handleLoadVacations}
                  isLoadingEmployees={isLoadingEmployees}
                  isLoadingEvents={isLoadingEvents}
                  isLoadingVacations={isLoadingVacations}
                  employeesCount={Object.keys(empleadosDB).length}
                  eventsCount={Object.keys(eventosDB).length}
                  vacationsCount={Object.keys(vacacionesDB).length}
                  savedEmployeesInfo={savedEmployeesInfo}
                  onUseSavedEmployees={handleUseSavedEmployees}
                  onClearSavedEmployees={handleClearSavedEmployees}
                />

                {/* Barra de Controles, Búsqueda y Filtros */}
                <ControlsBar
                  payrollWeeks={payrollWeeks}
                  selectedWeek={selectedWeek}
                  onSelectWeek={setSelectedWeek}
                  supervisors={allowedSupervisors}
                  selectedSupervisor={selectedSupervisor}
                  onSelectSupervisor={setSelectedSupervisor}
                  readingMode={config.modoLectura}
                  onReadingModeChange={handleReadingModeChange}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  emailDestino={emailDestino}
                  onEmailChange={setEmailDestino}
                  onGenerateReport={handleGenerateReport}
                  onDisperseAllPayroll={() => handleDisperseWeek(currentWeekNumber, selectedWeek, undefined, supervisorsList, true)}
                  onDisperseActiveList={() => handleDisperseWeek(currentWeekNumber, selectedWeek, undefined, activeListSupervisors, true)}
                  activeListSupervisorLabel={activeListSupervisorLabel}
                  isActiveListDispersed={isActiveListDispersed}
                  dispersedSupervisorsCount={dispersedSupervisorsCount}
                  onExportExcel={handleExportExcel}
                  onExportAllExcel={handleExportAllExcel}
                  onSendEmail={handleSendEmail}
                  onPrint={handlePrint}
                  canGenerate={Object.keys(empleadosDB).length > 0 && Object.keys(eventosDB).length > 0}
                  canDisperse={reportes.length > 0}
                  isWeekDispersed={isCurrentWeekDispersed}
                  canExport={filteredReports.length > 0}
                  canExportAll={reportes.length > 0}
                  isGenerating={isGenerating}
                  isExporting={isExporting}
                  isExportingAll={isExportingAll}
                  isSupervisor={false}
                  onReleasePayroll={() => setIsReleaseModalOpen(true)}
                  isPayrollReleased={isPayrollReleased}
                  releaseTooltip="Módulo exclusivo de revisión global de nóminas"
                  overtimeRules={config.overtimeRules}
                  onOpenOvertimeConfig={() => setIsOvertimeConfigOpen(true)}
                />

                {/* Tabla de Asistencia y Empleados */}
                <AttendanceTable
                  reports={filteredReports}
                  onUpdateDayIncidence={handleUpdateDayIncidence}
                  onUpdateDayTimes={handleUpdateDayTimes}
                  onUpdateDayNote={handleUpdateDayNote}
                  onQuickConfirmFalta={handleQuickConfirmFalta}
                  horarios={horarios}
                  onAssignSchedule={handleAssignIndividual}
                  filteredCount={reportes.length}
                  onToggleOvertimeApproval={handleToggleOvertimeApproval}
                />
              </>
            )}
          </>
        )}

        {portalTab === 'semaforo' && (
          <RHPayrollMonitorView
            supervisors={supervisorsList}
            users={portalUsers}
            releases={releases}
            dispersals={dispersals}
            empleados={reportes.map(r => ({
              id: r.empleado.id,
              nombre: r.empleado.nombre,
              supervisor: r.empleado.jefe,
              totalHorasNormales: r.totalNormal,
              totalHorasExtras: r.totalExtra,
              asistencias: r.asistencias,
              faltas: r.faltas,
              retardos: r.retardos,
              checadasHuerfanas: r.dias.filter(d => d.huerfana).length,
              alertas: r.dias.filter(d => d.advertencia).map(d => d.advertencia || ''),
              dias: r.dias
            }))}
            semanaPeriodo={selectedWeek}
            semanaNumero={currentWeekNumber}
            currentUser={currentUser}
            defaultHorasLimite={config.horasLimiteLiberacion}
            onDownloadExcel={handleDownloadSupervisorExcel}
            onInspectSupervisor={(sup) => {
              setSelectedSupervisor(sup);
              setDispersionMode('existing');
              setPortalTab('nomina');
            }}
            onDisperseWeek={handleDisperseWeek}
            onCancelDispersal={handleCancelDispersal}
            onDownloadSupervisorReturnedExcel={handleDownloadSupervisorReturnedExcel}
            onOpenContpaqiModule={() => setPortalTab('contpaqi')}
          />
        )}

        {portalTab === 'contpaqi' && userHasModuleAccess(currentUser, 'contpaqi') && (
          <ContpaqiExportView
            reports={reportes}
            releases={releases}
            supervisors={supervisorsList}
            weekNumber={currentWeekNumber}
            weekPeriod={selectedWeek}
          />
        )}

        {portalTab === 'incidencias' && userHasModuleAccess(currentUser, 'incidencias') && (
          <IncidentsManagementView
            currentUser={currentUser}
            incidents={incidents}
            onOpenNewModal={() => handleOpenIncidentModalForEmp(undefined)}
            onApproveIncident={handleApproveIncident}
            onRejectIncident={handleRejectIncident}
            onOpenAssignSchedules={() => setIsAssignOpen(true)}
          />
        )}

        {portalTab === 'usuarios' && userHasAnyAdminPanelAccess(currentUser) && (
          <AdminUsersView
            users={portalUsers}
            supervisorsInCatalog={supervisorsList}
            onSaveUser={handleSavePortalUser}
            onDeleteUser={handleDeletePortalUser}
            horasLimiteLiberacion={config.horasLimiteLiberacion}
            onSaveHorasLimiteLiberacion={handleSaveHorasLimiteLiberacion}
            activeDispersal={currentWeekDispersalObj}
            currentWeekNumber={currentWeekNumber}
            currentUser={currentUser}
            emailConfig={emailConfig}
            onSaveEmailConfig={handleSaveEmailConfig}
            overtimeRules={config.overtimeRules}
            jornadaBase={config.jornadaBase}
            onSaveOvertimeRules={handleSaveOvertimeRules}
          />
        )}
        </main>
      </div>

      {/* Modales Existentes */}
      <OvertimeConfigModal
        isOpen={isOvertimeConfigOpen}
        onClose={() => setIsOvertimeConfigOpen(false)}
        rules={config.overtimeRules}
        jornadaBase={config.jornadaBase}
        onSaveRules={handleSaveOvertimeRules}
      />
      <ScheduleModal
        isOpen={isSchedulesOpen}
        onClose={() => setIsSchedulesOpen(false)}
        horarios={horarios}
        onSaveHorario={handleSaveHorario}
        onDeleteHorario={handleDeleteHorario}
        assignedCountBySchedule={assignedCountBySchedule}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onSwitchToAssign={() => setIsAssignOpen(true)}
      />

      <AssignScheduleModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        employees={Object.values(empleadosDB)}
        horarios={horarios}
        onAssignIndividual={handleAssignIndividual}
        onAssignBulk={handleAssignBulk}
        onSwitchToCreate={() => setIsSchedulesOpen(true)}
      />

      <RawPunchAuditModal
        isOpen={isRawPunchesOpen}
        onClose={() => setIsRawPunchesOpen(false)}
        employees={Object.values(empleadosDB)}
        eventosDB={eventosDB}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        currentUser={currentUser}
        emailConfig={emailConfig}
        onSaveEmailConfig={handleSaveEmailConfig}
      />

      {/* Modales del Portal Multirrol */}
      {isNewIncidentModalOpen && (
        <NewIncidentModal
          currentUser={currentUser}
          initialEmployeeId={initialIncidentEmployeeId}
          availableEmployees={(reportes.length > 0
            ? reportes.map(r => ({
                id: r.empleado.id,
                nombre: r.empleado.nombre,
                supervisor: r.empleado.jefe,
                totalHorasNormales: r.totalNormal,
                totalHorasExtras: r.totalExtra,
                asistencias: r.asistencias,
                faltas: r.faltas,
                retardos: r.retardos,
                checadasHuerfanas: r.dias.filter(d => d.huerfana).length,
                alertas: r.dias.filter(d => d.advertencia).map(d => d.advertencia || ''),
                dias: r.dias
              }))
            : Object.values(empleadosDB).map(emp => ({
                id: emp.id,
                nombre: emp.nombre,
                supervisor: emp.jefe,
                totalHorasNormales: 0,
                totalHorasExtras: 0,
                asistencias: 0,
                faltas: 0,
                retardos: 0,
                checadasHuerfanas: 0,
                alertas: [],
                dias: []
              }))
          ).filter(e => {
            if (currentUser.role === 'supervisor') {
              return allowedSupervisors.includes(e.supervisor);
            }
            return true;
          })}
          onClose={() => {
            setIsNewIncidentModalOpen(false);
            setInitialIncidentEmployeeId(undefined);
          }}
          onSubmit={handleSubmitNewIncident}
        />
      )}

      {isReleaseModalOpen && (
        <SupervisorReleaseModal
          currentUser={currentUser}
          targetSupervisor={currentSupervisorForRelease}
          semanaNumero={currentWeekNumber}
          semanaPeriodo={selectedWeek}
          empleadosCount={supervisorTeamStats.empleadosCount}
          horasNormales={supervisorTeamStats.horasNormales}
          horasExtras={supervisorTeamStats.horasExtras}
          alertasCount={supervisorTeamStats.alertasCount}
          pendingOvertimeCount={supervisorTeamStats.pendingOvertimeCount}
          pendingMissingPunchCount={supervisorTeamStats.pendingMissingPunchCount}
          onClose={() => setIsReleaseModalOpen(false)}
          onConfirmRelease={handleConfirmRelease}
        />
      )}

      {isSendEmailModalOpen && (
        <SendPayrollEmailModal
          isOpen={isSendEmailModalOpen}
          onClose={() => setIsSendEmailModalOpen(false)}
          reportes={reportes}
          supervisorsList={allowedSupervisors.length > 0 ? allowedSupervisors : supervisorsList}
          selectedSupervisor={selectedSupervisor}
          portalUsers={portalUsers}
          currentUser={currentUser}
          semanaNumero={currentWeekNumber}
          semanaPeriodo={selectedWeek}
          emailConfig={emailConfig}
          defaultCustomEmail={emailDestino || config.emailDestino}
          onSaveEmailConfig={handleSaveEmailConfig}
          onDisperseAndNotify={(targetSupervisors, customMessage) =>
            handleDisperseWeek(currentWeekNumber, selectedWeek, customMessage, targetSupervisors, false)
          }
          onAppendNotifications={(newNotifs) => {
            setNotifications((prev) => {
              const updated = [...newNotifs, ...prev];
              PortalService.saveNotifications(updated);
              return updated;
            });
          }}
          onSuccessToast={(msg, title) => showToast(msg, 'success', title)}
        />
      )}

      {isDisperseByListModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#21222D] rounded-3xl shadow-2xl border border-white/[0.1] max-w-2xl w-full overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-[#171821] via-[#1B1C26] to-[#21222D] border-b border-white/[0.08] p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] font-black text-base">
                  ✉
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A9DFD8] bg-[#A9DFD8]/15 px-2.5 py-0.5 rounded-md border border-[#A9DFD8]/30">
                    Semana {currentWeekNumber} · Dispersión Individual o Masiva
                  </span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-white">
                    Dispersar Listas de Asistencia y Notificar
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsDisperseByListModalOpen(false)}
                className="text-[#87888C] hover:text-white px-2.5 py-1 rounded-xl hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="bg-[#171821] border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-white">
                    Notificación Dual: Sistema + Correo Empresarial
                  </p>
                  <p className="text-[11px] text-[#87888C] mt-0.5">
                    Al dispersar una lista o todas las listas, el supervisor recibe alerta inmediata en la campana del sistema y en su correo corporativo con botón de acceso directo.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-[#21222D] px-3 py-2 rounded-xl border border-white/[0.1] shrink-0">
                  <input
                    type="checkbox"
                    checked={disperseSendEmail}
                    onChange={e => setDisperseSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#A9DFD8]"
                  />
                  <span className="text-xs font-bold text-white">Enviar Correo</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#87888C] uppercase tracking-wider mb-1.5">
                  Mensaje / Instrucciones para Supervisores
                </label>
                <input
                  type="text"
                  value={disperseByListMsg}
                  onChange={e => setDisperseByListMsg(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-medium text-white focus:border-[#A9DFD8] outline-none"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-[#87888C] uppercase tracking-wider">
                    Supervisores ({supervisorsList.length} Listas)
                  </span>
                  <button
                    onClick={() => {
                      handleDisperseWeek(currentWeekNumber, selectedWeek, disperseByListMsg, undefined, disperseSendEmail);
                      setIsDisperseByListModalOpen(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                  >
                    Dispersar Todas en un Solo Botón
                  </button>
                </div>

                <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden">
                  {supervisorsList.map((sup: string) => {
                    const isAlreadyDispersed = currentWeekDispersalObj?.supervisoresNotificados.some(
                      (n: string) => n.trim().toUpperCase() === sup.trim().toUpperCase()
                    );
                    const supUser = portalUsers.find(u =>
                      getUserAllowedLists(u).some(
                        (l: string) => l.trim().toUpperCase() === sup.trim().toUpperCase()
                      )
                    );
                    const empCount = Object.values(empleadosDB).filter(e => e.jefe === sup).length;
                    return (
                      <div key={sup} className="p-3.5 bg-[#171821] hover:bg-white/[0.02] flex items-center justify-between gap-3 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-white truncate">{sup}</span>
                            <span className="text-[10px] font-bold text-[#87888C] bg-[#21222D] border border-white/[0.08] px-2 py-0.5 rounded-md">
                              {empCount} colab.
                            </span>
                            {isAlreadyDispersed && (
                              <span className="text-[10px] font-extrabold text-[#A9DFD8] bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 px-2 py-0.5 rounded-md">
                                Dispersada
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#87888C] font-medium truncate mt-0.5">
                            Correo corporativo: <span className="font-bold text-[#20AEF3]">{supUser?.email || 'No asignado'}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => handleDisperseWeek(currentWeekNumber, selectedWeek, disperseByListMsg, [sup], disperseSendEmail)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                            isAlreadyDispersed
                              ? 'bg-[#21222D] hover:bg-[#2B2B36] text-slate-200 border border-white/[0.1]'
                              : 'bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] shadow-xs'
                          }`}
                        >
                          {isAlreadyDispersed ? 'Re-Dispersar y Notificar' : 'Dispersar esta Lista'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#171821] border-t border-white/[0.08] flex justify-end">
              <button
                onClick={() => setIsDisperseByListModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#21222D] border border-white/[0.1] text-xs font-bold text-slate-200 hover:bg-[#2B2B36] transition-colors cursor-pointer"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificaciones flotantes Toast para acciones masivas y feedback visual */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

