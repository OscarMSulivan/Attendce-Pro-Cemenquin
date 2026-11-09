/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Home,
  Activity,
  FileText,
  FileSpreadsheet,
  Clock,
  UserCheck,
  History,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Laptop,
  Download,
  Upload,
  Calendar,
  X,
} from 'lucide-react';
import { UserRole, PortalUser, PortalModule, userHasModuleAccess, userHasAnyAdminPanelAccess } from '../types/portal';

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: UserRole;
  currentUser?: PortalUser;
  pendingIncidentsCount: number;
  pendingReleasesCount: number;
  onOpenSchedules: () => void;
  onOpenAssign: () => void;
  onOpenRawPunches: () => void;
  onOpenSettings: () => void;
  onDownloadPortable: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onLogout: () => void;
  hasEmployees: boolean;
  hasEvents: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onTabChange,
  userRole,
  currentUser,
  pendingIncidentsCount,
  pendingReleasesCount,
  onOpenSchedules,
  onOpenAssign,
  onOpenRawPunches,
  onOpenSettings,
  onDownloadPortable,
  onExportBackup,
  onImportBackup,
  onLogout,
  hasEmployees,
  hasEvents,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isSupervisor = userRole === 'supervisor';
  const isLocalFile = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const handleAction = (fn: () => void) => {
    fn();
    if (onCloseMobile) onCloseMobile();
  };

  const checkAccess = (mod: PortalModule) => {
    if (!currentUser) return true;
    return userHasModuleAccess(currentUser, mod);
  };

  const hasAdminPanelAccess = !currentUser || userHasAnyAdminPanelAccess(currentUser);
  const adminTabLabel = checkAccess('usuarios')
    ? 'Usuarios y Permisos'
    : 'Tiempo Límite y SMTP';

  const primaryItems = [
    {
      id: 'inicio',
      label: 'Inicio (Bienvenida)',
      icon: Home,
      onClick: () => handleAction(() => onTabChange('inicio')),
      isActive: activeTab === 'inicio',
      badge: 0,
      show: true,
    },
    {
      id: 'nomina',
      label: isSupervisor ? 'Mi Lista de Nómina' : 'Dashboard Nómina',
      icon: Calendar,
      onClick: () => handleAction(() => onTabChange('nomina')),
      isActive: activeTab === 'nomina',
      badge: 0,
      show: checkAccess('nomina'),
    },
    {
      id: 'semaforo',
      label: 'Semáforo de Nóminas',
      icon: Activity,
      onClick: () => handleAction(() => onTabChange('semaforo')),
      isActive: activeTab === 'semaforo',
      badge: pendingReleasesCount,
      show: checkAccess('semaforo'),
    },
    {
      id: 'incidencias',
      label: isSupervisor ? 'Mis Solicitudes' : 'Bandeja Incidencias',
      icon: FileText,
      onClick: () => handleAction(() => onTabChange('incidencias')),
      isActive: activeTab === 'incidencias',
      badge: pendingIncidentsCount,
      show: checkAccess('incidencias'),
    },
    {
      id: 'contpaqi',
      label: 'CONTPAQi® Nóminas',
      icon: FileSpreadsheet,
      onClick: () => handleAction(() => onTabChange('contpaqi')),
      isActive: activeTab === 'contpaqi',
      badge: 0,
      show: checkAccess('contpaqi'),
    },
    {
      id: 'usuarios',
      label: adminTabLabel,
      icon: Users,
      onClick: () => handleAction(() => onTabChange('usuarios')),
      isActive: activeTab === 'usuarios',
      badge: 0,
      show: hasAdminPanelAccess,
    },
  ].filter(item => item.show);

  const toolItems = [
    {
      id: 'horarios',
      label: 'Catálogo de Horarios',
      icon: Clock,
      onClick: () => handleAction(onOpenSchedules),
      disabled: false,
      show: !isSupervisor,
    },
    {
      id: 'asignar',
      label: 'Asignar Turno',
      icon: UserCheck,
      onClick: () => handleAction(onOpenAssign),
      disabled: !hasEmployees,
      show: !isSupervisor,
    },
    {
      id: 'crudas',
      label: 'Checadas Crudas',
      icon: History,
      onClick: () => handleAction(onOpenRawPunches),
      disabled: !hasEvents,
      show: !isSupervisor,
    },
    {
      id: 'ajustes',
      label: 'Configuración',
      icon: Settings,
      onClick: () => handleAction(onOpenSettings),
      disabled: false,
      show: true,
    },
  ].filter(item => item.show);

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <>
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#A9DFD8] text-[#171821] flex items-center justify-center font-black shadow-md shadow-[#A9DFD8]/20 shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
            </div>
            {!isCompact && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-extrabold tracking-tight text-white truncate">
                    Attendance<span className="text-[#A9DFD8]">PRO</span>
                  </span>
                </div>
                <span className="text-[10px] font-medium text-[#87888C] block mt-1 truncate">
                  Cemenquin · Nómina
                </span>
              </div>
            )}
          </div>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="w-8 h-8 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] text-[#87888C] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] text-[#87888C] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={collapsed ? 'Expandir menú lateral' : 'Compactar menú lateral'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          <div className="space-y-1.5">
            {!isCompact && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#87888C]/80 mb-2">
                Navegación
              </p>
            )}
            {primaryItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="relative flex items-center">
                  {/* Indicador vertical Mint Teal idéntico al diseño de referencia */}
                  {item.isActive && (
                    <span className="absolute -left-3 w-1 h-7 rounded-r-full bg-[#A9DFD8] shadow-[0_0_8px_#A9DFD8]" />
                  )}
                  <button
                    type="button"
                    onClick={item.onClick}
                    title={isCompact ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCompact ? 'justify-center px-2' : 'justify-between px-3.5'
                    } py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      item.isActive
                        ? 'bg-[#A9DFD8] text-[#171821] font-bold shadow-lg shadow-[#A9DFD8]/15'
                        : 'text-[#87888C] hover:text-white hover:bg-[#21222D]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          item.isActive ? 'text-[#171821] stroke-[2.4]' : 'text-[#87888C]'
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCompact && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold font-mono ${
                          item.isActive
                            ? 'bg-[#171821] text-[#A9DFD8]'
                            : 'bg-[#FEB95A]/20 text-[#FEB95A] border border-[#FEB95A]/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Herramientas y Catálogos */}
          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            {!isCompact && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#87888C]/80 mb-2">
                Herramientas
              </p>
            )}
            {toolItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  title={isCompact ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCompact ? 'justify-center px-2' : 'gap-3 px-3.5'
                  } py-2.5 rounded-xl text-xs font-medium text-[#87888C] hover:text-white hover:bg-[#21222D] transition-all cursor-pointer disabled:opacity-35 disabled:pointer-events-none`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#87888C]" />
                  {!isCompact && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            {!isLocalFile && (
              <button
                type="button"
                onClick={() => handleAction(onDownloadPortable)}
                title="Descargar versión HTML Portable"
                className={`w-full flex items-center ${
                  isCompact ? 'justify-center px-2' : 'gap-3 px-3.5'
                } py-2.5 rounded-xl text-xs font-medium text-[#A9DFD8] hover:bg-[#A9DFD8]/10 transition-all cursor-pointer`}
              >
                <Laptop className="w-4 h-4 shrink-0 text-[#A9DFD8]" />
                {!isCompact && <span className="truncate">HTML Portable</span>}
              </button>
            )}

            {!isCompact && (
              <div className="grid grid-cols-2 gap-1.5 pt-2 px-1">
                <button
                  type="button"
                  onClick={() => handleAction(onExportBackup)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] text-[#87888C] hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Exportar respaldo JSON"
                >
                  <Download className="w-3 h-3" />
                  <span>Respaldo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] text-[#87888C] hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Importar respaldo JSON"
                >
                  <Upload className="w-3 h-3" />
                  <span>Restaurar</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportBackup(file);
                      e.target.value = '';
                      if (onCloseMobile) onCloseMobile();
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Signout */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={() => handleAction(onLogout)}
            title={isCompact ? 'Cerrar sesión' : undefined}
            className={`w-full flex items-center ${
              isCompact ? 'justify-center px-2' : 'gap-3 px-3.5'
            } py-2.5 rounded-xl text-xs font-medium text-[#87888C] hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCompact && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Desktop Sticky Left Sidebar */}
      <aside
        className={`no-print hidden lg:flex flex-col shrink-0 bg-[#171821] border-r border-white/[0.06] select-none transition-all duration-200 sticky top-0 h-screen z-40 ${
          collapsed ? 'w-[72px]' : 'w-56 xl:w-60'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile / Tablet Drawer Overlay */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[82vw] bg-[#171821] border-r border-white/[0.08] h-full flex flex-col z-10 shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
