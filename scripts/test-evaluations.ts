import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import {
  DEFAULT_INCIDENCE_RULES,
  EVALUATION_COMPETENCIES,
  INCIDENCE_METRIC_LABELS,
  createEmptyCompetencies,
  type CompetencyScore,
  type EmployeeEvaluationRecord,
  type EvaluationCampaign,
  type EvaluationCompetencyId,
  type IncidenceScoringRules,
} from '../src/types/evaluations.ts';

import {
  buildPrintableEvaluationHtml,
  calculateEvaluationScores,
  getMetricMaxPoints,
  getRulesMaxTotal,
  parseEvaluationsExcelBuffer,
  recalculateRecordWithRules,
  scoreIncidenceCount,
  buildRecordsFromEmployeesDirectory,
  analyzeEvaluationsExcelBuffer,
  applyExcelMappingToCampaign,
} from '../src/services/evaluationService.ts';

test('1. Equivalencias de incidencias: rangos por defecto, huecos, negativos y NaN', () => {
  // Default max points
  assert.equal(getMetricMaxPoints(DEFAULT_INCIDENCE_RULES.faltas), 5);
  assert.equal(getMetricMaxPoints([]), 0);
  assert.equal(getRulesMaxTotal(DEFAULT_INCIDENCE_RULES), 20);

  // Faltas & Incapacidades: 0->5, 1->4, 2->3, 3->2, 4->1, 5+->0
  assert.equal(scoreIncidenceCount(0, DEFAULT_INCIDENCE_RULES.faltas), 5);
  assert.equal(scoreIncidenceCount(1, DEFAULT_INCIDENCE_RULES.faltas), 4);
  assert.equal(scoreIncidenceCount(2, DEFAULT_INCIDENCE_RULES.faltas), 3);
  assert.equal(scoreIncidenceCount(3, DEFAULT_INCIDENCE_RULES.faltas), 2);
  assert.equal(scoreIncidenceCount(4, DEFAULT_INCIDENCE_RULES.faltas), 1);
  assert.equal(scoreIncidenceCount(5, DEFAULT_INCIDENCE_RULES.faltas), 0);
  assert.equal(scoreIncidenceCount(12, DEFAULT_INCIDENCE_RULES.incapacidades), 0);

  // Retardos & Permisos: 0->5, 1..2->4, 3..4->3, 5..6->2, 7..9->1, 10+->0
  assert.equal(scoreIncidenceCount(0, DEFAULT_INCIDENCE_RULES.retardos), 5);
  assert.equal(scoreIncidenceCount(1, DEFAULT_INCIDENCE_RULES.retardos), 4);
  assert.equal(scoreIncidenceCount(2, DEFAULT_INCIDENCE_RULES.retardos), 4);
  assert.equal(scoreIncidenceCount(3, DEFAULT_INCIDENCE_RULES.retardos), 3);
  assert.equal(scoreIncidenceCount(4, DEFAULT_INCIDENCE_RULES.retardos), 3);
  assert.equal(scoreIncidenceCount(5, DEFAULT_INCIDENCE_RULES.retardos), 2);
  assert.equal(scoreIncidenceCount(6, DEFAULT_INCIDENCE_RULES.retardos), 2);
  assert.equal(scoreIncidenceCount(7, DEFAULT_INCIDENCE_RULES.retardos), 1);
  assert.equal(scoreIncidenceCount(9, DEFAULT_INCIDENCE_RULES.retardos), 1);
  assert.equal(scoreIncidenceCount(10, DEFAULT_INCIDENCE_RULES.retardos), 0);
  assert.equal(scoreIncidenceCount(25, DEFAULT_INCIDENCE_RULES.permisos), 0);

  // Edge cases: negatives, NaN, Infinity, gaps, empty brackets
  assert.equal(scoreIncidenceCount(-1, DEFAULT_INCIDENCE_RULES.faltas), 0);
  assert.equal(scoreIncidenceCount(Number.NaN, DEFAULT_INCIDENCE_RULES.faltas), 0);
  assert.equal(scoreIncidenceCount(Number.POSITIVE_INFINITY, DEFAULT_INCIDENCE_RULES.faltas), 0);
  assert.equal(scoreIncidenceCount(0, []), 0);

  const gappedBrackets = [
    { min: 0, max: 1, puntos: 5 },
    { min: 4, max: null, puntos: 1 },
  ];
  assert.equal(scoreIncidenceCount(1, gappedBrackets), 5);
  assert.equal(scoreIncidenceCount(2, gappedBrackets), 0);
  assert.equal(scoreIncidenceCount(3, gappedBrackets), 0);
  assert.equal(scoreIncidenceCount(4, gappedBrackets), 1);
});

test('2. Cálculo 50/50 de competencias e incidencias y catálogo exacto de 10 criterios', () => {
  assert.equal(EVALUATION_COMPETENCIES.length, 10);
  assert.equal(INCIDENCE_METRIC_LABELS.faltas.excelCode, 'FI');
  assert.equal(INCIDENCE_METRIC_LABELS.incapacidades.excelCode, 'INC_Int');
  assert.equal(INCIDENCE_METRIC_LABELS.retardos.excelCode, 'RE');
  assert.equal(INCIDENCE_METRIC_LABELS.permisos.excelCode, 'PCGyPSG');

  const competencias: Record<EvaluationCompetencyId, CompetencyScore> = {
    dominio_puesto: 1,
    multifuncionalidad: 1,
    calidad: 0.5,
    mejora_trabajo: 1,
    responsabilidad: 1,
    trabajo_equipo: 1,
    proactividad: 0.5,
    compromiso: 1,
    actitud_servicio: 1,
    adaptacion_cambio: 0,
  };
  // Sum = 8.0 / 10 => 80%
  // Incidencias: faltas=1 (4), incapacidades=0 (5), retardos=3 (3), permisos=5 (2) => 14/20 => 70%
  // Final = (80 + 70) / 2 = 75%
  const result = calculateEvaluationScores(
    { faltas: 1, incapacidades: 0, retardos: 3, permisos: 5 },
    competencias,
    DEFAULT_INCIDENCE_RULES,
  );

  assert.equal(result.answeredCount, 10);
  assert.equal(result.puntajeCompetencias, 8);
  assert.equal(result.porcentajeCompetencias, 80);
  assert.equal(result.puntajesIncidencias.faltas, 4);
  assert.equal(result.puntajesIncidencias.incapacidades, 5);
  assert.equal(result.puntajesIncidencias.retardos, 3);
  assert.equal(result.puntajesIncidencias.permisos, 2);
  assert.equal(result.puntajesIncidencias.total, 14);
  assert.equal(result.puntajesIncidencias.maxTotal, 20);
  assert.equal(result.puntajesIncidencias.porcentaje, 70);
  assert.equal(result.calificacionFinal, 75);

  // Partial competencies + zero maxTotal guard
  const partial = createEmptyCompetencies();
  partial.dominio_puesto = 1;
  partial.calidad = 0.5;
  const zeroRules: IncidenceScoringRules = {
    faltas: [],
    incapacidades: [],
    retardos: [],
    permisos: [],
  };
  const partialRes = calculateEvaluationScores(
    { faltas: 0, incapacidades: 0, retardos: 0, permisos: 0 },
    partial,
    zeroRules,
  );
  assert.equal(partialRes.answeredCount, 2);
  assert.equal(partialRes.puntajeCompetencias, 1.5);
  assert.equal(partialRes.porcentajeCompetencias, 15);
  assert.equal(partialRes.puntajesIncidencias.maxTotal, 0);
  assert.equal(partialRes.puntajesIncidencias.porcentaje, 0);
  assert.equal(partialRes.calificacionFinal, 7.5);
});

test('3. Recálculo con nuevas reglas de RH preserva competencias y metadatos del registro', () => {
  const competencias: Record<EvaluationCompetencyId, CompetencyScore> = {
    dominio_puesto: 1,
    multifuncionalidad: 1,
    calidad: 1,
    mejora_trabajo: 1,
    responsabilidad: 1,
    trabajo_equipo: 1,
    proactividad: 1,
    compromiso: 1,
    actitud_servicio: 1,
    adaptacion_cambio: 0.5,
  };
  const initialScores = calculateEvaluationScores(
    { faltas: 2, incapacidades: 0, retardos: 0, permisos: 0 },
    competencias,
    DEFAULT_INCIDENCE_RULES,
  );

  const record: EmployeeEvaluationRecord = {
    id: 'eval-1',
    campaignId: 'camp-2026',
    empleadoId: 'EMP-001',
    nombre: 'Ana López',
    fechaIngreso: '15/03/2021',
    supervisor: 'Carlos Ruiz',
    puesto: 'Analista',
    area: 'Calidad',
    justificacion: 'Evaluación Anual.',
    incidencias: { faltas: 2, incapacidades: 0, retardos: 0, permisos: 0 },
    puntajesIncidencias: initialScores.puntajesIncidencias,
    competencias,
    puntajeCompetencias: initialScores.puntajeCompetencias,
    porcentajeCompetencias: initialScores.porcentajeCompetencias,
    calificacionFinal: initialScores.calificacionFinal,
    comentariosEvaluador: 'Excelente desempeño',
    status: 'completada',
    fechaEvaluacion: '2026-02-10',
    evaluadoPor: 'Carlos Ruiz',
    evaluadoPorId: 'SUP-01',
    actualizadaEn: '2026-02-10T12:00:00.000Z',
  };

  // Stricter RH rule: 2+ faltas => 0 pts instead of 3 pts
  const stricterRules: IncidenceScoringRules = {
    ...DEFAULT_INCIDENCE_RULES,
    faltas: [
      { min: 0, max: 0, puntos: 5 },
      { min: 1, max: 1, puntos: 2 },
      { min: 2, max: null, puntos: 0 },
    ],
  };

  const recalculated = recalculateRecordWithRules(record, stricterRules);

  assert.deepEqual(recalculated.competencias, competencias);
  assert.equal(recalculated.puntajeCompetencias, 9.5);
  assert.equal(recalculated.porcentajeCompetencias, 95);
  assert.equal(recalculated.status, 'completada');
  assert.equal(recalculated.comentariosEvaluador, 'Excelente desempeño');
  assert.equal(recalculated.puntajesIncidencias.faltas, 0);
  assert.equal(recalculated.puntajesIncidencias.total, 15);
  assert.equal(recalculated.puntajesIncidencias.porcentaje, 75);
  assert.equal(recalculated.calificacionFinal, 85);
});

test('4. Parser Excel soporta encabezados Mail Merge, fecha serial DD/MM/YYYY, filas vacías y variantes en español', () => {
  // Excel serial 44927 = 2023-01-01 => 01/01/2023
  const rows = [
    ['Codigo', 'nombre', 'hireDate', 'Supervisor', 'Puesto', 'Departamento', 'FI', 'INC_Int', 'RE', 'PCGyPSG'],
    ['1042', 'Juan Pérez', 44927, 'María Gómez', 'Operador', 'Producción', 1, 0, 2, 3],
    ['', '', '', '', '', '', '', '', '', ''], // empty row should be ignored
    ['1043', 'Laura Díaz', '15/06/2022', 'María Gómez', 'Auxiliar', 'Almacén', 0, 1, 0, 0],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
  const arrayBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const { records, warnings } = parseEvaluationsExcelBuffer(arrayBuf, 'camp-2026', DEFAULT_INCIDENCE_RULES);

  assert.equal(records.length, 2);
  assert.equal(Array.isArray(warnings), true);

  const first = records[0];
  assert.equal(first.campaignId, 'camp-2026');
  assert.equal(first.empleadoId, '1042');
  assert.equal(first.nombre, 'Juan Pérez');
  assert.equal(first.fechaIngreso, '01/01/2023');
  assert.equal(first.supervisor, 'María Gómez');
  assert.equal(first.puesto, 'Operador');
  assert.equal(first.area, 'Producción');
  assert.deepEqual(first.incidencias, { faltas: 1, incapacidades: 0, retardos: 2, permisos: 3 });
  assert.equal(first.puntajesIncidencias.total, 4 + 5 + 4 + 3);
  assert.equal(first.puntajesIncidencias.porcentaje, 80);
  assert.equal(first.status, 'pendiente');
  assert.equal(first.competencias.dominio_puesto, null);

  const second = records[1];
  assert.equal(second.nombre, 'Laura Díaz');
  assert.equal(second.fechaIngreso, '15/06/2022');
  assert.equal(second.incidencias.incapacidades, 1);

  // Spanish header variants (with/without accents)
  const spanishRows = [
    ['Código', 'Nombre del colaborador', 'Fecha de ingreso', 'Jefe directo', 'Puesto', 'Área', 'Faltas Injustificadas', 'Incapacidades', 'Retardos', 'Permisos', 'Justificación'],
    ['2001', 'Pedro Sánchez', '2024-05-10', 'Luis Torres', 'Técnico', 'Mantenimiento', 0, 0, 1, 0, 'Evaluación Anual 2026'],
  ];
  const wbEs = XLSX.utils.book_new();
  const wsEs = XLSX.utils.aoa_to_sheet(spanishRows);
  XLSX.utils.book_append_sheet(wbEs, wsEs, 'Base');
  const bufEs = XLSX.write(wbEs, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsedEs = parseEvaluationsExcelBuffer(bufEs, 'camp-es', DEFAULT_INCIDENCE_RULES);
  assert.equal(parsedEs.records.length, 1);
  assert.equal(parsedEs.records[0].nombre, 'Pedro Sánchez');
  assert.equal(parsedEs.records[0].area, 'Mantenimiento');
  assert.equal(parsedEs.records[0].justificacion, 'Evaluación Anual 2026');
  assert.equal(parsedEs.records[0].incidencias.retardos, 1);
});

test('5. HTML imprimible escapa XSS, marca X en competencias, muestra /20, RESUMEN FINAL, firma y salto de página', () => {
  const campaign: EvaluationCampaign = {
    id: 'camp-2026',
    nombre: 'Evaluación Anual 2026',
    anioEmision: 2026,
    anioIncidencias: 2025,
    status: 'activa',
    rules: DEFAULT_INCIDENCE_RULES,
    creadaPor: 'RH',
    creadaEn: '2026-01-10T00:00:00.000Z',
  };

  const competencias1 = createEmptyCompetencies();
  competencias1.dominio_puesto = 1;
  competencias1.multifuncionalidad = 0.5;
  competencias1.calidad = 0;

  const scores1 = calculateEvaluationScores(
    { faltas: 0, incapacidades: 0, retardos: 0, permisos: 0 },
    competencias1,
    DEFAULT_INCIDENCE_RULES,
  );

  const rec1: EmployeeEvaluationRecord = {
    id: 'r1',
    campaignId: campaign.id,
    nombre: '<script>alert("xss")</script> & "O\'Connor"',
    fechaIngreso: '01/01/2023',
    supervisor: '<b>Jefe</b>',
    puesto: 'Operador',
    area: 'Planta',
    justificacion: 'Evaluación Anual.',
    incidencias: { faltas: 0, incapacidades: 0, retardos: 0, permisos: 0 },
    puntajesIncidencias: scores1.puntajesIncidencias,
    competencias: competencias1,
    puntajeCompetencias: scores1.puntajeCompetencias,
    porcentajeCompetencias: scores1.porcentajeCompetencias,
    calificacionFinal: scores1.calificacionFinal,
    status: 'en_progreso',
    actualizadaEn: '2026-02-01T00:00:00.000Z',
  };

  const rec2: EmployeeEvaluationRecord = {
    ...rec1,
    id: 'r2',
    nombre: 'Segundo Colaborador',
  };

  const html = buildPrintableEvaluationHtml(campaign, [rec1, rec2], '/assets/cemenquin-eval-logo.png');

  // XSS escaping
  assert.equal(html.includes('<script>alert("xss")</script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;O&#39;Connor&quot;'), true);
  assert.equal(html.includes('&lt;b&gt;Jefe&lt;/b&gt;'), true);

  // Required sections and markers
  assert.equal(html.includes('/assets/cemenquin-eval-logo.png'), true);
  assert.equal(html.includes('EVALUACIÓN DE DESEMPEÑO'), true);
  assert.equal(html.includes('2026'), true);
  assert.equal(html.includes('Incidencias 2025'), true);
  assert.equal(html.includes('20/20'), true);
  assert.equal(html.includes('RESUMEN FINAL'), true);
  assert.equal(html.includes('NOMBRE Y FIRMA DEL EVALUADOR'), true);
  assert.equal(html.includes('page-break-after: always'), true);
  assert.equal(html.includes('Segundo Colaborador'), true);

  // Competency X marks present
  assert.match(html, /Cumple[\s\S]*?>X</);
  assert.match(html, /Desarrollo[\s\S]*?>X</);
  assert.match(html, /Malo[\s\S]*?>X</);
});

test('6. Auto-carga de padrón (empleadosDB) a campaña y enlace por número de empleado en modo columnas', () => {
  const empleadosDB = {
    '00967': { id: '00967', nombre: 'Alma Aidee Schlemmer', jefe: 'ALEJANDRO GONZALEZ', puesto: 'Diseñadora' },
    '00615': { id: '00615', nombre: 'Oscar Valenzuela', jefe: 'ADRIAN FLORES', puesto: 'Supervisor' },
  };

  const seeded = buildRecordsFromEmployeesDirectory(empleadosDB, 'camp_2026', DEFAULT_INCIDENCE_RULES);
  assert.equal(seeded.records.length, 2);
  assert.equal(seeded.addedCount, 2);

  // Excel con columnas separadas: No_Emp (sin ceros a la izquierda), IFNJ, PCG, PSG, RET
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['No_Emp', 'IFNJ', 'PCG', 'PSG', 'RET'],
    [967, 2, 1, 2, 3],
    [99999, 1, 0, 0, 0], // no está en el padrón
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Resumen');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const analysis = analyzeEvaluationsExcelBuffer(buf, undefined, {});
  assert.equal(analysis.suggestedMode, 'columns');
  assert.equal(analysis.suggestedMapping.employeeIdColumn, 'No_Emp');
  assert.equal(analysis.suggestedMapping.columnMetricMap['IFNJ'], 'faltas');
  assert.equal(analysis.suggestedMapping.columnMetricMap['PCG'], 'permisos');
  assert.equal(analysis.suggestedMapping.columnMetricMap['PSG'], 'permisos');
  assert.equal(analysis.suggestedMapping.columnMetricMap['RET'], 'retardos');

  const preview = applyExcelMappingToCampaign(
    analysis,
    analysis.suggestedMapping,
    'camp_2026',
    DEFAULT_INCIDENCE_RULES,
    seeded.records,
    { includeUnmatched: false },
  );

  assert.equal(preview.matchedCount, 1);
  assert.equal(preview.untouchedCount, 1);
  assert.equal(preview.unmatchedCount, 1);
  assert.equal(preview.finalCampaignRecords.length, 2);

  const alma = preview.finalCampaignRecords.find(r => r.empleadoId === '00967')!;
  assert.equal(alma.supervisor, 'ALEJANDRO GONZALEZ'); // conserva supervisor del padrón
  assert.equal(alma.incidencias.faltas, 2);
  assert.equal(alma.incidencias.permisos, 3); // PCG (1) + PSG (2) sumados
  assert.equal(alma.incidencias.retardos, 3);
  assert.equal(alma.puntajesIncidencias.faltas, 3); // 2 faltas -> 3 pts
  assert.equal(alma.puntajesIncidencias.permisos, 3); // 3 permisos -> 3 pts
  assert.equal(alma.puntajesIncidencias.retardos, 3); // 3 retardos -> 3 pts
  assert.equal(alma.puntajesIncidencias.incapacidades, 5); // 0 incap -> 5 pts
  assert.equal(alma.puntajesIncidencias.total, 14);
});

test('7. Analizador de Excel en modo claves por fila (ej. IFNJ, RET, VAC) con significado configurable por RH', () => {
  const empleadosDB = {
    '00101': { id: '00101', nombre: 'Carlos Perez', jefe: 'OSCAR VALENZUELA', puesto: 'Operador' },
  };
  const seeded = buildRecordsFromEmployeesDirectory(empleadosDB, 'camp_2026', DEFAULT_INCIDENCE_RULES);

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Codigo', 'Clave', 'Dias'],
    ['101', 'IFNJ', 1],
    ['101', 'IFNJ', 2],
    ['101', 'RET', 1],
    ['101', 'VAC', 5], // vacaciones -> ignorar
    ['101', 'MI_CLAVE_CUSTOM', 2], // RH la mapeará manualmente a 'permisos'
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Detalle');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const analysis = analyzeEvaluationsExcelBuffer(buf, undefined, {});
  assert.equal(analysis.suggestedMode, 'codes');
  assert.equal(analysis.suggestedMapping.codeColumn, 'Clave');
  assert.equal(analysis.suggestedMapping.quantityColumn, 'Dias');
  assert.equal(analysis.suggestedMapping.codeMetricMap['IFNJ'], 'faltas');
  assert.equal(analysis.suggestedMapping.codeMetricMap['RET'], 'retardos');
  assert.equal(analysis.suggestedMapping.codeMetricMap['VAC'], 'ignore');

  // RH asigna manualmente MI_CLAVE_CUSTOM -> permisos
  const customMapping = {
    ...analysis.suggestedMapping,
    codeMetricMap: {
      ...analysis.suggestedMapping.codeMetricMap,
      MI_CLAVE_CUSTOM: 'permisos' as const,
    },
  };

  const preview = applyExcelMappingToCampaign(
    analysis,
    customMapping,
    'camp_2026',
    DEFAULT_INCIDENCE_RULES,
    seeded.records,
  );

  assert.equal(preview.matchedCount, 1);
  const carlos = preview.finalCampaignRecords[0];
  assert.equal(carlos.incidencias.faltas, 3); // 1 + 2 días de IFNJ
  assert.equal(carlos.incidencias.retardos, 1);
  assert.equal(carlos.incidencias.permisos, 2); // MI_CLAVE_CUSTOM
  assert.equal(carlos.incidencias.incapacidades, 0);
});

