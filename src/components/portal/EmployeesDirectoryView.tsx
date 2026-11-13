/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  Building2,
  ListChecks,
  Clock,
  Upload,
  UserPlus,
  Download,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  ShieldCheck,
  Sparkles,
  FolderKanban,
  ArrowRightLeft,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react';
import { Employee, ScheduleConfig } from '../../types/attendance';
import { PortalUser } from '../../types/portal';
import { normalizeEmployeeId, normalizeSupervisorName } from '../../utils/calendarUtils';

interface EmployeesDirectoryViewProps {
  empleadosDB: Record<string, Employee>;
  horarios: Record<string, ScheduleConfig>;
  portalUsers: PortalUser[];
  isLoadingEmployees: boolean;
  onLoadEmployeesFile: (file: File, empresaTag?: string) => void;
  onUpsertEmployee: (emp: Employee) => void;
  onBulkUpdateEmployees: (
    empIds: string[],
    patch: { jefe?: string; empresa?: string; horario?: string; listaPersonalizada?: boolean }
  ) => void;
  onDeleteEmployee: (empId: string) => void;
  onRenameSupervisorList: (oldListName: string, newListName: string) => void;
}

export const EmployeesDirectoryView: React.FC<EmployeesDirectoryViewProps> = ({
  empleadosDB,
  horarios,
  portalUsers,
  isLoadingEmployees,
  onLoadEmployeesFile,
  onUpsertEmployee,
  onBulkUpdateEmployees,
  onDeleteEmployee,
  onRenameSupervisorList,
}) => {
  const [viewMode, setViewMode] = useState<'by_employee' | 'by_list'>('by_employee');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterList, setFilterList] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterSchedule, setFilterSchedule] = useState<string>('');
  const [empresaUploadTag, setEmpresaUploadTag] = useState<string>('');

  // Selección múltiple para cambios en bloque
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetList, setBulkTargetList] = useState<string>('');
  const [bulkCustomList, setBulkCustomList] = useState<string>('');
  const [bulkTargetCompany, setBulkTargetCompany] = useState<string>('');
  const [bulkTargetSchedule, setBulkTargetSchedule] = useState<string>('');

  // Modal de Alta / Edición Manual de Empleado
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<{
    id: string;
    nombre: string;
    jefe: string;
    customJefe: string;
    empresa: string;
    horario: string;
    puesto: string;
    isEdit: boolean;
  }>({
    id: '',
    nombre: '',
    jefe: '',
    customJefe: '',
    empresa: '',
    horario: 'ADMO',
    puesto: '',
    isEdit: false,
  });

  // Modal para renombrar una lista completa
  const [renamingList, setRenamingList] = useState<{ oldName: string; newName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allEmployees = useMemo(() => {
    return Object.values(empleadosDB).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [empleadosDB]);

  const allLists = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach(e => {
      if (e.jefe && e.jefe.trim()) set.add(e.jefe.trim().toUpperCase());
    });
    portalUsers.forEach(u => {
      if (u.supervisorName && u.supervisorName.trim()) {
        set.add(u.supervisorName.trim().toUpperCase());
      }
      (u.assignedLists || []).forEach(l => {
        if (l && l.trim()) set.add(l.trim().toUpperCase());
      });
    });
    return Array.from(set).sort();
  }, [allEmployees, portalUsers]);

  const allCompanies = useMemo(() => {
    const map = new Map<string, number>();
    allEmployees.forEach(e => {
      const comp = (e.empresa || 'SIN ESPECIFICAR').trim().toUpperCase();
      map.set(comp, (map.get(comp) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allEmployees]);

  const scheduleCodes = useMemo(() => Object.keys(horarios).sort(), [horarios]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEmployees.filter(emp => {
      const empList = (emp.jefe || '').trim().toUpperCase();
      const empComp = (emp.empresa || 'SIN ESPECIFICAR').trim().toUpperCase();
      const empHor = (emp.horario || '').trim().toUpperCase();

      if (filterList && empList !== filterList) return false;
      if (filterCompany && empComp !== filterCompany) return false;
      if (filterSchedule) {
        if (filterSchedule === '__SIN_HORARIO__' && empHor && horarios[empHor]) return false;
        if (filterSchedule !== '__SIN_HORARIO__' && empHor !== filterSchedule) return false;
      }

      if (!q) return true;
      return (
        emp.id.toLowerCase().includes(q) ||
        emp.nombre.toLowerCase().includes(q) ||
        empList.toLowerCase().includes(q) ||
        empComp.toLowerCase().includes(q) ||
        empHor.toLowerCase().includes(q)
      );
    });
  }, [allEmployees, searchQuery, filterList, filterCompany, filterSchedule, horarios]);

  const employeesByList = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    allLists.forEach(l => {
      groups[l] = [];
    });
    filteredEmployees.forEach(emp => {
      const listName = (emp.jefe || 'GENERAL').trim().toUpperCase();
      if (!groups[listName]) groups[listName] = [];
      groups[listName].push(emp);
    });
    return Object.entries(groups)
      .filter(([listName, items]) => items.length > 0 || (!searchQuery && !filterCompany && !filterList) || listName === filterList)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [allLists, filteredEmployees, searchQuery, filterCompany, filterList]);

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allSelected =
      filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredEmployees.forEach(e => next.delete(e.id));
      } else {
        filteredEmployees.forEach(e => next.add(e.id));
      }
      return next;
    });
  };

  const handleOpenNewModal = () => {
    setEditingEmp({
      id: '',
      nombre: '',
      jefe: allLists[0] || 'GENERAL',
      customJefe: '',
      empresa: allCompanies[0]?.[0] !== 'SIN ESPECIFICAR' ? allCompanies[0]?.[0] || '' : '',
      horario: scheduleCodes[0] || 'ADMO',
      puesto: '',
      isEdit: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmp({
      id: emp.id,
      nombre: emp.nombre,
      jefe: emp.jefe || 'GENERAL',
      customJefe: '',
      empresa: emp.empresa || '',
      horario: emp.horario || 'ADMO',
      puesto: emp.puesto || '',
      isEdit: true,
    });
    setIsModalOpen(true);
  };

  const handleSaveModalEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = normalizeEmployeeId(editingEmp.id);
    const cleanName = editingEmp.nombre.trim().toUpperCase();
    const resolvedJefe = normalizeSupervisorName(
      editingEmp.jefe === '__NUEVA__' ? editingEmp.customJefe : editingEmp.jefe
    );
    if (!cleanId || !cleanName || !resolvedJefe) {
      alert('Por favor completa el ID, Nombre y Lista (Supervisor) del colaborador.');
      return;
    }
    onUpsertEmployee({
      ...(empleadosDB[cleanId] || {}),
      id: cleanId,
      nombre: cleanName,
      jefe: resolvedJefe,
      empresa: editingEmp.empresa.trim().toUpperCase() || undefined,
      horario: editingEmp.horario || 'ADMO',
      puesto: editingEmp.puesto.trim() || undefined,
      listaPersonalizada: true,
      actualizadoEn: new Date().toISOString(),
    });
    setIsModalOpen(false);
  };

  const handleApplyBulkList = () => {
    if (selectedIds.size === 0) return;
    const target = normalizeSupervisorName(
      bulkTargetList === '__NUEVA__' ? bulkCustomList : bulkTargetList
    );
    if (!target) {
      alert('Selecciona o escribe el nombre de la lista destino.');
      return;
    }
    onBulkUpdateEmployees(Array.from(selectedIds), {
      jefe: target,
      listaPersonalizada: true,
    });
    setSelectedIds(new Set());
    setBulkCustomList('');
  };

  const handleApplyBulkCompany = () => {
    if (selectedIds.size === 0 || !bulkTargetCompany.trim()) return;
    onBulkUpdateEmployees(Array.from(selectedIds), {
      empresa: bulkTargetCompany.trim().toUpperCase(),
    });
    setSelectedIds(new Set());
    setBulkTargetCompany('');
  };

  const handleApplyBulkSchedule = () => {
    if (selectedIds.size === 0 || !bulkTargetSchedule) return;
    onBulkUpdateEmployees(Array.from(selectedIds), {
      horario: bulkTargetSchedule,
    });
    setSelectedIds(new Set());
  };

  const handleExportDirectoryExcel = () => {
    const rows = allEmployees.map(emp => ({
      Codigo_ID: emp.id,
      Nombre_Colaborador: emp.nombre,
      Lista_Asignada_Supervisor: emp.jefe || 'GENERAL',
      Empresa_Origen: emp.empresa || 'SIN ESPECIFICAR',
      Horario_Turno: emp.horario || 'ADMO',
      Lista_Blindada_Manual: emp.listaPersonalizada ? 'SÍ' : 'NO',
      Archivo_Origen: emp.origenArchivo || 'Registro en Sistema',
      Ultima_Actualizacion: emp.actualizadoEn
        ? new Date(emp.actualizadoEn).toLocaleString('es-MX')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Padron_y_Listas');
    XLSX.writeFile(
      wb,
      `Padron_Empleados_y_Listas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const isAllVisibleSelected =
    filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id));

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER DARK STUDIO (.ground-inverse) */}
      <div className="ground-inverse rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#0B0F17] via-[#111827] to-[#0D131F] border border-slate-800/80 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.35)] relative overflow-hidden text-white">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#A9DFD8]/15 blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#20AEF3]/15 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30 font-bold text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Almacenamiento Permanente Multi-Empresa Activo
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-xs font-mono text-slate-300">
                {allEmployees.length} colaboradores registrados
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Padrón de Empleados y Asignación de Listas
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/85 leading-relaxed">
              Los colaboradores se almacenan de forma <strong>independiente y acumulativa</strong>. Cuando subes bases de datos de <strong>dos o más empresas diferentes</strong>, el sistema fusiona y conserva a todos los empleados sin borrar la información previa ni perder sus listas o turnos asignados.
            </p>
          </div>

          {/* Acciones principales */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) {
                  onLoadEmployeesFile(e.target.files[0], empresaUploadTag.trim() || undefined);
                  e.target.value = '';
                }
              }}
            />

            <div className="flex items-center bg-white/[0.06] border border-white/15 rounded-xl p-1 gap-1.5">
              <input
                type="text"
                value={empresaUploadTag}
                onChange={e => setEmpresaUploadTag(e.target.value)}
                placeholder="Etiqueta Empresa (opcional)"
                className="px-2.5 py-1.5 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-44 font-medium"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingEmployees}
                className="px-3.5 py-2 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#0B0F17] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isLoadingEmployees ? 'Importando...' : 'Fusionar Base Excel'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-4 py-2.5 rounded-xl bg-[#20AEF3] hover:bg-[#1a9ad9] text-[#0B0F17] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Empleado</span>
            </button>

            <button
              type="button"
              onClick={handleExportDirectoryExcel}
              disabled={allEmployees.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white border border-white/15 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-[#A9DFD8]" />
              <span>Exportar Padrón</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS KPI DE RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block">
              Total Empleados Guardados
            </span>
            <span className="text-xl font-extrabold text-white font-mono tabular-nums">
              {allEmployees.length}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block">
              Listas de Supervisor Activas
            </span>
            <span className="text-xl font-extrabold text-white font-mono tabular-nums">
              {allLists.length}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block">
              Empresas / Bases Registradas
            </span>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              {allCompanies.length === 0 ? (
                <span className="text-xs text-[#87888C]">Sin registros</span>
              ) : (
                allCompanies.slice(0, 3).map(([comp, cnt]) => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setFilterCompany(filterCompany === comp ? '' : comp)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                      filterCompany === comp
                        ? 'bg-[#FEB95A] text-[#171821] border-[#FEB95A]'
                        : 'bg-[#171821] text-[#FEB95A] border-[#FEB95A]/30'
                    }`}
                  >
                    {comp}: {cnt}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#87888C] block">
              Con Horario Configurado
            </span>
            <span className="text-xl font-extrabold text-white font-mono tabular-nums">
              {allEmployees.filter(e => e.horario && horarios[e.horario]).length}{' '}
              <span className="text-xs font-normal text-[#87888C]">/ {allEmployees.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS Y SELECTOR DE VISTA */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Selector de Modo de Vista */}
          <div className="inline-flex p-1 rounded-xl bg-[#171821] border border-white/[0.07] self-start">
            <button
              type="button"
              onClick={() => setViewMode('by_employee')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'by_employee'
                  ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                  : 'text-[#87888C] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Por Empleado ({filteredEmployees.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_list')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'by_list'
                  ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                  : 'text-[#87888C] hover:text-white'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Por Lista de Supervisor ({allLists.length})</span>
            </button>
          </div>

          {/* Buscador y Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1 max-w-4xl">
            <div className="relative">
              <Search className="w-4 h-4 text-[#87888C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar ID, nombre, lista o empresa..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#171821] border border-white/[0.08] text-xs text-white placeholder-[#87888C] focus:outline-none focus:border-[#A9DFD8]"
              />
            </div>

            <select
              value={filterList}
              onChange={e => setFilterList(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#A9DFD8]"
            >
              <option value="">Todas las Listas ({allLists.length})</option>
              {allLists.map(listName => (
                <option key={listName} value={listName}>
                  Lista: {listName}
                </option>
              ))}
            </select>

            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#A9DFD8]"
            >
              <option value="">Todas las Empresas ({allCompanies.length})</option>
              {allCompanies.map(([comp, cnt]) => (
                <option key={comp} value={comp}>
                  {comp} ({cnt} colab.)
                </option>
              ))}
            </select>

            <select
              value={filterSchedule}
              onChange={e => setFilterSchedule(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#171821] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#A9DFD8]"
            >
              <option value="">Todos los Horarios</option>
              <option value="__SIN_HORARIO__">Sin horario asignado</option>
              {scheduleCodes.map(code => (
                <option key={code} value={code}>
                  {code} — {horarios[code]?.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BARRA DE ACCIÓN MASIVA CUANDO HAY EMPLEADOS SELECCIONADOS */}
        {selectedIds.size > 0 && (
          <div className="p-3.5 rounded-xl bg-[#171821] border border-[#A9DFD8]/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#A9DFD8]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{selectedIds.size} colaborador(es) seleccionado(s)</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-[#87888C] hover:text-white underline ml-2 cursor-pointer"
              >
                Limpiar selección
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Mover a Lista */}
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkTargetList}
                  onChange={e => setBulkTargetList(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/10 text-xs text-white"
                >
                  <option value="">Mover a Lista...</option>
                  {allLists.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  <option value="__NUEVA__">+ Crear Nueva Lista...</option>
                </select>
                {bulkTargetList === '__NUEVA__' && (
                  <input
                    type="text"
                    value={bulkCustomList}
                    onChange={e => setBulkCustomList(e.target.value)}
                    placeholder="Nombre de nueva lista"
                    className="px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/10 text-xs text-white w-40"
                  />
                )}
                <button
                  type="button"
                  onClick={handleApplyBulkList}
                  disabled={!bulkTargetList}
                  className="px-3 py-1.5 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                >
                  Asignar Lista
                </button>
              </div>

              {/* Asignar Empresa */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={bulkTargetCompany}
                  onChange={e => setBulkTargetCompany(e.target.value)}
                  placeholder="Empresa (ej. CEMENQUIN)"
                  className="px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/10 text-xs text-white w-40"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkCompany}
                  disabled={!bulkTargetCompany.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#FEB95A] hover:bg-[#f5a838] text-[#171821] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                >
                  Fijar Empresa
                </button>
              </div>

              {/* Asignar Horario */}
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkTargetSchedule}
                  onChange={e => setBulkTargetSchedule(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#21222D] border border-white/10 text-xs text-white"
                >
                  <option value="">Cambiar Horario...</option>
                  {scheduleCodes.map(c => (
                    <option key={c} value={c}>
                      {c} — {horarios[c]?.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyBulkSchedule}
                  disabled={!bulkTargetSchedule}
                  className="px-3 py-1.5 rounded-lg bg-[#20AEF3] hover:bg-[#1a9ad9] text-[#171821] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                >
                  Asignar Turno
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4A. VISTA 1: TABLA MAESTRA POR EMPLEADO */}
      {viewMode === 'by_employee' && (
        <div className="rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm overflow-hidden">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-[#87888C] mx-auto opacity-60" />
              <h3 className="text-sm font-extrabold text-white">
                No se encontraron colaboradores con los filtros seleccionados
              </h3>
              <p className="text-xs text-[#87888C] max-w-md mx-auto">
                Puedes importar las bases de datos de tus empresas con el botón superior &ldquo;Fusionar Base Excel&rdquo; o agregar colaboradores manualmente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#171821] border-b border-white/[0.07] text-[11px] font-extrabold uppercase tracking-wider text-[#87888C]">
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAllVisible}
                        className="text-[#87888C] hover:text-white cursor-pointer"
                      >
                        {isAllVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#A9DFD8]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Empresa / Origen</th>
                    <th className="py-3 px-4">Lista Asignada (Supervisor)</th>
                    <th className="py-3 px-4">Horario / Turno</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-xs">
                  {filteredEmployees.map(emp => {
                    const isSelected = selectedIds.has(emp.id);
                    const currentList = (emp.jefe || 'GENERAL').trim().toUpperCase();
                    const currentSchedule = emp.horario || 'ADMO';

                    return (
                      <tr
                        key={emp.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#A9DFD8]/[0.06]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(emp.id)}
                            className="text-[#87888C] hover:text-white cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#A9DFD8]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3 font-mono font-extrabold text-[#A9DFD8] tabular-nums">
                          #{emp.id}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{emp.nombre}</div>
                          {emp.origenArchivo && (
                            <div className="text-[10px] text-[#87888C] font-mono truncate max-w-[220px]">
                              Archivo: {emp.origenArchivo}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#171821] border border-white/[0.08] text-[11px] font-mono font-semibold text-[#FEB95A]">
                            <Building2 className="w-3 h-3" />
                            {emp.empresa || 'SIN ESPECIFICAR'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={currentList}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__NUEVA__') {
                                  const custom = prompt(
                                    `Escribe el nombre de la nueva lista para ${emp.nombre}:`,
                                    currentList
                                  );
                                  if (custom && custom.trim()) {
                                    onUpsertEmployee({
                                      ...emp,
                                      jefe: normalizeSupervisorName(custom),
                                      listaPersonalizada: true,
                                      actualizadoEn: new Date().toISOString(),
                                    });
                                  }
                                } else {
                                  onUpsertEmployee({
                                    ...emp,
                                    jefe: normalizeSupervisorName(val),
                                    listaPersonalizada: true,
                                    actualizadoEn: new Date().toISOString(),
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#171821] border border-white/[0.08] text-xs font-bold text-white focus:outline-none focus:border-[#A9DFD8] cursor-pointer"
                            >
                              {allLists.map(l => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                              {!allLists.includes(currentList) && (
                                <option value={currentList}>{currentList}</option>
                              )}
                              <option value="__NUEVA__">+ Nueva Lista...</option>
                            </select>

                            {emp.listaPersonalizada && (
                              <span
                                title="Lista fijada manualmente: se conserva aunque vuelvas a subir el archivo Excel"
                                className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold"
                              >
                                Fijada
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={currentSchedule}
                            onChange={e =>
                              onUpsertEmployee({
                                ...emp,
                                horario: e.target.value,
                                actualizadoEn: new Date().toISOString(),
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#171821] border border-white/[0.08] text-xs font-mono font-semibold text-white focus:outline-none focus:border-[#20AEF3] cursor-pointer"
                          >
                            {scheduleCodes.map(c => (
                              <option key={c} value={c}>
                                {c} — {horarios[c]?.nombre}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(emp)}
                              title="Editar empleado"
                              className="p-1.5 rounded-lg bg-[#171821] hover:bg-white/10 text-[#87888C] hover:text-white border border-white/[0.07] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `¿Eliminar permanentemente a #${emp.id} ${emp.nombre} del padrón de empleados?`
                                  )
                                ) {
                                  onDeleteEmployee(emp.id);
                                }
                              }}
                              title="Eliminar empleado"
                              className="p-1.5 rounded-lg bg-[#171821] hover:bg-rose-500/15 text-[#87888C] hover:text-rose-400 border border-white/[0.07] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4B. VISTA 2: AGRUPADO POR LISTA DE SUPERVISOR */}
      {viewMode === 'by_list' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {employeesByList.map(([listName, listEmps]) => {
            const linkedUsers = portalUsers.filter(u => {
              const sup = (u.supervisorName || '').trim().toUpperCase();
              const assigned = (u.assignedLists || []).map(x => x.trim().toUpperCase());
              return sup === listName || assigned.includes(listName);
            });
            const companiesInList = Array.from(
              new Set(listEmps.map(e => (e.empresa || 'SIN ESPECIFICAR').trim().toUpperCase()))
            );

            return (
              <div
                key={listName}
                className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.07] shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 text-[#A9DFD8] font-mono text-[10px] font-extrabold uppercase">
                          LISTA DE NÓMINA
                        </span>
                        {companiesInList.map(c => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-md bg-[#171821] border border-white/10 text-[#FEB95A] font-mono text-[10px] font-semibold"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-base font-extrabold text-white mt-1.5">{listName}</h3>
                      <p className="text-[11px] text-[#87888C]">
                        {linkedUsers.length > 0
                          ? `Supervisor asignado en portal: ${linkedUsers.map(u => u.name).join(', ')}`
                          : 'Sin usuario supervisor vinculado aún en Usuarios y Accesos'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-xl bg-[#171821] border border-white/10 font-mono text-xs font-extrabold text-white">
                        {listEmps.length} colab.
                      </span>
                      <button
                        type="button"
                        onClick={() => setRenamingList({ oldName: listName, newName: listName })}
                        title="Renombrar o unificar esta lista"
                        className="p-2 rounded-xl bg-[#171821] hover:bg-white/10 text-[#87888C] hover:text-white border border-white/[0.08] cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lista compacta de integrantes */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.05] pr-1">
                    {listEmps.map(emp => (
                      <div
                        key={emp.id}
                        className="py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#A9DFD8]">#{emp.id}</span>
                            <span className="font-semibold text-white truncate">{emp.nombre}</span>
                          </div>
                          <div className="text-[10px] text-[#87888C] font-mono">
                            Empresa: {emp.empresa || 'SIN ESPECIFICAR'} · Turno: {emp.horario || 'ADMO'}
                          </div>
                        </div>

                        <select
                          value={listName}
                          onChange={e => {
                            const nextList = e.target.value;
                            if (!nextList || nextList === listName) return;
                            onUpsertEmployee({
                              ...emp,
                              jefe: nextList,
                              listaPersonalizada: true,
                              actualizadoEn: new Date().toISOString(),
                            });
                          }}
                          title="Mover empleado a otra lista"
                          className="px-2 py-1 rounded-lg bg-[#171821] border border-white/[0.08] text-[11px] text-white cursor-pointer shrink-0"
                        >
                          {allLists.map(l => (
                            <option key={l} value={l}>
                              {l === listName ? `En: ${l}` : `Mover a: ${l}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA AGREGAR / EDITAR EMPLEADO MANUALMENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#21222D] border border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {editingEmp.isEdit ? `Editar Colaborador #${editingEmp.id}` : 'Registrar Colaborador en Padrón'}
                </h3>
                <p className="text-xs text-[#87888C]">
                  Se almacenará de forma permanente independientemente de los archivos subidos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#87888C] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                    Código / ID (5 dígitos)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingEmp.isEdit}
                    value={editingEmp.id}
                    onChange={e => setEditingEmp(p => ({ ...p, id: e.target.value }))}
                    placeholder="Ej. 00615"
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs font-mono text-white disabled:opacity-60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmp.nombre}
                    onChange={e => setEditingEmp(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="APELLIDOS Y NOMBRE"
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                    Lista Asignada (Supervisor)
                  </label>
                  <select
                    value={editingEmp.jefe}
                    onChange={e => setEditingEmp(p => ({ ...p, jefe: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                  >
                    {allLists.map(l => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                    <option value="__NUEVA__">+ Crear Nueva Lista...</option>
                  </select>
                </div>

                {editingEmp.jefe === '__NUEVA__' ? (
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                      Nombre de la Nueva Lista
                    </label>
                    <input
                      type="text"
                      required
                      value={editingEmp.customJefe}
                      onChange={e => setEditingEmp(p => ({ ...p, customJefe: e.target.value }))}
                      placeholder="Ej. PLANTA CONCRETOS"
                      className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                      Empresa / Razón Social
                    </label>
                    <input
                      type="text"
                      value={editingEmp.empresa}
                      onChange={e => setEditingEmp(p => ({ ...p, empresa: e.target.value }))}
                      placeholder="Ej. CEMENQUIN / EMPRESA 2"
                      className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                    Horario / Turno Asignado
                  </label>
                  <select
                    value={editingEmp.horario}
                    onChange={e => setEditingEmp(p => ({ ...p, horario: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                  >
                    {scheduleCodes.map(c => (
                      <option key={c} value={c}>
                        {c} — {horarios[c]?.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                    Puesto / Área (Opcional)
                  </label>
                  <input
                    type="text"
                    value={editingEmp.puesto}
                    onChange={e => setEditingEmp(p => ({ ...p, puesto: e.target.value }))}
                    placeholder="Ej. Operador / Mantenimiento"
                    className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#171821] text-xs font-bold text-[#87888C] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold cursor-pointer"
                >
                  Guardar en Padrón Permanente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA RENOMBRAR O UNIFICAR UNA LISTA COMPLETA */}
      {renamingList && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#21222D] border border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">
                Renombrar o Unificar Lista
              </h3>
              <button
                type="button"
                onClick={() => setRenamingList(null)}
                className="p-1.5 text-[#87888C] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#87888C]">
              Todos los colaboradores de la lista <strong className="text-white">{renamingList.oldName}</strong> pasarán a la lista destino de forma permanente.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase text-[#87888C] block mb-1">
                Nuevo Nombre de Lista (Supervisor)
              </label>
              <input
                type="text"
                value={renamingList.newName}
                onChange={e => setRenamingList(p => (p ? { ...p, newName: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl bg-[#171821] border border-white/10 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingList(null)}
                className="px-4 py-2 rounded-xl bg-[#171821] text-xs font-bold text-[#87888C] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleanNew = normalizeSupervisorName(renamingList.newName);
                  if (cleanNew && cleanNew !== renamingList.oldName) {
                    onRenameSupervisorList(renamingList.oldName, cleanNew);
                  }
                  setRenamingList(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#A9DFD8] text-[#171821] text-xs font-extrabold cursor-pointer"
              >
                Aplicar Cambio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
