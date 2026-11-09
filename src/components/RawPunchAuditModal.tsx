/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { Employee, EventsDB, RawPunchItem } from '../types/attendance';
import { NOMBRES_DIAS_CORTO } from '../utils/calendarUtils';
import { timeToMinutes } from '../core/eventsHierarchy';
import { HeadlessModal } from './ui/HeadlessModal';

interface RawPunchAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  eventosDB: EventsDB;
}

export const RawPunchAuditModal: React.FC<RawPunchAuditModalProps> = ({
  isOpen,
  onClose,
  employees,
  eventosDB,
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchEmp, setSearchEmp] = useState<string>('');

  // Empleados que tienen al menos un evento en la base de datos
  const employeesWithEvents = useMemo(() => {
    const ids = Object.keys(eventosDB).filter(id => Object.keys(eventosDB[id] || {}).length > 0);
    const empMap = new Map(employees.map(e => [e.id, e]));

    return ids.map(id => {
      const emp = empMap.get(id);
      return {
        id,
        nombre: emp ? emp.nombre : `Empleado #${id}`,
        jefe: emp ? emp.jefe : ''
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [employees, eventosDB]);

  const filteredList = useMemo(() => {
    const q = searchEmp.toLowerCase().trim();
    if (!q) return employeesWithEvents;
    return employeesWithEvents.filter(e => e.nombre.toLowerCase().includes(q) || e.id.includes(q));
  }, [employeesWithEvents, searchEmp]);

  // Si no hay seleccionado y hay opciones, seleccionar el primero
  React.useEffect(() => {
    if (!selectedId && employeesWithEvents.length > 0) {
      setSelectedId(employeesWithEvents[0].id);
    }
  }, [employeesWithEvents, selectedId]);

  const currentEvents = selectedId && eventosDB[selectedId] ? eventosDB[selectedId] : null;
  const sortedDates = currentEvents ? Object.keys(currentEvents).sort() : [];

  return (
    <HeadlessModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-blue-500/15 border border-sky-200 dark:border-blue-500/30 flex items-center justify-center text-sky-600 dark:text-blue-400 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Auditoría de Checadas Crudas
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              Inspecciona todas las marcas registradas por el dispositivo biométrico (incluyendo mezcla de eventos y RST)
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Muestra TODAS las checadas físicas del empleado en orden cronológico sin ocultar ninguna aunque exista un evento{' '}
          <strong className="text-slate-900 dark:text-slate-200 font-bold">RST</strong>.
        </p>

        {/* Selector de empleado y búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
          >
            <option value="">Selecciona un empleado...</option>
            {filteredList.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre} (#{emp.id})
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="Filtrar por nombre o ID (ej. 979, 1091)..."
              className="w-full text-xs rounded-xl pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Detalle de checadas por fecha */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {!currentEvents || sortedDates.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">
              Este colaborador no cuenta con eventos registrados en el archivo biométrico.
            </p>
          ) : (
            sortedDates.map(fecha => {
              const dia = currentEvents[fecha];
              const [y, m, d] = fecha.split('-').map(Number);
              const dayOfWeek = new Date(y, m - 1, d, 12, 0, 0).getDay();
              const dayName = NOMBRES_DIAS_CORTO[dayOfWeek];

              // Unificar absolutamente todos los eventos crudos del día (sin que isRST oculte entradas/salidas)
              let eventosDelDia: RawPunchItem[] = [];
              if (dia.registrosCrudos && dia.registrosCrudos.length > 0) {
                eventosDelDia = dia.registrosCrudos.slice();
              } else {
                Object.keys(dia.entradas || {}).forEach(cod => {
                  dia.entradas[cod].forEach(h => eventosDelDia.push({ hora: h, codigo: cod }));
                });
                Object.keys(dia.salidas || {}).forEach(cod => {
                  dia.salidas[cod].forEach(h => eventosDelDia.push({ hora: h, codigo: cod }));
                });
                (dia.rstHoras || []).forEach(h => eventosDelDia.push({ hora: h, codigo: 'RST' }));
                if (eventosDelDia.length === 0 && dia.todas) {
                  dia.todas.forEach(h => eventosDelDia.push({ hora: h, codigo: dia.isRST ? 'RST' : 'CHE' }));
                }
              }
              eventosDelDia.sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));

              const conteoPorCodigo: Record<string, number> = {};
              eventosDelDia.forEach(ev => {
                conteoPorCodigo[ev.codigo] = (conteoPorCodigo[ev.codigo] || 0) + 1;
              });
              const hayRepetidos = Object.values(conteoPorCodigo).some(n => n > 1);

              return (
                <div
                  key={fecha}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                        {fecha}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {dayName}
                      </span>
                      {hayRepetidos && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-yellow-500/10 text-amber-700 dark:text-yellow-400 border border-amber-300 dark:border-yellow-500/30">
                          <AlertTriangle className="w-3 h-3" /> Checadas múltiples
                        </span>
                      )}
                      {dia.isRST && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-blue-500/15 text-sky-800 dark:text-blue-300 border border-sky-200 dark:border-blue-500/30">
                          Contiene RST
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      Entrada final: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{dia.entradaFinal || '--:--'}</strong> ·{' '}
                      Salida final: <strong className="text-amber-700 dark:text-amber-400 font-bold">{dia.salidaFinal || '--:--'}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {eventosDelDia.map((ev, idx) => {
                      const esEntradaFinal = ev.hora === dia.entradaFinal;
                      const esSalidaFinal = ev.hora === dia.salidaFinal;
                      const esUsada = esEntradaFinal || esSalidaFinal;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono border ${
                            esUsada
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                              : 'bg-white dark:bg-[#21222D] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold">{ev.hora}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-sans font-bold uppercase ${
                              ev.codigo === 'RST'
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-transparent'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                            }`}
                          >
                            {ev.codigo}
                          </span>
                          {esEntradaFinal && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 font-sans font-bold">
                              <CheckCircle className="w-3 h-3" /> Entrada
                            </span>
                          )}
                          {esSalidaFinal && !esEntradaFinal && (
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-0.5 font-sans font-bold">
                              <CheckCircle className="w-3 h-3" /> Salida
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </HeadlessModal>
  );
};
