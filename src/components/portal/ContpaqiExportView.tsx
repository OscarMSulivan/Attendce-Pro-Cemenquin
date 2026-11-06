/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Download,
  Settings2,
  CheckCircle2,
  Search,
  FileText,
  Table2,
  ListChecks,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Clock,
  AlertTriangle,
  Zap,
  Calculator
} from 'lucide-react';
import { EmployeeReport } from '../../types/attendance';
import { PayrollRelease } from '../../types/portal';
import {
  ContpaqiConfig,
  ContpaqiIncidenceRule,
  DEFAULT_CONTPAQI_CONFIG,
  loadContpaqiConfig,
  saveContpaqiConfig,
  buildContpaqiPayrollData,
  exportContpaqiExcel,
  exportContpaqiTxt,
} from '../../services/contpaqiExportService';

interface ContpaqiExportViewProps {
  reports: EmployeeReport[];
  releases: Record<string, PayrollRelease>;
  supervisors: string[];
  weekNumber: number;
  weekPeriod: string;
}

export const ContpaqiExportView: React.FC<ContpaqiExportViewProps> = ({
  reports,
  releases,
  supervisors,
  weekNumber,
  weekPeriod,
}) => {
  const [cfg, setCfg] = useState<ContpaqiConfig>(() => loadContpaqiConfig());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'formato_oficial' | 'tdd'>('formato_oficial');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [selectedConcepto, setSelectedConcepto] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleUpdateConfig = (partial: Partial<ContpaqiConfig>) => {
    const updated = { ...cfg, ...partial };
    setCfg(updated);
    saveContpaqiConfig(updated);
  };

  const handleUpdateRule = (ruleId: string, partial: Partial<ContpaqiIncidenceRule>) => {
    const updatedRules = cfg.reglasIncidencias.map(r =>
      r.id === ruleId ? { ...r, ...partial } : r
    );
    handleUpdateConfig({ reglasIncidencias: updatedRules });
  };

  const handleAddCustomRule = () => {
    const newId = `CUSTOM_${Date.now()}`;
    const newRule: ContpaqiIncidenceRule = {
      id: newId,
      etiquetaSistema: 'Otra Incidencia Personalizada',
      palabraClaveMatch: 'PERMISO',
      clave: 'PCS',
      prefijoCantidad: true,
      nombreColA: 'INCIDENCIAS',
      observacionesModo: 'SUPERVISOR',
      observacionesFijo: '',
      conceptoColC: 'OTRA INCIDENCIA',
      montoColF: 0,
      activa: true,
      esPersonalizada: true,
    };
    handleUpdateConfig({
      reglasIncidencias: [...cfg.reglasIncidencias, newRule],
    });
    setFeedbackMsg('✓ Se agregó una nueva incidencia personalizada al catálogo');
  };

  const handleDeleteCustomRule = (ruleId: string) => {
    handleUpdateConfig({
      reglasIncidencias: cfg.reglasIncidencias.filter(r => r.id !== ruleId),
    });
  };

  const handleResetConfig = () => {
    setCfg(DEFAULT_CONTPAQI_CONFIG);
    saveContpaqiConfig(DEFAULT_CONTPAQI_CONFIG);
    setFeedbackMsg('✓ Conceptos restaurados a los 4 esenciales (FINJ, Retardo, Horas Extras Dobles y Triples)');
  };

  // Reportes filtrados por supervisor seleccionado
  const baseReports = useMemo(() => {
    if (!selectedSupervisor) return reports;
    return reports.filter(r => r.empleado.jefe === selectedSupervisor);
  }, [reports, selectedSupervisor]);

  // Construcción en tiempo real de las filas del formato solicitado y los movimientos TDD
  const { formatRows, movements, datesInPeriod } = useMemo(() => {
    return buildContpaqiPayrollData(baseReports, weekNumber, releases, cfg);
  }, [baseReports, weekNumber, releases, cfg]);

  // Lista única de conceptos activos en las filas generadas
  const availableConcepts = useMemo(() => {
    const set = new Set<string>();
    formatRows.forEach(r => set.add(r.conceptoColC));
    return Array.from(set);
  }, [formatRows]);

  // Filtrado de filas del formato horizontal
  const filteredFormatRows = useMemo(() => {
    return formatRows.filter(row => {
      if (selectedConcepto && row.conceptoColC !== selectedConcepto) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          row.numEmpleadoColD.toLowerCase().includes(q) ||
          row.nombreEmpleadoColE.toLowerCase().includes(q) ||
          row.conceptoColC.toLowerCase().includes(q) ||
          row.nombreColA.toLowerCase().includes(q) ||
          row.observacionesColB.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [formatRows, selectedConcepto, searchQuery]);

  // Filtrado de movimientos verticales
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (selectedConcepto && m.conceptoDescripcion !== selectedConcepto) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          m.codigoEmpleado.toLowerCase().includes(q) ||
          m.nombreEmpleado.toLowerCase().includes(q) ||
          m.claveIncidencia.toLowerCase().includes(q) ||
          m.conceptoDescripcion.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [movements, selectedConcepto, searchQuery]);

  // KPIs ejecutivos simplificados
  const kpis = useMemo(() => {
    const faltasRows = formatRows.filter(r => r.ruleId === 'FALTA');
    const totalDiasFalta = faltasRows.reduce((acc, r) => acc + r.totalOcurrenciasSemana, 0);

    const retardoRows = formatRows.filter(r => r.ruleId === 'RETARDO');
    const totalMinutosRetardo = retardoRows.reduce(
      (acc, r) => acc + (r.minutosRetardoAcumulados || 0),
      0
    );
    const totalDescuentoRetardo = retardoRows.reduce((acc, r) => acc + (r.montoColF || 0), 0);

    const doblesRows = formatRows.filter(r => r.ruleId === 'HORAS_EXTRAS_DOBLES');
    const triplesRows = formatRows.filter(r => r.ruleId === 'HORAS_EXTRAS_TRIPLES');
    const totalHorasDobles = doblesRows.reduce((acc, r) => acc + r.totalOcurrenciasSemana, 0);
    const totalHorasTriples = triplesRows.reduce((acc, r) => acc + r.totalOcurrenciasSemana, 0);

    return {
      totalFilasFormato: formatRows.length,
      faltasEmpCount: faltasRows.length,
      totalDiasFalta,
      retardoEmpCount: retardoRows.length,
      totalMinutosRetardo,
      totalHorasRetardo: Number((totalMinutosRetardo / 60).toFixed(2)),
      totalDescuentoRetardo,
      totalHorasDobles: Number(totalHorasDobles.toFixed(1)),
      totalHorasTriples: Number(totalHorasTriples.toFixed(1)),
    };
  }, [formatRows]);

  const handleDownloadExcel = async () => {
    if (baseReports.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = await exportContpaqiExcel(baseReports, weekNumber, releases, cfg);
      setFeedbackMsg(`✓ Excel con formato oficial descargado: ${fileName}`);
    } catch (e: any) {
      setFeedbackMsg(`Error al exportar: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTxt = () => {
    if (baseReports.length === 0) return;
    const fileName = exportContpaqiTxt(baseReports, weekNumber, releases, cfg);
    setFeedbackMsg(`✓ Layout TXT descargado: ${fileName}`);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Encabezado Principal alineado al diseño #21222D / #171821 / #A9DFD8 */}
      <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35">
                  CONTPAQi® Nóminas · Semana {weekNumber}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#171821] text-[#FEB95A] border border-white/[0.06]">
                  Celda vacía = Asistencia normal
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1.5 tracking-tight">
                Layout Simplificado de Incidencias y Tiempo Extra
              </h2>
              <p className="text-xs text-[#87888C] mt-0.5 max-w-3xl">
                Enfocado exclusivamente en <strong className="text-white">FINJ</strong> (Falta Injustificada),{' '}
                <strong className="text-white">Retardo</strong> (con cálculo automático de minutos y descuento),{' '}
                <strong className="text-white">Horas Extras Dobles y Triples</strong>, dejando en blanco los días de asistencia normal.
              </p>
            </div>
          </div>

          {/* Botones de Acción (Configuración en Menú Emergente + Descargas) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#FEB95A] border border-[#FEB95A]/35 text-xs font-bold transition-all cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-[#FEB95A]" />
              <span>Configurar Conceptos y Retardo</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={reports.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] disabled:opacity-40 text-[#20AEF3] border border-[#20AEF3]/35 text-xs font-bold transition-all cursor-pointer"
              title="Descargar archivo .TXT separado por tabuladores"
            >
              <FileText className="w-4 h-4 text-[#20AEF3]" />
              <span>Descargar .TXT</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={reports.length === 0 || isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] disabled:opacity-40 text-[#171821] text-xs font-extrabold transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando...' : 'Descargar Excel CONTPAQi (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/40 text-[#A9DFD8] text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#A9DFD8]" />
              {feedbackMsg}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-[#87888C] hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Tarjetas Resumen Estilo Bento ("Today's Sales" style) */}
      <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* 1. FINJ - Falta Injustificada */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                1FINJ
              </span>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {kpis.totalDiasFalta} <span className="text-xs font-normal text-[#87888C]">días</span>
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Faltas Injustificadas (FINJ)
              </p>
              <p className="text-[10px] font-mono text-rose-400 mt-1">
                {kpis.faltasEmpCount} colaborador(es) con falta
              </p>
            </div>
          </div>

          {/* 2. RETARDO - Cálculo de tiempo y descuento */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A]">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30">
                1RET · Descuento
              </span>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {kpis.totalMinutosRetardo}m{' '}
                <span className="text-xs font-normal text-[#87888C]">({kpis.totalHorasRetardo}h)</span>
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Tiempo de Retardo a Descontar
              </p>
              <p className="text-[10px] font-mono text-[#FEB95A] mt-1">
                {kpis.totalDescuentoRetardo > 0
                  ? `Descuento estimado: $${kpis.totalDescuentoRetardo.toFixed(2)} (${kpis.retardoEmpCount} emp.)`
                  : `${kpis.retardoEmpCount} colaborador(es) con retardo`}
              </p>
            </div>
          </div>

          {/* 3. Horas Extras Dobles y Triples */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                <Zap className="w-4 h-4" />
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30">
                1HE / 2HE
              </span>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {kpis.totalHorasDobles}h <span className="text-xs font-normal text-[#87888C]">2x</span> ·{' '}
                {kpis.totalHorasTriples}h <span className="text-xs font-normal text-[#87888C]">3x</span>
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Horas Extras Dobles y Triples
              </p>
              <p className="text-[10px] font-mono text-[#A9DFD8] mt-1">
                Solo incluye tiempo extra autorizado ✓
              </p>
            </div>
          </div>

          {/* 4. Asistencia = Vacío + Total Filas */}
          <div className="rounded-xl p-4 bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3]">
                <Calculator className="w-4 h-4" />
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30">
                Vacío = Asistencia
              </span>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {kpis.totalFilasFormato} <span className="text-xs font-normal text-[#87888C]">filas</span>
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">
                Registros en Layout Excel
              </p>
              <p className="text-[10px] font-mono text-[#20AEF3] mt-1">
                {cfg.reglasIncidencias.filter(r => r.activa).length} conceptos activos
              </p>
            </div>
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#21222D] border border-white/[0.06] text-center space-y-2">
          <FileSpreadsheet className="w-10 h-10 text-[#87888C] mx-auto" />
          <h3 className="text-sm font-bold text-white">
            Primero genera el reporte de la semana en &ldquo;Dashboard Nómina&rdquo;
          </h3>
          <p className="text-xs text-[#87888C] max-w-md mx-auto">
            Una vez cargadas las checadas y generado el reporte, aquí verás la tabla lista para descargar a CONTPAQi® Nóminas.
          </p>
        </div>
      ) : (
        <>
          {/* Barra de Sub-pestañas y Filtros */}
          <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubTab('formato_oficial')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'formato_oficial'
                    ? 'bg-[#A9DFD8] text-[#171821] shadow'
                    : 'bg-[#171821] text-[#87888C] hover:text-white border border-white/[0.06]'
                }`}
              >
                <Table2 className="w-4 h-4" />
                <span>
                  Hoja 1: Formato Oficial Excel ({filteredFormatRows.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('tdd')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'tdd'
                    ? 'bg-[#A9DFD8] text-[#171821] shadow'
                    : 'bg-[#171821] text-[#87888C] hover:text-white border border-white/[0.06]'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Hoja 2: Desglose de Movimientos y Retardos ({filteredMovements.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filtro por Supervisor */}
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8]"
              >
                <option value="">Todas las Listas / Supervisores ({supervisors.length})</option>
                {supervisors.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Filtro por Concepto */}
              <select
                value={selectedConcepto}
                onChange={(e) => setSelectedConcepto(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] font-mono"
              >
                <option value="">Todos los Conceptos</option>
                {availableConcepts.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Buscador */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar 00615, nombre..."
                  className="w-full rounded-xl pl-8 pr-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] outline-none focus:border-[#A9DFD8] font-mono"
                />
              </div>
            </div>
          </div>

          {/* VISTA PREVIA 1: FORMATO OFICIAL EXACTO */}
          {activeSubTab === 'formato_oficial' && (
            <div className="rounded-2xl bg-white text-slate-950 border border-slate-400 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#C0C0C0] text-black border-b-2 border-slate-700 text-[11px] font-bold">
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">NOMBRE</th>
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">OBSERVACIONES</th>
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">CONCEPTO</th>
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">NUM EMPLEADO</th>
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">NOMBRE</th>
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">MONTO / DESC.</th>
                      {datesInPeriod.map(d => (
                        <th
                          key={d.isoDate}
                          className="py-2 px-2.5 border border-slate-500 whitespace-nowrap"
                        >
                          {d.headerLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.incluirFilaVaciaSeparadora && (
                      <tr className="h-5 bg-white">
                        <td className="border border-slate-300" />
                        <td className="border border-slate-300" />
                        <td className="border border-slate-300" />
                        <td className="border border-slate-300" />
                        <td className="border border-slate-300" />
                        <td className="border border-slate-300" />
                        {datesInPeriod.map(d => (
                          <td key={d.isoDate} className="border border-slate-300" />
                        ))}
                      </tr>
                    )}

                    {filteredFormatRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6 + datesInPeriod.length}
                          className="p-8 text-center text-slate-500 font-sans"
                        >
                          No hay faltas injustificadas (FINJ), retardos ni horas extras autorizadas con el filtro actual. (Recuerda que la asistencia normal deja la celda vacía).
                        </td>
                      </tr>
                    ) : (
                      filteredFormatRows.map(row => (
                        <tr
                          key={row.rowKey}
                          className="hover:bg-blue-50/70 transition-colors text-[11px] text-black"
                        >
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap">
                            {row.nombreColA}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap">
                            {row.observacionesColB}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap font-semibold">
                            {row.conceptoColC}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 font-mono whitespace-nowrap">
                            {row.numEmpleadoColD}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 whitespace-nowrap">
                            {row.nombreEmpleadoColE}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap font-mono">
                            {row.montoColF > 0
                              ? `$${row.montoColF.toFixed(2)}`
                              : row.minutosRetardoAcumulados && row.minutosRetardoAcumulados > 0
                              ? `-${row.minutosRetardoAcumulados} min`
                              : '-'}
                          </td>
                          {datesInPeriod.map(d => {
                            const val = row.celdasPorFecha[d.isoDate] || '';
                            return (
                              <td
                                key={d.isoDate}
                                className={`py-1.5 px-2 border border-slate-300 font-mono whitespace-nowrap ${
                                  val ? 'font-bold text-slate-950 bg-amber-50/60' : ''
                                }`}
                                title={val ? val : 'Vacío = Asistencia normal'}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISTA PREVIA 2: DESGLOSE VERTICAL TDD */}
          {activeSubTab === 'tdd' && (
            <div className="rounded-2xl bg-[#21222D] border border-white/[0.06] shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#171821] text-[10px] uppercase tracking-wider text-[#87888C] border-b border-white/[0.06]">
                      <th className="p-3 pl-4">Num Empleado</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Supervisor</th>
                      <th className="p-3">Concepto y Cálculo</th>
                      <th className="p-3 text-center">Clave Fecha</th>
                      <th className="p-3 text-center">Fecha</th>
                      <th className="p-3 text-center">Valor / Tiempo</th>
                      <th className="p-3 text-right pr-4">Descuento / Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] font-mono">
                    {filteredMovements.map((m, idx) => (
                      <tr
                        key={`${m.codigoEmpleado}-${m.fechaISO}-${m.claveIncidencia}-${idx}`}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-3 pl-4 font-bold text-[#20AEF3]">{m.codigoEmpleado}</td>
                        <td className="p-3 font-sans font-semibold text-white">
                          {m.nombreEmpleado}
                        </td>
                        <td className="p-3 font-sans text-[#87888C]">{m.observacionesColB}</td>
                        <td className="p-3 font-sans text-[#E8E8EA]">{m.conceptoDescripcion}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35 font-bold">
                            {m.claveIncidencia}
                          </span>
                        </td>
                        <td className="p-3 text-center text-[#87888C]">{m.fechaContpaqi}</td>
                        <td className="p-3 text-center text-[#FEB95A] font-bold">
                          {m.valor} {m.unidad}
                        </td>
                        <td className="p-3 pr-4 text-right text-[#A9DFD8] font-bold">
                          {m.monto > 0
                            ? `$${m.monto.toFixed(2)}`
                            : m.minutosRetardo
                            ? `-${m.minutosRetardo} min`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MENÚ EMERGENTE (MODAL POP-UP) DE CONFIGURACIÓN DE CONCEPTOS Y CÁLCULO DE RETARDO */}
      {isConfigModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[92vh] my-auto flex flex-col shadow-2xl animate-scale-in text-slate-100">
              {/* Header del Modal */}
              <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEB95A]/15 border border-[#FEB95A]/35 flex items-center justify-center text-[#FEB95A] shrink-0">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      Configuración de Conceptos CONTPAQi® y Descuento por Retardo
                    </h3>
                    <p className="text-xs text-[#87888C]">
                      Solo se muestran las incidencias esenciales (FINJ, Retardo, Horas Extras Dobles y Triples) + personalizadas. Celda vacía = Asistencia.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddCustomRule}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Otra Incidencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#87888C] hover:text-white border border-white/[0.07] text-xs font-semibold cursor-pointer transition-colors"
                    title="Restaurar los 4 conceptos por defecto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="p-1.5 rounded-xl text-[#87888C] hover:text-white hover:bg-[#171821] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body del Modal */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
                {/* Regla de Cálculo Automático de Descuento por Retardo */}
                <div className="p-4 rounded-xl bg-[#171821] border border-[#FEB95A]/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#FEB95A]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#FEB95A]">
                        Cálculo Automático de Descuento por Retardo
                      </h4>
                    </div>
                    <span className="text-[11px] text-[#87888C]">
                      Calcula los minutos de diferencia entre la hora programada de entrada y la checada real
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#87888C] block mb-1">
                        Modo de Descuento en Retardo
                      </label>
                      <select
                        value={cfg.modoDescuentoRetardo}
                        onChange={(e) =>
                          handleUpdateConfig({
                            modoDescuentoRetardo: e.target.value as 'POR_MINUTO' | 'POR_EVENTO' | 'SOLO_TIEMPO',
                          })
                        }
                        className="w-full rounded-xl px-3 py-2 bg-[#21222D] border border-white/[0.08] text-white text-xs outline-none focus:border-[#A9DFD8]"
                      >
                        <option value="POR_MINUTO">Calcular $ por cada minuto de retardo</option>
                        <option value="SOLO_TIEMPO">Mostrar minutos y horas a descontar (sin $)</option>
                        <option value="POR_EVENTO">Monto fijo por cada día con retardo</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#87888C] block mb-1">
                        Costo por Minuto de Retardo ($ MXN)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        disabled={cfg.modoDescuentoRetardo !== 'POR_MINUTO'}
                        value={cfg.costoPorMinutoRetardo}
                        onChange={(e) =>
                          handleUpdateConfig({
                            costoPorMinutoRetardo: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-xl px-3 py-2 bg-[#21222D] border border-white/[0.08] text-[#FEB95A] font-mono font-bold text-xs outline-none focus:border-[#A9DFD8] disabled:opacity-40"
                      />
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-[#E8E8EA]">
                        <input
                          type="checkbox"
                          checked={cfg.incluirMinutosEnCeldaRetardo}
                          onChange={(e) =>
                            handleUpdateConfig({ incluirMinutosEnCeldaRetardo: e.target.checked })
                          }
                          className="w-4 h-4 rounded accent-[#A9DFD8]"
                        />
                        <span>Mostrar minutos en celda (ej. <code>1RET (-18m)</code>)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Tabla de las 4 Incidencias Esenciales + Personalizadas */}
                <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#171821]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#171821] text-[10px] uppercase tracking-wider text-[#87888C] border-b border-white/[0.06]">
                        <th className="p-3 text-center">Activa</th>
                        <th className="p-3">Incidencia</th>
                        <th className="p-3 text-center">Clave</th>
                        <th className="p-3 text-center">Vista Celda</th>
                        <th className="p-3">Col A: NOMBRE</th>
                        <th className="p-3">Col B: OBSERVACIONES</th>
                        <th className="p-3">Col C: CONCEPTO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {cfg.reglasIncidencias.map(rule => {
                        const previewCode = rule.prefijoCantidad
                          ? `1${(rule.clave || '').trim().toUpperCase()}`
                          : (rule.clave || '').trim().toUpperCase();

                        return (
                          <tr
                            key={rule.id}
                            className={`transition-colors ${
                              rule.activa ? 'hover:bg-white/[0.02]' : 'opacity-50'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={rule.activa}
                                onChange={(e) => handleUpdateRule(rule.id, { activa: e.target.checked })}
                                className="w-4 h-4 rounded accent-[#A9DFD8] cursor-pointer"
                              />
                            </td>

                            <td className="p-3">
                              {rule.esPersonalizada ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={rule.etiquetaSistema}
                                    onChange={(e) =>
                                      handleUpdateRule(rule.id, { etiquetaSistema: e.target.value })
                                    }
                                    className="w-full rounded-lg px-2 py-1 bg-[#21222D] border border-white/[0.08] text-white text-xs font-semibold"
                                    placeholder="Nombre de incidencia"
                                  />
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-[#87888C]">Cuando diga:</span>
                                    <input
                                      type="text"
                                      value={rule.palabraClaveMatch || ''}
                                      onChange={(e) =>
                                        handleUpdateRule(rule.id, {
                                          palabraClaveMatch: e.target.value.toUpperCase(),
                                        })
                                      }
                                      className="w-28 rounded-lg px-2 py-0.5 bg-[#21222D] border border-white/[0.08] text-[#A9DFD8] font-mono text-[10px]"
                                      placeholder="PALABRA CLAVE"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomRule(rule.id)}
                                      className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                      title="Eliminar incidencia personalizada"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-bold text-white block">{rule.etiquetaSistema}</span>
                                  <span className="text-[10px] text-[#87888C] font-mono">{rule.id}</span>
                                </div>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="text"
                                  value={rule.clave}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.id, { clave: e.target.value.toUpperCase() })
                                  }
                                  className="w-16 text-center rounded-lg px-2 py-1 bg-[#21222D] border border-[#A9DFD8]/35 text-[#A9DFD8] font-mono font-bold text-xs uppercase outline-none"
                                />
                                <label
                                  className="flex items-center gap-1 text-[10px] text-[#87888C] cursor-pointer"
                                  title="Antepone cantidad al código (ej. 1FINJ)"
                                >
                                  <input
                                    type="checkbox"
                                    checked={rule.prefijoCantidad}
                                    onChange={(e) =>
                                      handleUpdateRule(rule.id, { prefijoCantidad: e.target.checked })
                                    }
                                    className="rounded accent-[#A9DFD8]"
                                  />
                                  <span>1+</span>
                                </label>
                              </div>
                            </td>

                            <td className="p-3 text-center">
                              <span className="inline-block font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#21222D] border border-white/[0.08] text-[#A9DFD8]">
                                {previewCode}
                              </span>
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={rule.nombreColA}
                                onChange={(e) =>
                                  handleUpdateRule(rule.id, { nombreColA: e.target.value.toUpperCase() })
                                }
                                className="w-36 rounded-lg px-2.5 py-1 bg-[#21222D] border border-white/[0.08] text-white font-mono text-xs uppercase outline-none focus:border-[#A9DFD8]"
                              />
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={rule.observacionesModo}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.id, {
                                      observacionesModo: e.target.value as 'SUPERVISOR' | 'FIJO',
                                    })
                                  }
                                  className="rounded-lg px-2 py-1 bg-[#21222D] border border-white/[0.08] text-white text-[11px] outline-none"
                                >
                                  <option value="SUPERVISOR">Supervisor</option>
                                  <option value="FIJO">Texto Fijo</option>
                                </select>
                                {rule.observacionesModo === 'FIJO' && (
                                  <input
                                    type="text"
                                    value={rule.observacionesFijo}
                                    onChange={(e) =>
                                      handleUpdateRule(rule.id, {
                                        observacionesFijo: e.target.value.toUpperCase(),
                                      })
                                    }
                                    placeholder="Texto..."
                                    className="w-28 rounded-lg px-2 py-1 bg-[#21222D] border border-[#FEB95A]/40 text-[#FEB95A] font-mono text-xs uppercase outline-none"
                                  />
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={rule.conceptoColC}
                                onChange={(e) =>
                                  handleUpdateRule(rule.id, {
                                    conceptoColC: e.target.value.toUpperCase(),
                                  })
                                }
                                className="w-40 rounded-lg px-2.5 py-1 bg-[#21222D] border border-white/[0.08] text-white font-mono text-xs uppercase outline-none focus:border-[#A9DFD8]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Opciones de Formato General */}
                <div className="p-3.5 rounded-xl bg-[#171821] border border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-[#E8E8EA]">
                      <input
                        type="checkbox"
                        checked={cfg.separarExtrasDoblesTriplesLFT}
                        onChange={(e) =>
                          handleUpdateConfig({ separarExtrasDoblesTriplesLFT: e.target.checked })
                        }
                        className="rounded accent-[#A9DFD8]"
                      />
                      <span>Separar Horas Extras Dobles (≤9h) y Triples (&gt;9h) LFT</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-[#E8E8EA]">
                      <input
                        type="checkbox"
                        checked={cfg.soloSupervisoresLiberados}
                        onChange={(e) =>
                          handleUpdateConfig({ soloSupervisoresLiberados: e.target.checked })
                        }
                        className="rounded accent-[#A9DFD8]"
                      />
                      <span>Solo incluir listas liberadas por supervisor</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-[#E8E8EA]">
                      <input
                        type="checkbox"
                        checked={cfg.incluirFilaVaciaSeparadora}
                        onChange={(e) =>
                          handleUpdateConfig({ incluirFilaVaciaSeparadora: e.target.checked })
                        }
                        className="rounded accent-[#A9DFD8]"
                      />
                      <span>Incluir fila vacía debajo del encabezado gris</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#87888C]">Fecha en encabezado:</span>
                    <select
                      value={cfg.formatoEncabezadoFecha}
                      onChange={(e) =>
                        handleUpdateConfig({
                          formatoEncabezadoFecha: e.target.value as 'M/D/YYYY' | 'DD/MM/YYYY',
                        })
                      }
                      className="rounded-lg px-2.5 py-1 bg-[#21222D] border border-white/[0.08] text-white font-mono text-xs"
                    >
                      <option value="M/D/YYYY">M/D/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer del Modal */}
              <div className="p-4 border-t border-white/[0.06] flex items-center justify-between bg-[#171821]/80 rounded-b-2xl">
                <span className="text-xs text-[#87888C]">
                  Nota: Cuando un día tiene Asistencia o Descanso, su celda queda vacía automáticamente.
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] transition-all cursor-pointer"
                >
                  Guardar y Cerrar ✓
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
