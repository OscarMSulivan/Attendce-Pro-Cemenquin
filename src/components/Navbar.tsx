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

  const getStatusColor = () => {
    switch (statusType) {
      case 'success': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'warning': return 'bg-amber-500 shadow-amber-500/50';
      case 'error': return 'bg-rose-500 shadow-rose-500/50';
      default: return 'bg-blue-500 shadow-blue-500/50';
    }
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-slate-800 bg-slate-950/80 transition-colors dark:border-slate-800 dark:bg-slate-950/90 light:bg-white/90 light:border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-black">
            <ShieldCheck className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-lg font-black tracking-tight text-slate-100">
                Attendance<span className="text-amber-400">PRO</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                v10
              </span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mt-1">
              Control de Accesos y Asistencia
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <span className={`w-2 h-2 rounded-full animate-pulse shadow-sm ${getStatusColor()}`} />
          <span className="font-mono text-[11px] truncate max-w-xs">{statusMessage}</span>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Botón Descargar Versión Portable .HTML Directo desde memoria (sin peticiones de red ni cookies) */}
          {!isLocalFile && (
            <button
              type="button"
              onClick={onDownloadPortable}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 transition-all shadow-sm cursor-pointer"
              title="Descargar archivo .HTML portable para abrirlo con doble clic en tu PC sin instalar nada"
            >
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">HTML Portable</span>
            </button>
          )}

          {/* Quick Schedule & Assign buttons: EXCLUSIVO RH / NÓMINAS Y ADMIN */}
          {!isSupervisor && (
            <>
              <button
                type="button"
                onClick={onOpenSchedules}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-all shadow-sm hover:border-amber-500/50 cursor-pointer"
                title="Administrar catálogo de horarios programados"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Horarios</span>
              </button>

              <button
                type="button"
                onClick={onOpenAssign}
                disabled={!hasEmployees}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-all shadow-sm hover:border-amber-500/50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Asignar horarios a empleados"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Asignar</span>
              </button>

              <button
                type="button"
                onClick={onOpenRawPunches}
                disabled={!hasEvents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-all shadow-sm hover:border-amber-500/50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Ver checadas crudas del biométrico"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Checadas Crudas</span>
              </button>
            </>
          )}

          {/* Backup dropdown / buttons */}
          <button
            type="button"
            onClick={onExportBackup}
            className="p-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            title="Exportar respaldo de horarios y empleados (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all"
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

          {/* Config */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            title="Configuración del sistema"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 transition-all"
            title="Cambiar tema claro / oscuro"
          >
            {config.theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
};
