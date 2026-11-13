/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Send,
  ListChecks,
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
  onOpenOvertimeConfig?: () => void;
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
  onOpenOvertimeConfig,
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
      label: 'Dispersión de Nómina',
      icon: Send,
      onClick: () => handleAction(() => onTabChange('nomina')),
      isActive: activeTab === 'nomina',
      badge: 0,
      show: checkAccess('nomina'),
    },
    {
      id: 'trabajar_listas',
      label: 'Trabajar Listas',
      icon: ListChecks,
      onClick: () => handleAction(() => onTabChange('trabajar_listas')),
      isActive: activeTab === 'trabajar_listas',
      badge: 0,
      show: checkAccess('trabajar_listas'),
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

  const canAccessBackupAndPortable =
    !currentUser ||
    currentUser.role === 'admin' ||
    checkAccess('usuarios') ||
    hasAdminPanelAccess;

  const toolItems = [
    {
      id: 'horarios',
      label: 'Catálogo de Horarios',
      icon: Clock,
      onClick: () => handleAction(onOpenSchedules),
      disabled: false,
      show: checkAccess('nomina'),
    },
    {
      id: 'asignar',
      label: 'Asignar Turno',
      icon: UserCheck,
      onClick: () => handleAction(onOpenAssign),
      disabled: !hasEmployees,
      show: checkAccess('nomina'),
    },
    {
      id: 'crudas',
      label: 'Checadas Crudas',
      icon: History,
      onClick: () => handleAction(onOpenRawPunches),
      disabled: !hasEvents,
      show: checkAccess('nomina'),
    },
    {
      id: 'tiempo_extra',
      label: 'Config. Tiempo Extra',
      icon: Clock,
      onClick: () => handleAction(() => (onOpenOvertimeConfig ? onOpenOvertimeConfig() : onOpenSettings())),
      disabled: false,
      show: checkAccess('tiempo_extra'),
    },
    {
      id: 'ajustes',
      label: 'Configuración',
      icon: Settings,
      onClick: () => handleAction(onOpenSettings),
      disabled: false,
      show: hasAdminPanelAccess,
    },
  ].filter(item => item.show);

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <>
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0a1e5e] p-0.5 border border-white/15 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg"
                alt="Cemenquin"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-[9px]"
              />
            </div>
            {!isCompact && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-extrabold tracking-tight text-white truncate">
                    Cemen<span className="text-[#A9DFD8]">Qtime</span>
                  </span>
                </div>
                <span className="text-[10px] font-medium text-[#87888C] block mt-1 truncate">
                  Módulo de Recursos Humanos
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
              const pillLayoutId = isMobileDrawer ? 'sidebar-active-pill-mobile' : 'sidebar-active-pill-desktop';
              const barLayoutId = isMobileDrawer ? 'sidebar-active-bar-mobile' : 'sidebar-active-bar-desktop';
              return (
                <div key={item.id} className="relative flex items-center">
                  {/* Indicador vertical deslizante con layoutId */}
                  {item.isActive && (
                    <motion.span
                      layoutId={barLayoutId}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute -left-3 w-1 h-7 rounded-r-full bg-[#A9DFD8] shadow-[0_0_10px_#A9DFD8] z-20"
                    />
                  )}
                  <button
                    type="button"
                    onClick={item.onClick}
                    title={isCompact ? item.label : undefined}
                    className={`relative w-full flex items-center ${
                      isCompact ? 'justify-center px-2' : 'justify-between px-3.5'
                    } py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer overflow-hidden ${
                      item.isActive
                        ? 'text-[#0B0F17] font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {item.isActive && (
                      <motion.div
                        layoutId={pillLayoutId}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#A9DFD8] to-[#8CD4CB] shadow-[0_6px_20px_rgba(169,223,216,0.22)] z-0"
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          item.isActive ? 'text-[#0B0F17] stroke-[2.4]' : 'text-slate-400'
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCompact && item.badge > 0 && (
                      <span
                        className={`relative z-10 px-1.5 py-0.2 rounded-md text-[10px] font-extrabold font-mono tabular-nums ${
                          item.isActive
                            ? 'bg-[#0B0F17] text-[#A9DFD8]'
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

          {/* Herramientas y Catálogos (Oculto para supervisores sin accesos de configuración/administración) */}
          {(toolItems.length > 0 || canAccessBackupAndPortable) && (
            <div className="space-y-1.5 pt-3 border-t border-white/[0.08]">
              {!isCompact && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 mb-2">
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
                    } py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-35 disabled:pointer-events-none`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                    {!isCompact && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}

              {canAccessBackupAndPortable && !isLocalFile && (
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

              {canAccessBackupAndPortable && !isCompact && (
                <div className="grid grid-cols-2 gap-1.5 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => handleAction(onExportBackup)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] text-slate-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Exportar respaldo JSON"
                  >
                    <Download className="w-3 h-3" />
                    <span>Respaldo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] text-slate-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
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
          )}
        </div>

        {/* Footer Signout */}
        <div className="p-3 border-t border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => handleAction(onLogout)}
            title={isCompact ? 'Cerrar sesión' : undefined}
            className={`w-full flex items-center ${
              isCompact ? 'justify-center px-2' : 'gap-3 px-3.5'
            } py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
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
      {/* Desktop Sticky Left Sidebar (Acabado Dark Studio .ground-inverse en ambos modos) */}
      <aside
        className={`ground-inverse no-print hidden lg:flex flex-col shrink-0 bg-[#0B0F17] border-r border-slate-800/80 select-none transition-all duration-200 sticky top-0 h-screen z-40 shadow-xl ${
          collapsed ? 'w-[72px]' : 'w-56 xl:w-60'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile / Tablet Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={onCloseMobile}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="ground-inverse relative w-64 max-w-[82vw] bg-[#0B0F17] border-r border-white/10 h-full flex flex-col z-10 shadow-2xl"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
