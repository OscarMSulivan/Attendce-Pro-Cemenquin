/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Search,
  CheckSquare,
  Square,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { Employee, ScheduleConfig } from '../types/attendance';
import { formatScheduleHoursSummary } from '../utils/calendarUtils';

interface AssignScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  horarios: Record<string, ScheduleConfig>;
  onAssignIndividual: (employeeId: string, scheduleCode: string) => void;
  onAssignBulk: (employeeIds: string[], scheduleCode: string) => void;
  onSwitchToCreate?: () => void;
}

export const AssignScheduleModal: React.FC<AssignScheduleModalProps> = ({
  isOpen,
  onClose,
  employees,
  horarios,
  onAssignIndividual,
  onAssignBulk,
  onSwitchToCreate,
}) => {
  const [search, setSearch] = useState<string>('');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('');
  const [filterHorario, setFilterHorario] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSchedule, setBulkSchedule] = useState<string>(() => Object.keys(horarios)[0] || 'ADMO');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const supervisors = useMemo(() => {
    return [...new Set(employees.map(e => e.jefe).filter(Boolean))].sort();
  }, [employees]);

  const scheduleCodes = useMemo(() => {
    return Object.keys(horarios).sort();
  }, [horarios]);

  const unassignedCount = useMemo(() => {
    return employees.filter(e => !e.horario || !horarios[e.horario]).length;
  }, [employees, horarios]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qNum = parseInt(q, 10);
    const qNumStr = !isNaN(qNum) ? qNum.toString() : '';
    return employees
      .filter(e => {
        const matchQuery =
          !q ||
          e.nombre.toLowerCase().includes(q) ||
          e.id.includes(q) ||
          (Boolean(qNumStr) && e.id.includes(qNumStr)) ||
          (e.puesto && e.puesto.toLowerCase().includes(q));
        const matchSup = !filterSupervisor || e.jefe === filterSupervisor;
        const matchHor =
          !filterHorario ||
          (filterHorario === '__NINGUNO__'
            ? !e.horario || !horarios[e.horario]
            : e.horario === filterHorario);
        return matchQuery && matchSup && matchHor;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [employees, search, filterSupervisor, filterHorario, horarios]);

  if (!isOpen) return null;

  const activeTargetSchedule =
    bulkSchedule && (horarios[bulkSchedule] || bulkSchedule === '__NINGUNO__')
      ? bulkSchedule
      : scheduleCodes[0] || '';

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allVisibleSelected =
      filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id));

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

  const handleApplyBulkToSelected = () => {
    if (!activeTargetSchedule || selectedIds.size === 0) return;
    const finalCode = activeTargetSchedule === '__NINGUNO__' ? '' : activeTargetSchedule;
    onAssignBulk(Array.from(selectedIds), finalCode);
    setFeedbackMsg(
      `✓ Se asignó "${finalCode || 'ADMO (Por defecto)'}" a ${selectedIds.size} colaborador(es) seleccionado(s).`
    );
    setSelectedIds(new Set());
  };

  const handleApplyToAllVisible = () => {
    if (!activeTargetSchedule || filteredEmployees.length === 0) return;
    const finalCode = activeTargetSchedule === '__NINGUNO__' ? '' : activeTargetSchedule;
    const ids = filteredEmployees.map(e => e.id);
    onAssignBulk(ids, finalCode);
    setFeedbackMsg(
      `✓ Se asignó "${finalCode || 'ADMO (Por defecto)'}" a los ${ids.length} colaboradores de la lista actual${
        filterSupervisor ? ` (${filterSupervisor})` : ''
      }.`
    );
    setSelectedIds(new Set());
  };

  const isAllVisibleSelected =
    filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id));

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[92vh] my-auto flex flex-col shadow-2xl animate-scale-in text-slate-100">
        {/* Header alineado al diseño del Dashboard */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Asignación de Horarios a Colaboradores
              </h3>
              <p className="text-xs text-[#87888C]">
                Filtra por lista o empleado y selecciona su horario directamente en su fila o de forma grupal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToCreate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToCreate();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#FEB95A] border border-[#FEB95A]/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Catálogo de Horarios</span>
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

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/40 text-[#A9DFD8] text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {feedbackMsg}
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

          {/* Barra de Filtros con Dropdown List para Supervisor / Lista, Horario y Búsqueda */}
          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Dropdown List: Filtrar por Lista / Supervisor */}
            <div>
              <label className="text-[11px] font-semibold text-[#87888C] flex items-center gap-1.5 mb-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#20AEF3]" />
                Filtrar por Lista / Supervisor
              </label>
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="w-full text-xs rounded-xl px-3 py-2 bg-[#21222D] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] transition-colors cursor-pointer"
              >
                <option value="">Todas las listas ({employees.length} colab.)</option>
                {supervisors.map(sup => {
                  const count = employees.filter(e => e.jefe === sup).length;
                  return (
                    <option key={sup} value={sup}>
                      {sup} ({count} colab.)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Dropdown List: Filtrar por Horario Asignado */}
            <div>
              <label className="text-[11px] font-semibold text-[#87888C] flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FEB95A]" />
                Filtrar por Horario Actual
              </label>
              <select
                value={filterHorario}
                onChange={(e) => setFilterHorario(e.target.value)}
                className="w-full text-xs rounded-xl px-3 py-2 bg-[#21222D] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] transition-colors cursor-pointer"
              >
                <option value="">Todos los horarios</option>
                <option value="__NINGUNO__">
                  Sin horario específico ({unassignedCount})
                </option>
                {scheduleCodes.map(c => (
                  <option key={c} value={c}>
                    {c} — {horarios[c].nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Búsqueda Rápida por Empleado */}
            <div>
              <label className="text-[11px] font-semibold text-[#87888C] flex items-center gap-1.5 mb-1.5">
                <Search className="w-3.5 h-3.5 text-[#F2C8ED]" />
                Buscar Colaborador
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, #ID (00615) o puesto..."
                  className="w-full text-xs rounded-xl pl-8 pr-7 py-2 bg-[#21222D] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] font-mono transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#87888C] hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Barra Compacta de Selección y Asignación Masiva en 1 línea */}
          <div className="p-3 rounded-xl bg-[#171821] border border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="flex items-center gap-2 text-xs font-bold text-[#E8E8EA] hover:text-white cursor-pointer"
              >
                {isAllVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 text-[#A9DFD8]" />
                ) : (
                  <Square className="w-4 h-4 text-[#87888C]" />
                )}
                <span>Seleccionar visibles ({filteredEmployees.length})</span>
              </button>
              {selectedIds.size > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30 font-mono text-[11px] font-bold">
                  {selectedIds.size} marcado(s)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#87888C]">
                <Sparkles className="w-3.5 h-3.5 text-[#FEB95A] shrink-0" />
                <span className="whitespace-nowrap">Asignación grupal:</span>
              </div>
              <select
                value={activeTargetSchedule}
                onChange={(e) => setBulkSchedule(e.target.value)}
                className="text-xs rounded-xl px-2.5 py-1.5 bg-[#21222D] border border-white/[0.08] text-white font-semibold outline-none focus:border-[#A9DFD8] cursor-pointer max-w-xs"
              >
                {scheduleCodes.map(c => (
                  <option key={c} value={c}>
                    {c} — {horarios[c].nombre} ({formatScheduleHoursSummary(horarios[c])})
                  </option>
                ))}
                <option value="__NINGUNO__">ADMO (Horario por defecto)</option>
              </select>

              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={handleApplyBulkToSelected}
                  className="px-3.5 py-1.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] font-extrabold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  Aplicar a {selectedIds.size} seleccionado(s)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyToAllVisible}
                  disabled={filteredEmployees.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-[#20AEF3] hover:bg-[#1b9bd9] text-[#171821] font-extrabold text-xs shadow-sm transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {filterSupervisor
                    ? `Aplicar a lista ${filterSupervisor} (${filteredEmployees.length})`
                    : `Aplicar a los ${filteredEmployees.length} visibles`}
                </button>
              )}
            </div>
          </div>

          {/* Lista de Empleados con su Horario y Horas directamente en cada fila */}
          <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
            {filteredEmployees.length === 0 ? (
              <div className="text-xs text-[#87888C] text-center py-10 rounded-xl bg-[#171821] border border-white/[0.04]">
                No hay colaboradores que coincidan con los filtros seleccionados.
              </div>
            ) : (
              filteredEmployees.map(emp => {
                const isChecked = selectedIds.has(emp.id);
                const empSchCode = emp.horario && horarios[emp.horario] ? emp.horario : '';
                const empSchCfg = empSchCode ? horarios[empSchCode] : horarios['ADMO'];
                const hoursText = empSchCfg ? formatScheduleHoursSummary(empSchCfg) : 'Lun-Vie 08:00-17:30';

                return (
                  <div
                    key={emp.id}
                    className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                      isChecked
                        ? 'bg-[#A9DFD8]/10 border-[#A9DFD8]/40'
                        : 'bg-[#171821] border-white/[0.05] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(emp.id)}
                        className="w-4 h-4 rounded border-white/20 bg-[#21222D] text-[#A9DFD8] cursor-pointer shrink-0"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30">
                            #{emp.id}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {emp.nombre}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                              empSchCode
                                ? 'bg-[#A9DFD8]/12 text-[#A9DFD8] border-[#A9DFD8]/35'
                                : 'bg-[#FEB95A]/12 text-[#FEB95A] border-[#FEB95A]/35'
                            }`}
                          >
                            {empSchCode || 'ADMO'}: {hoursText}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#87888C] truncate mt-1">
                          Lista / Supervisor: <strong className="text-[#E8E8EA]">{emp.jefe}</strong>
                          {emp.puesto ? ` · ${emp.puesto}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0 w-full md:w-auto">
                      <select
                        value={emp.horario || ''}
                        onChange={(e) => {
                          onAssignIndividual(emp.id, e.target.value);
                          const chosenCode = e.target.value || 'ADMO';
                          const chosenCfg = horarios[chosenCode];
                          setFeedbackMsg(
                            `✓ Horario "${chosenCode}${chosenCfg ? ` (${formatScheduleHoursSummary(chosenCfg)})` : ''}" asignado a #${emp.id} — ${emp.nombre}.`
                          );
                        }}
                        className="w-full md:w-64 text-xs rounded-xl px-3 py-2 bg-[#21222D] border border-white/[0.08] text-white font-semibold outline-none focus:border-[#A9DFD8] cursor-pointer transition-colors"
                      >
                        <option value="">
                          ADMO (Por defecto · {horarios['ADMO'] ? formatScheduleHoursSummary(horarios['ADMO']) : '08:00-17:30'})
                        </option>
                        {scheduleCodes.map(c => (
                          <option key={c} value={c}>
                            {c} — {horarios[c].nombre} ({formatScheduleHoursSummary(horarios[c])})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] flex items-center justify-between bg-[#171821]/80 rounded-b-2xl">
          <span className="text-xs text-[#87888C]">
            Mostrando <strong className="text-white">{filteredEmployees.length}</strong> de{' '}
            <strong className="text-white">{employees.length}</strong> colaboradores
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] transition-all cursor-pointer"
          >
            Listo ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
