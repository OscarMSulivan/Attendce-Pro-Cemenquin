/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Database, 
  Trash2, 
  Upload, 
  AlertCircle 
} from 'lucide-react';

interface FileDropzoneSectionProps {
  onLoadEmployees: (file: File) => void;
  onLoadEvents: (file: File) => void;
  onLoadVacations: (file: File) => void;
  isLoadingEmployees: boolean;
  isLoadingEvents: boolean;
  isLoadingVacations: boolean;
  employeesCount: number;
  eventsCount: number;
  vacationsCount: number;
  savedEmployeesInfo: { count: number; savedAt: string } | null;
  onUseSavedEmployees: () => void;
  onClearSavedEmployees: () => void;
}

export const FileDropzoneSection: React.FC<FileDropzoneSectionProps> = ({
  onLoadEmployees,
  onLoadEvents,
  onLoadVacations,
  isLoadingEmployees,
  isLoadingEvents,
  isLoadingVacations,
  employeesCount,
  eventsCount,
  vacationsCount,
  savedEmployeesInfo,
  onUseSavedEmployees,
  onClearSavedEmployees,
}) => {
  const fileEmpRef = useRef<HTMLInputElement>(null);
  const fileEvtRef = useRef<HTMLInputElement>(null);
  const fileVacRef = useRef<HTMLInputElement>(null);

  const formatFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-MX', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return iso;
    }
  };

  return (
    <div className="rounded-xl p-6 bg-slate-900/90 border border-slate-800 shadow-md mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Upload className="w-4 h-4 text-amber-400" />
          Carga de Archivos de Nómina
        </h3>
        <span className="text-[11px] text-slate-400">
          Formatos soportados: Excel (.xlsx, .xls) y CSV
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Paso 1: Base de Empleados */}
        <div className={`p-4 rounded-xl border transition-all ${
          employeesCount > 0 
            ? 'border-emerald-500/40 bg-emerald-950/10' 
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                1
              </span>
              Base de Empleados
            </span>
            {employeesCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {employeesCount} reg.
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Sube el catálogo de empleados con horarios y supervisores.
          </p>

          <input
            type="file"
            ref={fileEmpRef}
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onLoadEmployees(e.target.files[0]);
            }}
          />

          <button
            type="button"
            onClick={() => fileEmpRef.current?.click()}
            disabled={isLoadingEmployees}
            className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            {isLoadingEmployees ? 'Procesando...' : employeesCount > 0 ? 'Reemplazar Empleados' : 'Seleccionar Archivo'}
          </button>

          {/* Banner de base guardada en almacenamiento si existe */}
          {savedEmployeesInfo && employeesCount === 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px]">
              <div className="flex items-start gap-2 mb-2 text-slate-200 leading-tight">
                <Database className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-400 font-semibold block">Base guardada en memoria</strong>
                  <span>{savedEmployeesInfo.count} empleados ({formatFecha(savedEmployeesInfo.savedAt)})</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onUseSavedEmployees}
                  className="flex-1 py-1 px-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wider text-[10px] transition-all"
                >
                  Usar Guardada
                </button>
                <button
                  type="button"
                  onClick={onClearSavedEmployees}
                  className="p-1 rounded bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition-all"
                  title="Eliminar base guardada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Eventos Checador */}
        <div className={`p-4 rounded-xl border transition-all ${
          eventsCount > 0 
            ? 'border-emerald-500/40 bg-emerald-950/10' 
            : employeesCount === 0 
              ? 'border-slate-800/50 bg-slate-950/30 opacity-60' 
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="w-5 h-5 rounded-full bg-blue-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                2
              </span>
              Eventos Checador
            </span>
            {eventsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {eventsCount} evts.
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Excel con registros biométricos (ENT, ERT, SNT, RST).
          </p>

          <input
            type="file"
            ref={fileEvtRef}
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onLoadEvents(e.target.files[0]);
            }}
          />

          <button
            type="button"
            onClick={() => fileEvtRef.current?.click()}
            disabled={employeesCount === 0 || isLoadingEvents}
            className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4 text-blue-400" />
            {isLoadingEvents ? 'Procesando...' : eventsCount > 0 ? 'Reemplazar Eventos' : 'Cargar Checador'}
          </button>
        </div>

        {/* Paso 3: Vacaciones / FINJ */}
        <div className={`p-4 rounded-xl border transition-all ${
          vacationsCount > 0 
            ? 'border-emerald-500/40 bg-emerald-950/10' 
            : eventsCount === 0 
              ? 'border-slate-800/50 bg-slate-950/30 opacity-60' 
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                3
              </span>
              Vacaciones / FINJ
            </span>
            {vacationsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {vacationsCount} inc.
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            CSV o Excel con permisos, incapacidades y vacaciones.
          </p>

          <input
            type="file"
            ref={fileVacRef}
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onLoadVacations(e.target.files[0]);
            }}
          />

          <button
            type="button"
            onClick={() => fileVacRef.current?.click()}
            disabled={eventsCount === 0 || isLoadingVacations}
            className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            {isLoadingVacations ? 'Procesando...' : vacationsCount > 0 ? 'Reemplazar Incidencias' : 'Cargar Vacaciones'}
          </button>
        </div>
      </div>
    </div>
  );
};
