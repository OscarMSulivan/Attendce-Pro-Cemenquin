/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Sun
} from 'lucide-react';
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Popover,
  PopoverButton,
  PopoverPanel
} from '@headlessui/react';
import {
  PayrollModificationLog,
  PortalNotification,
  PortalUser,
  UserRole,
  getUserAllowedLists
} from '../../types/portal';

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
  theme = 'dark',
  onToggleTheme,
  onOpenMobileSidebar,
}) => {
  const [notifTab, setNotifTab] = useState<'avisos' | 'logs'>('avisos');
  const assignedLists = getUserAllowedLists(currentUser);

  // Filtrar notificaciones relevantes para el usuario actual
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
      case 'semaforo':
        return 'Semáforo de Liberación de Nóminas';
      case 'incidencias':
        return currentUser.role === 'supervisor' ? 'Mis Solicitudes e Incidencias' : 'Bandeja de Incidencias';
      case 'contpaqi':
        return 'Exportación CONTPAQi® Nóminas';
      case 'usuarios':
        return 'Gestión de Usuarios y Permisos';
      default:
        return currentUser.role === 'supervisor'
          ? 'Portal de Validación de Supervisor'
          : 'Panel de Control de Asistencia';
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-2.5 h-2.5 text-purple-400" /> Admin
          </span>
        );
      case 'rh':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Building2 className="w-2.5 h-2.5 text-blue-400" /> RH / Nóminas
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Briefcase className="w-2.5 h-2.5 text-amber-400" /> Supervisor
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
    <header className="bg-[#171821]/95 backdrop-blur-md border-b border-white/[0.06] text-slate-200 no-print sticky top-0 z-30 transition-colors">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Izquierda: Botón Menú Móvil + Título de Vista Activa + Estado del Sistema */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#A9DFD8] transition-colors cursor-pointer shrink-0"
              title="Abrir menú lateral"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                {getActiveViewTitle()}
              </h1>
              {currentUser.delegatedSupervisor && (
                <span className="hidden xl:inline-flex text-[10px] font-semibold text-amber-300 items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 shrink-0">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Supliendo a {currentUser.delegatedSupervisor}</span>
                </span>
              )}
            </div>
            {statusMessage && (
              <p className={`text-[11px] font-mono truncate max-w-xs sm:max-w-md lg:max-w-xl ${getStatusTextColor()}`}>
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Derecha: Campana de Notificaciones / Logs + Tema + Perfil de Usuario */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Campana de Notificaciones + Bitácora de Modificaciones de Lista */}
          <Popover className="relative">
            <PopoverButton
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer outline-none ${
                unreadNotifCount > 0
                  ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 border-teal-300 dark:border-[#A9DFD8]/40 text-teal-700 dark:text-[#A9DFD8] hover:bg-teal-100 dark:hover:bg-[#A9DFD8]/25'
                  : 'bg-slate-100 dark:bg-[#21222D] border-slate-200 dark:border-white/[0.07] text-slate-600 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Notificaciones de dispersión y Bitácora (Logs) de modificaciones de listas"
            >
              <Bell className={`w-4 h-4 ${unreadNotifCount > 0 ? 'text-teal-600 dark:text-[#A9DFD8] animate-bounce' : ''}`} />
              <span className="hidden md:inline">Avisos y Logs</span>
              {unreadNotifCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821] text-[10px] font-black font-mono">
                  {unreadNotifCount}
                </span>
              )}
              {userModificationLogs.length > 0 && (
                <span
                  className="hidden sm:inline-block px-1.5 py-0.2 rounded-full bg-purple-50 dark:bg-[#F2C8ED]/15 text-purple-700 dark:text-[#F2C8ED] border border-purple-200 dark:border-[#F2C8ED]/35 text-[10px] font-mono font-bold"
                  title={`${userModificationLogs.length} modificación(es) registrada(s) en la lista`}
                >
                  {userModificationLogs.length}
                </span>
              )}
            </PopoverButton>

            <PopoverPanel
              transition
              anchor="bottom end"
              className="z-50 mt-2 w-[90vw] max-w-[420px] rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.1] shadow-2xl p-3 text-slate-800 dark:text-slate-200 backdrop-blur-md outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
            >
              {({ close }) => (
                <>
                  {/* Pestañas superiores: Avisos vs Logs de Modificaciones */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1 bg-[#171821] p-1 rounded-xl border border-white/[0.06] flex-1">
                      <button
                        type="button"
                        onClick={() => setNotifTab('avisos')}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          notifTab === 'avisos'
                            ? 'bg-[#A9DFD8] text-[#171821] shadow'
                            : 'text-[#87888C] hover:text-white'
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
                            ? 'bg-[#A9DFD8] text-[#171821] shadow'
                            : 'text-[#87888C] hover:text-white'
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
                        className="text-[10px] font-bold text-[#A9DFD8] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <CheckCheck className="w-3 h-3" /> Leídas
                      </button>
                    )}
                  </div>

                  {notifTab === 'avisos' ? (
                    userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#87888C]">
                        No tienes notificaciones de dispersión pendientes.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {userNotifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (onMarkNotificationRead) onMarkNotificationRead(n.id);
                              onTabChange('nomina');
                              close();
                            }}
                            className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                              !n.leida
                                ? 'bg-[#171821] border-[#A9DFD8]/40 text-slate-100'
                                : 'bg-[#171821]/60 border-white/[0.05] text-[#87888C]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-[11px] text-[#A9DFD8] line-clamp-1">
                                {n.titulo}
                              </span>
                              {!n.leida && (
                                <span className="w-2 h-2 rounded-full bg-[#A9DFD8] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {n.mensaje}
                            </p>
                            <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-[#87888C]">
                              <span className="flex items-center gap-1 text-[#A9DFD8]">
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
                    <div className="p-6 text-center text-xs text-[#87888C]">
                      Aún no se han registrado modificaciones sobre las listas de asistencia de esta semana.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {userModificationLogs.map((log) => {
                        const badgeColor =
                          log.actionType === 'falta_confirmada' || log.actionType === 'tiempo_extra_rechazado'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : log.actionType === 'tiempo_extra_autorizado'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : log.actionType === 'formato_permiso'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30';

                        return (
                          <div
                            key={log.id}
                            onClick={() => {
                              onTabChange('nomina');
                              close();
                            }}
                            className="p-2.5 rounded-xl bg-[#171821] border border-white/[0.06] hover:border-[#A9DFD8]/40 text-xs transition-all cursor-pointer space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                  #{log.employeeId}
                                </span>
                                <span className="font-bold text-slate-100 text-[11px] truncate max-w-[160px]">
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

                            <p className="text-[11px] text-slate-200 font-medium leading-snug">
                              {log.summary}
                            </p>

                            {log.details && (
                              <p className="text-[10px] text-[#87888C] italic leading-snug">
                                {log.details}
                              </p>
                            )}

                            <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-[#87888C]">
                              <span>
                                {log.dayName} {log.isoDate} • Lista: <strong>{log.supervisorName}</strong>
                              </span>
                              {log.hasAttachment && (
                                <span className="text-[#A9DFD8] flex items-center gap-0.5 font-bold">
                                  <Paperclip className="w-2.5 h-2.5" /> {log.attachmentName || 'Adjunto'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </PopoverPanel>
          </Popover>

          {/* Botón Tema Claro / Oscuro */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#FEB95A] transition-all cursor-pointer"
              title="Cambiar entre tema oscuro y tema claro"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          )}

          {/* Selector de Perfil / Usuario Activo con Headless UI Menu */}
          <Menu as="div" className="relative">
            <MenuButton
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
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-[#87888C] transition-transform duration-200" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getRoleBadge(currentUser.role)}
                </div>
              </div>
            </MenuButton>

            <MenuItems
              transition
              anchor="bottom end"
              className="z-50 mt-2 w-80 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.1] shadow-2xl p-2.5 outline-none backdrop-blur-md transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
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
                      <MenuItem key={u.id}>
                        <button
                          type="button"
                          onClick={() => onSwitchUser(u.id)}
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
                      </MenuItem>
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
                <MenuItem>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </header>
  );
};
