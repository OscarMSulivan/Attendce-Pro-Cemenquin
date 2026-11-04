/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Users, Search, CheckSquare, Square, Filter } from 'lucide-react';
import { Employee, ScheduleConfig } from '../types/attendance';

interface AssignScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  horarios: Record<string, ScheduleConfig>;
  onAssignIndividual: (employeeId: string, scheduleCode: string) => void;
  onAssignBulk: (employeeIds: string[], scheduleCode: string) => void;
}

export const AssignScheduleModal: React.FC<AssignScheduleModalProps> = ({
  isOpen,
  onClose,
  employees,
  horarios,
  onAssignIndividual,
  onAssignBulk,
}) => {
  const [search, setSearch] = useState<string>('');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('');
  const [filterHorario, setFilterHorario] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSchedule, setBulkSchedule] = useState<string>('');

  const supervisors = useMemo(() => {
    return [...new Set(employees.map(e => e.jefe).filter(Boolean))].sort();
  }, [employees]);

  const scheduleCodes = useMemo(() => {
    return Object.keys(horarios).sort();
  }, [horarios]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qNum = parseInt(q, 10);
    const qNumStr = !isNaN(qNum) ? qNum.toString() : '';
    return employees.filter(e => {
      const matchQuery = !q || e.nombre.toLowerCase().includes(q) || e.id.includes(q) || (Boolean(qNumStr) && e.id.includes(qNumStr));
      const matchSup = !filterSupervisor || e.jefe === filterSupervisor;
      const matchHor = !filterHorario || 
        (filterHorario === '__NINGUNO__' ? !e.horario : e.horario === filterHorario);
      return matchQuery && matchSup && matchHor;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [employees, search, filterSupervisor, filterHorario]);

  if (!isOpen) return null;

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allVisibleSelected = filteredEmployees.length > 0 &&
      filteredEmployees.every(e => selectedIds.has(e.id));

    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredEmployees.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredEmployees.forEach(e => next.add(e.id));
        return next;
      });
    }
  };

  const handleApplyBulk = () => {
    if (!bulkSchedule) {
      alert('Por favor selecciona un horario para aplicar.');
      return;
    }
    if (selectedIds.size === 0) {
      alert('Marca al menos un empleado para aplicar el horario.');
      return;
    }

    const finalCode = bulkSchedule === '__NINGUNO__' ? '' : bulkSchedule;
    onAssignBulk(Array.from(selectedIds), finalCode);
    setSelectedIds(new Set());
  };

  const isAllVisibleSelected = filteredEmployees.length > 0 &&
    filteredEmployees.every(e => selectedIds.has(e.id));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Asignar Horarios a Empleados</h3>
              <p className="text-[10px] text-slate-400">Vincula los turnos laborales a los colaboradores de forma individual o masiva</p>
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
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Filtros */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={filterSupervisor}
              onChange={(e) => setFilterSupervisor(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 outline-none"
            >
              <option value="">Todos los supervisores</option>
              {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filterHorario}
              onChange={(e) => setFilterHorario(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 outline-none"
            >
              <option value="">Todos los horarios</option>
              {scheduleCodes.map(c => (
                <option key={c} value={c}>
                  {c} — {horarios[c].nombre}
                </option>
              ))}
              <option value="__NINGUNO__">Sin horario asignado</option>
            </select>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o ID..."
                className="w-full text-xs rounded-lg pl-7 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Acción masiva */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 whitespace-nowrap">
              Acción Masiva:
            </span>
            <select
              value={bulkSchedule}
              onChange={(e) => setBulkSchedule(e.target.value)}
              className="flex-1 text-xs rounded-lg px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 outline-none"
            >
              <option value="">Selecciona horario a asignar...</option>
              {scheduleCodes.map(c => (
                <option key={c} value={c}>
                  {c} — {horarios[c].nombre}
                </option>
              ))}
              <option value="__NINGUNO__">Sin horario (quitar asignación)</option>
            </select>
            <button
              type="button"
              onClick={handleApplyBulk}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap"
            >
              Aplicar a {selectedIds.size} seleccionado(s)
            </button>
          </div>

          {/* Selector de todos */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-400">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="flex items-center gap-1.5 font-semibold text-slate-300 hover:text-white"
            >
              {isAllVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              <span>Seleccionar todos los visibles ({filteredEmployees.length})</span>
            </button>
            <span className="font-mono text-[11px]">
              {selectedIds.size} seleccionados en total
            </span>
          </div>

          {/* Lista de empleados */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {filteredEmployees.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No hay empleados que coincidan con los filtros seleccionados.
              </p>
            ) : (
              filteredEmployees.map(emp => {
                const isChecked = selectedIds.has(emp.id);
                return (
                  <div
                    key={emp.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-3 transition-colors ${
                      isChecked
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectOne(emp.id)}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {emp.nombre}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          #{emp.id}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        Supervisor: {emp.jefe}
                      </p>
                    </div>

                    <select
                      value={emp.horario || ''}
                      onChange={(e) => onAssignIndividual(emp.id, e.target.value)}
                      className="w-44 text-xs rounded-lg px-2 py-1 bg-slate-900 border border-slate-800 text-slate-200 outline-none"
                    >
                      <option value="">Sin horario</option>
                      {scheduleCodes.map(c => (
                        <option key={c} value={c}>
                          {c} — {horarios[c].nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
