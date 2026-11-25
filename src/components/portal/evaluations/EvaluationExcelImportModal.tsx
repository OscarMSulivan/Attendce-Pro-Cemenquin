/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Columns3,
  Download,
  FileSpreadsheet,
  Link2,
  ListFilter,
  Plus,
  Sparkles,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type {
  EmployeeEvaluationRecord,
  EvaluationCampaign,
  IncidenceMetricKey,
} from '../../../types/evaluations';
import {
  analyzeEvaluationsExcelBuffer,
  applyExcelMappingToCampaign,
  downloadEvaluationTemplateExcel,
  extractUniqueCodesForColumn,
  getCustomMappingLabel,
  isCustomMappingTarget,
  saveIncidenceCodeDictionary,
  type ExcelImportFormatMode,
  type ExcelImportMapping,
  type ExcelMappingTarget,
  type ExcelSheetAnalysis,
} from '../../../services/evaluationService';

export interface EvaluationExcelImportModalProps {
  campaign: EvaluationCampaign;
  existingRecords: EmployeeEvaluationRecord[];
  onApplyMappedRecords: (
    finalCampaignRecords: EmployeeEvaluationRecord[],
    summary: { matchedCount: number; untouchedCount: number; addedUnmatchedCount: number },
  ) => void;
  onClose: () => void;
}

const BASE_TARGET_OPTIONS: { value: ExcelMappingTarget; label: string }[] = [
  { value: 'ignore', label: 'Ignorar (no sumar)' },
  { value: 'faltas', label: 'Faltas Injustificadas (FI)' },
  { value: 'incapacidades', label: 'Incapacidades (INC)' },
  { value: 'retardos', label: 'Retardos (RE)' },
  { value: 'permisos', label: 'Permisos (PCG / PSG)' },
];

const CREATE_CUSTOM_SENTINEL = '__create_custom__';

function getTargetBadgeClass(target: ExcelMappingTarget): string {
  if (target === 'faltas') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  if (target === 'incapacidades') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (target === 'retardos') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  if (target === 'permisos') return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  if (isCustomMappingTarget(target)) {
    return 'bg-teal-500/15 text-teal-200 border-teal-500/35';
  }
  return 'bg-white/[0.04] text-[#87888C] border-white/[0.08]';
}

const TARGET_SHORT_LABEL: Record<IncidenceMetricKey, string> = {
  faltas: 'Faltas',
  incapacidades: 'Incapacidades',
  retardos: 'Retardos',
  permisos: 'Permisos',
};

const PREVIEW_LIMIT = 25;

export const EvaluationExcelImportModal: React.FC<EvaluationExcelImportModalProps> = ({
  campaign,
  existingRecords,
  onApplyMappedRecords,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [analysis, setAnalysis] = useState<ExcelSheetAnalysis | null>(null);
  const [mapping, setMapping] = useState<ExcelImportMapping | null>(null);
  const [includeUnmatched, setIncludeUnmatched] = useState(existingRecords.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customMetrics, setCustomMetrics] = useState<string[]>([]);
  const [newCustomMetricName, setNewCustomMetricName] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const syncCustomMetricsFromMapping = (m: ExcelImportMapping) => {
    const found = new Set<string>();
    Object.values(m.columnMetricMap).forEach(t => {
      if (isCustomMappingTarget(t)) found.add(getCustomMappingLabel(t));
    });
    Object.values(m.codeMetricMap).forEach(t => {
      if (isCustomMappingTarget(t)) found.add(getCustomMappingLabel(t));
    });
    if (found.size > 0) {
      setCustomMetrics(prev => Array.from(new Set([...prev, ...found])));
    }
  };

  const runAnalysis = (buffer: ArrayBuffer, sheetName?: string) => {
    const res = analyzeEvaluationsExcelBuffer(buffer, sheetName);
    setAnalysis(res);
    setMapping(res.suggestedMapping);
    syncCustomMetricsFromMapping(res.suggestedMapping);
    if (res.rows.length === 0) {
      setErrorMessage(
        res.warnings[0] || 'No se detectaron filas con datos en la hoja seleccionada.',
      );
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      setRawBuffer(buffer);
      setFileName(file.name);
      runAnalysis(buffer);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo analizar el archivo: ${err.message}`
          : 'No se pudo leer el archivo Excel.',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!rawBuffer) return;
    runAnalysis(rawBuffer, sheetName);
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setErrorMessage(null);
    try {
      await downloadEvaluationTemplateExcel();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Error al descargar plantilla: ${err.message}`
          : 'Error al generar la plantilla Excel.',
      );
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Códigos únicos dinámicos cuando RH cambia la columna de clave o cantidad en modo 'codes'
  const detectedCodes = useMemo(() => {
    if (!analysis || !mapping || !mapping.codeColumn) return [];
    return extractUniqueCodesForColumn(
      analysis.rows,
      mapping.codeColumn,
      mapping.quantityColumn,
    );
  }, [analysis, mapping?.codeColumn, mapping?.quantityColumn]);

  const handleModeChange = (mode: ExcelImportFormatMode) => {
    if (!mapping) return;
    setMapping({ ...mapping, mode });
  };

  const handleCodeColumnChange = (codeColumn: string) => {
    if (!analysis || !mapping) return;
    const codes = extractUniqueCodesForColumn(
      analysis.rows,
      codeColumn,
      mapping.quantityColumn,
    );
    const nextCodeMap: Record<string, ExcelMappingTarget> = {};
    codes.forEach(item => {
      const upper = item.code.toUpperCase();
      nextCodeMap[upper] = mapping.codeMetricMap[upper] ?? item.suggestedMetric;
    });
    const nextMapping = { ...mapping, codeColumn, codeMetricMap: nextCodeMap };
    setMapping(nextMapping);
    syncCustomMetricsFromMapping(nextMapping);
  };

  const registerCustomMetric = (rawLabel: string): ExcelMappingTarget | null => {
    const cleaned = rawLabel.trim();
    if (!cleaned) return null;
    setCustomMetrics(prev => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    return `custom:${cleaned}`;
  };

  const handleAddCustomMetricFromBar = () => {
    if (!registerCustomMetric(newCustomMetricName)) return;
    setNewCustomMetricName('');
  };

  const handleColumnMetricChange = (colName: string, rawValue: string) => {
    if (!mapping) return;
    if (rawValue === CREATE_CUSTOM_SENTINEL) {
      const entered = window.prompt(
        `Nombre de la incidencia personalizada para "${colName}":`,
        colName,
      );
      const customTarget = entered ? registerCustomMetric(entered) : null;
      if (!customTarget) return;
      setMapping({
        ...mapping,
        columnMetricMap: { ...mapping.columnMetricMap, [colName]: customTarget },
      });
      return;
    }
    setMapping({
      ...mapping,
      columnMetricMap: {
        ...mapping.columnMetricMap,
        [colName]: rawValue as ExcelMappingTarget,
      },
    });
  };

  const handleCodeMetricChange = (code: string, rawValue: string) => {
    if (!mapping) return;
    const upper = code.toUpperCase();
    if (rawValue === CREATE_CUSTOM_SENTINEL) {
      const entered = window.prompt(
        `Nombre de la incidencia personalizada para la clave "${code}":`,
        code,
      );
      const customTarget = entered ? registerCustomMetric(entered) : null;
      if (!customTarget) return;
      setMapping({
        ...mapping,
        codeMetricMap: { ...mapping.codeMetricMap, [upper]: customTarget },
      });
      return;
    }
    setMapping({
      ...mapping,
      codeMetricMap: {
        ...mapping.codeMetricMap,
        [upper]: rawValue as ExcelMappingTarget,
      },
    });
  };

  const allTargetOptions = useMemo(() => {
    const customOpts: { value: string; label: string }[] = customMetrics.map(label => ({
      value: `custom:${label}`,
      label: `★ Personalizada: ${label}`,
    }));
    return [
      ...BASE_TARGET_OPTIONS,
      ...customOpts,
      { value: CREATE_CUSTOM_SENTINEL, label: '+ Crear incidencia personalizada...' },
    ];
  }, [customMetrics]);

  const activeMappedSummary = useMemo(() => {
    const byMetric: Record<IncidenceMetricKey, string[]> = {
      faltas: [],
      incapacidades: [],
      retardos: [],
      permisos: [],
    };
    const byCustom: Record<string, string[]> = {};
    if (!mapping) return { count: 0, byMetric, byCustom };

    const source =
      mapping.mode === 'columns' ? mapping.columnMetricMap : mapping.codeMetricMap;
    Object.entries(source).forEach(([key, target]) => {
      if (target === 'ignore') return;
      if (isCustomMappingTarget(target)) {
        const label = getCustomMappingLabel(target);
        if (!byCustom[label]) byCustom[label] = [];
        byCustom[label].push(key);
      } else {
        byMetric[target].push(key);
      }
    });
    const customCount = Object.values(byCustom).reduce((acc, arr) => acc + arr.length, 0);
    const count =
      byMetric.faltas.length +
      byMetric.incapacidades.length +
      byMetric.retardos.length +
      byMetric.permisos.length +
      customCount;
    return { count, byMetric, byCustom };
  }, [mapping]);

  const previewResult = useMemo(() => {
    if (!analysis || !mapping || step !== 3) return null;
    return applyExcelMappingToCampaign(
      analysis,
      mapping,
      campaign.id,
      campaign.rules,
      existingRecords,
      { includeUnmatched },
    );
  }, [analysis, mapping, step, campaign.id, campaign.rules, existingRecords, includeUnmatched]);

  const canGoToPreview = Boolean(
    analysis &&
      mapping &&
      (mapping.employeeIdColumn || mapping.nameColumn) &&
      (mapping.mode === 'columns' || Boolean(mapping.codeColumn)) &&
      activeMappedSummary.count > 0,
  );

  const handleConfirmApply = () => {
    if (!previewResult || !mapping) return;
    // Guardar diccionario de significados para futuras importaciones
    if (mapping.mode === 'columns') {
      saveIncidenceCodeDictionary(mapping.columnMetricMap);
    } else {
      saveIncidenceCodeDictionary(mapping.codeMetricMap);
    }
    onApplyMappedRecords(previewResult.finalCampaignRecords, {
      matchedCount: previewResult.matchedCount,
      untouchedCount: previewResult.untouchedCount,
      addedUnmatchedCount: includeUnmatched ? previewResult.unmatchedCount : 0,
    });
    onClose();
  };

  const metadataColsSet = useMemo(() => {
    if (!mapping) return new Set<string>();
    return new Set(
      [
        mapping.employeeIdColumn,
        mapping.nameColumn,
        mapping.hireDateColumn,
        mapping.supervisorColumn,
        mapping.puestoColumn,
        mapping.areaColumn,
      ].filter(Boolean),
    );
  }, [mapping]);

  const previewRows = useMemo(() => {
    if (!previewResult) return [];
    const combined = includeUnmatched
      ? [...previewResult.matchedRecords, ...previewResult.unmatchedRecords]
      : previewResult.matchedRecords;
    return combined.slice(0, PREVIEW_LIMIT);
  }, [previewResult, includeUnmatched]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eval-excel-import-title"
    >
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#1C1D26] border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#21222D] border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="eval-excel-import-title"
                className="text-base sm:text-lg font-extrabold text-white truncate"
              >
                Analizar e Importar Incidencias (Excel)
              </h2>
              <p className="text-xs text-[#87888C] truncate">
                Campaña: <span className="text-[#E2E4EC] font-semibold">{campaign.nombre}</span> ·
                Cruce automático por <span className="text-[#A9DFD8] font-semibold">Número de Empleado</span> ({existingRecords.length} en padrón)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[#87888C] hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 bg-[#171821] border-b border-white/[0.06] flex flex-wrap items-center gap-2 text-xs shrink-0">
          {[
            { num: 1 as const, label: '1. Subir Excel' },
            { num: 2 as const, label: '2. Mapear Columnas / Claves' },
            { num: 3 as const, label: '3. Vista Previa y Cruce' },
          ].map(item => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <div
                key={item.num}
                className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#A9DFD8]/15 border-[#A9DFD8]/40 text-[#A9DFD8]'
                    : done
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-[#87888C]'
                }`}
              >
                {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
              </div>
            );
          })}
          {fileName && (
            <span className="ml-auto text-[11px] text-[#87888C] truncate max-w-[260px]">
              Archivo: <strong className="text-[#E2E4EC]">{fileName}</strong>
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#21222D] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#A9DFD8]" />
                    Compatible con cualquier reporte Excel de RH o CONTPAQi
                  </p>
                  <p className="text-[11px] text-[#87888C] leading-relaxed">
                    El analizador detecta automáticamente las columnas y códigos (como{' '}
                    <code className="text-[#A9DFD8]">IFNJ</code>,{' '}
                    <code className="text-[#A9DFD8]">INC</code>,{' '}
                    <code className="text-[#A9DFD8]">RET</code>,{' '}
                    <code className="text-[#A9DFD8]">PCG</code>,{' '}
                    <code className="text-[#A9DFD8]">PSG</code>) para que solo confirmes qué significa cada uno y lo ligue por número de empleado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-[#E2E4EC] transition-all shrink-0 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  {isDownloadingTemplate ? 'Generando...' : 'Descargar plantilla Excel'}
                </button>
              </div>

              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                  isDragging
                    ? 'border-[#A9DFD8] bg-[#A9DFD8]/10'
                    : 'border-white/[0.14] hover:border-[#A9DFD8]/50 bg-[#21222D]/60 hover:bg-[#21222D]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 text-[#A9DFD8] flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">
                  {isParsing
                    ? 'Analizando estructura del Excel...'
                    : 'Arrastra aquí el informe Excel de incidencias o haz clic para seleccionarlo'}
                </p>
                <p className="text-xs text-[#87888C] mt-1">
                  Formatos soportados: .xlsx, .xls, .csv (por columnas o por listado de claves)
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Configure Columns & Code Meanings */}
          {step === 2 && analysis && mapping && (
            <div className="space-y-5">
              {/* Sheet selector + Format mode toggle */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#21222D] border border-white/[0.08] space-y-2.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                    Columna de Número de Empleado (llave de enlace)
                  </label>
                  <select
                    value={mapping.employeeIdColumn}
                    onChange={e =>
                      setMapping({ ...mapping, employeeIdColumn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.12] text-sm font-semibold text-white focus:outline-none focus:border-[#A9DFD8]"
                  >
                    <option value="">-- Seleccionar columna --</option>
                    {analysis.headers.map(h => (
                      <option key={h} value={h}>
                        {h}{' '}
                        {analysis.columnSamples[h]?.length
                          ? `(ej: ${analysis.columnSamples[h].slice(0, 2).join(', ')})`
                          : ''}
                      </option>
                    ))}
                  </select>

                  {analysis.sheetNames.length > 1 && (
                    <div className="pt-2 flex items-center gap-2">
                      <span className="text-[11px] text-[#87888C]">Hoja del Excel:</span>
                      <select
                        value={analysis.selectedSheet}
                        onChange={e => handleSheetChange(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-[#171821] border border-white/[0.1] text-xs text-white"
                      >
                        {analysis.sheetNames.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#21222D] border border-white/[0.08] space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block">
                    ¿Cómo vienen organizadas las incidencias en este Excel?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange('columns')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        mapping.mode === 'columns'
                          ? 'bg-[#A9DFD8]/15 border-[#A9DFD8]/50 text-white'
                          : 'bg-[#171821] border-white/[0.08] text-[#87888C] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Columns3 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                        Por Columnas
                      </div>
                      <p className="text-[10px] opacity-80 mt-0.5">
                        Ej. columnas IFNJ, INC, RET, PCG, PSG con totales.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeChange('codes')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        mapping.mode === 'codes'
                          ? 'bg-[#A9DFD8]/15 border-[#A9DFD8]/50 text-white'
                          : 'bg-[#171821] border-white/[0.08] text-[#87888C] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <ListFilter className="w-3.5 h-3.5 text-[#A9DFD8]" />
                        Por Claves / Filas
                      </div>
                      <p className="text-[10px] opacity-80 mt-0.5">
                        Ej. una columna "Clave" con IFNJ, RET, PCG repetidos por empleado.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional metadata columns */}
              <div className="p-3.5 rounded-xl bg-[#171821] border border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#87888C] block mb-1">
                    Fecha de ingreso (opcional)
                  </label>
                  <select
                    value={mapping.hireDateColumn}
                    onChange={e => setMapping({ ...mapping, hireDateColumn: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] text-xs text-white"
                  >
                    <option value="">-- No usar --</option>
                    {analysis.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#87888C] block mb-1">
                    Área / Departamento (opcional)
                  </label>
                  <select
                    value={mapping.areaColumn}
                    onChange={e => setMapping({ ...mapping, areaColumn: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] text-xs text-white"
                  >
                    <option value="">-- No usar --</option>
                    {analysis.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#87888C] block mb-1">
                    Nombre (respaldo si falta No. Emp)
                  </label>
                  <select
                    value={mapping.nameColumn}
                    onChange={e => setMapping({ ...mapping, nameColumn: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] text-xs text-white"
                  >
                    <option value="">-- No usar --</option>
                    {analysis.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom incidence quick creator bar */}
              <div className="p-3.5 rounded-xl bg-teal-500/[0.06] border border-teal-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-teal-200">
                    ¿Tu Excel trae incidencias adicionales no listadas?
                  </p>
                  <p className="text-[11px] text-[#87888C]">
                    Crea una incidencia personalizada (ej. <span className="text-teal-200">Actas Administrativas</span>, <span className="text-teal-200">Suspensiones</span>) o selecciona <span className="text-white">Ignorar</span> en cada fila.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={newCustomMetricName}
                    onChange={e => setNewCustomMetricName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomMetricFromBar();
                      }
                    }}
                    placeholder="Ej. Actas Administrativas"
                    className="w-48 px-3 py-1.5 rounded-xl bg-[#171821] border border-teal-500/30 text-xs text-white placeholder:text-[#87888C] focus:outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomMetricFromBar}
                    disabled={!newCustomMetricName.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>
              </div>

              {/* MODE A: Columns mapping table */}
              {mapping.mode === 'columns' && (
                <div className="rounded-2xl bg-[#21222D] border border-white/[0.08] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                        Asignar significado a cada columna detectada ({analysis.rows.length} filas)
                      </h3>
                      <p className="text-[11px] text-[#87888C]">
                        Puedes asignar varias columnas al mismo rubro (por ejemplo <code className="text-[#A9DFD8]">PCG</code> y <code className="text-[#A9DFD8]">PSG</code> a Permisos) y se sumarán automáticamente.
                      </p>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.05]">
                    {analysis.headers
                      .filter(h => !metadataColsSet.has(h))
                      .map(colName => {
                        const target = mapping.columnMetricMap[colName] ?? 'ignore';
                        const samples = analysis.columnSamples[colName] || [];
                        return (
                          <div
                            key={colName}
                            className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02]"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{colName}</p>
                              <p className="text-[11px] text-[#87888C] truncate">
                                Ejemplos:{' '}
                                {samples.length > 0 ? samples.join(', ') : '(sin datos)'}
                              </p>
                            </div>
                            <select
                              value={target}
                              onChange={e =>
                                handleColumnMetricChange(colName, e.target.value)
                              }
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none ${getTargetBadgeClass(target)} bg-[#171821]`}
                            >
                              {allTargetOptions.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-[#171821] text-white">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* MODE B: Codes per row mapping table */}
              {mapping.mode === 'codes' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#21222D] border border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block mb-1.5">
                        Columna con las Claves / Códigos de Incidencia
                      </label>
                      <select
                        value={mapping.codeColumn}
                        onChange={e => handleCodeColumnChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.12] text-xs font-semibold text-white"
                      >
                        <option value="">-- Seleccionar columna --</option>
                        {analysis.headers.map(h => (
                          <option key={h} value={h}>
                            {h}{' '}
                            {analysis.columnSamples[h]?.length
                              ? `(ej: ${analysis.columnSamples[h].slice(0, 3).join(', ')})`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block mb-1.5">
                        Columna de Cantidad / Días (opcional)
                      </label>
                      <select
                        value={mapping.quantityColumn}
                        onChange={e =>
                          setMapping({ ...mapping, quantityColumn: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.12] text-xs font-semibold text-white"
                      >
                        <option value="">Contar cada fila como 1</option>
                        {analysis.headers.map(h => (
                          <option key={h} value={h}>
                            {h}{' '}
                            {analysis.columnSamples[h]?.length
                              ? `(ej: ${analysis.columnSamples[h].slice(0, 3).join(', ')})`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#21222D] border border-white/[0.08] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.07]">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                        Claves detectadas en el Excel ({detectedCodes.length} códigos únicos)
                      </h3>
                      <p className="text-[11px] text-[#87888C]">
                        Especifica qué significa cada clave leída (ej. <code className="text-[#A9DFD8]">IFNJ</code> → Faltas Injustificadas), crea una personalizada o selecciona Ignorar.
                      </p>
                    </div>

                    {detectedCodes.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#87888C]">
                        Selecciona la columna que contiene los códigos/claves de incidencia para analizarlos.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.05]">
                        {detectedCodes.map(item => {
                          const upper = item.code.toUpperCase();
                          const target =
                            mapping.codeMetricMap[upper] ?? item.suggestedMetric;
                          return (
                            <div
                              key={upper}
                              className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="px-2.5 py-1 rounded-lg bg-[#171821] border border-white/[0.1] font-mono text-xs font-extrabold text-[#A9DFD8]">
                                  {item.code}
                                </span>
                                <span className="text-[11px] text-[#87888C]">
                                  {item.count} registro(s)
                                  {mapping.quantityColumn
                                    ? ` · Suma: ${item.totalQty}`
                                    : ''}
                                </span>
                              </div>
                              <select
                                value={target}
                                onChange={e =>
                                  handleCodeMetricChange(item.code, e.target.value)
                                }
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none ${getTargetBadgeClass(target)} bg-[#171821]`}
                              >
                                {allTargetOptions.map(opt => (
                                  <option key={opt.value} value={opt.value} className="bg-[#171821] text-white">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active mapping summary pills */}
              <div className="p-3.5 rounded-xl bg-[#171821] border border-white/[0.07] flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-[#87888C]">Resumen del mapeo:</span>
                {(['faltas', 'incapacidades', 'retardos', 'permisos'] as IncidenceMetricKey[]).map(
                  metric => (
                    <span
                      key={metric}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${getTargetBadgeClass(metric)}`}
                    >
                      {TARGET_SHORT_LABEL[metric]}:{' '}
                      {activeMappedSummary.byMetric[metric].length > 0
                        ? activeMappedSummary.byMetric[metric].join(' + ')
                        : 'ninguno'}
                    </span>
                  ),
                )}
                {Object.entries(activeMappedSummary.byCustom).map(([label, keys]) => (
                  <span
                    key={label}
                    className="px-2.5 py-1 rounded-lg border font-semibold bg-teal-500/15 text-teal-200 border-teal-500/35"
                  >
                    ★ {label}: {keys.join(' + ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Match preview */}
          {step === 3 && previewResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <UserCheck className="w-4 h-4" />
                    Vinculados por No. Empleado
                  </div>
                  <p className="text-2xl font-black text-white mt-1">
                    {previewResult.matchedCount}
                  </p>
                  <p className="text-[11px] text-emerald-200/80">
                    Se actualizan sus incidencias y puntaje /20
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#21222D] border border-white/[0.08]">
                  <div className="text-[#87888C] text-xs font-bold">
                    Del padrón sin incidencias en archivo
                  </div>
                  <p className="text-2xl font-black text-white mt-1">
                    {previewResult.untouchedCount}
                  </p>
                  <p className="text-[11px] text-[#87888C]">
                    Conservan sus valores actuales (0 si es carga inicial)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <UserX className="w-4 h-4" />
                    No encontrados en el padrón
                  </div>
                  <p className="text-2xl font-black text-white mt-1">
                    {previewResult.unmatchedCount}
                  </p>
                  {previewResult.unmatchedCount > 0 && (
                    <label className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeUnmatched}
                        onChange={e => setIncludeUnmatched(e.target.checked)}
                        className="rounded border-amber-400/50 bg-[#171821]"
                      />
                      Agregarlos también a la campaña
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-[#21222D] border border-white/[0.08] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    Vista previa del cruce ({previewRows.length} de{' '}
                    {includeUnmatched
                      ? previewResult.matchedCount + previewResult.unmatchedCount
                      : previewResult.matchedCount}{' '}
                    colaboradores)
                  </span>
                  <span className="text-[11px] text-[#87888C]">
                    Competencias ya evaluadas se preservan intactas
                  </span>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#171821] text-[10px] uppercase tracking-wider text-[#87888C] sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">No. Emp</th>
                        <th className="px-3 py-2.5">Colaborador</th>
                        <th className="px-3 py-2.5">Supervisor (Padrón)</th>
                        <th className="px-2 py-2.5 text-center">FI</th>
                        <th className="px-2 py-2.5 text-center">INC</th>
                        <th className="px-2 py-2.5 text-center">RE</th>
                        <th className="px-2 py-2.5 text-center">PER</th>
                        <th className="px-3 py-2.5 text-right">Puntaje Inc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {previewRows.map(rec => (
                        <tr key={rec.id} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-[#A9DFD8] font-bold">
                            {rec.empleadoId || '—'}
                          </td>
                          <td className="px-3 py-2 text-white font-semibold">
                            <div>{rec.nombre}</div>
                            {rec.incidenciasPersonalizadas &&
                              Object.keys(rec.incidenciasPersonalizadas).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(rec.incidenciasPersonalizadas).map(
                                    ([label, qty]) => (
                                      <span
                                        key={label}
                                        className="px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-[10px] font-bold text-teal-200"
                                      >
                                        ★ {label}: {qty}
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-2 text-[#87888C]">{rec.supervisor}</td>
                          <td className="px-2 py-2 text-center text-rose-300 font-bold">
                            {rec.incidencias.faltas}
                          </td>
                          <td className="px-2 py-2 text-center text-amber-300 font-bold">
                            {rec.incidencias.incapacidades}
                          </td>
                          <td className="px-2 py-2 text-center text-sky-300 font-bold">
                            {rec.incidencias.retardos}
                          </td>
                          <td className="px-2 py-2 text-center text-violet-300 font-bold">
                            {rec.incidencias.permisos}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-white">
                            {rec.puntajesIncidencias.total}/{rec.puntajesIncidencias.maxTotal}{' '}
                            <span className="text-[#A9DFD8]">
                              ({rec.puntajesIncidencias.porcentaje}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                      {previewRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-[#87888C]">
                            Ningún registro coincidió con el número de empleado del padrón. Verifica la columna seleccionada en el Paso 2.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#21222D] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(prev => (prev === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#E2E4EC]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {step === 2 ? 'Cambiar archivo' : 'Ajustar mapeo'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#87888C] hover:text-white transition-colors"
            >
              Cancelar
            </button>

            {step === 2 && (
              <button
                type="button"
                disabled={!canGoToPreview}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#A9DFD8] hover:bg-[#95d6ce] text-[#11131a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ver cruce por No. Empleado
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && previewResult && (
              <button
                type="button"
                disabled={
                  previewResult.matchedCount === 0 &&
                  (!includeUnmatched || previewResult.unmatchedCount === 0)
                }
                onClick={handleConfirmApply}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-400 hover:bg-emerald-300 text-[#0f172a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aplicar incidencias ({previewResult.matchedCount + (includeUnmatched ? previewResult.unmatchedCount : 0)} colaboradores)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
