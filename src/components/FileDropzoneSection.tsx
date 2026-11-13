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
  onOpenEmployeesModule?: () => void;
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
  onOpenEmployeesModule,
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
    <section className="rounded-xl bg-[#21222D] border border-white/[0.08] mb-5 overflow-hidden">
      {/* Encabezado técnico compacto */}
      <div className="px-5 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-[#171821]/40">
        <div className="flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-[#A9DFD8]" />
          <h3 className="text-xs font-bold text-white tracking-tight">
            Insumos de nómina y reloj biométrico
          </h3>
          <span className="hidden sm:inline-block text-[11px] text-[#87888C]">
            — Fusión multi-empresa activa: los empleados se almacenan permanentemente sin borrarse al subir otra base
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-[#87888C]">
          <span>
            EMP: <strong className="text-white">{employeesCount}</strong>
          </span>
          <span className="opacity-30">|</span>
          <span>
            EVT: <strong className="text-white">{eventsCount}</strong>
          </span>
          <span className="opacity-30">|</span>
          <span>
            INC: <strong className="text-white">{vacationsCount}</strong>
          </span>
        </div>
      </div>

      {/* Ledger de 3 columnas con divisores de 1px */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
        {/* Paso 01: Base de Empleados */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="px-1.5 py-0.5 rounded bg-[#171821] text-[#87888C] border border-white/[0.08] text-[10px] font-mono font-bold tabular-nums">
                  01
                </span>
                Padrón de empleados
              </span>
              {employeesCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#10B981] tabular-nums">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {employeesCount} guardados
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#87888C]">Requerido</span>
              )}
            </div>

            <p className="text-[11px] text-[#87888C] mb-3 leading-relaxed">
              Padrón permanente multi-empresa. Subir una nueva base fusiona y conserva los empleados existentes.
            </p>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              ref={fileEmpRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onLoadEmployees(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileEmpRef.current?.click()}
                disabled={isLoadingEmployees}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-[#171821] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#A9DFD8]" />
                {isLoadingEmployees
                  ? 'Procesando...'
                  : employeesCount > 0
                  ? 'Fusionar otra base / empresa'
                  : 'Seleccionar archivo'}
              </button>

              {onOpenEmployeesModule && (
                <button
                  type="button"
                  onClick={onOpenEmployeesModule}
                  className="py-2 px-2.5 rounded-lg text-xs font-bold bg-[#A9DFD8]/15 hover:bg-[#A9DFD8]/25 text-[#A9DFD8] border border-[#A9DFD8]/30 transition-colors cursor-pointer shrink-0"
                  title="Abrir módulo de Empleados y Listas"
                >
                  Ver Listas
                </button>
              )}
            </div>

            {/* Banner de base guardada en almacenamiento si existe */}
            {savedEmployeesInfo && employeesCount === 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0 text-[#87888C]">
                  <Database className="w-3.5 h-3.5 text-[#FEB95A] shrink-0" />
                  <span className="truncate" title={`Guardada: ${formatFecha(savedEmployeesInfo.savedAt)}`}>
                    Memoria: <strong className="text-white font-mono tabular-nums">{savedEmployeesInfo.count}</strong> emp.
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onUseSavedEmployees}
                    className="py-1 px-2.5 rounded-md bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={onClearSavedEmployees}
                    className="p-1 rounded-md bg-[#171821] hover:bg-rose-500/15 text-[#87888C] hover:text-rose-500 border border-white/[0.08] transition-colors cursor-pointer"
                    title="Eliminar base guardada"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Paso 02: Eventos Checador */}
        <div
          className={`p-4 sm:p-5 flex flex-col justify-between transition-opacity ${
            employeesCount === 0 && eventsCount === 0 ? 'opacity-60' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="px-1.5 py-0.5 rounded bg-[#171821] text-[#87888C] border border-white/[0.08] text-[10px] font-mono font-bold tabular-nums">
                  02
                </span>
                Eventos de checador
              </span>
              {eventsCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#10B981] tabular-nums">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {eventsCount} emp. con evts.
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#87888C]">Requerido</span>
              )}
            </div>

            <p className="text-[11px] text-[#87888C] mb-3 leading-relaxed">
              Exportación de reloj biométrico (se acumulan checadas al subir archivos de 2 empresas).
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileEvtRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onLoadEvents(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />

            <button
              type="button"
              onClick={() => fileEvtRef.current?.click()}
              disabled={employeesCount === 0 || isLoadingEvents}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-[#171821] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Clock className="w-3.5 h-3.5 text-[#20AEF3]" />
              {isLoadingEvents
                ? 'Procesando...'
                : eventsCount > 0
                ? 'Sumar / Cargar checador'
                : 'Cargar checador'}
            </button>
          </div>
        </div>

        {/* Paso 03: Vacaciones / Incidencias */}
        <div
          className={`p-4 sm:p-5 flex flex-col justify-between transition-opacity ${
            eventsCount === 0 && vacationsCount === 0 ? 'opacity-60' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="px-1.5 py-0.5 rounded bg-[#171821] text-[#87888C] border border-white/[0.08] text-[10px] font-mono font-bold tabular-nums">
                  03
                </span>
                Vacaciones e incidencias
              </span>
              {vacationsCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#10B981] tabular-nums">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {vacationsCount} inc.
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#87888C]">Opcional</span>
              )}
            </div>

            <p className="text-[11px] text-[#87888C] mb-3 leading-relaxed">
              Permisos autorizados, incapacidades IMSS y periodos de vacaciones.
            </p>
          </div>

          <div>
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
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-[#171821] hover:bg-[#2B2B36] text-white border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Calendar className="w-3.5 h-3.5 text-[#FEB95A]" />
              {isLoadingVacations
                ? 'Procesando...'
                : vacationsCount > 0
                ? 'Reemplazar incidencias'
                : 'Cargar incidencias'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
