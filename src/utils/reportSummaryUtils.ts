/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, EmployeeReport, EventsDB, PayrollSummary } from '../types/attendance';
import { normalizeEmployeeId } from './calendarUtils';

/**
 * Aplica los códigos de horario asignados a cada colaborador normalizando IDs (ej. 64 -> 00064).
 */
export function mergeAsignacionesToEmployees(
  base: Record<string, Employee>,
  asig: Record<string, string>
): Record<string, Employee> {
  const updated: Record<string, Employee> = {};
  Object.values(base).forEach((emp) => {
    const normId = normalizeEmployeeId(emp.id) || emp.id;
    const assignedCode = asig[normId] ?? asig[emp.id] ?? emp.horario ?? '';
    updated[normId] = {
      ...emp,
      id: normId,
      horario: assignedCode,
    };
  });
  return updated;
}

/**
 * Recalcula las métricas globales del resumen ejecutivo a partir de un arreglo de reportes.
 */
export function recomputeSummaryFromReports(listaReportes: EmployeeReport[]): PayrollSummary {
  let totalHoras = 0;
  let totalHorasExtra = 0;
  let totalF = 0;
  let totalV = 0;
  let totalR = 0;
  let totalRE = 0;
  let perfectas = 0;
  const conteoInc: Record<string, number> = {};
  let totalDiasAuditoria = 0;

  listaReportes.forEach((rep) => {
    totalHoras += rep.totalNormal;
    totalHorasExtra += rep.totalExtra;
    totalF += rep.faltas;
    totalR += rep.retardos;
    if (rep.asistenciaPerfecta) perfectas++;

    rep.dias.forEach((d) => {
      totalDiasAuditoria++;
      if (d.incidencia) {
        conteoInc[d.incidencia] = (conteoInc[d.incidencia] || 0) + 1;
        const up = d.incidencia.toUpperCase();
        if (up.includes('VAC')) totalV++;
        if (up.includes('EXCESIVO')) totalRE++;
      }
    });
  });

  const numEmp = listaReportes.length;
  const promedioHoras = numEmp > 0 ? Number((totalHoras / numEmp).toFixed(2)) : 0;
  const tasaFaltas = (totalF / Math.max(1, totalDiasAuditoria)) * 100;
  const tasaCumplimiento = Number(Math.max(0, 100 - tasaFaltas).toFixed(1));

  return {
    totalHoras,
    totalHorasExtra,
    totalFaltas: totalF,
    totalVac: totalV,
    totalRetardos: totalR,
    totalRetardosExcesivos: totalRE,
    totalEmpleados: numEmp,
    tasaCumplimiento,
    promedioHoras,
    asistenciasPerfectas: perfectas,
    incidenciasConteo: conteoInc,
  };
}

/**
 * Determina si un colaborador tiene al menos una checada biométrica o edición en la semana seleccionada.
 */
export function employeeReportHasActivityInWeek(
  rep: EmployeeReport,
  eventosDB?: EventsDB,
  selectedWeek?: string
): boolean {
  const hasDayActivity = rep.dias.some(
    (d) =>
      (d.entrada && d.entrada !== '--:--') ||
      (d.salida && d.salida !== '--:--') ||
      Boolean(d.modificadoPorSupervisor) ||
      (d.registrosCrudosDia && d.registrosCrudosDia.length > 0) ||
      (d.incidencia &&
        !d.incidencia.toUpperCase().includes('FALTA') &&
        d.incidencia !== 'Descanso')
  );
  if (hasDayActivity) return true;

  if (eventosDB && selectedWeek && selectedWeek.includes('|')) {
    const [startISO, endISO] = selectedWeek.split('|');
    const normId = normalizeEmployeeId(rep.empleado.id) || rep.empleado.id;
    const empDates = eventosDB[normId] || eventosDB[rep.empleado.id];
    if (empDates) {
      return Object.keys(empDates).some((iso) => iso >= startISO && iso <= endISO);
    }
  }
  return false;
}
