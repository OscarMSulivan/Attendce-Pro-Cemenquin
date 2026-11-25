/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Columns3,
  Cpu,
  Download,
  FileSpreadsheet,
  Link2,
  ListFilter,
  Plus,
  ScanLine,
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

function getTargetBadgeStyle(target: ExcelMappingTarget): React.CSSProperties {
  if (target === 'faltas') {
    return {
      backgroundColor: 'var(--ef-badge-faltas-bg)',
      color: 'var(--ef-badge-faltas-text)',
      borderColor: 'var(--ef-badge-faltas-border)',
    };
  }
  if (target === 'incapacidades') {
    return {
      backgroundColor: 'var(--ef-badge-inc-bg)',
      color: 'var(--ef-badge-inc-text)',
      borderColor: 'var(--ef-badge-inc-border)',
    };
  }
  if (target === 'retardos') {
    return {
      backgroundColor: 'var(--ef-badge-ret-bg)',
      color: 'var(--ef-badge-ret-text)',
      borderColor: 'var(--ef-badge-ret-border)',
    };
  }
  if (target === 'permisos') {
    return {
      backgroundColor: 'var(--ef-badge-perm-bg)',
      color: 'var(--ef-badge-perm-text)',
      borderColor: 'var(--ef-badge-perm-border)',
    };
  }
  if (isCustomMappingTarget(target)) {
    return {
      backgroundColor: 'var(--ef-badge-custom-bg)',
      color: 'var(--ef-badge-custom-text)',
      borderColor: 'var(--ef-badge-custom-border)',
    };
  }
  return {
    backgroundColor: 'var(--ef-badge-ignore-bg)',
    color: 'var(--ef-badge-ignore-text)',
    borderColor: 'var(--ef-badge-ignore-border)',
  };
}

const TARGET_SHORT_LABEL: Record<IncidenceMetricKey, string> = {
  faltas: 'Faltas',
  incapacidades: 'Incapacidades',
  retardos: 'Retardos',
  permisos: 'Permisos',
};

const SCAN_STAGES = [
  'Leyendo estructura y hojas del archivo Excel...',
  'Escaneando encabezados y claves (IFNJ, INC, RET, PCG)...',
  'Preparando cruce automático por Número de Empleado...',
];

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
  const [scanStageIdx, setScanStageIdx] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
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
      if (event.key === 'Escape' && !isParsing) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isParsing]);

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
    setFileName(file.name);
    setScanStageIdx(0);
    setScanProgress(18);

    const t1 = window.setTimeout(() => {
      setScanStageIdx(1);
      setScanProgress(58);
    }, 260);
    const t2 = window.setTimeout(() => {
      setScanStageIdx(2);
      setScanProgress(90);
    }, 540);

    try {
      const [buffer] = await Promise.all([
        file.arrayBuffer(),
        new Promise(resolve => window.setTimeout(resolve, 780)),
      ]);
      setScanProgress(100);
      setRawBuffer(buffer);
      runAnalysis(buffer);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo analizar el archivo: ${err.message}`
          : 'No se pudo leer el archivo Excel.',
      );
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eval-excel-import-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="eval-futuristic-modal relative w-full max-w-5xl max-h-[92vh] rounded-2xl border flex flex-col overflow-hidden"
      >
        {/* Top glowing accent bar */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background:
              'linear-gradient(90deg, #0d9488 0%, #0ea5e9 50%, #6366f1 100%)',
          }}
        />

        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0"
          style={{
            background: 'var(--ef-header-bg)',
            borderColor: 'var(--ef-border)',
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: 'var(--ef-accent-soft)',
                borderColor: 'var(--ef-accent-border)',
                color: 'var(--ef-accent-ink)',
              }}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="eval-excel-import-title"
                  className="text-base sm:text-lg font-extrabold tracking-tight truncate"
                  style={{ color: 'var(--ef-text)' }}
                >
                  Analizador Inteligente de Incidencias (Excel)
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                  style={{
                    backgroundColor: 'var(--ef-accent-soft)',
                    borderColor: 'var(--ef-accent-border)',
                    color: 'var(--ef-accent-ink)',
                  }}
                >
                  Motor Auto-Match
                </span>
              </div>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ef-text-muted)' }}>
                Campaña:{' '}
                <strong style={{ color: 'var(--ef-text)' }}>{campaign.nombre}</strong> ·
                Enlace por{' '}
                <strong style={{ color: 'var(--ef-accent-ink)' }}>
                  Número de Empleado
                </strong>{' '}
                ({existingRecords.length} en padrón)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isParsing}
            aria-label="Cerrar modal"
            className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:opacity-40"
            style={{
              backgroundColor: 'var(--ef-card-bg)',
              borderColor: 'var(--ef-border)',
              color: 'var(--ef-text-muted)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div
          className="px-6 py-3 border-b flex flex-wrap items-center gap-2 text-xs shrink-0"
          style={{
            backgroundColor: 'var(--ef-subbar-bg)',
            borderColor: 'var(--ef-border)',
          }}
        >
          {[
            { num: 1 as const, label: '01 · Subir Excel' },
            { num: 2 as const, label: '02 · Mapear Columnas / Claves' },
            { num: 3 as const, label: '03 · Vista Previa y Cruce' },
          ].map(item => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <div
                key={item.num}
                className="px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--ef-accent-soft)',
                        borderColor: 'var(--ef-accent-border)',
                        color: 'var(--ef-accent-ink)',
                      }
                    : done
                    ? {
                        backgroundColor: 'var(--ef-success-bg)',
                        borderColor: 'var(--ef-success-border)',
                        color: 'var(--ef-success-text)',
                      }
                    : {
                        backgroundColor: 'var(--ef-card-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text-muted)',
                      }
                }
              >
                {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
              </div>
            );
          })}
          {fileName && (
            <span
              className="ml-auto text-[11px] truncate max-w-[260px] font-medium"
              style={{ color: 'var(--ef-text-muted)' }}
            >
              Archivo:{' '}
              <strong style={{ color: 'var(--ef-text)' }}>{fileName}</strong>
            </span>
          )}
        </div>

        {/* Body */}
        <div
          className="p-6 overflow-y-auto space-y-5 flex-1"
          style={{ backgroundColor: 'var(--ef-shell-bg)' }}
        >
          {errorMessage && (
            <div
              className="p-4 rounded-xl border text-xs flex items-start gap-2.5 font-medium"
              style={{
                backgroundColor: 'var(--ef-danger-bg)',
                borderColor: 'var(--ef-danger-border)',
                color: 'var(--ef-danger-text)',
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: Upload + Futuristic Scanner Loader */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div
                  className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--ef-card-alt)',
                    borderColor: 'var(--ef-border)',
                  }}
                >
                  <div className="space-y-1">
                    <p
                      className="text-xs font-extrabold flex items-center gap-1.5"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      <Sparkles
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--ef-accent-ink)' }}
                      />
                      Compatible con cualquier reporte Excel de RH o CONTPAQi
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Detecta automáticamente encabezados y claves (como{' '}
                      <code
                        className="px-1 py-0.5 rounded font-mono font-bold"
                        style={{
                          backgroundColor: 'var(--ef-accent-soft)',
                          color: 'var(--ef-accent-ink)',
                        }}
                      >
                        IFNJ
                      </code>
                      ,{' '}
                      <code
                        className="px-1 py-0.5 rounded font-mono font-bold"
                        style={{
                          backgroundColor: 'var(--ef-accent-soft)',
                          color: 'var(--ef-accent-ink)',
                        }}
                      >
                        INC
                      </code>
                      ,{' '}
                      <code
                        className="px-1 py-0.5 rounded font-mono font-bold"
                        style={{
                          backgroundColor: 'var(--ef-accent-soft)',
                          color: 'var(--ef-accent-ink)',
                        }}
                      >
                        RET
                      </code>
                      ,{' '}
                      <code
                        className="px-1 py-0.5 rounded font-mono font-bold"
                        style={{
                          backgroundColor: 'var(--ef-accent-soft)',
                          color: 'var(--ef-accent-ink)',
                        }}
                      >
                        PCG
                      </code>
                      ) para mapear o crear incidencias personalizadas y ligarlas por número de empleado.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTemplate || isParsing}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--ef-card-bg)',
                      borderColor: 'var(--ef-border)',
                      color: 'var(--ef-text)',
                    }}
                  >
                    <Download
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--ef-accent-ink)' }}
                    />
                    {isDownloadingTemplate ? 'Generando...' : 'Descargar plantilla Excel'}
                  </button>
                </div>

                {/* Dropzone OR Futuristic Scanning Loader */}
                {isParsing ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="eval-futuristic-grid-bg relative overflow-hidden rounded-2xl border p-10 text-center"
                    style={{
                      backgroundColor: 'var(--ef-card-alt)',
                      borderColor: 'var(--ef-accent-border)',
                    }}
                  >
                    {/* Animated laser scanline */}
                    <div
                      className="eval-scanline pointer-events-none absolute inset-x-0 top-0 h-14"
                      style={{
                        background:
                          'linear-gradient(180deg, transparent 0%, rgba(20, 184, 166, 0.25) 50%, transparent 100%)',
                      }}
                    />

                    {/* Orbital holographic scanner */}
                    <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
                      <div
                        className="eval-orbit absolute inset-0 rounded-full border-2 border-dashed"
                        style={{ borderColor: 'var(--ef-accent)' }}
                      />
                      <div
                        className="eval-orbit-reverse absolute inset-2.5 rounded-full border-2 border-dotted"
                        style={{ borderColor: '#0ea5e9' }}
                      />
                      <div
                        className="w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg"
                        style={{
                          backgroundColor: 'var(--ef-accent-soft)',
                          borderColor: 'var(--ef-accent-border)',
                          color: 'var(--ef-accent-ink)',
                        }}
                      >
                        <ScanLine className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>

                    <p
                      className="text-sm font-extrabold tracking-tight"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      Analizando <span style={{ color: 'var(--ef-accent-ink)' }}>{fileName}</span>
                    </p>
                    <p
                      className="text-xs font-semibold mt-1.5"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      {SCAN_STAGES[scanStageIdx]}
                    </p>

                    {/* Futuristic Progress Bar */}
                    <div
                      className="max-w-md mx-auto mt-5 h-2 rounded-full overflow-hidden border"
                      style={{
                        backgroundColor: 'var(--ef-card-bg)',
                        borderColor: 'var(--ef-border)',
                      }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: '10%' }}
                        animate={{ width: `${scanProgress}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{
                          background:
                            'linear-gradient(90deg, #0d9488 0%, #0ea5e9 65%, #6366f1 100%)',
                        }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {SCAN_STAGES.map((stage, idx) => {
                        const active = idx <= scanStageIdx;
                        return (
                          <span
                            key={stage}
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all"
                            style={
                              active
                                ? {
                                    backgroundColor: 'var(--ef-accent-soft)',
                                    borderColor: 'var(--ef-accent-border)',
                                    color: 'var(--ef-accent-ink)',
                                  }
                                : {
                                    backgroundColor: 'var(--ef-card-bg)',
                                    borderColor: 'var(--ef-border)',
                                    color: 'var(--ef-text-muted)',
                                  }
                            }
                          >
                            {idx < scanStageIdx ? '✓' : idx === scanStageIdx ? '●' : '○'}{' '}
                            Fase {idx + 1}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
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
                    className="eval-futuristic-grid-bg p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center group"
                    style={{
                      backgroundColor: isDragging
                        ? 'var(--ef-accent-soft)'
                        : 'var(--ef-card-alt)',
                      borderColor: isDragging
                        ? 'var(--ef-accent)'
                        : 'var(--ef-border)',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <div
                      className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-3.5 transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: 'var(--ef-accent-soft)',
                        borderColor: 'var(--ef-accent-border)',
                        color: 'var(--ef-accent-ink)',
                      }}
                    >
                      <Upload className="w-6 h-6" />
                    </div>
                    <p
                      className="text-sm font-extrabold"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      Arrastra aquí el informe Excel de incidencias o haz clic para seleccionarlo
                    </p>
                    <p
                      className="text-xs mt-1.5 font-medium"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Formatos soportados: .xlsx, .xls, .csv · Análisis instantáneo por columnas o claves
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Configure Columns & Code Meanings */}
            {step === 2 && analysis && mapping && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Sheet selector + Format mode toggle */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div
                    className="p-4 rounded-xl border space-y-2.5"
                    style={{
                      backgroundColor: 'var(--ef-card-bg)',
                      borderColor: 'var(--ef-border)',
                    }}
                  >
                    <label
                      className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      <Link2
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--ef-accent-ink)' }}
                      />
                      Columna de Número de Empleado (llave de enlace)
                    </label>
                    <select
                      value={mapping.employeeIdColumn}
                      onChange={e =>
                        setMapping({ ...mapping, employeeIdColumn: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border text-sm font-semibold focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ef-input-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text)',
                      }}
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
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Hoja del Excel:
                        </span>
                        <select
                          value={analysis.selectedSheet}
                          onChange={e => handleSheetChange(e.target.value)}
                          className="px-2.5 py-1 rounded-lg border text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--ef-input-bg)',
                            borderColor: 'var(--ef-border)',
                            color: 'var(--ef-text)',
                          }}
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

                  <div
                    className="p-4 rounded-xl border space-y-2.5"
                    style={{
                      backgroundColor: 'var(--ef-card-bg)',
                      borderColor: 'var(--ef-border)',
                    }}
                  >
                    <span
                      className="text-[11px] font-extrabold uppercase tracking-wider block"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      ¿Cómo vienen organizadas las incidencias en este Excel?
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleModeChange('columns')}
                        className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                        style={
                          mapping.mode === 'columns'
                            ? {
                                backgroundColor: 'var(--ef-accent-soft)',
                                borderColor: 'var(--ef-accent-border)',
                                color: 'var(--ef-text)',
                              }
                            : {
                                backgroundColor: 'var(--ef-card-alt)',
                                borderColor: 'var(--ef-border)',
                                color: 'var(--ef-text-muted)',
                              }
                        }
                      >
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <Columns3
                            className="w-3.5 h-3.5"
                            style={{ color: 'var(--ef-accent-ink)' }}
                          />
                          Por Columnas
                        </div>
                        <p
                          className="text-[10px] mt-0.5 leading-snug"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Ej. columnas IFNJ, INC, RET, PCG, PSG con totales.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModeChange('codes')}
                        className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                        style={
                          mapping.mode === 'codes'
                            ? {
                                backgroundColor: 'var(--ef-accent-soft)',
                                borderColor: 'var(--ef-accent-border)',
                                color: 'var(--ef-text)',
                              }
                            : {
                                backgroundColor: 'var(--ef-card-alt)',
                                borderColor: 'var(--ef-border)',
                                color: 'var(--ef-text-muted)',
                              }
                        }
                      >
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <ListFilter
                            className="w-3.5 h-3.5"
                            style={{ color: 'var(--ef-accent-ink)' }}
                          />
                          Por Claves / Filas
                        </div>
                        <p
                          className="text-[10px] mt-0.5 leading-snug"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Ej. columna "Clave" con IFNJ, RET, PCG repetidos por empleado.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional metadata columns */}
                <div
                  className="p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-3"
                  style={{
                    backgroundColor: 'var(--ef-card-alt)',
                    borderColor: 'var(--ef-border)',
                  }}
                >
                  <div>
                    <label
                      className="text-[10px] font-extrabold uppercase tracking-wider block mb-1"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Fecha de ingreso (opcional)
                    </label>
                    <select
                      value={mapping.hireDateColumn}
                      onChange={e =>
                        setMapping({ ...mapping, hireDateColumn: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--ef-input-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text)',
                      }}
                    >
                      <option value="">-- No usar --</option>
                      {analysis.headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-extrabold uppercase tracking-wider block mb-1"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Área / Departamento (opcional)
                    </label>
                    <select
                      value={mapping.areaColumn}
                      onChange={e =>
                        setMapping({ ...mapping, areaColumn: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--ef-input-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text)',
                      }}
                    >
                      <option value="">-- No usar --</option>
                      {analysis.headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-extrabold uppercase tracking-wider block mb-1"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Nombre (respaldo si falta No. Emp)
                    </label>
                    <select
                      value={mapping.nameColumn}
                      onChange={e =>
                        setMapping({ ...mapping, nameColumn: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--ef-input-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text)',
                      }}
                    >
                      <option value="">-- No usar --</option>
                      {analysis.headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom incidence quick creator bar */}
                <div
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  style={{
                    backgroundColor: 'var(--ef-badge-custom-bg)',
                    borderColor: 'var(--ef-badge-custom-border)',
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-xs font-extrabold"
                      style={{ color: 'var(--ef-badge-custom-text)' }}
                    >
                      ¿Tu Excel trae incidencias adicionales no listadas?
                    </p>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Crea una incidencia personalizada (ej.{' '}
                      <strong style={{ color: 'var(--ef-text)' }}>
                        Actas Administrativas
                      </strong>
                      ) o selecciona{' '}
                      <strong style={{ color: 'var(--ef-text)' }}>Ignorar</strong> en cada fila.
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
                      className="w-48 px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ef-input-bg)',
                        borderColor: 'var(--ef-border)',
                        color: 'var(--ef-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomMetricFromBar}
                      disabled={!newCustomMetricName.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer disabled:opacity-40"
                      style={{
                        background: 'var(--ef-btn-primary-bg)',
                        borderColor: 'transparent',
                        color: 'var(--ef-btn-primary-text)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>
                </div>

                {/* MODE A: Columns mapping table */}
                {mapping.mode === 'columns' && (
                  <div
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--ef-card-bg)',
                      borderColor: 'var(--ef-border)',
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{
                        backgroundColor: 'var(--ef-card-alt)',
                        borderColor: 'var(--ef-border)',
                      }}
                    >
                      <h3
                        className="text-xs font-extrabold uppercase tracking-wider"
                        style={{ color: 'var(--ef-text)' }}
                      >
                        Asignar significado a cada columna detectada ({analysis.rows.length} filas)
                      </h3>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: 'var(--ef-text-muted)' }}
                      >
                        Puedes asignar varias columnas al mismo rubro (por ejemplo{' '}
                        <code className="font-mono font-bold">PCG</code> y{' '}
                        <code className="font-mono font-bold">PSG</code> a Permisos) y se sumarán automáticamente.
                      </p>
                    </div>
                    <div
                      className="max-h-72 overflow-y-auto divide-y"
                      style={{ borderColor: 'var(--ef-border)' }}
                    >
                      {analysis.headers
                        .filter(h => !metadataColsSet.has(h))
                        .map(colName => {
                          const target = mapping.columnMetricMap[colName] ?? 'ignore';
                          const samples = analysis.columnSamples[colName] || [];
                          return (
                            <div
                              key={colName}
                              className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              style={{ borderColor: 'var(--ef-border)' }}
                            >
                              <div className="min-w-0">
                                <p
                                  className="text-xs font-extrabold truncate"
                                  style={{ color: 'var(--ef-text)' }}
                                >
                                  {colName}
                                </p>
                                <p
                                  className="text-[11px] truncate"
                                  style={{ color: 'var(--ef-text-muted)' }}
                                >
                                  Ejemplos:{' '}
                                  {samples.length > 0 ? samples.join(', ') : '(sin datos)'}
                                </p>
                              </div>
                              <select
                                value={target}
                                onChange={e =>
                                  handleColumnMetricChange(colName, e.target.value)
                                }
                                className="px-3 py-1.5 rounded-xl border text-xs font-extrabold focus:outline-none cursor-pointer"
                                style={getTargetBadgeStyle(target)}
                              >
                                {allTargetOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
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
                    <div
                      className="p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4"
                      style={{
                        backgroundColor: 'var(--ef-card-bg)',
                        borderColor: 'var(--ef-border)',
                      }}
                    >
                      <div>
                        <label
                          className="text-[11px] font-extrabold uppercase tracking-wider block mb-1.5"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Columna con las Claves / Códigos de Incidencia
                        </label>
                        <select
                          value={mapping.codeColumn}
                          onChange={e => handleCodeColumnChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--ef-input-bg)',
                            borderColor: 'var(--ef-border)',
                            color: 'var(--ef-text)',
                          }}
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
                        <label
                          className="text-[11px] font-extrabold uppercase tracking-wider block mb-1.5"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Columna de Cantidad / Días (opcional)
                        </label>
                        <select
                          value={mapping.quantityColumn}
                          onChange={e =>
                            setMapping({ ...mapping, quantityColumn: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--ef-input-bg)',
                            borderColor: 'var(--ef-border)',
                            color: 'var(--ef-text)',
                          }}
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

                    <div
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        backgroundColor: 'var(--ef-card-bg)',
                        borderColor: 'var(--ef-border)',
                      }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{
                          backgroundColor: 'var(--ef-card-alt)',
                          borderColor: 'var(--ef-border)',
                        }}
                      >
                        <h3
                          className="text-xs font-extrabold uppercase tracking-wider"
                          style={{ color: 'var(--ef-text)' }}
                        >
                          Claves detectadas en el Excel ({detectedCodes.length} códigos únicos)
                        </h3>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Especifica qué significa cada clave leída (ej.{' '}
                          <code className="font-mono font-bold">IFNJ</code> → Faltas Injustificadas), crea una personalizada o selecciona Ignorar.
                        </p>
                      </div>

                      {detectedCodes.length === 0 ? (
                        <div
                          className="p-6 text-center text-xs"
                          style={{ color: 'var(--ef-text-muted)' }}
                        >
                          Selecciona la columna que contiene los códigos/claves de incidencia para analizarlos.
                        </div>
                      ) : (
                        <div
                          className="max-h-64 overflow-y-auto divide-y"
                          style={{ borderColor: 'var(--ef-border)' }}
                        >
                          {detectedCodes.map(item => {
                            const upper = item.code.toUpperCase();
                            const target =
                              mapping.codeMetricMap[upper] ?? item.suggestedMetric;
                            return (
                              <div
                                key={upper}
                                className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                style={{ borderColor: 'var(--ef-border)' }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className="px-2.5 py-1 rounded-lg border font-mono text-xs font-extrabold"
                                    style={{
                                      backgroundColor: 'var(--ef-accent-soft)',
                                      borderColor: 'var(--ef-accent-border)',
                                      color: 'var(--ef-accent-ink)',
                                    }}
                                  >
                                    {item.code}
                                  </span>
                                  <span
                                    className="text-[11px] font-medium"
                                    style={{ color: 'var(--ef-text-muted)' }}
                                  >
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
                                  className="px-3 py-1.5 rounded-xl border text-xs font-extrabold focus:outline-none cursor-pointer"
                                  style={getTargetBadgeStyle(target)}
                                >
                                  {allTargetOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>
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
                <div
                  className="p-3.5 rounded-xl border flex flex-wrap items-center gap-2 text-[11px]"
                  style={{
                    backgroundColor: 'var(--ef-card-alt)',
                    borderColor: 'var(--ef-border)',
                  }}
                >
                  <span
                    className="font-extrabold"
                    style={{ color: 'var(--ef-text-muted)' }}
                  >
                    Resumen del mapeo:
                  </span>
                  {(['faltas', 'incapacidades', 'retardos', 'permisos'] as IncidenceMetricKey[]).map(
                    metric => (
                      <span
                        key={metric}
                        className="px-2.5 py-1 rounded-lg border font-bold"
                        style={getTargetBadgeStyle(metric)}
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
                      className="px-2.5 py-1 rounded-lg border font-bold"
                      style={getTargetBadgeStyle(`custom:${label}`)}
                    >
                      ★ {label}: {keys.join(' + ')}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Match preview */}
            {step === 3 && previewResult && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className="p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--ef-success-bg)',
                      borderColor: 'var(--ef-success-border)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-extrabold"
                      style={{ color: 'var(--ef-success-text)' }}
                    >
                      <UserCheck className="w-4 h-4" />
                      Vinculados por No. Empleado
                    </div>
                    <p
                      className="text-2xl font-black mt-1"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      {previewResult.matchedCount}
                    </p>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--ef-success-text)' }}
                    >
                      Se actualizan sus incidencias y puntaje /20
                    </p>
                  </div>

                  <div
                    className="p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--ef-card-alt)',
                      borderColor: 'var(--ef-border)',
                    }}
                  >
                    <div
                      className="text-xs font-extrabold"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Del padrón sin incidencias en archivo
                    </div>
                    <p
                      className="text-2xl font-black mt-1"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      {previewResult.untouchedCount}
                    </p>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Conservan sus valores actuales (0 si es carga inicial)
                    </p>
                  </div>

                  <div
                    className="p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--ef-warn-bg)',
                      borderColor: 'var(--ef-warn-border)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-extrabold"
                      style={{ color: 'var(--ef-warn-text)' }}
                    >
                      <UserX className="w-4 h-4" />
                      No encontrados en el padrón
                    </div>
                    <p
                      className="text-2xl font-black mt-1"
                      style={{ color: 'var(--ef-text)' }}
                    >
                      {previewResult.unmatchedCount}
                    </p>
                    {previewResult.unmatchedCount > 0 && (
                      <label
                        className="mt-1.5 flex items-center gap-2 text-[11px] font-bold cursor-pointer"
                        style={{ color: 'var(--ef-warn-text)' }}
                      >
                        <input
                          type="checkbox"
                          checked={includeUnmatched}
                          onChange={e => setIncludeUnmatched(e.target.checked)}
                          className="rounded"
                        />
                        Agregarlos también a la campaña
                      </label>
                    )}
                  </div>
                </div>

                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--ef-card-bg)',
                    borderColor: 'var(--ef-border)',
                  }}
                >
                  <div
                    className="px-4 py-2.5 border-b flex items-center justify-between text-xs"
                    style={{
                      backgroundColor: 'var(--ef-card-alt)',
                      borderColor: 'var(--ef-border)',
                    }}
                  >
                    <span className="font-extrabold" style={{ color: 'var(--ef-text)' }}>
                      Vista previa del cruce ({previewRows.length} de{' '}
                      {includeUnmatched
                        ? previewResult.matchedCount + previewResult.unmatchedCount
                        : previewResult.matchedCount}{' '}
                      colaboradores)
                    </span>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--ef-text-muted)' }}
                    >
                      Competencias ya evaluadas se preservan intactas
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead
                        className="text-[10px] uppercase tracking-wider sticky top-0 border-b"
                        style={{
                          backgroundColor: 'var(--ef-subbar-bg)',
                          color: 'var(--ef-text-muted)',
                          borderColor: 'var(--ef-border)',
                        }}
                      >
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
                      <tbody
                        className="divide-y"
                        style={{ borderColor: 'var(--ef-border)' }}
                      >
                        {previewRows.map(rec => (
                          <tr key={rec.id} style={{ borderColor: 'var(--ef-border)' }}>
                            <td
                              className="px-3 py-2 font-mono font-extrabold"
                              style={{ color: 'var(--ef-accent-ink)' }}
                            >
                              {rec.empleadoId || '—'}
                            </td>
                            <td
                              className="px-3 py-2 font-bold"
                              style={{ color: 'var(--ef-text)' }}
                            >
                              <div>{rec.nombre}</div>
                              {rec.incidenciasPersonalizadas &&
                                Object.keys(rec.incidenciasPersonalizadas).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(rec.incidenciasPersonalizadas).map(
                                      ([label, qty]) => (
                                        <span
                                          key={label}
                                          className="px-1.5 py-0.5 rounded border text-[10px] font-bold"
                                          style={getTargetBadgeStyle(`custom:${label}`)}
                                        >
                                          ★ {label}: {qty}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                            </td>
                            <td
                              className="px-3 py-2 font-medium"
                              style={{ color: 'var(--ef-text-muted)' }}
                            >
                              {rec.supervisor}
                            </td>
                            <td
                              className="px-2 py-2 text-center font-extrabold"
                              style={{ color: 'var(--ef-badge-faltas-text)' }}
                            >
                              {rec.incidencias.faltas}
                            </td>
                            <td
                              className="px-2 py-2 text-center font-extrabold"
                              style={{ color: 'var(--ef-badge-inc-text)' }}
                            >
                              {rec.incidencias.incapacidades}
                            </td>
                            <td
                              className="px-2 py-2 text-center font-extrabold"
                              style={{ color: 'var(--ef-badge-ret-text)' }}
                            >
                              {rec.incidencias.retardos}
                            </td>
                            <td
                              className="px-2 py-2 text-center font-extrabold"
                              style={{ color: 'var(--ef-badge-perm-text)' }}
                            >
                              {rec.incidencias.permisos}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-extrabold"
                              style={{ color: 'var(--ef-text)' }}
                            >
                              {rec.puntajesIncidencias.total}/{rec.puntajesIncidencias.maxTotal}{' '}
                              <span style={{ color: 'var(--ef-accent-ink)' }}>
                                ({rec.puntajesIncidencias.porcentaje}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                        {previewRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-8 text-center font-medium"
                              style={{ color: 'var(--ef-text-muted)' }}
                            >
                              Ningún registro coincidió con el número de empleado del padrón. Verifica la columna seleccionada en el Paso 2.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{
            background: 'var(--ef-header-bg)',
            borderColor: 'var(--ef-border)',
          }}
        >
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(prev => (prev === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                style={{
                  backgroundColor: 'var(--ef-card-bg)',
                  borderColor: 'var(--ef-border)',
                  color: 'var(--ef-text)',
                }}
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
              disabled={isParsing}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
              style={{ color: 'var(--ef-text-muted)' }}
            >
              Cancelar
            </button>

            {step === 2 && (
              <button
                type="button"
                disabled={!canGoToPreview}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                style={{
                  background: 'var(--ef-btn-primary-bg)',
                  color: 'var(--ef-btn-primary-text)',
                }}
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
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                style={{
                  background: 'var(--ef-btn-primary-bg)',
                  color: 'var(--ef-btn-primary-text)',
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Aplicar incidencias (
                {previewResult.matchedCount +
                  (includeUnmatched ? previewResult.unmatchedCount : 0)}{' '}
                colaboradores)
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
