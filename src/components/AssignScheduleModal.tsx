/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
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
import { HeadlessModal } from './ui/HeadlessModal';
import { HeadlessSelect, SelectOption } from './ui/HeadlessSelect';

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

  // Opciones para HeadlessSelect de supervisor
  const supervisorOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: '',
        label: `Todas las listas`,
        badge: `${employees.length} colab.`
      },
      ...supervisors.map(sup => {
        const count = employees.filter(e => e.jefe === sup).length;
        return {
          value: sup,
          label: sup,
          badge: `${count} colab.`
        };
      })
    ];
  }, [supervisors, employees]);

  // Opciones para HeadlessSelect de horario
  const horarioOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: '',
        label: 'Todos los horarios'
      },
      {
        value: '__NINGUNO__',
        label: 'Sin horario específico',
        badge: String(unassignedCount)
      },
      ...scheduleCodes.map(c => ({
        value: c,
        label: `${c} — ${horarios[c].nombre}`,
        sublabel: formatScheduleHoursSummary(horarios[c])
      }))
    ];
  }, [scheduleCodes, horarios, unassignedCount]);

  // Opciones para asignación masiva
  const bulkOptions: SelectOption[] = useMemo(() => {
    return [
      ...scheduleCodes.map(c => ({
        value: c,
        label: `${c} — ${horarios[c].nombre}`,
        sublabel: formatScheduleHoursSummary(horarios[c])
      })),
      {
        value: '__NINGUNO__',
        label: 'ADMO (Horario por defecto)'
      }
    ];
  }, [scheduleCodes, horarios]);

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

  return (
    <HeadlessModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/35 dark:border-[#A9DFD8]/35 flex items-center justify-center text-teal-600 dark:text-[#A9DFD8] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Asignación de Horarios a Colaboradores
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#87888C]">
              Filtra por lista o empleado y selecciona su horario directamente en su fila o de forma grupal
            </p>
          </div>
        </div>
      }
      subtitle={
        onSwitchToCreate ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToCreate();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-amber-700 dark:text-[#FEB95A] border border-amber-300 dark:border-[#FEB95A]/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Catálogo de Horarios</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {feedbackMsg && (
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/40 text-teal-800 dark:text-[#A9DFD8] text-xs font-semibold flex items-center justify-between">
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

        {/* Barra de Filtros con Dropdown List accesible (Headless UI) */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Dropdown: Supervisor / Lista */}
          <div>
            <HeadlessSelect
              label="Filtrar por Lista / Supervisor"
              icon={<UserCheck className="w-3.5 h-3.5 text-sky-500 dark:text-[#20AEF3]" />}
              value={filterSupervisor}
              onChange={setFilterSupervisor}
              options={supervisorOptions}
              searchable={supervisors.length > 5}
              placeholder="Todas las listas"
            />
          </div>

          {/* 2. Dropdown: Horario Actual */}
          <div>
            <HeadlessSelect
              label="Filtrar por Horario Actual"
              icon={<Clock className="w-3.5 h-3.5 text-amber-500 dark:text-[#FEB95A]" />}
              value={filterHorario}
              onChange={setFilterHorario}
              options={horarioOptions}
              searchable={scheduleCodes.length > 4}
              placeholder="Todos los horarios"
            />
          </div>

          {/* 3. Búsqueda Rápida */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-[#87888C] flex items-center gap-1.5 mb-1.5">
              <Search className="w-3.5 h-3.5 text-purple-500 dark:text-[#F2C8ED]" />
              Buscar Colaborador
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, #ID o puesto..."
                className="w-full text-xs rounded-xl pl-8 pr-7 py-2 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#87888C] outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] transition-colors"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#87888C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-[#87888C] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barra Compacta de Asignación Masiva */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-[#E8E8EA] hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {isAllVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-teal-600 dark:text-[#A9DFD8]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 dark:text-[#87888C]" />
              )}
              <span>Seleccionar visibles ({filteredEmployees.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/30 font-mono text-[11px] font-bold">
                {selectedIds.size} marcado(s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#87888C]">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-[#FEB95A] shrink-0" />
              <span className="whitespace-nowrap">Asignación grupal:</span>
            </div>

            <div className="w-64">
              <HeadlessSelect
                value={activeTargetSchedule}
                onChange={setBulkSchedule}
                options={bulkOptions}
                searchable={bulkOptions.length > 5}
              />
            </div>

            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleApplyBulkToSelected}
                className="px-3.5 py-2 rounded-xl bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] font-extrabold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                Aplicar a {selectedIds.size}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyToAllVisible}
                disabled={filteredEmployees.length === 0}
                className="px-3.5 py-2 rounded-xl bg-sky-500 dark:bg-[#20AEF3] hover:bg-sky-600 dark:hover:bg-[#1b9bd9] text-white dark:text-[#171821] font-extrabold text-xs shadow-sm transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {filterSupervisor
                  ? `Aplicar a ${filteredEmployees.length}`
                  : `Aplicar a ${filteredEmployees.length} visibles`}
              </button>
            )}
          </div>
        </div>

        {/* Lista de Empleados con su Horario y Horas */}
        <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
          {filteredEmployees.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-[#87888C] text-center py-10 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.04]">
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
                      ? 'bg-teal-500/10 dark:bg-[#A9DFD8]/10 border-teal-500/40 dark:border-[#A9DFD8]/40'
                      : 'bg-white dark:bg-[#171821] border-slate-200 dark:border-white/[0.05] hover:border-slate-300 dark:hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectOne(emp.id)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-[#21222D] text-teal-600 dark:text-[#A9DFD8] cursor-pointer shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] border border-sky-200 dark:border-[#20AEF3]/30">
                          #{emp.id}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {emp.nombre}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            empSchCode
                              ? 'bg-teal-50 dark:bg-[#A9DFD8]/12 text-teal-700 dark:text-[#A9DFD8] border-teal-200 dark:border-[#A9DFD8]/35'
                              : 'bg-amber-50 dark:bg-[#FEB95A]/12 text-amber-700 dark:text-[#FEB95A] border-amber-200 dark:border-[#FEB95A]/35'
                          }`}
                        >
                          {empSchCode || 'ADMO'}: {hoursText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#87888C] truncate mt-1">
                        Lista / Supervisor: <strong className="text-slate-700 dark:text-[#E8E8EA]">{emp.jefe}</strong>
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
                      className="w-full md:w-64 text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white font-semibold outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] cursor-pointer transition-colors"
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

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-[#87888C]">
            Mostrando <strong className="text-slate-800 dark:text-white">{filteredEmployees.length}</strong> de{' '}
            <strong className="text-slate-800 dark:text-white">{employees.length}</strong> colaboradores
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] transition-all cursor-pointer shadow-sm"
          >
            Listo ✓
          </button>
        </div>
      </div>
    </HeadlessModal>
  );
};
