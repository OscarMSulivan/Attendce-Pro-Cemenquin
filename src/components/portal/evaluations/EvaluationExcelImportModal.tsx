/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  EmployeeEvaluationRecord,
  EvaluationCampaign,
} from '../../../types/evaluations';
import {
  downloadEvaluationTemplateExcel,
  parseEvaluationsExcelBuffer,
} from '../../../services/evaluationService';

export interface EvaluationExcelImportModalProps {
  campaign: EvaluationCampaign;
  existingCount: number;
  onImport: (records: EmployeeEvaluationRecord[], mode: 'merge' | 'replace') => void;
  onClose: () => void;
}

const PREVIEW_LIMIT = 20;

export const EvaluationExcelImportModal: React.FC<
  EvaluationExcelImportModalProps
> = ({ campaign, existingCount, onImport, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<EmployeeEvaluationRecord[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadEvaluationTemplateExcel();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo generar la plantilla Excel: ${err.message}`
          : 'No se pudo generar la plantilla Excel.',
      );
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setErrorMessage(null);
    setWarnings([]);
    setParsedRecords([]);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseEvaluationsExcelBuffer(
        buffer,
        campaign.id,
        campaign.rules,
      );
      setWarnings(result.warnings);

      if (result.records.length === 0) {
        setErrorMessage(
          'El archivo no contiene registros válidos de colaboradores. Verifica las columnas esperadas o descarga la plantilla Excel.',
        );
        return;
      }

      setParsedRecords(result.records);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Error al leer el archivo: ${err.message}`
          : 'El archivo seleccionado está dañado o no es un Excel/CSV válido.',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleConfirmImport = () => {
    if (parsedRecords.length === 0) return;
    onImport(parsedRecords, existingCount > 0 ? mode : 'merge');
    onClose();
  };

  const previewRows = parsedRecords.slice(0, PREVIEW_LIMIT);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eval-excel-import-title"
    >
      <div className="bg-[#21222D] border border-[#2C2D3C] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2C2D3C] bg-[#171821] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="eval-excel-import-title"
                className="text-sm sm:text-base font-bold text-white truncate"
              >
                Importar Acumulados de Incidencias (Excel)
              </h3>
              <p className="text-xs text-[#8C8D9B] truncate">
                Campaña:{' '}
                <strong className="text-slate-200">{campaign.nombre}</strong> ·
                Incidencias {campaign.anioIncidencias}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Acciones superiores + plantilla */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#171821] border border-white/[0.06]">
            <div className="text-slate-300 space-y-0.5">
              <p className="font-semibold text-white">
                Sube el archivo Excel (.xlsx, .xls o .csv) con el acumulado anual
              </p>
              <p className="text-[11px] text-[#8C8D9B]">
                Columnas esperadas: Código, Nombre, Fecha Ingreso, Supervisor, Puesto, Departamento, FI, INC_Int, RE, PCGyPSG.
              </p>
            </div>

            <button
              type="button"
              disabled={isDownloadingTemplate}
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {isDownloadingTemplate
                  ? 'Generando...'
                  : 'Descargar plantilla Excel'}
              </span>
            </button>
          </div>

          {/* Zona Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-[#A9DFD8] bg-[#A9DFD8]/10'
                : 'border-white/[0.14] bg-[#171821]/70 hover:border-[#A9DFD8]/50 hover:bg-[#171821]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[#21222D] border border-white/[0.08] flex items-center justify-center text-[#A9DFD8]">
                {isParsing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>
              <p className="text-sm font-bold text-white">
                {isParsing
                  ? 'Procesando archivo...'
                  : fileName
                    ? `Archivo cargado: ${fileName}`
                    : 'Arrastra y suelta tu archivo Excel aquí'}
              </p>
              <p className="text-[11px] text-[#8C8D9B]">
                o haz clic para seleccionar un archivo{' '}
                <span className="font-mono text-slate-300">.xlsx, .xls, .csv</span>
              </p>
            </div>
          </div>

          {/* Errores */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-rose-300">No se pudo importar el archivo</p>
                <p className="text-[11px] text-rose-200/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Warnings del parser */}
          {warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Avisos de lectura ({warnings.length})</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-100/90 space-y-0.5 max-h-28 overflow-y-auto pl-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Selector de modo si ya existen registros en la campaña */}
          {existingCount > 0 && parsedRecords.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Modo de importación ({existingCount} colaborador
                  {existingCount === 1 ? '' : 'es'} existentes en la campaña)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    mode === 'merge'
                      ? 'bg-[#A9DFD8]/10 border-[#A9DFD8]/50'
                      : 'bg-[#171821] border-white/[0.06] hover:border-white/[0.15]'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value="merge"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                    className="mt-0.5 accent-[#A9DFD8]"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">Combinar / Actualizar</p>
                    <p className="text-[11px] text-[#8C8D9B]">
                      Mantiene evaluaciones ya capturadas y actualiza incidencias o agrega nuevos colaboradores.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    mode === 'replace'
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-[#171821] border-white/[0.06] hover:border-white/[0.15]'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    className="mt-0.5 accent-amber-400"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-300">Reemplazar campaña</p>
                    <p className="text-[11px] text-[#8C8D9B]">
                      Borra los registros previos de esta campaña y carga únicamente los del archivo.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Vista previa tabular */}
          {parsedRecords.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Vista previa: {parsedRecords.length} colaborador
                    {parsedRecords.length === 1 ? '' : 'es'} detectado
                    {parsedRecords.length === 1 ? '' : 's'}
                  </span>
                </div>
                {parsedRecords.length > PREVIEW_LIMIT && (
                  <span className="text-[11px] text-[#8C8D9B] font-mono">
                    Mostrando primeros {PREVIEW_LIMIT} de {parsedRecords.length}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#171821]">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#21222D] text-[10px] uppercase tracking-wider text-[#8C8D9B] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Colaborador</th>
                        <th className="px-3 py-2.5 font-bold">Supervisor</th>
                        <th className="px-3 py-2.5 font-bold">Puesto / Área</th>
                        <th className="px-2.5 py-2.5 font-bold text-center">FI</th>
                        <th className="px-2.5 py-2.5 font-bold text-center">INC</th>
                        <th className="px-2.5 py-2.5 font-bold text-center">RE</th>
                        <th className="px-2.5 py-2.5 font-bold text-center">PER</th>
                        <th className="px-3 py-2.5 font-bold text-right">
                          Puntaje Incidencias
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] text-[11px]">
                      {previewRows.map((rec) => (
                        <tr
                          key={rec.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white">
                              {rec.nombre}
                            </div>
                            {rec.empleadoId && (
                              <div className="text-[10px] font-mono text-[#8C8D9B]">
                                #{rec.empleadoId}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {rec.supervisor || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-slate-200">
                              {rec.puesto || '—'}
                            </div>
                            {rec.area && (
                              <div className="text-[10px] text-[#8C8D9B]">
                                {rec.area}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono tabular-nums text-slate-200">
                            {rec.incidencias.faltas}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono tabular-nums text-slate-200">
                            {rec.incidencias.incapacidades}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono tabular-nums text-slate-200">
                            {rec.incidencias.retardos}
                          </td>
                          <td className="px-2.5 py-2 text-center font-mono tabular-nums text-slate-200">
                            {rec.incidencias.permisos}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            <span className="font-bold text-[#A9DFD8]">
                              {rec.puntajesIncidencias.total}/
                              {rec.puntajesIncidencias.maxTotal}
                            </span>
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {rec.puntajesIncidencias.porcentaje}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#2C2D3C] bg-[#171821] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#8C8D9B]">
            <Users className="w-4 h-4 text-slate-400" />
            <span>
              {parsedRecords.length > 0
                ? `${parsedRecords.length} colaborador${parsedRecords.length === 1 ? '' : 'es'} listo${parsedRecords.length === 1 ? '' : 's'} para importar`
                : 'Selecciona un archivo para previsualizar los registros'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#21222D] hover:bg-[#2A2B36] text-slate-300 border border-white/[0.08] text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={parsedRecords.length === 0 || isParsing}
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] disabled:opacity-45 disabled:cursor-not-allowed text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                Importar {parsedRecords.length}{' '}
                {parsedRecords.length === 1 ? 'colaborador' : 'colaboradores'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
