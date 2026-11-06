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
  Upload
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
    <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
            <Upload className="w-4 h-4 text-[#A9DFD8]" />
            Carga de Archivos de Nómina
          </h3>
          <p className="text-xs text-[#87888C] mt-0.5">
            Importa tu catálogo de empleados, eventos del reloj biométrico e incidencias (.xlsx, .xls, .csv)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Paso 1: Base de Empleados */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            employeesCount > 0
              ? 'border-[#A9DFD8]/40 bg-[#171821]'
              : 'border-white/[0.05] bg-[#171821] hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="w-5 h-5 rounded-md bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30 flex items-center justify-center text-[11px] font-mono font-bold">
                01
              </span>
              Base de Empleados
            </span>
            {employeesCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#A9DFD8]">
                <CheckCircle className="w-3.5 h-3.5" />
                {employeesCount} reg.
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#87888C] mb-3">
            Catálogo de colaboradores con sus horarios y supervisores.
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
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-[#21222D] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FEB95A]" />
            {isLoadingEmployees
              ? 'Procesando...'
              : employeesCount > 0
              ? 'Reemplazar Empleados'
              : 'Seleccionar Archivo'}
          </button>

          {/* Banner de base guardada en almacenamiento si existe */}
          {savedEmployeesInfo && employeesCount === 0 && (
            <div className="mt-3 p-2.5 rounded-xl bg-[#FEB95A]/10 border border-[#FEB95A]/30 text-[11px]">
              <div className="flex items-start gap-2 mb-2 text-[#E8E8EA] leading-tight">
                <Database className="w-4 h-4 text-[#FEB95A] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#FEB95A] font-semibold block">Base guardada en memoria</strong>
                  <span className="text-[#87888C]">
                    {savedEmployeesInfo.count} empleados ({formatFecha(savedEmployeesInfo.savedAt)})
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onUseSavedEmployees}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] font-bold text-[11px] transition-all cursor-pointer"
                >
                  Usar Guardada
                </button>
                <button
                  type="button"
                  onClick={onClearSavedEmployees}
                  className="p-1.5 rounded-lg bg-[#21222D] hover:bg-rose-900/40 text-[#87888C] hover:text-rose-400 transition-all cursor-pointer"
                  title="Eliminar base guardada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Eventos Checador */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            eventsCount > 0
              ? 'border-[#A9DFD8]/40 bg-[#171821]'
              : employeesCount === 0
              ? 'border-white/[0.04] bg-[#171821]/60 opacity-60'
              : 'border-white/[0.05] bg-[#171821] hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="w-5 h-5 rounded-md bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30 flex items-center justify-center text-[11px] font-mono font-bold">
                02
              </span>
              Eventos Checador
            </span>
            {eventsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#A9DFD8]">
                <CheckCircle className="w-3.5 h-3.5" />
                {eventsCount} evts.
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#87888C] mb-3">
            Archivo Excel con registros biométricos (ENT, ERT, SNT, RST).
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
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-[#21222D] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4 text-[#20AEF3]" />
            {isLoadingEvents
              ? 'Procesando...'
              : eventsCount > 0
              ? 'Reemplazar Eventos'
              : 'Cargar Checador'}
          </button>
        </div>

        {/* Paso 3: Vacaciones / FINJ */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            vacationsCount > 0
              ? 'border-[#A9DFD8]/40 bg-[#171821]'
              : eventsCount === 0
              ? 'border-white/[0.04] bg-[#171821]/60 opacity-60'
              : 'border-white/[0.05] bg-[#171821] hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="w-5 h-5 rounded-md bg-[#F2C8ED]/15 text-[#F2C8ED] border border-[#F2C8ED]/30 flex items-center justify-center text-[11px] font-mono font-bold">
                03
              </span>
              Vacaciones / Incidencias
            </span>
            {vacationsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#A9DFD8]">
                <CheckCircle className="w-3.5 h-3.5" />
                {vacationsCount} inc.
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#87888C] mb-3">
            Archivo opcional con permisos, incapacidades y vacaciones.
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
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-[#21222D] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Calendar className="w-4 h-4 text-[#F2C8ED]" />
            {isLoadingVacations
              ? 'Procesando...'
              : vacationsCount > 0
              ? 'Reemplazar Incidencias'
              : 'Cargar Vacaciones'}
          </button>
        </div>
      </div>
    </div>
  );
};
