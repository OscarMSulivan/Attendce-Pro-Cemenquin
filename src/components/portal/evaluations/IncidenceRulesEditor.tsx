/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_INCIDENCE_RULES,
  INCIDENCE_METRIC_LABELS,
  type IncidenceMetricKey,
  type IncidenceRuleBracket,
  type IncidenceScoringRules,
} from '../../../types/evaluations';
import {
  getMetricMaxPoints,
  getRulesMaxTotal,
} from '../../../services/evaluationService';

export interface IncidenceRulesEditorProps {
  rules: IncidenceScoringRules;
  onSaveRules: (rules: IncidenceScoringRules) => void;
  disabled?: boolean;
}

const METRIC_KEYS: IncidenceMetricKey[] = [
  'faltas',
  'incapacidades',
  'retardos',
  'permisos',
];

const METRIC_ACCENTS: Record<
  IncidenceMetricKey,
  { badge: string; border: string; text: string }
> = {
  faltas: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    border: 'border-rose-500/20',
    text: 'text-rose-300',
  },
  incapacidades: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
  },
  retardos: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    border: 'border-sky-500/20',
    text: 'text-sky-300',
  },
  permisos: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    border: 'border-emerald-500/20',
    text: 'text-emerald-300',
  },
};

function cloneRules(rules: IncidenceScoringRules): IncidenceScoringRules {
  return {
    faltas: rules.faltas.map((b) => ({ ...b })),
    incapacidades: rules.incapacidades.map((b) => ({ ...b })),
    retardos: rules.retardos.map((b) => ({ ...b })),
    permisos: rules.permisos.map((b) => ({ ...b })),
  };
}

interface ValidationResult {
  allErrors: string[];
  byMetric: Record<IncidenceMetricKey, string[]>;
  rowErrors: Record<string, string>;
}

function validateRules(rules: IncidenceScoringRules): ValidationResult {
  const allErrors: string[] = [];
  const byMetric: Record<IncidenceMetricKey, string[]> = {
    faltas: [],
    incapacidades: [],
    retardos: [],
    permisos: [],
  };
  const rowErrors: Record<string, string> = {};

  for (const key of METRIC_KEYS) {
    const label = INCIDENCE_METRIC_LABELS[key].label;
    const brackets = rules[key];

    if (!brackets || brackets.length === 0) {
      const msg = `${label}: debe tener al menos un rango configurado.`;
      byMetric[key].push(msg);
      allErrors.push(msg);
      continue;
    }

    brackets.forEach((bracket, idx) => {
      const rowKey = `${key}_${idx}`;
      const issues: string[] = [];

      if (!Number.isFinite(bracket.min) || bracket.min < 0) {
        issues.push('el mínimo debe ser ≥ 0');
      }

      if (bracket.max !== null) {
        if (!Number.isFinite(bracket.max)) {
          issues.push('el máximo debe ser un número válido');
        } else if (Number.isFinite(bracket.min) && bracket.max < bracket.min) {
          issues.push('el máximo debe ser ≥ mínimo');
        }
      }

      if (!Number.isFinite(bracket.puntos) || bracket.puntos < 0) {
        issues.push('los puntos deben ser ≥ 0');
      }

      if (issues.length > 0) {
        const msg = `Fila ${idx + 1}: ${issues.join(', ')}.`;
        rowErrors[rowKey] = msg;
        byMetric[key].push(msg);
        allErrors.push(`${label} — ${msg}`);
      }
    });
  }

  return { allErrors, byMetric, rowErrors };
}

function parseNumericInput(raw: string): number {
  if (raw.trim() === '') return Number.NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export const IncidenceRulesEditor: React.FC<IncidenceRulesEditorProps> = ({
  rules,
  onSaveRules,
  disabled = false,
}) => {
  const [draftRules, setDraftRules] = useState<IncidenceScoringRules>(() =>
    cloneRules(rules),
  );
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDraftRules(cloneRules(rules));
    setSavedNotice(false);
  }, [rules]);

  const validation = useMemo(() => validateRules(draftRules), [draftRules]);
  const maxTotal = useMemo(() => getRulesMaxTotal(draftRules), [draftRules]);
  const hasErrors = validation.allErrors.length > 0;

  const updateBracket = (
    key: IncidenceMetricKey,
    index: number,
    updater: (prev: IncidenceRuleBracket) => IncidenceRuleBracket,
  ) => {
    setSavedNotice(false);
    setDraftRules((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? updater(item) : item)),
    }));
  };

  const handleAddBracket = (key: IncidenceMetricKey) => {
    setSavedNotice(false);
    setDraftRules((prev) => {
      const current = prev[key];
      let nextBracket: IncidenceRuleBracket;

      if (current.length === 0) {
        nextBracket = { min: 0, max: 0, puntos: 5 };
      } else {
        const last = current[current.length - 1];
        const baseMin =
          last.max !== null && Number.isFinite(last.max)
            ? last.max + 1
            : Number.isFinite(last.min)
              ? last.min + 1
              : 0;
        const basePoints = Number.isFinite(last.puntos)
          ? Math.max(0, last.puntos - 1)
          : 0;
        nextBracket = {
          min: baseMin,
          max: last.max === null ? null : baseMin,
          puntos: basePoints,
        };
      }

      return {
        ...prev,
        [key]: [...current, nextBracket],
      };
    });
  };

  const handleDeleteBracket = (key: IncidenceMetricKey, index: number) => {
    setSavedNotice(false);
    setDraftRules((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const handleRestoreDefaults = () => {
    setSavedNotice(false);
    setDraftRules(cloneRules(DEFAULT_INCIDENCE_RULES));
  };

  const handleSave = () => {
    if (disabled || hasErrors) return;
    onSaveRules(cloneRules(draftRules));
    setSavedNotice(true);
  };

  return (
    <div className="space-y-5">
      {/* Barra superior de resumen y acciones */}
      <div className="rounded-2xl p-4 sm:p-5 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Reglas de Equivalencias de Incidencias
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#171821] border border-[#A9DFD8]/30 text-xs font-mono font-bold text-[#A9DFD8] tabular-nums">
                Máx. {maxTotal} pts
              </span>
            </div>
            <p className="text-xs text-[#87888C] mt-0.5">
              Puntaje máximo total de incidencias:{' '}
              <strong className="text-slate-200 font-mono tabular-nums">
                {maxTotal} pts
              </strong>{' '}
              <span className="text-[#87888C]">(sugerido: 20 pts = 50% de la calificación final)</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#171821] hover:bg-[#2A2B36] disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 border border-white/[0.08] text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Restaurar sugeridos</span>
          </button>

          <button
            type="button"
            disabled={disabled || hasErrors}
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] disabled:opacity-45 disabled:cursor-not-allowed text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar y Recalcular Campaña</span>
          </button>
        </div>
      </div>

      {/* Aviso de guardado */}
      {savedNotice && !hasErrors && (
        <div className="rounded-xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Reglas guardadas correctamente. Los puntajes de incidencias y calificaciones finales de la campaña fueron recalculados.
          </span>
        </div>
      )}

      {/* Resumen de errores de validación */}
      {hasErrors && (
        <div className="rounded-xl p-4 bg-rose-500/15 border border-rose-500/35 text-rose-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Corrige los siguientes errores antes de guardar ({validation.allErrors.length}):</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-rose-200/90 space-y-0.5 pl-1">
            {validation.allErrors.slice(0, 6).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
            {validation.allErrors.length > 6 && (
              <li className="text-rose-300 font-semibold">
                y {validation.allErrors.length - 6} error(es) más...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Grid de 4 tarjetas de rubros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {METRIC_KEYS.map((key) => {
          const meta = INCIDENCE_METRIC_LABELS[key];
          const accent = METRIC_ACCENTS[key];
          const brackets = draftRules[key];
          const metricMax = getMetricMaxPoints(brackets);
          const metricErrors = validation.byMetric[key];

          return (
            <div
              key={key}
              className={`rounded-2xl bg-[#21222D] border ${
                metricErrors.length > 0 ? 'border-rose-500/50' : 'border-white/[0.06]'
              } shadow-lg overflow-hidden flex flex-col`}
            >
              {/* Header de la tarjeta */}
              <div className="px-4 py-3.5 bg-[#171821] border-b border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold shrink-0 ${accent.badge}`}
                  >
                    {meta.excelCode}
                  </span>
                  <h4 className="text-sm font-bold text-white truncate">
                    {meta.label}
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-slate-200 bg-[#21222D] px-2.5 py-1 rounded-lg border border-white/[0.08] tabular-nums shrink-0">
                  Máx. {metricMax} pts
                </span>
              </div>

              {/* Contenido / Tabla de rangos */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                {brackets.length === 0 ? (
                  <div className="rounded-xl p-4 bg-rose-500/10 border border-rose-500/30 text-center text-xs text-rose-300">
                    Este rubro debe tener al menos 1 rango configurado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#87888C]">
                      <span>Mínimo</span>
                      <span>Máximo</span>
                      <span className="text-center">O más</span>
                      <span>Puntos</span>
                      <span className="w-7" />
                    </div>

                    {brackets.map((bracket, idx) => {
                      const rowError = validation.rowErrors[`${key}_${idx}`];
                      const isOpenEnded = bracket.max === null;

                      return (
                        <div key={idx} className="space-y-1">
                          <div
                            className={`grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2 p-2 rounded-xl bg-[#171821] border ${
                              rowError ? 'border-rose-500/50' : 'border-white/[0.05]'
                            }`}
                          >
                            {/* Min */}
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={disabled}
                              aria-label={`${meta.label} mínimo fila ${idx + 1}`}
                              value={Number.isFinite(bracket.min) ? bracket.min : ''}
                              onChange={(e) => {
                                const nextMin = parseNumericInput(e.target.value);
                                updateBracket(key, idx, (prev) => ({
                                  ...prev,
                                  min: nextMin,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] focus:border-[#A9DFD8]/60 focus:outline-none text-xs font-mono text-white tabular-nums disabled:opacity-50"
                            />

                            {/* Max */}
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={disabled || isOpenEnded}
                              aria-label={`${meta.label} máximo fila ${idx + 1}`}
                              placeholder={isOpenEnded ? '∞' : ''}
                              value={
                                bracket.max === null
                                  ? ''
                                  : Number.isFinite(bracket.max)
                                    ? bracket.max
                                    : ''
                              }
                              onChange={(e) => {
                                const nextMax = parseNumericInput(e.target.value);
                                updateBracket(key, idx, (prev) => ({
                                  ...prev,
                                  max: nextMax,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] focus:border-[#A9DFD8]/60 focus:outline-none text-xs font-mono text-white tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                            />

                            {/* Checkbox "o más" */}
                            <label className="flex items-center justify-center gap-1.5 px-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={isOpenEnded}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateBracket(key, idx, (prev) => ({
                                    ...prev,
                                    max: checked
                                      ? null
                                      : Number.isFinite(prev.min)
                                        ? prev.min
                                        : 0,
                                  }));
                                }}
                                className="w-3.5 h-3.5 rounded accent-[#A9DFD8] cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="text-[11px] text-slate-300 whitespace-nowrap">
                                o más
                              </span>
                            </label>

                            {/* Puntos */}
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              disabled={disabled}
                              aria-label={`${meta.label} puntos fila ${idx + 1}`}
                              value={
                                Number.isFinite(bracket.puntos) ? bracket.puntos : ''
                              }
                              onChange={(e) => {
                                const nextPoints = parseNumericInput(e.target.value);
                                updateBracket(key, idx, (prev) => ({
                                  ...prev,
                                  puntos: nextPoints,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/[0.08] focus:border-[#A9DFD8]/60 focus:outline-none text-xs font-mono font-bold text-[#A9DFD8] tabular-nums disabled:opacity-50"
                            />

                            {/* Eliminar fila */}
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleDeleteBracket(key, idx)}
                              title="Eliminar rango"
                              aria-label={`Eliminar rango ${idx + 1} de ${meta.label}`}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {rowError && (
                            <p className="text-[11px] text-rose-400 pl-2">
                              {rowError}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botón agregar rango */}
                <div className="pt-1 mt-auto">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleAddBracket(key)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#171821] hover:bg-[#2A2B36] disabled:opacity-45 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-dashed border-white/[0.12] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>+ Agregar rango</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
