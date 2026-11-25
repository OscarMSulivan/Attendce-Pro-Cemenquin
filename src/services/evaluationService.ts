/**
 * Motor de cálculo, importación/exportación Excel y generación de formato imprimible
 * para el módulo de Evaluaciones de Desempeño Anuales (CemenQtime).
 */

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import {
  EVALUATION_COMPETENCIES,
  INCIDENCE_METRIC_LABELS,
  createEmptyCompetencies,
  type CompetencyScore,
  type EmployeeEvaluationIncidenceScores,
  type EmployeeEvaluationIncidences,
  type EmployeeEvaluationRecord,
  type EvaluationCampaign,
  type EvaluationCompetencyId,
  type IncidenceMetricKey,
  type IncidenceRuleBracket,
  type IncidenceScoringRules,
} from '../types/evaluations';
import type { Employee } from '../types/attendance';
import { normalizeEmployeeId, normalizeSupervisorName } from '../utils/calendarUtils';

const INCIDENCE_KEYS: IncidenceMetricKey[] = [
  'faltas',
  'incapacidades',
  'retardos',
  'permisos',
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getMetricMaxPoints(brackets: IncidenceRuleBracket[]): number {
  if (!Array.isArray(brackets) || brackets.length === 0) {
    return 0;
  }
  let max = 0;
  for (const bracket of brackets) {
    if (Number.isFinite(bracket.puntos) && bracket.puntos > max) {
      max = bracket.puntos;
    }
  }
  return max;
}

export function getRulesMaxTotal(rules: IncidenceScoringRules): number {
  let total = 0;
  for (const key of INCIDENCE_KEYS) {
    total += getMetricMaxPoints(rules[key]);
  }
  return total;
}

export function scoreIncidenceCount(
  count: number,
  brackets: IncidenceRuleBracket[],
): number {
  if (!Number.isFinite(count) || count < 0 || !Array.isArray(brackets) || brackets.length === 0) {
    return 0;
  }
  for (const bracket of brackets) {
    const meetsMin = count >= bracket.min;
    const meetsMax = bracket.max === null || count <= bracket.max;
    if (meetsMin && meetsMax) {
      return Number.isFinite(bracket.puntos) ? bracket.puntos : 0;
    }
  }
  return 0;
}

export interface CalculatedEvaluationScores {
  puntajesIncidencias: EmployeeEvaluationIncidenceScores;
  puntajeCompetencias: number;
  porcentajeCompetencias: number;
  calificacionFinal: number;
  answeredCount: number;
}

export function calculateEvaluationScores(
  incidencias: EmployeeEvaluationIncidences,
  competencias: Record<EvaluationCompetencyId, CompetencyScore>,
  rules: IncidenceScoringRules,
): CalculatedEvaluationScores {
  let puntajeCompetencias = 0;
  let answeredCount = 0;

  for (const comp of EVALUATION_COMPETENCIES) {
    const score = competencias[comp.id];
    if (score !== null && score !== undefined && Number.isFinite(score)) {
      puntajeCompetencias += score;
      answeredCount += 1;
    }
  }

  puntajeCompetencias = round1(puntajeCompetencias);
  const porcentajeCompetencias = round1((puntajeCompetencias / 10) * 100);

  const valorFI = scoreIncidenceCount(incidencias.faltas, rules.faltas);
  const valorINC = scoreIncidenceCount(incidencias.incapacidades, rules.incapacidades);
  const valorRE = scoreIncidenceCount(incidencias.retardos, rules.retardos);
  const valorPER = scoreIncidenceCount(incidencias.permisos, rules.permisos);

  const total = round1(valorFI + valorINC + valorRE + valorPER);
  const maxTotal = getRulesMaxTotal(rules);
  const porcentaje = maxTotal > 0 ? round1((total / maxTotal) * 100) : 0;

  const calificacionFinal = round1((porcentajeCompetencias + porcentaje) / 2);

  return {
    puntajesIncidencias: {
      faltas: valorFI,
      incapacidades: valorINC,
      retardos: valorRE,
      permisos: valorPER,
      total,
      maxTotal,
      porcentaje,
    },
    puntajeCompetencias,
    porcentajeCompetencias,
    calificacionFinal,
    answeredCount,
  };
}

export function recalculateRecordWithRules(
  record: EmployeeEvaluationRecord,
  rules: IncidenceScoringRules,
): EmployeeEvaluationRecord {
  const scores = calculateEvaluationScores(
    record.incidencias,
    record.competencias,
    rules,
  );

  return {
    ...record,
    puntajesIncidencias: scores.puntajesIncidencias,
    puntajeCompetencias: scores.puntajeCompetencias,
    porcentajeCompetencias: scores.porcentajeCompetencias,
    calificacionFinal: scores.calificacionFinal,
  };
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  empleadoId: new Set([
    'codigo',
    'id',
    'clave',
    'empleadoid',
    'noempleado',
    'numeroempleado',
    'numempleado',
    'codigocolaborador',
  ]),
  nombre: new Set([
    'nombre',
    'nombredelcolaborador',
    'nombrecolaborador',
    'colaborador',
    'empleado',
    'nombrecompleto',
  ]),
  fechaIngreso: new Set([
    'hiredate',
    'fechadeingreso',
    'fechaingreso',
    'ingreso',
    'fechaalta',
    'antiguedad',
  ]),
  supervisor: new Set([
    'supervisor',
    'jefedirecto',
    'jefe',
    'evaluador',
    'lider',
    'encargado',
  ]),
  puesto: new Set(['puesto', 'cargo', 'posicion', 'puestodetrabajo']),
  area: new Set([
    'departamento',
    'area',
    'depto',
    'ubicacion',
    'sucursal',
    'planta',
  ]),
  justificacion: new Set(['justificacion', 'motivo', 'concepto', 'tipo']),
  faltas: new Set([
    'fi',
    'faltas',
    'faltasinjustificadas',
    'inasistencias',
    'falta',
  ]),
  incapacidades: new Set([
    'incint',
    'incapacidades',
    'incapacidad',
    'incapacidadesinternas',
    'inc',
  ]),
  retardos: new Set(['re', 'retardos', 'retardo', 'llegadastarde']),
  permisos: new Set([
    'pcgypsg',
    'permisos',
    'permiso',
    'pcg',
    'psg',
    'permisosconysingose',
    'permisosconysingoce',
  ]),
} as const;

type ParsedFieldKey = keyof typeof HEADER_ALIASES;

function matchFieldKey(rawHeader: string): ParsedFieldKey | null {
  const norm = normalizeHeader(rawHeader);
  if (!norm) return null;
  for (const key of Object.keys(HEADER_ALIASES) as ParsedFieldKey[]) {
    if (HEADER_ALIASES[key].has(norm)) {
      return key;
    }
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatExcelDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') {
    return '';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const utcMs = (Math.floor(raw) - 25569) * 86400 * 1000;
    const date = new Date(utcMs);
    if (!Number.isNaN(date.getTime())) {
      return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
    }
    return String(raw);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${pad2(raw.getUTCDate())}/${pad2(raw.getUTCMonth() + 1)}/${raw.getUTCFullYear()}`;
  }
  const str = String(raw).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return str;
}

function parseNonNegativeNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') {
    return 0;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  }
  const cleaned = String(raw).trim().replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function generateRecordId(campaignId: string, rowIndex: number, empleadoId?: string): string {
  if (empleadoId) {
    const safeEmp = empleadoId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeEmp) {
      return `eval_${campaignId}_${safeEmp}_${rowIndex}`;
    }
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `eval_${campaignId}_${crypto.randomUUID()}`;
  }
  return `eval_${campaignId}_${Date.now()}_${rowIndex}`;
}

export function parseEvaluationsExcelBuffer(
  buffer: ArrayBuffer,
  campaignId: string,
  rules: IncidenceScoringRules,
): { records: EmployeeEvaluationRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const records: EmployeeEvaluationRecord[] = [];

  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    warnings.push('El archivo Excel no contiene hojas de cálculo.');
    return { records, warnings };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  if (rawRows.length === 0) {
    warnings.push('La hoja principal está vacía o no contiene filas de colaboradores.');
    return { records, warnings };
  }

  const nowIso = new Date().toISOString();

  rawRows.forEach((rawRow, idx) => {
    const values = Object.values(rawRow);
    const isEmptyRow = values.every((v) => v === null || v === undefined || String(v).trim() === '');
    if (isEmptyRow) {
      return;
    }

    const mapped: Partial<Record<ParsedFieldKey, unknown>> = {};
    for (const [colHeader, cellValue] of Object.entries(rawRow)) {
      const field = matchFieldKey(colHeader);
      if (field && mapped[field] === undefined) {
        mapped[field] = cellValue;
      }
    }

    const nombre = String(mapped.nombre ?? '').trim();
    if (!nombre) {
      warnings.push(`Fila ${idx + 2}: omitida porque no contiene nombre del colaborador.`);
      return;
    }

    const empleadoIdRaw = String(mapped.empleadoId ?? '').trim();
    const empleadoId = empleadoIdRaw || undefined;
    const fechaIngreso = formatExcelDate(mapped.fechaIngreso);
    const supervisor = String(mapped.supervisor ?? '').trim();
    const puesto = String(mapped.puesto ?? '').trim();
    const area = String(mapped.area ?? '').trim();
    const justificacionRaw = String(mapped.justificacion ?? '').trim();
    const justificacion = justificacionRaw || 'Evaluación Anual.';

    const incidencias: EmployeeEvaluationIncidences = {
      faltas: parseNonNegativeNumber(mapped.faltas),
      incapacidades: parseNonNegativeNumber(mapped.incapacidades),
      retardos: parseNonNegativeNumber(mapped.retardos),
      permisos: parseNonNegativeNumber(mapped.permisos),
    };

    const competencias = createEmptyCompetencies();
    const scores = calculateEvaluationScores(incidencias, competencias, rules);

    records.push({
      id: generateRecordId(campaignId, idx + 1, empleadoId),
      campaignId,
      empleadoId,
      nombre,
      fechaIngreso,
      supervisor,
      puesto,
      area,
      justificacion,
      incidencias,
      puntajesIncidencias: scores.puntajesIncidencias,
      competencias,
      puntajeCompetencias: scores.puntajeCompetencias,
      porcentajeCompetencias: scores.porcentajeCompetencias,
      calificacionFinal: scores.calificacionFinal,
      status: 'pendiente',
      actualizadaEn: nowIso,
    });
  });

  return { records, warnings };
}

export async function downloadEvaluationTemplateExcel(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CemenQtime';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Base_Evaluaciones');
  sheet.columns = [
    { header: 'Codigo', key: 'Codigo', width: 12 },
    { header: 'nombre', key: 'nombre', width: 32 },
    { header: 'hireDate', key: 'hireDate', width: 15 },
    { header: 'Supervisor', key: 'Supervisor', width: 26 },
    { header: 'Puesto', key: 'Puesto', width: 24 },
    { header: 'Departamento', key: 'Departamento', width: 22 },
    { header: 'FI', key: 'FI', width: 10 },
    { header: 'INC_Int', key: 'INC_Int', width: 12 },
    { header: 'RE', key: 'RE', width: 10 },
    { header: 'PCGyPSG', key: 'PCGyPSG', width: 12 },
    { header: 'Justificacion', key: 'Justificacion', width: 22 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.addRow({
    Codigo: '1001',
    nombre: 'Ejemplo Colaborador',
    hireDate: '15/03/2021',
    Supervisor: 'Nombre del Supervisor',
    Puesto: 'Operador General',
    Departamento: 'Producción',
    FI: 0,
    INC_Int: 0,
    RE: 1,
    PCGyPSG: 0,
    Justificacion: 'Evaluación Anual.',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'Plantilla_Evaluaciones_Desempeno.xlsx');
}

export async function exportEvaluationsSummaryExcel(
  campaign: EvaluationCampaign,
  records: EmployeeEvaluationRecord[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CemenQtime';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Resumen_Evaluaciones');

  const baseColumns: Partial<ExcelJS.Column>[] = [
    { header: 'Código', key: 'empleadoId', width: 12 },
    { header: 'Colaborador', key: 'nombre', width: 30 },
    { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 14 },
    { header: 'Supervisor', key: 'supervisor', width: 24 },
    { header: 'Puesto', key: 'puesto', width: 22 },
    { header: 'Área', key: 'area', width: 20 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Fecha Evaluación', key: 'fechaEvaluacion', width: 16 },
    { header: 'Evaluado Por', key: 'evaluadoPor', width: 22 },
  ];

  const competencyColumns: Partial<ExcelJS.Column>[] = EVALUATION_COMPETENCIES.map((c) => ({
    header: c.criterio,
    key: `comp_${c.id}`,
    width: 16,
  }));

  const scoreColumns: Partial<ExcelJS.Column>[] = [
    { header: 'Puntaje Comp. (/10)', key: 'puntajeCompetencias', width: 18 },
    { header: '% Competencias', key: 'porcentajeCompetencias', width: 16 },
    { header: INCIDENCE_METRIC_LABELS.faltas.excelCode, key: 'fi', width: 10 },
    { header: 'Valor FI', key: 'valorFi', width: 10 },
    { header: INCIDENCE_METRIC_LABELS.incapacidades.excelCode, key: 'inc', width: 10 },
    { header: 'Valor INC', key: 'valorInc', width: 10 },
    { header: INCIDENCE_METRIC_LABELS.retardos.excelCode, key: 're', width: 10 },
    { header: 'Valor RE', key: 'valorRe', width: 10 },
    { header: INCIDENCE_METRIC_LABELS.permisos.excelCode, key: 'per', width: 12 },
    { header: 'Valor PER', key: 'valorPer', width: 10 },
    { header: 'Total Incidencias', key: 'totalInc', width: 16 },
    { header: '% Incidencias', key: 'porcentajeInc', width: 14 },
    { header: 'Calificación Final (%)', key: 'calificacionFinal', width: 20 },
    { header: 'Comentarios Evaluador', key: 'comentarios', width: 34 },
  ];

  sheet.columns = [...baseColumns, ...competencyColumns, ...scoreColumns];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  for (const record of records) {
    const rowData: Record<string, string | number> = {
      empleadoId: record.empleadoId ?? '',
      nombre: record.nombre,
      fechaIngreso: record.fechaIngreso,
      supervisor: record.supervisor,
      puesto: record.puesto,
      area: record.area,
      status: record.status,
      fechaEvaluacion: record.fechaEvaluacion ?? '',
      evaluadoPor: record.evaluadoPor ?? '',
      puntajeCompetencias: record.puntajeCompetencias,
      porcentajeCompetencias: record.porcentajeCompetencias,
      fi: record.incidencias.faltas,
      valorFi: record.puntajesIncidencias.faltas,
      inc: record.incidencias.incapacidades,
      valorInc: record.puntajesIncidencias.incapacidades,
      re: record.incidencias.retardos,
      valorRe: record.puntajesIncidencias.retardos,
      per: record.incidencias.permisos,
      valorPer: record.puntajesIncidencias.permisos,
      totalInc: `${record.puntajesIncidencias.total}/${record.puntajesIncidencias.maxTotal}`,
      porcentajeInc: record.puntajesIncidencias.porcentaje,
      calificacionFinal: record.calificacionFinal,
      comentarios: record.comentariosEvaluador ?? '',
    };

    for (const comp of EVALUATION_COMPETENCIES) {
      const score = record.competencias[comp.id];
      rowData[`comp_${comp.id}`] = score === null ? '' : score;
    }

    sheet.addRow(rowData);
  }

  const safeName = campaign.nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `Evaluaciones_${safeName || 'Campana'}_${campaign.anioEmision}.xlsx`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCompetencyCell(label: string, isSelected: boolean): string {
  const mark = isSelected ? '<span class="x-mark">X</span>' : '';
  return `<td class="opt-cell${isSelected ? ' selected' : ''}">
    <div class="opt-label">${escapeHtml(label)}</div>
    <div class="opt-box">${mark}</div>
  </td>`;
}

function renderSingleEvaluationPage(
  campaign: EvaluationCampaign,
  record: EmployeeEvaluationRecord,
  logoUrl: string,
  isLast: boolean,
): string {
  const competencyRows = EVALUATION_COMPETENCIES.map((comp) => {
    const score = record.competencias[comp.id];
    const scoreDisplay = score === null ? '' : String(score);
    return `<tr>
      <td class="criterio-cell">${escapeHtml(comp.criterio)}</td>
      <td class="pregunta-cell">${escapeHtml(comp.pregunta)}</td>
      ${renderCompetencyCell(comp.labels['1'], score === 1)}
      ${renderCompetencyCell(comp.labels['0.5'], score === 0.5)}
      ${renderCompetencyCell(comp.labels['0'], score === 0)}
      <td class="score-cell">${escapeHtml(scoreDisplay)}</td>
    </tr>`;
  }).join('\n');

  const incidenceRows = INCIDENCE_KEYS.map((key) => {
    const meta = INCIDENCE_METRIC_LABELS[key];
    const count = record.incidencias[key];
    const score = record.puntajesIncidencias[key];
    return `<tr>
      <td>${escapeHtml(meta.label)}</td>
      <td class="num-cell">${escapeHtml(String(count))}</td>
      <td class="num-cell">${escapeHtml(String(score))}</td>
    </tr>`;
  }).join('\n');

  const evaluatorCommentsHtml = record.comentariosEvaluador?.trim()
    ? `<div class="comments-box">
        <strong>Comentarios del evaluador:</strong>
        <p>${escapeHtml(record.comentariosEvaluador.trim())}</p>
      </div>`
    : '';

  const pageClass = isLast ? 'eval-page eval-page-last' : 'eval-page';

  return `<section class="${pageClass}">
    <table class="header-table">
      <tr>
        <td class="logo-cell" rowspan="2">
          <img src="${escapeHtml(logoUrl)}" alt="Cemenquin" class="logo-img" />
        </td>
        <td class="title-top">FORMATO</td>
        <td class="year-cell" rowspan="2">
          <div class="year-label">AÑO DE EMISIÓN</div>
          <div class="year-value">${escapeHtml(String(campaign.anioEmision))}</div>
        </td>
      </tr>
      <tr>
        <td class="title-main">EVALUACIÓN DE DESEMPEÑO</td>
      </tr>
    </table>

    <table class="meta-table">
      <tr>
        <td colspan="2"><strong>Nombre del colaborador:</strong> ${escapeHtml(record.nombre)}</td>
        <td><strong>Fecha de evaluación:</strong> ${escapeHtml(record.fechaEvaluacion ?? '')}</td>
      </tr>
      <tr>
        <td><strong>Fecha de ingreso:</strong> ${escapeHtml(record.fechaIngreso)}</td>
        <td><strong>Supervisor:</strong> ${escapeHtml(record.supervisor)}</td>
        <td><strong>Puesto:</strong> ${escapeHtml(record.puesto)}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Justificación:</strong> ${escapeHtml(record.justificacion)}</td>
        <td><strong>Área:</strong> ${escapeHtml(record.area)}</td>
      </tr>
    </table>

    <p class="instruction">
      <strong>Instrucciones.</strong> 1.- Marcar con una (X) la casilla según el desempeño del colaborador, anotando el puntaje correspondiente en la última columna evaluación por competencias (50%).
    </p>

    <table class="comp-table">
      <thead>
        <tr>
          <th style="width: 17%;">Criterio</th>
          <th style="width: 38%;">Pregunta</th>
          <th style="width: 12%;">1</th>
          <th style="width: 12%;">0.5</th>
          <th style="width: 12%;">0</th>
          <th style="width: 9%;">Puntaje</th>
        </tr>
      </thead>
      <tbody>
        ${competencyRows}
        <tr class="total-row">
          <td colspan="5" class="total-label">Puntaje total</td>
          <td class="score-cell">${escapeHtml(String(record.puntajeCompetencias))}/10</td>
        </tr>
      </tbody>
    </table>

    <p class="instruction">
      2.- A continuación, aparecerá la suma del puntaje conforme al acumulado de inasistencias, incapacidades internas y retardos durante el año ${escapeHtml(String(campaign.anioIncidencias))}.
    </p>

    <div class="bottom-grid">
      <table class="inc-table">
        <thead>
          <tr>
            <th colspan="3">Incidencias ${escapeHtml(String(campaign.anioIncidencias))} (50%)</th>
          </tr>
          <tr>
            <th>Concepto</th>
            <th>Cantidad</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${incidenceRows}
          <tr class="total-row">
            <td colspan="2" class="total-label">Puntaje total incidencias</td>
            <td class="num-cell">${escapeHtml(String(record.puntajesIncidencias.total))}/${escapeHtml(String(record.puntajesIncidencias.maxTotal))}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary-wrapper">
        <table class="summary-table">
          <thead>
            <tr>
              <th colspan="2">RESUMEN FINAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Evaluación por competencias</td>
              <td class="num-cell">${escapeHtml(String(record.porcentajeCompetencias))}%</td>
            </tr>
            <tr>
              <td>Puntaje total incidencias</td>
              <td class="num-cell">${escapeHtml(String(record.puntajesIncidencias.porcentaje))}%</td>
            </tr>
            <tr class="final-row">
              <td>Calificación final</td>
              <td class="num-cell">${escapeHtml(String(record.calificacionFinal))}%</td>
            </tr>
          </tbody>
        </table>
        <p class="instruction small-note">
          3.- Finalmente, se realizará promedio de la evaluación por competencias y el puntaje total de incidencias.
        </p>
      </div>
    </div>

    ${evaluatorCommentsHtml}

    <div class="signature-block">
      <div class="signature-line">${escapeHtml(record.evaluadoPor ?? '')}</div>
      <div class="signature-label">NOMBRE Y FIRMA DEL EVALUADOR</div>
    </div>
  </section>`;
}

export function buildPrintableEvaluationHtml(
  campaign: EvaluationCampaign,
  records: EmployeeEvaluationRecord[],
  logoUrl = '/assets/cemenquin-eval-logo.png',
): string {
  const pagesHtml = records
    .map((record, index) =>
      renderSingleEvaluationPage(
        campaign,
        record,
        logoUrl,
        index === records.length - 1,
      ),
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Evaluación de Desempeño - ${escapeHtml(campaign.nombre)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.3;
      background: #ffffff;
    }
    .eval-page {
      width: 100%;
      page-break-after: always;
      break-after: page;
      padding-bottom: 6px;
    }
    .eval-page-last {
      page-break-after: auto;
      break-after: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #374151;
      padding: 4px 6px;
      vertical-align: middle;
    }
    .header-table {
      margin-bottom: 8px;
    }
    .logo-cell {
      width: 24%;
      text-align: center;
    }
    .logo-img {
      max-width: 140px;
      max-height: 48px;
      object-fit: contain;
    }
    .title-top {
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      letter-spacing: 0.5px;
      background: #f3f4f6;
    }
    .title-main {
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      color: #1e3a5f;
    }
    .year-cell {
      width: 18%;
      text-align: center;
    }
    .year-label {
      font-size: 9px;
      font-weight: bold;
      color: #4b5563;
    }
    .year-value {
      font-size: 15px;
      font-weight: bold;
      color: #1e3a5f;
    }
    .meta-table {
      margin-bottom: 8px;
      font-size: 10px;
    }
    .instruction {
      margin: 6px 0;
      font-size: 10px;
    }
    .small-note {
      font-size: 9.5px;
      margin-top: 6px;
    }
    .comp-table th {
      background: #1e3a5f;
      color: #ffffff;
      text-align: center;
      font-size: 10px;
    }
    .criterio-cell {
      font-weight: bold;
      font-size: 10px;
    }
    .pregunta-cell {
      font-size: 9.8px;
    }
    .opt-cell {
      text-align: center;
      padding: 3px 4px;
    }
    .opt-cell.selected {
      background: #eff6ff;
    }
    .opt-label {
      font-size: 9px;
      color: #374151;
    }
    .opt-box {
      min-height: 14px;
      font-weight: bold;
      font-size: 11px;
      color: #1e3a5f;
    }
    .x-mark {
      font-weight: bold;
    }
    .score-cell, .num-cell {
      text-align: center;
      font-weight: bold;
    }
    .total-row td {
      background: #f3f4f6;
      font-weight: bold;
    }
    .total-label {
      text-align: right;
    }
    .bottom-grid {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-top: 6px;
    }
    .inc-table {
      width: 52%;
    }
    .inc-table th, .summary-table th {
      background: #1e3a5f;
      color: #ffffff;
      text-align: center;
      font-size: 10px;
    }
    .summary-wrapper {
      width: 48%;
    }
    .final-row td {
      background: #dbeafe;
      font-weight: bold;
      font-size: 11.5px;
    }
    .comments-box {
      margin-top: 8px;
      border: 1px solid #9ca3af;
      padding: 6px 8px;
      font-size: 10px;
    }
    .comments-box p {
      margin: 4px 0 0 0;
      white-space: pre-wrap;
    }
    .signature-block {
      margin-top: 28px;
      text-align: center;
    }
    .signature-line {
      width: 280px;
      min-height: 18px;
      margin: 0 auto 4px auto;
      border-bottom: 1px solid #111827;
      font-size: 10px;
    }
    .signature-label {
      font-weight: bold;
      font-size: 10px;
      letter-spacing: 0.4px;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

export function printEvaluations(
  campaign: EvaluationCampaign,
  records: EmployeeEvaluationRecord[],
): void {
  if (typeof window === 'undefined' || records.length === 0) {
    return;
  }
  const html = buildPrintableEvaluationHtml(campaign, records);
  const printWindow = window.open('', '_blank', 'width=960,height=1100');
  if (!printWindow) {
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// ============================================================================
// Padrón de Empleados -> Campaña de Evaluaciones
// ============================================================================

export function buildRecordsFromEmployeesDirectory(
  empleadosDB: Record<string, Employee>,
  campaignId: string,
  rules: IncidenceScoringRules,
  existingCampaignRecords: EmployeeEvaluationRecord[] = [],
): {
  records: EmployeeEvaluationRecord[];
  addedCount: number;
  updatedCount: number;
} {
  const nowIso = new Date().toISOString();
  const employees = Object.values(empleadosDB || {}).filter(
    emp => emp && (emp.id || emp.nombre),
  );

  const byEmpId = new Map<string, EmployeeEvaluationRecord>();
  const byName = new Map<string, EmployeeEvaluationRecord>();

  existingCampaignRecords.forEach(rec => {
    const normId = normalizeEmployeeId(rec.empleadoId);
    if (normId) byEmpId.set(normId, rec);
    const normName = normalizeSupervisorName(rec.nombre);
    if (normName) byName.set(normName, rec);
  });

  const mergedMap = new Map<string, EmployeeEvaluationRecord>();
  existingCampaignRecords.forEach(rec => mergedMap.set(rec.id, rec));

  let addedCount = 0;
  let updatedCount = 0;

  employees.forEach((emp, idx) => {
    const normId = normalizeEmployeeId(emp.id);
    const normName = normalizeSupervisorName(emp.nombre);
    const existing =
      (normId ? byEmpId.get(normId) : undefined) ||
      (normName ? byName.get(normName) : undefined);

    if (existing) {
      const updated: EmployeeEvaluationRecord = {
        ...existing,
        empleadoId: normId || existing.empleadoId,
        nombre: emp.nombre?.trim() || existing.nombre,
        supervisor: emp.jefe?.trim() || existing.supervisor || 'SIN SUPERVISOR',
        puesto: emp.puesto?.trim() || existing.puesto,
        actualizadaEn: nowIso,
      };
      mergedMap.set(existing.id, updated);
      updatedCount += 1;
      return;
    }

    const incidencias: EmployeeEvaluationIncidences = {
      faltas: 0,
      incapacidades: 0,
      retardos: 0,
      permisos: 0,
    };
    const competencias = createEmptyCompetencies();
    const scores = calculateEvaluationScores(incidencias, competencias, rules);

    const newRec: EmployeeEvaluationRecord = {
      id: `eval_${campaignId}_${normId || idx + 1}_${Date.now()}_${idx}`,
      campaignId,
      empleadoId: normId || undefined,
      nombre: emp.nombre?.trim() || `Empleado ${normId || idx + 1}`,
      fechaIngreso: '',
      supervisor: emp.jefe?.trim() || 'SIN SUPERVISOR',
      puesto: emp.puesto?.trim() || '',
      area: emp.empresa?.trim() || '',
      justificacion: 'Evaluación Anual.',
      incidencias,
      puntajesIncidencias: scores.puntajesIncidencias,
      competencias,
      puntajeCompetencias: scores.puntajeCompetencias,
      porcentajeCompetencias: scores.porcentajeCompetencias,
      calificacionFinal: scores.calificacionFinal,
      status: 'pendiente',
      actualizadaEn: nowIso,
    };
    mergedMap.set(newRec.id, newRec);
    addedCount += 1;
  });

  const records = Array.from(mergedMap.values()).sort((a, b) =>
    a.supervisor.localeCompare(b.supervisor, 'es') ||
    a.nombre.localeCompare(b.nombre, 'es'),
  );

  return { records, addedCount, updatedCount };
}

// ============================================================================
// Analizador y Mapeador Inteligente de Excel (por Columnas o por Claves/Filas)
// ============================================================================

export type ExcelMappingTarget = IncidenceMetricKey | 'ignore';
export type ExcelImportFormatMode = 'columns' | 'codes';

export interface DetectedIncidenceCode {
  code: string;
  count: number;
  totalQty: number;
  suggestedMetric: ExcelMappingTarget;
}

export interface ExcelImportMapping {
  mode: ExcelImportFormatMode;
  employeeIdColumn: string;
  nameColumn: string;
  hireDateColumn: string;
  supervisorColumn: string;
  puestoColumn: string;
  areaColumn: string;
  /** En modo 'columns': qué rubro suma cada columna del Excel */
  columnMetricMap: Record<string, ExcelMappingTarget>;
  /** En modo 'codes': columna que contiene el código/clave (ej. IFNJ, RET, PCG) */
  codeColumn: string;
  /** En modo 'codes': columna numérica opcional con cantidad/días (vacío = 1 por fila) */
  quantityColumn: string;
  /** En modo 'codes': significado asignado por RH a cada código detectado */
  codeMetricMap: Record<string, ExcelMappingTarget>;
}

export interface ExcelSheetAnalysis {
  sheetNames: string[];
  selectedSheet: string;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, unknown>[];
  columnSamples: Record<string, string[]>;
  suggestedMode: ExcelImportFormatMode;
  suggestedMapping: ExcelImportMapping;
  detectedCodes: DetectedIncidenceCode[];
  warnings: string[];
}

export interface ExcelMappingPreviewResult {
  matchedRecords: EmployeeEvaluationRecord[];
  unmatchedRecords: EmployeeEvaluationRecord[];
  /** Lista final lista para guardar en la campaña (incluyendo los del padrón sin cambios en el Excel) */
  finalCampaignRecords: EmployeeEvaluationRecord[];
  matchedCount: number;
  untouchedCount: number;
  unmatchedCount: number;
  warnings: string[];
}

const CODE_DICTIONARY_STORAGE_KEY = 'cemenqtime_eval_excel_code_dict_v1';

export function loadSavedIncidenceCodeDictionary(): Record<string, ExcelMappingTarget> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CODE_DICTIONARY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveIncidenceCodeDictionary(
  entries: Record<string, ExcelMappingTarget>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadSavedIncidenceCodeDictionary();
    const merged: Record<string, ExcelMappingTarget> = { ...prev };
    Object.entries(entries).forEach(([k, v]) => {
      const normKey = normalizeHeader(k);
      if (normKey) merged[normKey] = v;
    });
    window.localStorage.setItem(CODE_DICTIONARY_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore storage quota errors
  }
}

export function guessIncidenceMetricFromToken(
  token: string,
  savedDict?: Record<string, ExcelMappingTarget>,
): ExcelMappingTarget {
  const norm = normalizeHeader(token);
  if (!norm) return 'ignore';

  if (savedDict && savedDict[norm]) {
    return savedDict[norm];
  }

  // Faltas Injustificadas: FI, FINJ, IFNJ, FALTA, FALTAS, INASISTENCIA
  if (
    norm === 'fi' ||
    norm === 'finj' ||
    norm === 'ifnj' ||
    norm === 'falta' ||
    norm === 'faltas' ||
    norm.includes('falta') ||
    norm.includes('ifnj') ||
    norm.includes('finj') ||
    norm.includes('inasistencia') ||
    norm.includes('ausentismo')
  ) {
    return 'faltas';
  }

  // Incapacidades: INC, INC_INT, INCAP, ENF, MAT, RT, ST7
  if (
    norm === 'inc' ||
    norm === 'incint' ||
    norm === 'incap' ||
    norm === 'incapacidad' ||
    norm === 'incapacidades' ||
    norm.startsWith('incap') ||
    norm.includes('incapacidad') ||
    norm === 'enfermedadgeneral' ||
    norm === 'riesgotrabajo' ||
    norm === 'maternidad'
  ) {
    return 'incapacidades';
  }

  // Retardos: RE, RET, RETARDO, RETARDOS, TARDANZA
  if (
    norm === 're' ||
    norm === 'ret' ||
    norm === 'retardo' ||
    norm === 'retardos' ||
    norm.includes('retardo') ||
    norm.includes('tardanza')
  ) {
    return 'retardos';
  }

  // Permisos: PCG, PSG, PCGYPSG, PERM, PERMISO, PERMISOS
  if (
    norm === 'pcg' ||
    norm === 'psg' ||
    norm === 'pcgypsg' ||
    norm === 'pcgpsg' ||
    norm === 'perm' ||
    norm === 'permiso' ||
    norm === 'permisos' ||
    norm.includes('permiso') ||
    norm.includes('congoce') ||
    norm.includes('singoce')
  ) {
    return 'permisos';
  }

  return 'ignore';
}

export function extractUniqueCodesForColumn(
  rows: Record<string, unknown>[],
  codeColumn: string,
  quantityColumn = '',
  savedDict?: Record<string, ExcelMappingTarget>,
): DetectedIncidenceCode[] {
  if (!codeColumn) return [];
  const dict = savedDict ?? loadSavedIncidenceCodeDictionary();
  const map = new Map<string, { display: string; count: number; totalQty: number }>();

  for (const row of rows) {
    const rawCode = String(row[codeColumn] ?? '').trim();
    if (!rawCode) continue;
    const key = rawCode.toUpperCase();
    const qty = quantityColumn
      ? Math.max(0, parseNonNegativeNumber(row[quantityColumn]))
      : 1;
    const effectiveQty = quantityColumn ? qty : 1;

    const current = map.get(key);
    if (current) {
      current.count += 1;
      current.totalQty += effectiveQty;
    } else {
      map.set(key, {
        display: rawCode,
        count: 1,
        totalQty: effectiveQty,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, 'es'))
    .map(item => ({
      code: item.display,
      count: item.count,
      totalQty: round1(item.totalQty),
      suggestedMetric: guessIncidenceMetricFromToken(item.display, dict),
    }));
}

export function analyzeEvaluationsExcelBuffer(
  buffer: ArrayBuffer,
  sheetName?: string,
  savedDict?: Record<string, ExcelMappingTarget>,
): ExcelSheetAnalysis {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return {
      sheetNames: [],
      selectedSheet: '',
      headerRowIndex: 0,
      headers: [],
      rows: [],
      columnSamples: {},
      suggestedMode: 'columns',
      suggestedMapping: {
        mode: 'columns',
        employeeIdColumn: '',
        nameColumn: '',
        hireDateColumn: '',
        supervisorColumn: '',
        puestoColumn: '',
        areaColumn: '',
        columnMetricMap: {},
        codeColumn: '',
        quantityColumn: '',
        codeMetricMap: {},
      },
      detectedCodes: [],
      warnings: ['El archivo Excel no contiene hojas de cálculo.'],
    };
  }

  const selectedSheet =
    sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  // Detectar fila de encabezados dentro de las primeras 10 filas (la que tenga más celdas de texto no vacías)
  let headerRowIndex = 0;
  let bestScore = -1;
  const maxScan = Math.min(matrix.length, 10);
  for (let r = 0; r < maxScan; r++) {
    const row = Array.isArray(matrix[r]) ? matrix[r] : [];
    const nonEmpty = row.filter(cell => String(cell ?? '').trim() !== '');
    const textCells = nonEmpty.filter(cell => typeof cell === 'string');
    const score = nonEmpty.length * 2 + textCells.length;
    if (score > bestScore && nonEmpty.length >= 2) {
      bestScore = score;
      headerRowIndex = r;
    }
  }

  const rawHeaderRow = Array.isArray(matrix[headerRowIndex]) ? matrix[headerRowIndex] : [];
  const usedHeaderNames = new Set<string>();
  const headers: string[] = [];

  rawHeaderRow.forEach((cell, idx) => {
    let base = String(cell ?? '').trim();
    if (!base) base = `Columna_${idx + 1}`;
    let unique = base;
    let suffix = 2;
    while (usedHeaderNames.has(unique)) {
      unique = `${base} (${suffix++})`;
    }
    usedHeaderNames.add(unique);
    headers.push(unique);
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const arr = Array.isArray(matrix[r]) ? matrix[r] : [];
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((h, colIdx) => {
      const val = arr[colIdx] ?? '';
      obj[h] = val;
      if (String(val).trim() !== '') hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }

  const columnSamples: Record<string, string[]> = {};
  headers.forEach(h => {
    const samples: string[] = [];
    for (const row of rows) {
      const val = String(row[h] ?? '').trim();
      if (val && !samples.includes(val)) {
        samples.push(val);
        if (samples.length >= 4) break;
      }
    }
    columnSamples[h] = samples;
  });

  const findCol = (aliases: string[]): string => {
    const normAliases = aliases.map(normalizeHeader);
    for (const h of headers) {
      const nh = normalizeHeader(h);
      if (normAliases.includes(nh)) return h;
    }
    for (const h of headers) {
      const nh = normalizeHeader(h);
      if (normAliases.some(alias => alias.length >= 4 && nh.includes(alias))) return h;
    }
    return '';
  };

  const employeeIdColumn = findCol([
    'codigo',
    'codigo_empleado',
    'codigo_del_empleado',
    'num_empleado',
    'numero_empleado',
    'numero_de_empleado',
    'no_empleado',
    'no_emp',
    'num_emp',
    'clave_empleado',
    'empleadoid',
    'empleado_id',
    'id_empleado',
    'id',
  ]);
  const nameColumn = findCol([
    'nombre',
    'nombre_colaborador',
    'nombre_del_colaborador',
    'nombre_empleado',
    'colaborador',
    'empleado',
  ]);
  const hireDateColumn = findCol([
    'hiredate',
    'hire_date',
    'fecha_ingreso',
    'fecha_de_ingreso',
    'ingreso',
    'fecha_alta',
  ]);
  const supervisorColumn = findCol([
    'supervisor',
    'jefe',
    'jefe_inmediato',
    'evaluador',
    'lider',
    'lista',
  ]);
  const puestoColumn = findCol(['puesto', 'cargo', 'posicion', 'position']);
  const areaColumn = findCol(['departamento', 'area', 'depto', 'department']);

  const codeColumn = findCol([
    'incidencia',
    'tipo_incidencia',
    'clave_incidencia',
    'clave',
    'concepto',
    'tipo',
    'codigo_incidencia',
    'motivo',
  ]);
  const quantityColumn = findCol([
    'cantidad',
    'dias',
    'valor',
    'total',
    'conteo',
    'unidades',
  ]);

  const dict = savedDict ?? loadSavedIncidenceCodeDictionary();
  const metadataCols = new Set(
    [employeeIdColumn, nameColumn, hireDateColumn, supervisorColumn, puestoColumn, areaColumn].filter(Boolean),
  );

  // Construir mapa sugerido para modo columnas
  const columnMetricMap: Record<string, ExcelMappingTarget> = {};
  let detectedMetricColsCount = 0;
  headers.forEach(h => {
    if (metadataCols.has(h)) {
      columnMetricMap[h] = 'ignore';
      return;
    }
    const guess = guessIncidenceMetricFromToken(h, dict);
    columnMetricMap[h] = guess;
    if (guess !== 'ignore') detectedMetricColsCount += 1;
  });

  // Evaluar si el archivo parece ser de formato "claves por fila" (mismo empleado repetido + columna de claves)
  let hasRepeatedEmployees = false;
  if (employeeIdColumn && rows.length > 0) {
    const seen = new Set<string>();
    for (const row of rows) {
      const id = normalizeEmployeeId(String(row[employeeIdColumn] ?? ''));
      if (!id) continue;
      if (seen.has(id)) {
        hasRepeatedEmployees = true;
        break;
      }
      seen.add(id);
    }
  }

  const detectedCodes = codeColumn
    ? extractUniqueCodesForColumn(rows, codeColumn, quantityColumn, dict)
    : [];
  const codeMetricMap: Record<string, ExcelMappingTarget> = {};
  detectedCodes.forEach(item => {
    codeMetricMap[item.code.toUpperCase()] = item.suggestedMetric;
  });

  const suggestedMode: ExcelImportFormatMode =
    codeColumn && (hasRepeatedEmployees || detectedMetricColsCount === 0)
      ? 'codes'
      : 'columns';

  const warnings: string[] = [];
  if (rows.length === 0) {
    warnings.push('No se detectaron filas con datos debajo de los encabezados.');
  }
  if (!employeeIdColumn) {
    warnings.push(
      'No se detectó automáticamente la columna de Número de Empleado. Selecciónala manualmente para cruzar con el padrón.',
    );
  }

  return {
    sheetNames,
    selectedSheet,
    headerRowIndex,
    headers,
    rows,
    columnSamples,
    suggestedMode,
    suggestedMapping: {
      mode: suggestedMode,
      employeeIdColumn,
      nameColumn,
      hireDateColumn,
      supervisorColumn,
      puestoColumn,
      areaColumn,
      columnMetricMap,
      codeColumn,
      quantityColumn,
      codeMetricMap,
    },
    detectedCodes,
    warnings,
  };
}

export function applyExcelMappingToCampaign(
  analysis: ExcelSheetAnalysis,
  mapping: ExcelImportMapping,
  campaignId: string,
  rules: IncidenceScoringRules,
  existingCampaignRecords: EmployeeEvaluationRecord[],
  options: { includeUnmatched?: boolean } = {},
): ExcelMappingPreviewResult {
  const nowIso = new Date().toISOString();
  const warnings: string[] = [];

  if (!mapping.employeeIdColumn && !mapping.nameColumn) {
    return {
      matchedRecords: [],
      unmatchedRecords: [],
      finalCampaignRecords: existingCampaignRecords,
      matchedCount: 0,
      untouchedCount: existingCampaignRecords.length,
      unmatchedCount: 0,
      warnings: ['Debes seleccionar al menos la columna de Número de Empleado.'],
    };
  }

  interface AggregatedEmp {
    empId: string;
    nombre: string;
    fechaIngreso: string;
    supervisor: string;
    puesto: string;
    area: string;
    incidencias: EmployeeEvaluationIncidences;
  }

  const aggregated = new Map<string, AggregatedEmp>();

  analysis.rows.forEach((row, idx) => {
    const rawId = mapping.employeeIdColumn ? String(row[mapping.employeeIdColumn] ?? '').trim() : '';
    const normId = normalizeEmployeeId(rawId);
    const rawName = mapping.nameColumn ? String(row[mapping.nameColumn] ?? '').trim() : '';
    const key = normId || (rawName ? `NAME:${normalizeSupervisorName(rawName)}` : '');
    if (!key) return;

    let entry = aggregated.get(key);
    if (!entry) {
      entry = {
        empId: normId,
        nombre: rawName,
        fechaIngreso: mapping.hireDateColumn ? formatExcelDate(row[mapping.hireDateColumn]) : '',
        supervisor: mapping.supervisorColumn ? String(row[mapping.supervisorColumn] ?? '').trim() : '',
        puesto: mapping.puestoColumn ? String(row[mapping.puestoColumn] ?? '').trim() : '',
        area: mapping.areaColumn ? String(row[mapping.areaColumn] ?? '').trim() : '',
        incidencias: { faltas: 0, incapacidades: 0, retardos: 0, permisos: 0 },
      };
      aggregated.set(key, entry);
    } else {
      if (!entry.nombre && rawName) entry.nombre = rawName;
      if (!entry.fechaIngreso && mapping.hireDateColumn) {
        entry.fechaIngreso = formatExcelDate(row[mapping.hireDateColumn]);
      }
      if (!entry.supervisor && mapping.supervisorColumn) {
        entry.supervisor = String(row[mapping.supervisorColumn] ?? '').trim();
      }
      if (!entry.puesto && mapping.puestoColumn) {
        entry.puesto = String(row[mapping.puestoColumn] ?? '').trim();
      }
      if (!entry.area && mapping.areaColumn) {
        entry.area = String(row[mapping.areaColumn] ?? '').trim();
      }
    }

    if (mapping.mode === 'columns') {
      Object.entries(mapping.columnMetricMap).forEach(([colName, target]) => {
        if (target === 'ignore') return;
        const val = parseNonNegativeNumber(row[colName]);
        if (val > 0) {
          entry!.incidencias[target] = round1(entry!.incidencias[target] + val);
        }
      });
    } else if (mapping.mode === 'codes' && mapping.codeColumn) {
      const rawCode = String(row[mapping.codeColumn] ?? '').trim().toUpperCase();
      if (!rawCode) return;
      const target = mapping.codeMetricMap[rawCode] ?? 'ignore';
      if (target === 'ignore') return;
      const qty = mapping.quantityColumn
        ? parseNonNegativeNumber(row[mapping.quantityColumn])
        : 1;
      if (qty > 0) {
        entry.incidencias[target] = round1(entry.incidencias[target] + qty);
      }
    }

    if (idx < 0) return;
  });

  // Índices del padrón actual de la campaña
  const existingByEmpId = new Map<string, EmployeeEvaluationRecord>();
  const existingByName = new Map<string, EmployeeEvaluationRecord>();
  existingCampaignRecords.forEach(rec => {
    const nid = normalizeEmployeeId(rec.empleadoId);
    if (nid) existingByEmpId.set(nid, rec);
    const nname = normalizeSupervisorName(rec.nombre);
    if (nname) existingByName.set(nname, rec);
  });

  const matchedIds = new Set<string>();
  const matchedRecords: EmployeeEvaluationRecord[] = [];
  const unmatchedRecords: EmployeeEvaluationRecord[] = [];
  const updatedById = new Map<string, EmployeeEvaluationRecord>();
  existingCampaignRecords.forEach(rec => updatedById.set(rec.id, rec));

  let unmatchedIdx = 0;
  aggregated.forEach(item => {
    const existing =
      (item.empId ? existingByEmpId.get(item.empId) : undefined) ||
      (item.nombre ? existingByName.get(normalizeSupervisorName(item.nombre)) : undefined);

    if (existing) {
      const updated = recalculateRecordWithRules(
        {
          ...existing,
          empleadoId: existing.empleadoId || item.empId || undefined,
          fechaIngreso: item.fechaIngreso || existing.fechaIngreso,
          puesto: existing.puesto || item.puesto,
          area: item.area || existing.area,
          incidencias: { ...item.incidencias },
          actualizadaEn: nowIso,
        },
        rules,
      );
      matchedIds.add(existing.id);
      matchedRecords.push(updated);
      updatedById.set(existing.id, updated);
    } else {
      const competencias = createEmptyCompetencies();
      const scores = calculateEvaluationScores(item.incidencias, competencias, rules);
      const created: EmployeeEvaluationRecord = {
        id: `eval_${campaignId}_${item.empId || 'ext'}_${Date.now()}_${unmatchedIdx++}`,
        campaignId,
        empleadoId: item.empId || undefined,
        nombre: item.nombre || `Empleado ${item.empId || unmatchedIdx}`,
        fechaIngreso: item.fechaIngreso,
        supervisor: item.supervisor || 'SIN SUPERVISOR',
        puesto: item.puesto,
        area: item.area,
        justificacion: 'Evaluación Anual.',
        incidencias: { ...item.incidencias },
        puntajesIncidencias: scores.puntajesIncidencias,
        competencias,
        puntajeCompetencias: scores.puntajeCompetencias,
        porcentajeCompetencias: scores.porcentajeCompetencias,
        calificacionFinal: scores.calificacionFinal,
        status: 'pendiente',
        actualizadaEn: nowIso,
      };
      unmatchedRecords.push(created);
      if (options.includeUnmatched) {
        updatedById.set(created.id, created);
      }
    }
  });

  if (unmatchedRecords.length > 0 && !options.includeUnmatched) {
    warnings.push(
      `${unmatchedRecords.length} registro(s) del Excel no coinciden con ningún número de empleado del padrón actual.`,
    );
  }

  const finalCampaignRecords = Array.from(updatedById.values()).sort(
    (a, b) =>
      a.supervisor.localeCompare(b.supervisor, 'es') ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );

  return {
    matchedRecords,
    unmatchedRecords,
    finalCampaignRecords,
    matchedCount: matchedRecords.length,
    untouchedCount: Math.max(0, existingCampaignRecords.length - matchedIds.size),
    unmatchedCount: unmatchedRecords.length,
    warnings,
  };
}

