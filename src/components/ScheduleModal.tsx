/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Moon, 
  Zap, 
  Download, 
  Upload 
} from 'lucide-react';
import { DaySchedule, ScheduleConfig } from '../types/attendance';
import { NOMBRES_DIAS_CORTO } from '../utils/calendarUtils';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  horarios: Record<string, ScheduleConfig>;
  onSaveHorario: (code: string, config: ScheduleConfig) => void;
  onDeleteHorario: (code: string) => void;
  assignedCountBySchedule: Record<string, number>;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
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
}) => {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [plantillaEntrada, setPlantillaEntrada] = useState<string>('08:00');
  const [plantillaSalida, setPlantillaSalida] = useState<string>('17:00');
  const [plantillaComida, setPlantillaComida] = useState<number>(60);

  // Estado de los 7 días (0..6)
  const [diasState, setDiasState] = useState<Record<number, DaySchedule | null>>({
    0: null,
    1: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    2: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    3: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    4: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    5: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
    6: null
  });

  if (!isOpen) return null;

  const handleStartEdit = (horarioCode: string) => {
    const item = horarios[horarioCode];
    if (!item) return;
    setEditingCode(horarioCode);
    setCode(horarioCode);
    setNombre(item.nombre);

    const initialDias: Record<number, DaySchedule | null> = {};
    for (let i = 0; i <= 6; i++) {
      initialDias[i] = item.dias[i] ? { ...item.dias[i]! } : null;
    }
    setDiasState(initialDias);
  };

  const handleResetForm = () => {
    setEditingCode(null);
    setCode('');
    setNombre('');
    setDiasState({
      0: null,
      1: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      2: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      3: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      4: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      5: { entrada: '08:00', salida: '17:00', comida: 60, cruzaMedianoche: false },
      6: null
    });
  };

  const handleToggleDay = (dayIndex: number) => {
    setDiasState(prev => {
      const current = prev[dayIndex];
      return {
        ...prev,
        [dayIndex]: current
          ? null
          : { entrada: plantillaEntrada, salida: plantillaSalida, comida: plantillaComida, cruzaMedianoche: false }
      };
    });
  };

  const handleApplyTemplate = () => {
    setDiasState(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        const idx = Number(k);
        if (updated[idx]) {
          const cruzaPrevio = updated[idx]?.cruzaMedianoche;
          updated[idx] = {
            entrada: plantillaEntrada,
            salida: plantillaSalida,
            comida: plantillaComida,
            cruzaMedianoche: !!cruzaPrevio
          };
        }
      });
      return updated;
    });
  };

  const handleSave = () => {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanNombre = nombre.trim();
    if (!cleanCode || !cleanNombre) {
      alert('Por favor ingresa un código y un nombre para el horario.');
      return;
    }

    const activeDays = Object.values(diasState).filter(Boolean);
    if (activeDays.length === 0) {
      alert('Debes marcar al menos un día como laborable.');
      return;
    }

    onSaveHorario(cleanCode, {
      nombre: cleanNombre,
      dias: diasState
    });

    handleResetForm();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Administrador de Horarios</h3>
              <p className="text-[10px] text-slate-400">Define plantillas de turnos y tolerancias de jornada</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Barra de respaldo rápido */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Respalda tus horarios y asignaciones en un archivo JSON</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <Download className="w-3 h-3 text-amber-400" /> Exportar
              </button>
              <label className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" /> Importar
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

          {/* Lista de horarios existentes */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Horarios Registrados</h4>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {Object.keys(horarios).length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No hay horarios configurados.</p>
              ) : (
                Object.keys(horarios).map(cod => {
                  const h = horarios[cod];
                  const asignados = assignedCountBySchedule[cod] || 0;
                  return (
                    <div
                      key={cod}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {cod}
                          </span>
                          <span className="text-xs font-semibold text-slate-200">{h.nombre}</span>
                          {asignados > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                              {asignados} emp.
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          {NOMBRES_DIAS_CORTO.map((name, idx) => (
                            <span
                              key={name}
                              className={h.dias[idx] ? 'text-slate-200 font-medium' : 'text-slate-600 line-through mr-1'}
                            >
                              {name}{idx < 6 ? ' ' : ''}
                            </span>
                          ))}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cod)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Editar horario"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar el horario "${cod}"?`)) onDeleteHorario(cod);
                          }}
                          className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="Eliminar horario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Formulario de Creación / Edición */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                {editingCode ? `Editando: ${editingCode}` : 'Nuevo Horario'}
              </h4>
              {editingCode && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Código (Ej: ADMO, PRODT1)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={Boolean(editingCode)}
                  placeholder="PRODT1"
                  className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                  maxLength={12}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre Descriptivo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Producción Turno 1"
                  className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Selector de días laborados */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Días Laborados (Clic para activar/desactivar)
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {NOMBRES_DIAS_CORTO.map((name, idx) => {
                  const isActive = Boolean(diasState[idx]);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleToggleDay(idx)}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Los días apagados se computarán automáticamente como <strong>Descanso</strong> en el reporte.
              </p>
            </div>

            {/* Plantilla rápida */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 mb-2 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" />
                Plantilla Rápida (aplica a todos los días marcados arriba)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Entrada</span>
                  <input
                    type="time"
                    value={plantillaEntrada}
                    onChange={(e) => setPlantillaEntrada(e.target.value)}
                    className="w-full text-xs rounded px-2 py-1.5 bg-slate-900 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Salida</span>
                  <input
                    type="time"
                    value={plantillaSalida}
                    onChange={(e) => setPlantillaSalida(e.target.value)}
                    className="w-full text-xs rounded px-2 py-1.5 bg-slate-900 border border-slate-800 text-slate-200"
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
                    className="w-full text-xs rounded px-2 py-1.5 bg-slate-900 border border-slate-800 text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  className="py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {/* Detalle por día individual */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Detalle por Día (Ajuste Individual)
              </label>
              {Object.keys(diasState)
                .map(Number)
                .filter(idx => Boolean(diasState[idx]))
                .map(idx => {
                  const d = diasState[idx]!;
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 flex-wrap text-xs"
                    >
                      <span className="w-10 text-center font-bold text-amber-400 uppercase text-[10px] py-1 bg-amber-500/10 rounded border border-amber-500/20">
                        {NOMBRES_DIAS_CORTO[idx]}
                      </span>
                      <input
                        type="time"
                        value={d.entrada}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDiasState(prev => ({ ...prev, [idx]: { ...prev[idx]!, entrada: val } }));
                        }}
                        className="rounded px-2 py-1 bg-slate-900 border border-slate-800 text-slate-200 flex-1 min-w-20"
                      />
                      <input
                        type="time"
                        value={d.salida}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDiasState(prev => ({ ...prev, [idx]: { ...prev[idx]!, salida: val } }));
                        }}
                        className="rounded px-2 py-1 bg-slate-900 border border-slate-800 text-slate-200 flex-1 min-w-20"
                      />
                      <input
                        type="number"
                        value={d.comida}
                        title="Minutos de comida"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setDiasState(prev => ({ ...prev, [idx]: { ...prev[idx]!, comida: val } }));
                        }}
                        className="w-16 rounded px-2 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-center"
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer ml-auto">
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
                        Nocturno
                      </label>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all"
          >
            Guardar Horario
          </button>
        </div>
      </div>
    </div>
  );
};
