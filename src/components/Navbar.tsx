/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  ShieldCheck,
  Moon,
  Sun,
  Download,
  Upload,
  Settings,
  Clock,
  Users,
  FileSpreadsheet,
  Laptop
} from 'lucide-react';
import { AppConfig } from '../types/attendance';

interface NavbarProps {
  statusMessage: string;
  statusType: 'info' | 'success' | 'warning' | 'error';
  config: AppConfig;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenSchedules: () => void;
  onOpenAssign: () => void;
  onOpenRawPunches: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onDownloadPortable: () => void;
  hasEmployees: boolean;
  hasEvents: boolean;
  isSupervisor?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  statusMessage,
  statusType,
  config,
  onToggleTheme,
  onOpenSettings,
  onOpenSchedules,
  onOpenAssign,
  onOpenRawPunches,
  onExportBackup,
  onImportBackup,
  onDownloadPortable,
  hasEmployees,
  hasEvents,
  isSupervisor = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLocalFile = typeof window !== 'undefined' && window.location.protocol === 'file:';

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

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#171821]/95 backdrop-blur-md transition-colors no-print">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Brand / Desktop Context Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="lg:hidden w-8 h-8 rounded-xl bg-[#A9DFD8] flex items-center justify-center text-[#171821] font-black shrink-0">
            <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
          </div>
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              Panel de Control de Asistencia
            </span>
            <span className={`hidden md:inline-block ml-3 text-xs font-mono truncate max-w-md align-middle ${getStatusTextColor()}`}>
              · {statusMessage}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isLocalFile && (
            <button
              type="button"
              onClick={onDownloadPortable}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#A9DFD8]/15 hover:bg-[#A9DFD8]/25 border border-[#A9DFD8]/35 text-[#A9DFD8] transition-all cursor-pointer whitespace-nowrap"
              title="Descargar archivo .HTML portable para abrirlo con doble clic en tu PC"
            >
              <Laptop className="w-3.5 h-3.5 text-[#A9DFD8]" />
              <span className="hidden sm:inline">HTML Portable</span>
            </button>
          )}

          {!isSupervisor && (
            <>
              <button
                type="button"
                onClick={onOpenSchedules}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#E8E8EA] transition-all cursor-pointer whitespace-nowrap"
                title="Administrar catálogo de horarios programados"
              >
                <Clock className="w-3.5 h-3.5 text-[#FEB95A]" />
                <span className="hidden sm:inline">Horarios</span>
              </button>

              <button
                type="button"
                onClick={onOpenAssign}
                disabled={!hasEmployees}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#E8E8EA] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap"
                title="Asignar horarios a empleados"
              >
                <Users className="w-3.5 h-3.5 text-[#A9DFD8]" />
                <span className="hidden sm:inline">Asignar</span>
              </button>

              <button
                type="button"
                onClick={onOpenRawPunches}
                disabled={!hasEvents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#E8E8EA] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap"
                title="Ver checadas crudas del biométrico"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#20AEF3]" />
                <span className="hidden xl:inline">Checadas Crudas</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onExportBackup}
            className="p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#87888C] hover:text-white transition-all cursor-pointer"
            title="Exportar respaldo de horarios y empleados (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#87888C] hover:text-white transition-all cursor-pointer"
            title="Importar respaldo (JSON)"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onImportBackup(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#87888C] hover:text-white transition-all cursor-pointer"
            title="Configuración del sistema"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.07] text-[#FEB95A] transition-all cursor-pointer"
            title="Cambiar tema claro / oscuro"
          >
            {config.theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
