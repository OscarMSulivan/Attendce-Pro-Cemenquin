/**
 * Tipos y catálogos del módulo de Evaluaciones de Desempeño Anuales (CemenQtime).
 * Los 10 criterios de competencias y sus etiquetas replican el formato oficial
 * Formato_de_desempeño_2023.docx.
 */

export type EvaluationCompetencyId =
  | 'dominio_puesto'
  | 'multifuncionalidad'
  | 'calidad'
  | 'mejora_trabajo'
  | 'responsabilidad'
  | 'trabajo_equipo'
  | 'proactividad'
  | 'compromiso'
  | 'actitud_servicio'
  | 'adaptacion_cambio';

export type CompetencyScore = 1 | 0.5 | 0 | null;

export interface CompetencyDefinition {
  id: EvaluationCompetencyId;
  criterio: string;
  pregunta: string;
  labels: {
    '1': string;
    '0.5': string;
    '0': string;
  };
}

export const EVALUATION_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: 'dominio_puesto',
    criterio: 'Dominio del puesto',
    pregunta: 'Cuenta con los conocimientos necesarios para desempeñar sus funciones',
    labels: { '1': 'Cumple', '0.5': 'Desarrollo', '0': 'No cumple' },
  },
  {
    id: 'multifuncionalidad',
    criterio: 'Multifuncionalidad',
    pregunta: 'Cuenta con la capacidad de cubrir otros puestos (iguales o ascendentes) cuando se requiere',
    labels: { '1': 'Cumple', '0.5': 'Desarrollo', '0': 'No cumple' },
  },
  {
    id: 'calidad',
    criterio: 'Calidad',
    pregunta: '¿Cómo califica la calidad de los trabajos entregados?',
    labels: { '1': 'Bueno', '0.5': 'Regular', '0': 'Malo' },
  },
  {
    id: 'mejora_trabajo',
    criterio: 'Mejora del trabajo',
    pregunta: 'Adquirió nuevas habilidades y conocimientos para aplicar a su trabajo.',
    labels: { '1': 'Realizado', '0.5': 'Inconcluso', '0': 'No se realizó' },
  },
  {
    id: 'responsabilidad',
    criterio: 'Responsabilidad',
    pregunta: 'Cumple con su trabajo en tiempo y forma.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
  {
    id: 'trabajo_equipo',
    criterio: 'Trabajo en equipo',
    pregunta: 'Realiza su parte del trabajo para cumplir en las metas del equipo.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
  {
    id: 'proactividad',
    criterio: 'Proactividad',
    pregunta: 'Toma la iniciativa en la solución de problemas sin que se le solicitara.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
  {
    id: 'compromiso',
    criterio: 'Compromiso',
    pregunta: 'Cuenta con la disponibilidad de trabajar días festivos / tiempo extra cuando se requiere.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
  {
    id: 'actitud_servicio',
    criterio: 'Actitud de servicio',
    pregunta: 'Mantiene un trato cordial y de servicio hacia las personas.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
  {
    id: 'adaptacion_cambio',
    criterio: 'Adaptación al cambio',
    pregunta: 'Acepta realizar diferentes actividades, aunque implique salir de la rutina de su puesto.',
    labels: { '1': 'Siempre', '0.5': 'A veces', '0': 'Nunca' },
  },
];

export type IncidenceMetricKey = 'faltas' | 'incapacidades' | 'retardos' | 'permisos';

export const INCIDENCE_METRIC_LABELS: Record<IncidenceMetricKey, { label: string; excelCode: string }> = {
  faltas: { label: 'Faltas Injustificadas', excelCode: 'FI' },
  incapacidades: { label: 'Incapacidades', excelCode: 'INC_Int' },
  retardos: { label: 'Retardos', excelCode: 'RE' },
  permisos: { label: 'Permisos', excelCode: 'PCGyPSG' },
};

export interface IncidenceRuleBracket {
  min: number;
  max: number | null;
  puntos: number;
}

export type IncidenceScoringRules = Record<IncidenceMetricKey, IncidenceRuleBracket[]>;

export const DEFAULT_INCIDENCE_RULES: IncidenceScoringRules = {
  faltas: [
    { min: 0, max: 0, puntos: 5 },
    { min: 1, max: 1, puntos: 4 },
    { min: 2, max: 2, puntos: 3 },
    { min: 3, max: 3, puntos: 2 },
    { min: 4, max: 4, puntos: 1 },
    { min: 5, max: null, puntos: 0 },
  ],
  incapacidades: [
    { min: 0, max: 0, puntos: 5 },
    { min: 1, max: 1, puntos: 4 },
    { min: 2, max: 2, puntos: 3 },
    { min: 3, max: 3, puntos: 2 },
    { min: 4, max: 4, puntos: 1 },
    { min: 5, max: null, puntos: 0 },
  ],
  retardos: [
    { min: 0, max: 0, puntos: 5 },
    { min: 1, max: 2, puntos: 4 },
    { min: 3, max: 4, puntos: 3 },
    { min: 5, max: 6, puntos: 2 },
    { min: 7, max: 9, puntos: 1 },
    { min: 10, max: null, puntos: 0 },
  ],
  permisos: [
    { min: 0, max: 0, puntos: 5 },
    { min: 1, max: 2, puntos: 4 },
    { min: 3, max: 4, puntos: 3 },
    { min: 5, max: 6, puntos: 2 },
    { min: 7, max: 9, puntos: 1 },
    { min: 10, max: null, puntos: 0 },
  ],
};

export type EvaluationCampaignStatus = 'borrador' | 'activa' | 'cerrada';

export interface EvaluationCampaign {
  id: string;
  nombre: string;
  anioEmision: number;
  anioIncidencias: number;
  status: EvaluationCampaignStatus;
  fechaLimite?: string;
  rules: IncidenceScoringRules;
  creadaPor: string;
  creadaEn: string;
  abiertaEn?: string;
  cerradaEn?: string;
  actualizadaEn?: string;
}

export type EvaluationRecordStatus = 'pendiente' | 'en_progreso' | 'completada';

export interface EmployeeEvaluationIncidences {
  faltas: number;
  incapacidades: number;
  retardos: number;
  permisos: number;
}

export interface EmployeeEvaluationIncidenceScores {
  faltas: number;
  incapacidades: number;
  retardos: number;
  permisos: number;
  total: number;
  maxTotal: number;
  porcentaje: number;
}

export interface EmployeeEvaluationRecord {
  id: string;
  campaignId: string;
  empleadoId?: string;
  nombre: string;
  fechaIngreso: string;
  supervisor: string;
  puesto: string;
  area: string;
  justificacion: string;
  incidencias: EmployeeEvaluationIncidences;
  puntajesIncidencias: EmployeeEvaluationIncidenceScores;
  competencias: Record<EvaluationCompetencyId, CompetencyScore>;
  puntajeCompetencias: number;
  porcentajeCompetencias: number;
  calificacionFinal: number;
  comentariosEvaluador?: string;
  status: EvaluationRecordStatus;
  fechaEvaluacion?: string;
  evaluadoPor?: string;
  evaluadoPorId?: string;
  reabiertaPor?: string;
  actualizadaEn: string;
}

export function createEmptyCompetencies(): Record<EvaluationCompetencyId, CompetencyScore> {
  return {
    dominio_puesto: null,
    multifuncionalidad: null,
    calidad: null,
    mejora_trabajo: null,
    responsabilidad: null,
    trabajo_equipo: null,
    proactividad: null,
    compromiso: null,
    actitud_servicio: null,
    adaptacion_cambio: null,
  };
}
