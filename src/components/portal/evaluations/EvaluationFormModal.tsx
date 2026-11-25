/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Lock,
  MessageSquare,
  Printer,
  Save,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import {
  EVALUATION_COMPETENCIES,
  INCIDENCE_METRIC_LABELS,
  createEmptyCompetencies,
  type CompetencyScore,
  type EmployeeEvaluationRecord,
  type EvaluationCampaign,
  type EvaluationCompetencyId,
  type EvaluationRecordStatus,
  type IncidenceMetricKey,
} from '../../../types/evaluations';
import {
  calculateEvaluationScores,
  printEvaluations,
} from '../../../services/evaluationService';
import type { PortalUser } from '../../../types/portal';

export interface EvaluationFormModalProps {
  campaign: EvaluationCampaign;
  record: EmployeeEvaluationRecord;
  currentUser: PortalUser;
  readOnly?: boolean;
  onSave: (updated: EmployeeEvaluationRecord) => void;
  onClose: () => void;
}

const INCIDENCE_KEYS: IncidenceMetricKey[] = [
  'faltas',
  'incapacidades',
  'retardos',
  'permisos',
];

const SCORE_OPTIONS: Array<{
  value: 1 | 0.5 | 0;
  key: '1' | '0.5' | '0';
  activeClasses: string;
  inactiveClasses: string;
  badgeClasses: string;
}> = [
  {
    value: 1,
    key: '1',
    activeClasses:
      'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm shadow-emerald-500/15 ring-1 ring-emerald-400/30',
    inactiveClasses:
      'bg-[#171821] border-white/[0.08] text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200',
    badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    value: 0.5,
    key: '0.5',
    activeClasses:
      'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm shadow-amber-500/15 ring-1 ring-amber-400/30',
    inactiveClasses:
      'bg-[#171821] border-white/[0.08] text-slate-300 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200',
    badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    value: 0,
    key: '0',
    activeClasses:
      'bg-rose-500/20 border-rose-400 text-rose-200 shadow-sm shadow-rose-500/15 ring-1 ring-rose-400/30',
    inactiveClasses:
      'bg-[#171821] border-white/[0.08] text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200',
    badgeClasses: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
];

const STATUS_META: Record<
  EvaluationRecordStatus,
  { label: string; className: string }
> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-slate-500/15 text-slate-300 border-slate-500/35',
  },
  en_progreso: {
    label: 'En progreso',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
  completada: {
    label: 'Completada',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
};

function getFinalScoreAccent(score: number): string {
  if (score >= 85) {
    return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15';
  }
  if (score >= 70) {
    return 'text-[#A9DFD8] border-[#A9DFD8]/40 bg-[#A9DFD8]/15';
  }
  if (score >= 50) {
    return 'text-amber-300 border-amber-500/40 bg-amber-500/15';
  }
  return 'text-rose-300 border-rose-500/40 bg-rose-500/15';
}

export const EvaluationFormModal: React.FC<EvaluationFormModalProps> = ({
  campaign,
  record,
  currentUser,
  readOnly = false,
  onSave,
  onClose,
}) => {
  const [competencias, setCompetencias] = useState<
    Record<EvaluationCompetencyId, CompetencyScore>
  >(() => ({
    ...createEmptyCompetencies(),
    ...record.competencias,
  }));
  const [comentarios, setComentarios] = useState<string>(
    record.comentariosEvaluador ?? '',
  );
  const [highlightMissing, setHighlightMissing] = useState(false);
  const validationBannerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCompetencias({
      ...createEmptyCompetencies(),
      ...record.competencias,
    });
    setComentarios(record.comentariosEvaluador ?? '');
    setHighlightMissing(false);
  }, [record]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const scores = useMemo(
    () =>
      calculateEvaluationScores(
        record.incidencias,
        competencias,
        campaign.rules,
      ),
    [record.incidencias, competencias, campaign.rules],
  );

  const { answeredCount } = scores;
  const totalCompetencies = EVALUATION_COMPETENCIES.length;
  const missingCount = totalCompetencies - answeredCount;
  const progressPercent = Math.round((answeredCount / totalCompetencies) * 100);
  const canPrint =
    record.status === 'completada' || answeredCount === totalCompetencies;

  const previewRecord = useMemo<EmployeeEvaluationRecord>(() => {
    const trimmedComments = comentarios.trim();
    return {
      ...record,
      competencias,
      puntajesIncidencias: scores.puntajesIncidencias,
      puntajeCompetencias: scores.puntajeCompetencias,
      porcentajeCompetencias: scores.porcentajeCompetencias,
      calificacionFinal: scores.calificacionFinal,
      comentariosEvaluador: trimmedComments || undefined,
      fechaEvaluacion:
        record.fechaEvaluacion ||
        (answeredCount === totalCompetencies
          ? new Date().toISOString().slice(0, 10)
          : undefined),
      evaluadoPor:
        record.evaluadoPor ||
        (!readOnly && answeredCount === totalCompetencies
          ? currentUser.name
          : undefined),
    };
  }, [
    record,
    competencias,
    scores,
    comentarios,
    answeredCount,
    totalCompetencies,
    readOnly,
    currentUser.name,
  ]);

  const validationError =
    highlightMissing && missingCount > 0
      ? `Falta responder ${missingCount} criterio${missingCount === 1 ? '' : 's'} de competencias para poder finalizar la evaluación.`
      : null;

  const handleSelectScore = (
    compId: EvaluationCompetencyId,
    value: 1 | 0.5 | 0,
  ) => {
    if (readOnly) return;
    setCompetencias((prev) => {
      const next = { ...prev, [compId]: value };
      if (highlightMissing) {
        const nextAnswered = EVALUATION_COMPETENCIES.filter(
          (c) => next[c.id] !== null && next[c.id] !== undefined,
        ).length;
        if (nextAnswered === totalCompetencies) {
          setHighlightMissing(false);
        }
      }
      return next;
    });
  };

  const handleSaveDraft = () => {
    if (readOnly) return;
    const nowIso = new Date().toISOString();
    const nextStatus: EvaluationRecordStatus =
      record.status === 'completada' && answeredCount === totalCompetencies
        ? 'completada'
        : answeredCount > 0
          ? 'en_progreso'
          : 'pendiente';

    const trimmedComments = comentarios.trim();
    const updated: EmployeeEvaluationRecord = {
      ...record,
      competencias,
      puntajesIncidencias: scores.puntajesIncidencias,
      puntajeCompetencias: scores.puntajeCompetencias,
      porcentajeCompetencias: scores.porcentajeCompetencias,
      calificacionFinal: scores.calificacionFinal,
      comentariosEvaluador: trimmedComments || undefined,
      status: nextStatus,
      actualizadaEn: nowIso,
    };

    onSave(updated);
    onClose();
  };

  const handleFinalize = () => {
    if (readOnly) return;
    if (answeredCount < totalCompetencies) {
      setHighlightMissing(true);
      requestAnimationFrame(() => {
        validationBannerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const trimmedComments = comentarios.trim();
    const updated: EmployeeEvaluationRecord = {
      ...record,
      competencias,
      puntajesIncidencias: scores.puntajesIncidencias,
      puntajeCompetencias: scores.puntajeCompetencias,
      porcentajeCompetencias: scores.porcentajeCompetencias,
      calificacionFinal: scores.calificacionFinal,
      comentariosEvaluador: trimmedComments || undefined,
      status: 'completada',
      fechaEvaluacion:
        record.fechaEvaluacion || new Date().toISOString().slice(0, 10),
      evaluadoPor: currentUser.name,
      evaluadoPorId: currentUser.id,
      actualizadaEn: nowIso,
    };

    onSave(updated);
    onClose();
  };

  const handlePrint = () => {
    if (!canPrint) return;
    printEvaluations(campaign, [previewRecord]);
  };

  const statusMeta = STATUS_META[record.status];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eval-form-modal-title"
    >
      <div className="bg-[#21222D] border border-[#2C2D3C] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header fijo */}
        <div className="p-4 sm:p-5 border-b border-[#2C2D3C] bg-[#171821] shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0 mt-0.5">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="eval-form-modal-title"
                    className="text-sm sm:text-base font-bold text-white truncate"
                  >
                    {record.nombre}
                  </h3>
                  {record.empleadoId && (
                    <span className="text-[11px] font-mono text-[#8C8D9B] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md">
                      #{record.empleadoId}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusMeta.className}`}
                  >
                    {record.status === 'completada' && (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {record.status === 'en_progreso' && (
                      <Clock className="w-3 h-3" />
                    )}
                    {statusMeta.label}
                  </span>
                  {readOnly && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/35">
                      <Lock className="w-3 h-3" />
                      Solo lectura
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8C8D9B] mt-0.5 truncate">
                  Campaña:{' '}
                  <strong className="text-slate-200">{campaign.nombre}</strong> ·
                  Año de emisión {campaign.anioEmision}
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

          {/* Metadatos del colaborador */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="px-3 py-2 rounded-xl bg-[#21222D] border border-white/[0.06] flex items-center gap-2 min-w-0">
              <Briefcase className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B]">
                  Puesto
                </div>
                <div className="font-semibold text-slate-100 truncate">
                  {record.puesto || '—'}
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-[#21222D] border border-white/[0.06] flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B]">
                  Área
                </div>
                <div className="font-semibold text-slate-100 truncate">
                  {record.area || '—'}
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-[#21222D] border border-white/[0.06] flex items-center gap-2 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B]">
                  Supervisor
                </div>
                <div className="font-semibold text-slate-100 truncate">
                  {record.supervisor || '—'}
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-[#21222D] border border-white/[0.06] flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-[#A9DFD8] shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B]">
                  Fecha de ingreso
                </div>
                <div className="font-semibold text-slate-100 font-mono truncate">
                  {record.fechaIngreso || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Bloque 1: Incidencias del año (50% - Solo lectura) */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#171821] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Incidencias {campaign.anioIncidencias} (50% — Solo lectura)
                </h4>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums">
                <span className="text-[11px] text-[#8C8D9B]">Total:</span>
                <span className="font-bold text-white">
                  {scores.puntajesIncidencias.total}/
                  {scores.puntajesIncidencias.maxTotal}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/35">
                  {scores.puntajesIncidencias.porcentaje}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {INCIDENCE_KEYS.map((key) => {
                const meta = INCIDENCE_METRIC_LABELS[key];
                const count = record.incidencias[key];
                const pts = scores.puntajesIncidencias[key];
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-[#21222D] border border-white/[0.06] p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-200 leading-tight">
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-[#8C8D9B] shrink-0">
                        {meta.excelCode}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 border-t border-white/[0.05] font-mono tabular-nums">
                      <div>
                        <span className="text-[10px] text-[#8C8D9B] block">
                          Cantidad
                        </span>
                        <span className="text-sm font-bold text-white">
                          {count}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#8C8D9B] block">
                          Puntaje
                        </span>
                        <span className="text-sm font-bold text-[#A9DFD8]">
                          {pts} pts
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {record.incidenciasPersonalizadas &&
              Object.keys(record.incidenciasPersonalizadas).length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#8C8D9B]">
                    Incidencias personalizadas (informativas):
                  </span>
                  {Object.entries(record.incidenciasPersonalizadas).map(
                    ([label, qty]) => (
                      <span
                        key={label}
                        className="px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-[11px] font-bold text-teal-200"
                      >
                        ★ {label}: {qty}
                      </span>
                    ),
                  )}
                </div>
              )}
          </section>

          {/* Bloque 2: Evaluación por Competencias (50%) */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#171821] p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#A9DFD8]" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Evaluación por Competencias (50%)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-300 font-mono tabular-nums">
                    {answeredCount} / {totalCompetencies} criterios respondidos
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                      answeredCount === totalCompetencies
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    }`}
                  >
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full h-2 rounded-full bg-[#21222D] overflow-hidden border border-white/[0.05]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    answeredCount === totalCompetencies
                      ? 'bg-emerald-400'
                      : 'bg-[#A9DFD8]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Banner de validación si faltan criterios al finalizar */}
            {validationError && (
              <div
                ref={validationBannerRef}
                role="alert"
                className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold text-xs">{validationError}</span>
              </div>
            )}

            {/* Lista de las 10 competencias */}
            <div className="space-y-2.5">
              {EVALUATION_COMPETENCIES.map((comp, index) => {
                const selectedScore = competencias[comp.id];
                const isMissing =
                  highlightMissing &&
                  (selectedScore === null || selectedScore === undefined);

                return (
                  <div
                    key={comp.id}
                    className={`rounded-xl p-3.5 border transition-colors ${
                      isMissing
                        ? 'bg-rose-500/[0.06] border-rose-500/45'
                        : 'bg-[#21222D] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-0.5 lg:max-w-[52%]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-[#8C8D9B]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="font-bold text-white text-xs sm:text-[13px]">
                            {comp.criterio}
                          </span>
                          {isMissing && (
                            <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed pl-7">
                          {comp.pregunta}
                        </p>
                      </div>

                      {/* 3 botones seleccionables */}
                      <div className="grid grid-cols-3 gap-2 lg:w-[46%] shrink-0">
                        {SCORE_OPTIONS.map((opt) => {
                          const isSelected = selectedScore === opt.value;
                          const labelText = comp.labels[opt.key];

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={readOnly}
                              aria-pressed={isSelected}
                              onClick={() =>
                                handleSelectScore(comp.id, opt.value)
                              }
                              className={`px-2.5 py-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? opt.activeClasses
                                  : readOnly
                                    ? 'bg-[#171821]/60 border-white/[0.05] text-slate-500 opacity-50'
                                    : opt.inactiveClasses
                              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              <span className="font-bold text-[11px] leading-tight">
                                {labelText}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  isSelected
                                    ? opt.badgeClasses
                                    : 'bg-white/[0.04] text-[#8C8D9B] border-white/[0.06]'
                                }`}
                              >
                                {opt.key}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bloque 3: Observaciones del evaluador */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#171821] p-4 space-y-2.5">
            <label
              htmlFor="eval-comments-textarea"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white"
            >
              <MessageSquare className="w-4 h-4 text-[#A9DFD8]" />
              <span>Observaciones del evaluador (opcional)</span>
            </label>
            <textarea
              id="eval-comments-textarea"
              rows={3}
              value={comentarios}
              disabled={readOnly}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder={
                readOnly
                  ? 'Sin observaciones registradas.'
                  : 'Agrega comentarios sobre fortalezas, áreas de oportunidad o compromisos acordados...'
              }
              className="w-full rounded-xl bg-[#21222D] border border-white/[0.08] focus:border-[#A9DFD8]/60 focus:outline-none px-3.5 py-2.5 text-xs text-white placeholder:text-[#8C8D9B] resize-y disabled:opacity-65 disabled:cursor-default"
            />
          </section>

          {/* Bloque 4: Resumen Final en vivo */}
          <section className="rounded-2xl border border-[#A9DFD8]/25 bg-gradient-to-br from-[#171821] to-[#1D2030] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Resumen Final en Vivo (50 / 50)
              </h4>
              {record.evaluadoPor && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#8C8D9B]">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Evaluado por{' '}
                    <strong className="text-slate-200">
                      {record.evaluadoPor}
                    </strong>
                    {record.fechaEvaluacion
                      ? ` el ${record.fechaEvaluacion}`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#21222D] border border-white/[0.06] p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B] font-semibold">
                    Evaluación por competencias
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    {scores.puntajeCompetencias} / 10 pts
                  </div>
                </div>
                <div className="text-xl font-extrabold font-mono tabular-nums text-white">
                  {scores.porcentajeCompetencias}%
                </div>
              </div>

              <div className="rounded-xl bg-[#21222D] border border-white/[0.06] p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#8C8D9B] font-semibold">
                    Puntaje total incidencias
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    {scores.puntajesIncidencias.total} /{' '}
                    {scores.puntajesIncidencias.maxTotal} pts
                  </div>
                </div>
                <div className="text-xl font-extrabold font-mono tabular-nums text-sky-300">
                  {scores.puntajesIncidencias.porcentaje}%
                </div>
              </div>

              <div
                className={`rounded-xl border p-3.5 flex items-center justify-between ${getFinalScoreAccent(
                  scores.calificacionFinal,
                )}`}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold opacity-85">
                    Calificación Final (50/50)
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Promedio ponderado
                  </div>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums">
                  {scores.calificacionFinal}%
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer fijo con acciones */}
        <div className="p-4 sm:p-5 border-t border-[#2C2D3C] bg-[#171821] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <button
              type="button"
              disabled={!canPrint}
              onClick={handlePrint}
              title={
                canPrint
                  ? 'Abrir formato oficial imprimible / guardar como PDF'
                  : 'Responde los 10 criterios para habilitar la impresión'
              }
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-sky-300 border border-sky-500/35 text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {readOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#21222D] hover:bg-[#2A2B36] text-slate-200 border border-white/[0.08] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#21222D] hover:bg-[#2A2B36] text-slate-200 border border-white/[0.1] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  <span>Guardar borrador</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalizar evaluación</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
