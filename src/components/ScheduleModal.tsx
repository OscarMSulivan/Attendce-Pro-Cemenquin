/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Moon,
  Zap,
  Download,
  Upload,
  Copy,
  Users,
  Sparkles,
  CheckCircle2,
  CalendarClock,
  ArrowRight
} from 'lucide-react';
import { DaySchedule, ScheduleConfig } from '../types/attendance';
import { NOMBRES_DIAS_CORTO, formatScheduleHoursSummary } from '../utils/calendarUtils';
import { normalizarHorarioDia } from '../core/eventsHierarchy';

function timeToMinutes(t: string): number | null {
  if (!t || !t.includes(':')) return null;
  const [hh, mm] = t.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  horarios: Record<string, ScheduleConfig>;
  onSaveHorario: (code: string, config: ScheduleConfig) => void;
  onDeleteHorario: (code: string) => void;
  assignedCountBySchedule: Record<string, number>;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onSwitchToAssign?: () => void;
}

interface QuickPreset {
  id: string;
  label: string;
  sublabel: string;
  suggestedCode: string;
  suggestedName: string;
  dias: Record<number, DaySchedule | null>;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'admo_lv',
    label: '🏢 Administrativo L-V',
    sublabel: '08:00 a 17:30 (60m comida)',
    suggestedCode: 'ADMO',
    suggestedName: 'Administrativo Lunes a Viernes',
    dias: {
      0: null,
      1: { entrada: '08:00', salida: '17:30', comida: 60, cruzaMedianoche: false },
      2: { entrada: '08:00', salida: '17:30', comida: 60, cruzaMedianoche: false },
      3: { entrada: '08:00', salida: '17:30', comida: 60, cruzaMedianoche: false },
      4: { entrada: '08:00', salida: '17:30', comida: 60, cruzaMedianoche: false },
      5: { entrada: '08:00', salida: '17:30', comida: 60, cruzaMedianoche: false },
      6: null,
    },
  },
  {
    id: 'operativo_sab',
    label: '⚙️ Operativo + Sábado',
    sublabel: 'L-V 08:00-17:00 | Sáb 08:00-13:00',
    suggestedCode: 'OPER_SAB',
    suggestedName: 'Operativo con Sábado Medio Día',
    dias: {
      0: null,
      1: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      2: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      3: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      4: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      5: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      6: { entrada: '08:00', salida: '13:00', comida: 0, cruzaMedianoche: false },
    },
  },
  {
    id: 'turno_matutino',
    label: '☀️ Turno Matutino (T1)',
    sublabel: 'L-S 06:00 a 14:00 (30m comida)',
    suggestedCode: 'MAT_T1',
    suggestedName: 'Turno 1 Matutino (06:00 - 14:00)',
    dias: {
      0: null,
      1: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
      2: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
      3: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
      4: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
      5: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
      6: { entrada: '06:00', salida: '14:00', comida: 30, cruzaMedianoche: false },
    },
  },
  {
    id: 'turno_vespertino',
    label: '🌇 Turno Vespertino (T2)',
    sublabel: 'L-S 14:00 a 22:00 (30m comida)',
    suggestedCode: 'VESP_T2',
    suggestedName: 'Turno 2 Vespertino (14:00 - 22:00)',
    dias: {
      0: null,
      1: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
      2: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
      3: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
      4: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
      5: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
      6: { entrada: '14:00', salida: '22:00', comida: 30, cruzaMedianoche: false },
    },
  },
  {
    id: 'turno_nocturno',
    label: '🌙 Turno Nocturno (T3)',
    sublabel: 'L-V 22:00 a 06:00 (Cruza medianoche)',
    suggestedCode: 'NOCT_T3',
    suggestedName: 'Turno 3 Nocturno (22:00 - 06:00)',
    dias: {
      0: null,
      1: { entrada: '22:00', salida: '06:00', comida: 30, cruzaMedianoche: true },
      2: { entrada: '22:00', salida: '06:00', comida: 30, cruzaMedianoche: true },
      3: { entrada: '22:00', salida: '06:00', comida: 30, cruzaMedianoche: true },
      4: { entrada: '22:00', salida: '06:00', comida: 30, cruzaMedianoche: true },
      5: { entrada: '22:00', salida: '06:00', comida: 30, cruzaMedianoche: true },
      6: null,
    },
  },
];

function computeDayNetHours(d: DaySchedule | null): number {
  const norm = normalizarHorarioDia(d);
  if (!norm) return 0;
  const entMin = timeToMinutes(norm.entrada);
  const salMin = timeToMinutes(norm.salida);
  if (entMin === null || salMin === null) return 0;
  let diff = salMin - entMin;
  if (diff <= 0 || norm.cruzaMedianoche) {
    diff += 24 * 60;
  }
  const netMin = Math.max(0, diff - (norm.comida || 0));
  return Number((netMin / 60).toFixed(2));
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  horarios,
  onSaveHorario,
  onDeleteHorario,
  assignedCountBySchedule,
  onExportBackup,
  onImportBackup,
  onSwitchToAssign,
}) => {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [plantillaEntrada, setPlantillaEntrada] = useState<string>('08:00');
  const [plantillaSalida, setPlantillaSalida] = useState<string>('17:00');
  const [plantillaComida, setPlantillaComida] = useState<number>(60);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  // Estado de los 7 días (0..6)
  const [diasState, setDiasState] = useState<Record<number, DaySchedule | null>>({
    0: null,
    1: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    2: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    3: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    4: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    5: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    6: null,
  });

  const weeklySummary = useMemo(() => {
    let activeDaysCount = 0;
    let totalWeeklyHours = 0;
    for (let i = 0; i <= 6; i++) {
      if (diasState[i]) {
        activeDaysCount++;
        totalWeeklyHours += computeDayNetHours(diasState[i]);
      }
    }
    return {
      activeDaysCount,
      totalWeeklyHours: Number(totalWeeklyHours.toFixed(2)),
    };
  }, [diasState]);

  if (!isOpen) return null;

  const handleStartEdit = (horarioCode: string) => {
    const item = horarios[horarioCode];
    if (!item) return;
    setEditingCode(horarioCode);
    setCode(horarioCode);
    setNombre(item.nombre);
    setFeedbackMsg(null);

    const initialDias: Record<number, DaySchedule | null> = {};
    for (let i = 0; i <= 6; i++) {
      initialDias[i] = item.dias[i] ? { ...item.dias[i]! } : null;
    }
    setDiasState(initialDias);
  };

  const handleDuplicateSchedule = (horarioCode: string) => {
    const item = horarios[horarioCode];
    if (!item) return;
    setEditingCode(null);
    setCode(`${horarioCode}_2`.slice(0, 12));
    setNombre(`${item.nombre} (Copia)`);
    const clonedDias: Record<number, DaySchedule | null> = {};
    for (let i = 0; i <= 6; i++) {
      clonedDias[i] = item.dias[i] ? { ...item.dias[i]! } : null;
    }
    setDiasState(clonedDias);
    setFeedbackMsg({
      text: `Horario "${horarioCode}" clonado en el formulario. Ajusta el código y guarda.`,
      type: 'ok',
    });
  };

  const handleApplyPreset = (preset: QuickPreset) => {
    if (!editingCode) {
      if (!code.trim() || QUICK_PRESETS.some(p => p.suggestedCode === code)) {
        const nextCode = horarios[preset.suggestedCode]
          ? `${preset.suggestedCode}_N`
          : preset.suggestedCode;
        setCode(nextCode);
      }
      setNombre(preset.suggestedName);
    }
    const cloned: Record<number, DaySchedule | null> = {};
    for (let i = 0; i <= 6; i++) {
      cloned[i] = preset.dias[i] ? { ...preset.dias[i]! } : null;
    }
    setDiasState(cloned);
    const refDay = preset.dias[1];
    if (refDay) {
      setPlantillaEntrada(refDay.entrada);
      setPlantillaSalida(refDay.salida);
      setPlantillaComida(refDay.comida);
    }
    setFeedbackMsg({
      text: `Plantilla "${preset.label}" cargada. Revisa los datos y presiona Guardar Horario.`,
      type: 'ok',
    });
  };

  const handleResetForm = () => {
    setEditingCode(null);
    setCode('');
    setNombre('');
    setFeedbackMsg(null);
    setDiasState({
      0: null,
      1: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      2: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      3: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      4: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      5: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      6: null,
    });
  };

  const handleToggleDay = (dayIndex: number) => {
    setDiasState(prev => {
      const current = prev[dayIndex];
      const normTemplate = normalizarHorarioDia({
        entrada: plantillaEntrada,
        salida: plantillaSalida,
        comida: plantillaComida,
        cruzaMedianoche: false,
      });
      return {
        ...prev,
        [dayIndex]: current ? null : normTemplate,
      };
    });
  };

  const handleQuickSelectDays = (mode: 'lv' | 'ls' | 'all') => {
    const normTemplate = normalizarHorarioDia({
      entrada: plantillaEntrada,
      salida: plantillaSalida,
      comida: plantillaComida,
      cruzaMedianoche: false,
    });
    setDiasState(prev => {
      const next: Record<number, DaySchedule | null> = {};
      for (let i = 0; i <= 6; i++) {
        const shouldBeActive =
          mode === 'all' || (mode === 'lv' && i >= 1 && i <= 5) || (mode === 'ls' && i >= 1 && i <= 6);
        if (!shouldBeActive) {
          next[i] = null;
        } else {
          next[i] = prev[i] ? normalizarHorarioDia(prev[i]) : normTemplate;
        }
      }
      return next;
    });
  };

  const handleApplyTemplate = () => {
    const normTemplate = normalizarHorarioDia({
      entrada: plantillaEntrada,
      salida: plantillaSalida,
      comida: plantillaComida,
      cruzaMedianoche: false,
    });
    if (normTemplate) {
      setPlantillaEntrada(normTemplate.entrada);
      setPlantillaSalida(normTemplate.salida);
    }
    setDiasState(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        const idx = Number(k);
        if (updated[idx] && normTemplate) {
          updated[idx] = { ...normTemplate };
        }
      });
      return updated;
    });
    setFeedbackMsg({
      text: `Horario ${normTemplate?.entrada || plantillaEntrada} - ${normTemplate?.salida || plantillaSalida} (${plantillaComida}m comida) aplicado a todos los días activos.`,
      type: 'ok',
    });
  };

  const handleCopyDayToAllActive = (sourceIdx: number) => {
    const source = diasState[sourceIdx];
    if (!source) return;
    setDiasState(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        const idx = Number(k);
        if (updated[idx]) {
          updated[idx] = { ...source };
        }
      });
      return updated;
    });
    setFeedbackMsg({
      text: `Se copió el horario del ${NOMBRES_DIAS_CORTO[sourceIdx]} (${source.entrada} - ${source.salida}) al resto de los días activos.`,
      type: 'ok',
    });
  };

  const handleSave = () => {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanNombre = nombre.trim();
    if (!cleanCode || !cleanNombre) {
      setFeedbackMsg({
        text: '⚠️ Por favor ingresa tanto el Código corto (ej. ADMO) como el Nombre Descriptivo del horario.',
        type: 'err',
      });
      return;
    }

    const activeDays = Object.values(diasState).filter(Boolean);
    if (activeDays.length === 0) {
      setFeedbackMsg({
        text: '⚠️ Debes activar al menos un día laborable en la semana.',
        type: 'err',
      });
      return;
    }

    const normalizedDias: Record<number, DaySchedule | null> = {};
    for (let i = 0; i <= 6; i++) {
      normalizedDias[i] = diasState[i] ? normalizarHorarioDia(diasState[i]) : null;
    }

    onSaveHorario(cleanCode, {
      nombre: cleanNombre,
      dias: normalizedDias,
    });

    handleResetForm();
    setFeedbackMsg({
      text: `✓ Horario "${cleanCode} — ${cleanNombre}" guardado y normalizado correctamente.`,
      type: 'ok',
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[92vh] my-auto flex flex-col shadow-2xl animate-scale-in text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/35 flex items-center justify-center text-[#FEB95A]">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Catálogo y Creador Inteligente de Horarios
              </h3>
              <p className="text-xs text-[#87888C]">
                Usa plantillas de 1 clic, ajusta días individuales o clona horarios existentes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToAssign && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToAssign();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Asignar a Empleados</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#87888C] hover:text-white hover:bg-[#171821] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body en 2 columnas en escritorio para trabajar mucho más cómodo */}
        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* COLUMNA IZQUIERDA (5 cols): Catálogo de Horarios Registrados + Respaldo */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Horarios Activos ({Object.keys(horarios).length})
              </h4>
              {editingCode && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  + Crear Nuevo
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {Object.keys(horarios).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">
                  No hay horarios configurados. Usa una plantilla rápida a la derecha.
                </p>
              ) : (
                Object.keys(horarios).map(cod => {
                  const h = horarios[cod];
                  const asignados = assignedCountBySchedule[cod] || 0;
                  const isBeingEdited = editingCode === cod;
                  const hoursSummary = formatScheduleHoursSummary(h);
                  return (
                    <div
                      key={cod}
                      className={`p-3 rounded-xl border transition-all ${
                        isBeingEdited
                          ? 'bg-amber-500/15 border-amber-500 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {cod}
                            </span>
                            <span className="text-xs font-bold text-slate-100 truncate">
                              {h.nombre}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono font-bold">
                              {asignados} colab.
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-300 font-mono mt-1">
                            {hoursSummary}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 font-mono text-[10px]">
                            {NOMBRES_DIAS_CORTO.map((name, idx) => (
                              <span
                                key={name}
                                className={`px-1.5 py-0.2 rounded ${
                                  h.dias[idx]
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold'
                                    : 'text-slate-500 line-through opacity-60'
                                }`}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cod)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            title="Editar este horario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateSchedule(cod)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 cursor-pointer"
                            title="Duplicar horario como base para uno nuevo"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteCode === cod ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteHorario(cod);
                                setConfirmDeleteCode(null);
                                if (editingCode === cod) handleResetForm();
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                              title="Confirmar eliminación"
                            >
                              ¿Borrar?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCode(cod)}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                              title="Eliminar horario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Respaldo JSON */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold block">
                Respaldo de Catálogo y Asignaciones (.JSON)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Exportar
                </button>
                <label className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Importar
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        onImportBackup(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA (7 cols): Editor Inteligente con Plantillas de 1 Clic */}
          <div className="lg:col-span-7 space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" />
                {editingCode ? `Editando Horario: ${editingCode}` : 'Configurar Nuevo Horario'}
              </h4>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  {weeklySummary.activeDaysCount} días activos
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                  Total: {weeklySummary.totalWeeklyHours} hrs netas/sem
                </span>
              </div>
            </div>

            {feedbackMsg && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                  feedbackMsg.type === 'ok'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {feedbackMsg.text}
                </span>
                <button
                  type="button"
                  onClick={() => setFeedbackMsg(null)}
                  className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 1. Plantillas Preconfiguradas de 1 Clic */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                1. Cargar Plantilla Preconfigurada en 1 Clic (Opcional):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                {QUICK_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-left transition-all cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-slate-100">{p.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate">{p.sublabel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Código y Nombre */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Código Corto *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={Boolean(editingCode)}
                  placeholder="Ej: ADMO, T1"
                  className="w-full text-xs rounded-lg px-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-amber-500 font-mono font-bold disabled:opacity-50"
                  maxLength={12}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre Descriptivo del Horario *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Administrativo Lunes a Viernes"
                  className="w-full text-xs rounded-lg px-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-amber-500 font-semibold"
                />
              </div>
            </div>

            {/* 3. Selección de días laborables + Botones rápidos */}
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  2. Días Laborados (Clic para activar o descansar):
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickSelectDays('lv')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                  >
                    Lun a Vie
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSelectDays('ls')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                  >
                    Lun a Sáb
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSelectDays('all')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {NOMBRES_DIAS_CORTO.map((name, idx) => {
                  const isActive = Boolean(diasState[idx]);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleToggleDay(idx)}
                      className={`py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Aplicar Hora Masiva a los Días Seleccionados */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-1.5 mb-2 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Aplicar misma Entrada / Salida a todos los días activos:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Entrada</span>
                  <input
                    type="time"
                    value={plantillaEntrada}
                    onChange={(e) => setPlantillaEntrada(e.target.value)}
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Salida</span>
                  <input
                    type="time"
                    value={plantillaSalida}
                    onChange={(e) => setPlantillaSalida(e.target.value)}
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Comida (min)</span>
                  <input
                    type="number"
                    value={plantillaComida}
                    onChange={(e) => setPlantillaComida(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    step={5}
                    className="w-full text-xs rounded-lg px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Aplicar a Todos
                </button>
              </div>
            </div>

            {/* 5. Detalle por Día Individual */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                3. Ajuste Fino por Día (Ej. Sábado sale más temprano):
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {Object.keys(diasState)
                  .map(Number)
                  .filter(idx => Boolean(diasState[idx]))
                  .map(idx => {
                    const d = diasState[idx]!;
                    const netHrs = computeDayNetHours(d);
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 flex-wrap text-xs"
                      >
                        <span className="w-11 text-center font-extrabold text-amber-300 uppercase text-[10px] py-1 bg-amber-500/15 rounded-lg border border-amber-500/30">
                          {NOMBRES_DIAS_CORTO[idx]}
                        </span>
                        <input
                          type="time"
                          value={d.entrada}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiasState(prev => {
                              const current = prev[idx]!;
                              const nextNight =
                                timeToMinutes(current.salida) !== null &&
                                timeToMinutes(val) !== null &&
                                timeToMinutes(current.salida)! <= timeToMinutes(val)! &&
                                timeToMinutes(val)! >= 12 * 60;
                              return {
                                ...prev,
                                [idx]: { ...current, entrada: val, cruzaMedianoche: nextNight },
                              };
                            });
                          }}
                          className="rounded-lg px-2 py-1 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs"
                        />
                        <span className="text-slate-500 text-[10px]">a</span>
                        <input
                          type="time"
                          value={d.salida}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiasState(prev => {
                              const current = prev[idx]!;
                              const nextNight =
                                timeToMinutes(val) !== null &&
                                timeToMinutes(current.entrada) !== null &&
                                timeToMinutes(val)! <= timeToMinutes(current.entrada)! &&
                                timeToMinutes(current.entrada)! >= 12 * 60;
                              return {
                                ...prev,
                                [idx]: { ...current, salida: val, cruzaMedianoche: nextNight },
                              };
                            });
                          }}
                          className="rounded-lg px-2 py-1 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={d.comida}
                            title="Minutos de comida"
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setDiasState(prev => ({ ...prev, [idx]: { ...prev[idx]!, comida: val } }));
                            }}
                            className="w-14 rounded-lg px-1.5 py-1 bg-slate-950 border border-slate-800 text-slate-100 text-center font-mono text-xs"
                          />
                          <span className="text-[10px] text-slate-400">m com.</span>
                        </div>

                        <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                          {netHrs}h netas
                        </span>

                        <label className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer ml-auto">
                          <input
                            type="checkbox"
                            checked={Boolean(d.cruzaMedianoche)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDiasState(prev => ({ ...prev, [idx]: { ...prev[idx]!, cruzaMedianoche: checked } }));
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-amber-500"
                          />
                          <Moon className="w-3 h-3 text-amber-400 inline" />
                          <span>Nocturno</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleCopyDayToAllActive(idx)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 cursor-pointer"
                          title="Copiar el horario de este día al resto de los días activos"
                        >
                          Copiar a demás
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-[#171821]/80 rounded-b-2xl">
          <span className="text-[11px] text-[#87888C]">
            Los cambios se aplican y recalculan en automático sobre el reporte activo.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#87888C] hover:text-white cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] shadow-md transition-all cursor-pointer"
            >
              {editingCode ? `Actualizar Horario (${editingCode})` : 'Guardar Nuevo Horario'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
