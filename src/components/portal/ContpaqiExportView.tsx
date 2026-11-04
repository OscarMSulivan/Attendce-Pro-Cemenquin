/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(true);
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
      etiquetaSistema: 'Nueva Incidencia Personalizada',
      palabraClaveMatch: 'GUARDIA',
      clave: 'NVA',
      prefijoCantidad: true,
      nombreColA: 'PAGO ESPECIAL',
      observacionesModo: 'SUPERVISOR',
      observacionesFijo: '',
      conceptoColC: 'CONCEPTO PERSONALIZADO',
      montoColF: 0,
      activa: true,
      esPersonalizada: true,
    };
    handleUpdateConfig({
      reglasIncidencias: [...cfg.reglasIncidencias, newRule],
    });
    setFeedbackMsg('✓ Nueva regla de incidencia agregada al catálogo configurable');
  };

  const handleDeleteCustomRule = (ruleId: string) => {
    handleUpdateConfig({
      reglasIncidencias: cfg.reglasIncidencias.filter(r => r.id !== ruleId),
    });
  };

  const handleResetConfig = () => {
    setCfg(DEFAULT_CONTPAQI_CONFIG);
    saveContpaqiConfig(DEFAULT_CONTPAQI_CONFIG);
    setFeedbackMsg('✓ Catálogo de claves y formato restaurados a los valores por defecto');
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

  // KPIs ejecutivos
  const kpis = useMemo(() => {
    const activeRulesCount = cfg.reglasIncidencias.filter(r => r.activa).length;
    const faltasRows = formatRows.filter(r => r.ruleId === 'FALTA').length;
    const primaRows = formatRows.filter(r => r.ruleId === 'PRIMA_DOMINICAL').length;
    const retardoRows = formatRows.filter(r => r.ruleId === 'RETARDO').length;
    const montoTotal = formatRows.reduce((acc, r) => acc + (r.montoColF || 0), 0);

    return {
      totalFilasFormato: formatRows.length,
      totalMovimientos: movements.length,
      activeRulesCount,
      faltasRows,
      primaRows,
      retardoRows,
      montoTotal,
    };
  }, [formatRows, movements, cfg.reglasIncidencias]);

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
    <div className="space-y-6">
      {/* Encabezado Ejecutivo del Módulo CONTPAQi Nóminas */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Módulo Configurable CONTPAQi® Nóminas
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Semana No. <strong className="text-slate-200">{weekNumber}</strong> ({weekPeriod || cfg.ejercicio})
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-100 mt-1">
                Generador de Layout de Incidencias para CONTPAQi® Nóminas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Configura las claves de <strong>todas las incidencias</strong> (Faltas <code>1FINJ</code>, Prima Dominical <code>1SRDN</code>, Asistencia <code>1ASIS</code>, Retardos <code>1RET</code>, Vacaciones, Permisos, Horas Extras, etc.) y descarga el Excel con las columnas exactas: <strong>NOMBRE | OBSERVACIONES | CONCEPTO | NUM EMPLEADO | NOMBRE | MONTO | 7 Fechas de la Semana</strong>.
              </p>
            </div>
          </div>

          {/* Botones de Descarga y Configuración */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showConfigPanel
                  ? 'bg-indigo-600/25 text-indigo-200 border-indigo-500/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Settings2 className="w-4 h-4 text-indigo-400" />
              <span>{showConfigPanel ? 'Ocultar Configurador de Claves' : 'Configurar Todas las Incidencias'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={reports.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Descargar archivo .TXT separado por tabuladores"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Descargar .TXT</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={reports.length === 0 || isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando Excel...' : 'Descargar Excel Formato CONTPAQi (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="mt-4 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {feedbackMsg}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* PANEL CONFIGURADOR DE TODAS LAS INCIDENCIAS Y CLAVES */}
      {showConfigPanel && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-400" />
                Configuración de Claves, Conceptos y Montos para Todas las Incidencias
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Activa o desactiva qué incidencias deseas incluir en el Excel (incluyendo <strong>Asistencia</strong>, <strong>Retardo</strong>, <strong>Falta Injustificada</strong>, <strong>Prima Dominical</strong>, etc.) y personaliza su Clave (ej. <code>FINJ</code> &rarr; <code>1FINJ</code>, <code>SRDN</code> &rarr; <code>1SRDN</code>), Columna <code>NOMBRE</code>, <code>OBSERVACIONES</code>, <code>CONCEPTO</code> y <code>MONTO</code>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAddCustomRule}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Incidencia</span>
              </button>

              <button
                type="button"
                onClick={handleResetConfig}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Valores</span>
              </button>
            </div>
          </div>

          {/* Tabla editable de todas las incidencias */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="p-2.5 pl-3 text-center">Incluir en Excel</th>
                  <th className="p-2.5">Incidencia del Sistema</th>
                  <th className="p-2.5 text-center">Clave (Ej. FINJ / SRDN)</th>
                  <th className="p-2.5 text-center">Vista en Fecha</th>
                  <th className="p-2.5">Columna A: NOMBRE</th>
                  <th className="p-2.5">Columna B: OBSERVACIONES</th>
                  <th className="p-2.5">Columna C: CONCEPTO</th>
                  <th className="p-2.5 text-right pr-3">Columna F: MONTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {cfg.reglasIncidencias.map(rule => {
                  const previewCode = rule.prefijoCantidad
                    ? `1${(rule.clave || '').trim().toUpperCase()}`
                    : (rule.clave || '').trim().toUpperCase();

                  return (
                    <tr
                      key={rule.id}
                      className={`transition-colors ${
                        rule.activa ? 'bg-slate-900/70 hover:bg-slate-800/60' : 'bg-slate-950/40 opacity-60 hover:opacity-90'
                      }`}
                    >
                      {/* Switch Activa */}
                      <td className="p-2.5 pl-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.activa}
                          onChange={(e) => handleUpdateRule(rule.id, { activa: e.target.checked })}
                          className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          title="Marcar para exportar esta incidencia al Excel de CONTPAQi"
                        />
                      </td>

                      {/* Nombre de la incidencia en el sistema */}
                      <td className="p-2.5">
                        {rule.esPersonalizada ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={rule.etiquetaSistema}
                              onChange={(e) => handleUpdateRule(rule.id, { etiquetaSistema: e.target.value })}
                              className="w-full rounded px-2 py-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold"
                              placeholder="Nombre de regla"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Si dice:</span>
                              <input
                                type="text"
                                value={rule.palabraClaveMatch || ''}
                                onChange={(e) =>
                                  handleUpdateRule(rule.id, { palabraClaveMatch: e.target.value.toUpperCase() })
                                }
                                className="w-28 rounded px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-[10px]"
                                placeholder="PALABRA CLAVE"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomRule(rule.id)}
                                className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                title="Eliminar regla personalizada"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-200 block">{rule.etiquetaSistema}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{rule.id}</span>
                          </div>
                        )}
                      </td>

                      {/* Clave editable */}
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="text"
                            value={rule.clave}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, { clave: e.target.value.toUpperCase() })
                            }
                            className="w-20 text-center rounded-lg px-2 py-1 bg-slate-950 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs uppercase focus:border-indigo-400 outline-none"
                          />
                          <label
                            className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer"
                            title="Antepone el número 1 o cantidad de horas antes de la clave (ej. 1FINJ, 1SRDN)"
                          >
                            <input
                              type="checkbox"
                              checked={rule.prefijoCantidad}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, { prefijoCantidad: e.target.checked })
                              }
                              className="rounded accent-indigo-500"
                            />
                            <span>1+</span>
                          </label>
                        </div>
                      </td>

                      {/* Badge de cómo se verá en la columna de fecha */}
                      <td className="p-2.5 text-center">
                        <span className="inline-block font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-emerald-300">
                          {previewCode}
                        </span>
                      </td>

                      {/* Columna A: NOMBRE (Ej. PAGO 0, GUARDIAS 12 HRS) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={rule.nombreColA}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { nombreColA: e.target.value.toUpperCase() })
                          }
                          className="w-36 rounded-lg px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs uppercase focus:border-indigo-500 outline-none"
                          placeholder="Ej. PAGO 0"
                        />
                      </td>

                      {/* Columna B: OBSERVACIONES (Supervisor automático o Texto fijo como SEMANA REDUCIDA) */}
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={rule.observacionesModo}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, {
                                observacionesModo: e.target.value as 'SUPERVISOR' | 'FIJO',
                              })
                            }
                            className="rounded-lg px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 text-[11px] outline-none"
                          >
                            <option value="SUPERVISOR">Nombre Supervisor</option>
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
                              placeholder="Ej. SEMANA REDUCIDA"
                              className="w-36 rounded-lg px-2 py-1 bg-slate-950 border border-amber-500/40 text-amber-200 font-mono text-xs uppercase outline-none"
                            />
                          )}
                        </div>
                      </td>

                      {/* Columna C: CONCEPTO (Ej. FALTA INJUSTIFICADA, PRIMA DOMINICAL) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={rule.conceptoColC}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { conceptoColC: e.target.value.toUpperCase() })
                          }
                          className="w-44 rounded-lg px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs uppercase focus:border-indigo-500 outline-none"
                          placeholder="Ej. FALTA INJUSTIFICADA"
                        />
                      </td>

                      {/* Columna F: MONTO (0 muestra "-", o monto numérico ej. 168.75) */}
                      <td className="p-2.5 pr-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rule.montoColF}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              montoColF: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 text-right rounded-lg px-2 py-1 bg-slate-950 border border-slate-800 text-emerald-300 font-mono font-bold text-xs outline-none focus:border-indigo-500"
                          title="Si es 0, en el Excel aparecerá '-' como en FALTA INJUSTIFICADA. Si es mayor a 0 (ej. 168.75), aparecerá el monto."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Opciones Generales del Formato */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={cfg.detectarPrimaDominicalAuto}
                  onChange={(e) =>
                    handleUpdateConfig({ detectarPrimaDominicalAuto: e.target.checked })
                  }
                  className="rounded accent-indigo-500"
                />
                <span>
                  Detectar automáticamente <strong>Prima Dominical (1SRDN)</strong> cuando el empleado trabaja en Domingo
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={cfg.separarExtrasDoblesTriplesLFT}
                  onChange={(e) =>
                    handleUpdateConfig({ separarExtrasDoblesTriplesLFT: e.target.checked })
                  }
                  className="rounded accent-indigo-500"
                />
                <span>Separar Horas Extras Dobles (≤9h) y Triples (&gt;9h) LFT</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={cfg.soloSupervisoresLiberados}
                  onChange={(e) =>
                    handleUpdateConfig({ soloSupervisoresLiberados: e.target.checked })
                  }
                  className="rounded accent-emerald-500"
                />
                <span>Solo incluir nóminas Liberadas por Supervisor</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={cfg.incluirFilaVaciaSeparadora}
                  onChange={(e) =>
                    handleUpdateConfig({ incluirFilaVaciaSeparadora: e.target.checked })
                  }
                  className="rounded accent-indigo-500"
                />
                <span>Incluir fila vacía debajo del encabezado gris (idéntico al formato)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Formato Fecha Encabezado:</span>
              <select
                value={cfg.formatoEncabezadoFecha}
                onChange={(e) =>
                  handleUpdateConfig({
                    formatoEncabezadoFecha: e.target.value as 'M/D/YYYY' | 'DD/MM/YYYY',
                  })
                }
                className="rounded-lg px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs"
              >
                <option value="M/D/YYYY">M/D/YYYY (Ej. 10/8/2026)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (Ej. 08/10/2026)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Filas en Formato Excel
          </span>
          <span className="text-2xl font-black text-slate-100 font-mono">
            {kpis.totalFilasFormato}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {kpis.activeRulesCount} tipos de incidencia activos
          </span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
          <span className="text-[10px] uppercase font-bold text-rose-400 block">
            Faltas Injustificadas
          </span>
          <span className="text-2xl font-black text-rose-300 font-mono">{kpis.faltasRows}</span>
          <span className="text-[10px] text-rose-400/80 block mt-0.5">Empleados con faltas</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
          <span className="text-[10px] uppercase font-bold text-amber-400 block">
            Prima Dominical / Guardias
          </span>
          <span className="text-2xl font-black text-amber-300 font-mono">{kpis.primaRows}</span>
          <span className="text-[10px] text-amber-400/80 block mt-0.5">Registros SRDN</span>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30">
          <span className="text-[10px] uppercase font-bold text-blue-400 block">
            Retardos y Otras Incidencias
          </span>
          <span className="text-2xl font-black text-blue-300 font-mono">
            {kpis.totalMovimientos}
          </span>
          <span className="text-[10px] text-blue-400/80 block mt-0.5">Eventos en la semana</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">
            Suma Columna MONTO
          </span>
          <span className="text-2xl font-black text-emerald-300 font-mono">
            ${kpis.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">Conceptos con importe</span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">
            Primero genera el reporte de la semana en &ldquo;Carga y Proceso Nómina&rdquo;
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Una vez cargadas las checadas y generado el reporte, aquí verás la tabla con el formato exacto lista para descargar a Excel.
          </p>
        </div>
      ) : (
        <>
          {/* Barra de Sub-pestañas y Filtros */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubTab('formato_oficial')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'formato_oficial'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Table2 className="w-4 h-4" />
                <span>
                  Hoja 1: Formato Oficial Excel (NOMBRE | OBSERVACIONES | CONCEPTO | 7 Fechas) ({filteredFormatRows.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('tdd')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'tdd'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Hoja 2: Desglose Vertical por Día ({filteredMovements.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filtro por Supervisor */}
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="">Todos los Supervisores ({supervisors.length})</option>
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
                className="rounded-lg px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 font-mono"
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
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar 00615, nombre o concepto..."
                  className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* VISTA PREVIA 1: FORMATO OFICIAL EXACTO DE LA IMAGEN */}
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
                      <th className="py-2 px-3 border border-slate-500 whitespace-nowrap">MONTO</th>
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
                    {/* Fila vacía debajo del encabezado si está activada */}
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
                          No hay incidencias que coincidan con las reglas activas o el filtro actual. Puedes activar &ldquo;Asistencia Normal&rdquo; u otras incidencias en el panel superior.
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
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap">
                            {row.conceptoColC}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 font-mono whitespace-nowrap">
                            {row.numEmpleadoColD}
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 whitespace-nowrap">
                            {row.nombreEmpleadoColE}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-nowrap">
                            {row.montoColF > 0 ? row.montoColF.toFixed(2) : '-'}
                          </td>
                          {datesInPeriod.map(d => {
                            const val = row.celdasPorFecha[d.isoDate] || '';
                            return (
                              <td
                                key={d.isoDate}
                                className={`py-1.5 px-2 border border-slate-300 font-mono whitespace-nowrap ${
                                  val ? 'font-bold text-slate-950 bg-amber-50/40' : ''
                                }`}
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
            <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="p-3 pl-4">Num Empleado</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Nombre Grupo (Col A)</th>
                      <th className="p-3">Observaciones (Col B)</th>
                      <th className="p-3">Concepto (Col C)</th>
                      <th className="p-3 text-center">Clave Fecha</th>
                      <th className="p-3 text-center">Fecha</th>
                      <th className="p-3 text-right pr-4">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredMovements.map((m, idx) => (
                      <tr
                        key={`${m.codigoEmpleado}-${m.fechaISO}-${m.claveIncidencia}-${idx}`}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3 pl-4 font-bold text-blue-300">{m.codigoEmpleado}</td>
                        <td className="p-3 font-sans font-semibold text-slate-100">
                          {m.nombreEmpleado}
                        </td>
                        <td className="p-3 font-sans text-slate-300">{m.nombreColA}</td>
                        <td className="p-3 font-sans text-slate-300">{m.observacionesColB}</td>
                        <td className="p-3 font-sans text-slate-200">{m.conceptoDescripcion}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                            {m.claveIncidencia}
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-300">{m.fechaContpaqi}</td>
                        <td className="p-3 pr-4 text-right text-emerald-300">
                          {m.monto > 0 ? m.monto.toFixed(2) : '-'}
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
    </div>
  );
};
