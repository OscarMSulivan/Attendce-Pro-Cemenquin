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
  FileSpreadsheet,
  Activity,
  FileText,
  Users,
  Check,
  LogOut,
  Bell,
  Mail,
  CheckCheck
} from 'lucide-react';
import { PortalNotification, PortalUser, UserRole, getUserAllowedLists } from '../../types/portal';

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
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const UserSessionBar: React.FC<UserSessionBarProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  activeTab,
  onTabChange,
  pendingIncidentsCount,
  pendingReleasesCount,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const assignedLists = getUserAllowedLists(currentUser);

  // Filtrar notificaciones relevantes para el usuario actual
  const userNotifications = notifications.filter(n => {
    if (currentUser.role === 'admin' || currentUser.role === 'rh') return true;
    const targetSup = (n.targetSupervisor || '').toUpperCase();
    return assignedLists.includes(targetSup) || n.targetUserId === currentUser.id;
  });

  const unreadNotifCount = userNotifications.filter(n => !n.leida).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-3 h-3 text-purple-400" /> Admin
          </span>
        );
      case 'rh':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Building2 className="w-3 h-3 text-blue-400" /> RH / Nóminas
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Briefcase className="w-3 h-3 text-amber-400" /> Supervisor
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
    <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 text-slate-200 no-print sticky top-16 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2.5">
          {/* Identidad del Usuario Activo + Campana de Notificaciones + Cerrar Sesión */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setIsNotifOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-950 transition-all text-left shadow-sm group cursor-pointer"
              >
                {/* Avatar con gradiente */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs shadow-inner shadow-white/20">
                  {getInitials(currentUser.name)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors">
                      {currentUser.name}
                    </span>
                    {currentUser.employeeId && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        #{currentUser.employeeId}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {getRoleBadge(currentUser.role)}
                    {currentUser.role === 'supervisor' && assignedLists.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        Lista: <strong>{assignedLists.join(', ')}</strong>
                      </span>
                    )}
                    {currentUser.delegatedSupervisor && (
                      <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
                        <span>Supliendo a {currentUser.delegatedSupervisor}</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Menú flotante moderno para alternar usuarios o cerrar sesión */}
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2.5 z-50 animate-scale-in">
                    <div className="px-2.5 py-1.5 mb-1.5 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Sesión Activa / Cambio Rápido
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Alterna de perfil o cierra tu sesión
                        </p>
                      </div>
                    </div>

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
                              setIsMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40 shadow-sm'
                                : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[11px] text-slate-300 shrink-0">
                                {getInitials(u.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-200 truncate">{u.name}</span>
                                  {u.employeeId && (
                                    <span className="font-mono text-[9px] font-bold text-slate-400">
                                      #{u.employeeId}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block truncate max-w-[155px]">
                                  {u.role === 'supervisor' && uLists.length > 0
                                    ? `Lista: ${uLists.join(', ')}`
                                    : u.email}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {getRoleBadge(u.role)}
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión (Ir a Login)</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Campana de Notificaciones (Sistema + Correo Electrónico Empresarial) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  setIsMenuOpen(false);
                }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  unreadNotifCount > 0
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/30'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title="Notificaciones de dispersión en sistema y correo electrónico empresarial"
              >
                <Bell className={`w-3.5 h-3.5 ${unreadNotifCount > 0 ? 'text-indigo-400 animate-bounce' : ''}`} />
                <span className="hidden sm:inline">Notificaciones</span>
                {unreadNotifCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-black">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-3 z-50 animate-scale-in">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-indigo-400" />
                          Bandeja de Notificaciones
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Avisos de dispersión en Sistema y Correo Empresarial
                        </p>
                      </div>
                      {unreadNotifCount > 0 && onMarkAllNotificationsRead && (
                        <button
                          type="button"
                          onClick={onMarkAllNotificationsRead}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck className="w-3 h-3" /> Marcar leídas
                        </button>
                      )}
                    </div>

                    {userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No tienes notificaciones pendientes.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {userNotifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (onMarkNotificationRead) onMarkNotificationRead(n.id);
                              onTabChange('nomina');
                              setIsNotifOpen(false);
                            }}
                            className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                              !n.leida
                                ? 'bg-indigo-950/40 border-indigo-500/40 text-slate-100'
                                : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-[11px] text-indigo-300 line-clamp-1">
                                {n.titulo}
                              </span>
                              {!n.leida && (
                                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {n.mensaje}
                            </p>
                            <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10px] font-mono text-slate-400">
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[160px]">{n.recipientEmail || currentUser.email}</span>
                              </span>
                              <span>{new Date(n.fechaEnvio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Botón directo Cerrar Sesión */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 text-xs font-semibold transition-all cursor-pointer"
              title="Cerrar sesión actual y volver a la pantalla de Login"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>

          {/* Segmented Tabs de Navegación según el Rol */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            {/* Pestaña Principal: Supervisor o Gestor RH */}
            <button
              type="button"
              onClick={() => onTabChange('nomina')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'nomina'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{currentUser.role === 'supervisor' ? 'Mi Portal Supervisor' : 'Carga y Proceso Nómina'}</span>
            </button>

            {/* Pestaña: Semáforo de Liberación (RH y Admin) */}
            {(currentUser.role === 'rh' || currentUser.role === 'admin') && (
              <button
                type="button"
                onClick={() => onTabChange('semaforo')}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'semaforo'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Semáforo de Nóminas</span>
                {pendingReleasesCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center animate-pulse">
                    {pendingReleasesCount}
                  </span>
                )}
              </button>
            )}

            {/* Pestaña: Incidencias / Solicitudes */}
            <button
              type="button"
              onClick={() => onTabChange('incidencias')}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'incidencias'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{currentUser.role === 'supervisor' ? 'Mis Solicitudes' : 'Bandeja de Incidencias'}</span>
              {pendingIncidentsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center animate-pulse">
                  {pendingIncidentsCount}
                </span>
              )}
            </button>

            {/* Pestaña: Hoja Electrónica CONTPAQi® Nóminas (RH y Admin) */}
            {(currentUser.role === 'rh' || currentUser.role === 'admin') && (
              <button
                type="button"
                onClick={() => onTabChange('contpaqi')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'contpaqi'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/40 border border-emerald-500/20'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CONTPAQi® Nóminas</span>
              </button>
            )}

            {/* Pestaña: Gestión de Usuarios y Roles (Solo Admin) */}
            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => onTabChange('usuarios')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'usuarios'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Usuarios y Listas</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
