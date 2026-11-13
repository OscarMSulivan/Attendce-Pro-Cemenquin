/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Briefcase,
  ChevronDown,
  RefreshCw,
  Check,
  LogOut,
  Bell,
  Mail,
  CheckCheck,
  History,
  Paperclip,
  Menu as MenuIcon,
  Moon,
  Sun,
  BellRing,
  BellOff,
  Radio,
} from 'lucide-react';
import {
  PayrollModificationLog,
  PortalNotification,
  PortalUser,
  UserRole,
  getUserAllowedLists,
  userHasModuleAccess,
} from '../../types/portal';
import { PushNotificationService, PushPermissionState } from '../../services/pushNotificationService';

interface UserSessionBarProps {
  currentUser: PortalUser;
  allUsers: PortalUser[];
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingIncidentsCount: number;
  pendingReleasesCount: number;
  notifications?: PortalNotification[];
  modificationLogs?: PayrollModificationLog[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  statusMessage?: string;
  statusType?: 'info' | 'success' | 'warning' | 'error';
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenMobileSidebar?: () => void;
}

export const UserSessionBar: React.FC<UserSessionBarProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  activeTab,
  onTabChange,
  notifications = [],
  modificationLogs = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  statusMessage,
  statusType = 'info',
  theme = 'light',
  onToggleTheme,
  onOpenMobileSidebar,
}) => {
  const [notifTab, setNotifTab] = useState<'avisos' | 'logs'>('avisos');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [pushPerm, setPushPerm] = useState<PushPermissionState>(() =>
    PushNotificationService.getPermissionState()
  );
  const [pushEnabled, setPushEnabled] = useState<boolean>(() =>
    PushNotificationService.isUserPushEnabled()
  );
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPushPerm(PushNotificationService.getPermissionState());
    setPushEnabled(PushNotificationService.isUserPushEnabled());
  }, [isNotifOpen]);

  const handleEnableOrTogglePush = async () => {
    const currentPerm = PushNotificationService.getPermissionState();
    if (currentPerm === 'unsupported') return;
    if (currentPerm !== 'granted') {
      const nextPerm = await PushNotificationService.requestPermission();
      setPushPerm(nextPerm);
      const isNowEnabled = nextPerm === 'granted';
      setPushEnabled(isNowEnabled);
      if (isNowEnabled) {
        await PushNotificationService.showNativeNotification({
          title: '🔔 Notificaciones Push Activadas — CemenQtime',
          body: `Hola ${currentUser.name}, recibirás alertas en tiempo real de nuevas incidencias y cambios en tu nómina sin recargar la página.`,
          tag: 'cemenqtime-push-welcome',
          targetTab: currentUser.role === 'supervisor' ? 'trabajar_listas' : 'semaforo',
          soundKind: 'success',
        });
      }
      return;
    }

    const nextEnabled = !pushEnabled;
    PushNotificationService.setUserPushPreference(nextEnabled);
    setPushEnabled(nextEnabled);
    if (nextEnabled) {
      await PushNotificationService.showNativeNotification({
        title: '🔔 Alertas Push Reactivadas — CemenQtime',
        body: 'Las alertas en tiempo real para tu sesión están activas.',
        tag: 'cemenqtime-push-toggle',
        soundKind: 'info',
      });
    }
  };

  const handleTestPushNotification = async () => {
    if (PushNotificationService.getPermissionState() !== 'granted') {
      await handleEnableOrTogglePush();
      return;
    }
    PushNotificationService.setUserPushPreference(true);
    setPushEnabled(true);
    await PushNotificationService.showNativeNotification({
      title: '⚡ Alerta en Tiempo Real · CemenQtime',
      body:
        currentUser.role === 'supervisor'
          ? `Lista(s) activa(s): ${assignedLists.join(', ') || 'General'}. Recibirás avisos inmediatos de dispersión, vencimientos e incidencias.`
          : 'Monitoreo Push activo: recibirás alertas inmediatas de nuevas incidencias y nóminas liberadas por supervisores.',
      tag: `cemenqtime-test-${Date.now()}`,
      targetTab: currentUser.role === 'supervisor' ? 'trabajar_listas' : 'incidencias',
      soundKind: 'success',
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotifOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const assignedLists = getUserAllowedLists(currentUser);

  // Filtrar notificaciones relevantes para el usuario actual (incluyendo alertas globales ALL para RH/Admin)
  const userNotifications = notifications.filter(n => {
    if (currentUser.role === 'admin' || currentUser.role === 'rh') return true;
    const targetSup = (n.targetSupervisor || '').toUpperCase();
    return assignedLists.includes(targetSup) || n.targetUserId === currentUser.id;
  });

  // Filtrar logs de modificaciones relevantes para el usuario actual
  const userModificationLogs = modificationLogs.filter(log => {
    if (currentUser.role === 'admin' || currentUser.role === 'rh') return true;
    return assignedLists.includes((log.supervisorName || '').toUpperCase());
  });

  const unreadNotifCount = userNotifications.filter(n => !n.leida).length;

  const getActiveViewTitle = () => {
    switch (activeTab) {
      case 'inicio':
        return 'Panel de Inicio y Bienvenida';
      case 'nomina':
        return 'Módulo de Dispersión y Cálculo de Nómina';
      case 'trabajar_listas':
        return 'Módulo para Trabajar y Liberar Listas';
      case 'semaforo':
        return 'Semáforo de Liberación de Nóminas';
      case 'incidencias':
        return currentUser.role === 'supervisor' ? 'Mis Solicitudes e Incidencias' : 'Bandeja de Incidencias';
      case 'contpaqi':
        return 'Exportación CONTPAQi® Nóminas';
      case 'usuarios':
        return 'Centro de Configuración, Usuarios y Accesos';
      default:
        return 'Panel de Control de Asistencia';
    }
  };

  const getStatusTextColor = () => {
    switch (statusType) {
      case 'success':
        return 'text-[#A9DFD8]';
      case 'warning':
        return 'text-[#FEB95A]';
      case 'error':
        return 'text-rose-400';
      default:
        return 'text-[#87888C]';
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-[#10B981] border border-emerald-500/30">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-[#10B981]" /> Admin
          </span>
        );
      case 'rh':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Building2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" /> RH / Nóminas
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Briefcase className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> Supervisor
          </span>
        );
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="bg-white/95 dark:bg-[#171821]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 no-print sticky top-0 z-30 transition-colors">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Izquierda: Botón Menú Móvil + Título de Vista Activa + Estado del Sistema */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-[#21222D] hover:bg-slate-200 dark:hover:bg-[#2B2B36] border border-slate-200 dark:border-white/[0.07] text-teal-700 dark:text-[#A9DFD8] transition-colors cursor-pointer shrink-0"
              title="Abrir menú lateral"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {getActiveViewTitle()}
              </h1>
              {currentUser.delegatedSupervisor && (
                <span className="hidden xl:inline-flex text-[10px] font-semibold text-amber-800 dark:text-amber-300 items-center gap-1 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/20 shrink-0">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Supliendo a {currentUser.delegatedSupervisor}</span>
                </span>
              )}
            </div>
            {statusMessage && (
              <p className={`text-[11px] font-mono tabular-nums truncate max-w-xs sm:max-w-md lg:max-w-xl ${getStatusTextColor()}`}>
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Derecha: Campana de Notificaciones / Logs + Tema + Perfil de Usuario */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Campana de Notificaciones + Bitácora de Modificaciones de Lista */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer outline-none ${
                unreadNotifCount > 0
                  ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 border-teal-300 dark:border-[#A9DFD8]/40 text-teal-800 dark:text-[#A9DFD8] hover:bg-teal-100 dark:hover:bg-[#A9DFD8]/25'
                  : 'bg-slate-100 dark:bg-[#21222D] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Notificaciones de dispersión y Bitácora (Logs) de modificaciones de listas"
            >
              <Bell className={`w-3.5 h-3.5 ${unreadNotifCount > 0 ? 'text-teal-600 dark:text-[#A9DFD8]' : ''}`} />
              <span className="hidden md:inline">Avisos y bitácora</span>
              {unreadNotifCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821] text-[10px] font-bold font-mono tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
              {userModificationLogs.length > 0 && (
                <span
                  className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#171821] text-slate-700 dark:text-[#A9DFD8] border border-slate-300 dark:border-white/[0.1] text-[10px] font-mono font-bold tabular-nums"
                  title={`${userModificationLogs.length} modificación(es) registrada(s) en la lista`}
                >
                  {userModificationLogs.length}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-[90vw] max-w-[420px] rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.1] shadow-2xl p-3 text-slate-800 dark:text-slate-200 backdrop-blur-md outline-none animate-scale-in"
              >
                {/* Pestañas superiores: Avisos vs Logs de Modificaciones */}
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#171821] p-1 rounded-xl border border-slate-200 dark:border-white/[0.06] flex-1">
                    <button
                      type="button"
                      onClick={() => setNotifTab('avisos')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        notifTab === 'avisos'
                          ? 'bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821] shadow'
                          : 'text-slate-600 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Avisos ({unreadNotifCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('logs')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        notifTab === 'logs'
                          ? 'bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821] shadow'
                          : 'text-slate-600 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Logs ({userModificationLogs.length})</span>
                    </button>
                  </div>

                  {notifTab === 'avisos' && unreadNotifCount > 0 && onMarkAllNotificationsRead && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="text-[10px] font-bold text-teal-700 dark:text-[#A9DFD8] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <CheckCheck className="w-3 h-3" /> Leídas
                    </button>
                  )}
                </div>

                {/* Barra de Estado y Activación de Notificaciones Web Push en Tiempo Real */}
                <div className="mb-2.5 p-2.5 rounded-xl bg-slate-100 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        pushEnabled && pushPerm === 'granted'
                          ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30'
                          : 'bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30'
                      }`}
                    >
                      {pushEnabled && pushPerm === 'granted' ? (
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Notificaciones Push (Tiempo Real)</span>
                        {pushEnabled && pushPerm === 'granted' && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#87888C] truncate">
                        {pushPerm === 'unsupported'
                          ? 'Sincronización en vivo activa en pantalla'
                          : pushPerm === 'denied'
                          ? 'Permiso bloqueado en el navegador · Alertas en pantalla activas'
                          : pushEnabled && pushPerm === 'granted'
                          ? 'Alertas instantáneas de nómina e incidencias sin refrescar'
                          : 'Activa alertas Push de escritorio para avisos inmediatos'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {pushPerm !== 'unsupported' && pushPerm !== 'denied' && (
                      <button
                        type="button"
                        onClick={handleEnableOrTogglePush}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                          pushEnabled && pushPerm === 'granted'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-[#A9DFD8] text-[#171821] hover:bg-[#92d4cc] shadow-sm'
                        }`}
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{pushEnabled && pushPerm === 'granted' ? 'Push Activo' : 'Activar Push'}</span>
                      </button>
                    )}
                    {pushPerm === 'granted' && (
                      <button
                        type="button"
                        onClick={handleTestPushNotification}
                        className="px-2 py-1.5 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.08] text-[10px] font-bold text-[#A9DFD8] transition-colors cursor-pointer"
                        title="Enviar notificación Push de prueba"
                      >
                        Probar
                      </button>
                    )}
                  </div>
                </div>

                {notifTab === 'avisos' ? (
                  userNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-[#87888C]">
                      No tienes notificaciones de dispersión o incidencias pendientes.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {userNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (onMarkNotificationRead) onMarkNotificationRead(n.id);
                            const isIncidentOrSchedule =
                              n.titulo.toLowerCase().includes('horario') ||
                              n.titulo.toLowerCase().includes('incidencia');
                            if (isIncidentOrSchedule && userHasModuleAccess(currentUser, 'incidencias')) {
                              onTabChange('incidencias');
                            } else if (
                              currentUser.role === 'supervisor' &&
                              userHasModuleAccess(currentUser, 'trabajar_listas')
                            ) {
                              onTabChange('trabajar_listas');
                            } else if (userHasModuleAccess(currentUser, 'nomina')) {
                              onTabChange('nomina');
                            } else {
                              onTabChange('trabajar_listas');
                            }
                            setIsNotifOpen(false);
                          }}
                          className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                            !n.leida
                              ? 'bg-teal-50/70 dark:bg-[#171821] border-teal-300 dark:border-[#A9DFD8]/40 text-slate-900 dark:text-slate-100 shadow-sm'
                              : 'bg-slate-50 dark:bg-[#171821]/60 border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-[#87888C]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-[11px] text-teal-800 dark:text-[#A9DFD8] line-clamp-1">
                              {n.titulo}
                            </span>
                            {!n.leida && (
                              <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-[#A9DFD8] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                            {n.mensaje}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-[#87888C]">
                            <span className="flex items-center gap-1 text-teal-700 dark:text-[#A9DFD8]">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[160px]">{n.recipientEmail || currentUser.email}</span>
                            </span>
                            <span>{new Date(n.fechaEnvio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : userModificationLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-[#87888C]">
                    Aún no se han registrado modificaciones sobre las listas de asistencia de esta semana.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {userModificationLogs.map((log) => {
                      const badgeColor =
                        log.actionType === 'falta_confirmada' || log.actionType === 'tiempo_extra_rechazado'
                          ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                          : log.actionType === 'tiempo_extra_autorizado'
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                          : log.actionType === 'formato_permiso'
                          ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/30'
                          : 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/30';

                      return (
                        <div
                          key={log.id}
                          onClick={() => {
                            onTabChange('nomina');
                            setIsNotifOpen(false);
                          }}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] hover:border-teal-400 dark:hover:border-[#A9DFD8]/40 text-xs transition-all cursor-pointer space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                                #{log.employeeId}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] truncate max-w-[160px]">
                                {log.employeeName}
                              </span>
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${badgeColor}`}>
                              {log.actionType === 'checada_agregada'
                                ? 'Checada sin Gafete'
                                : log.actionType === 'formato_permiso'
                                ? 'Permiso / Solicitud'
                                : log.actionType === 'falta_confirmada'
                                ? 'Falta Confirmada'
                                : log.actionType === 'tiempo_extra_autorizado'
                                ? 'Extra Autorizado ✓'
                                : log.actionType === 'tiempo_extra_rechazado'
                                ? 'Extra NO Autorizado'
                                : log.actionType === 'cambio_incidencia'
                                ? 'Incidencia'
                                : 'Nota'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-snug">
                            {log.summary}
                          </p>

                          {log.details && (
                            <p className="text-[10px] text-slate-500 dark:text-[#87888C] italic leading-snug">
                              {log.details}
                            </p>
                          )}

                          <div className="pt-1 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-[#87888C]">
                            <span>
                              {log.dayName} {log.isoDate} • Lista: <strong>{log.supervisorName}</strong>
                            </span>
                            {log.hasAttachment && (
                              <span className="text-teal-700 dark:text-[#A9DFD8] flex items-center gap-0.5 font-bold">
                                <Paperclip className="w-2.5 h-2.5" /> {log.attachmentName || 'Adjunto'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón Tema Claro Técnico / Oscuro Carbon Ledger */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#21222D] hover:bg-slate-200 dark:hover:bg-[#2B2B36] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#FEB95A] text-xs font-semibold transition-colors cursor-pointer"
              title={
                theme === 'light'
                  ? 'Cambiar a Modo Oscuro (Carbon Ledger)'
                  : 'Cambiar a Modo Claro Técnico (Stone & Blueprint)'
              }
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden lg:inline text-[11px]">Oscuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FEB95A]" />
                  <span className="hidden lg:inline text-[11px]">Claro</span>
                </>
              )}
            </button>
          )}

          {/* Selector de Perfil / Usuario Activo */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.07] hover:border-teal-500/40 dark:hover:border-[#A9DFD8]/40 transition-all text-left cursor-pointer outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/40 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8] font-extrabold text-xs shrink-0">
                {getInitials(currentUser.name)}
              </div>

              <div className="hidden sm:block min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                    {currentUser.name}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 dark:text-[#87888C] transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getRoleBadge(currentUser.role)}
                </div>
              </div>
            </button>

            {isUserMenuOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-80 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.1] shadow-2xl p-2.5 outline-none backdrop-blur-md animate-scale-in"
              >
                <div className="px-2.5 py-1.5 mb-1.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#87888C]">
                      {currentUser.role === 'admin' ? 'Sesión Activa / Perfiles (Admin)' : 'Mi Sesión Activa'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                {currentUser.role === 'admin' ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {allUsers.filter(u => u.active !== false).map((u) => {
                      const isSelected = u.id === currentUser.id;
                      const uLists = getUserAllowedLists(u);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            onSwitchUser(u.id);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-900 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/40'
                              : 'hover:bg-slate-100 dark:hover:bg-[#171821] text-slate-700 dark:text-slate-300 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#171821] flex items-center justify-center font-bold text-[11px] text-teal-700 dark:text-[#A9DFD8] shrink-0">
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-slate-200 truncate">{u.name}</span>
                                {u.employeeId && (
                                  <span className="font-mono text-[9px] font-bold text-slate-400 dark:text-[#87888C]">
                                    #{u.employeeId}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-[#87888C] block truncate max-w-[155px]">
                                {u.role === 'supervisor' && uLists.length > 0
                                  ? `Lista: ${uLists.join(', ')}`
                                  : u.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getRoleBadge(u.role)}
                            {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                    {currentUser.employeeId && (
                      <p className="font-mono text-[11px] text-teal-600 dark:text-[#A9DFD8]">No. Empleado: #{currentUser.employeeId}</p>
                    )}
                    {assignedLists.length > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-[#FEB95A]">Lista(s): {assignedLists.join(', ')}</p>
                    )}
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
