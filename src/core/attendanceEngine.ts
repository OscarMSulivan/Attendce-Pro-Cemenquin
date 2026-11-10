/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DayEventStore,
  DaySchedule,
  DEFAULT_OVERTIME_RULES,
  Employee,
  EmployeeReport,
  EventsDB,
  OvertimeRulesConfig,
  PayrollSummary,
  ProcessedDay,
  RawPunchItem,
  ReadingMode,
  ScheduleConfig
} from '../types/attendance';
import {
  addDaysToISO,
  FESTIVOS_OFICIALES,
  getDateRangeISO,
  getDayOfWeekFromISO,
  NOMBRES_DIAS_CORTO
} from '../utils/calendarUtils';
import {
  circularTimeDiffMinutes,
  clasificarChecadaUnica,
  elegirHoraMasCercana,
  ENTRADAS_PRIORIDAD,
  filtrarRebotesChecadas,
  normalizarHorarioDia,
  SALIDAS_PRIORIDAD,
  sortHoursNumerically,
  timeToMinutes
} from './eventsHierarchy';

/**
 * Obtiene la configuración de horario normalizada para un día específico de la semana (0..6).
 * Si el empleado aún no tiene un código de horario personalizado en el catálogo,
 * enlaza con el horario base programado ('ADMO' o el primero activo) para detectar días laborales y checadas faltantes.
 */
export function getScheduleForDay(
  horariosDB: Record<string, ScheduleConfig>,
  scheduleCode: string | undefined,
  dayOfWeek: number
): DaySchedule | null {
  const effectiveCode = (scheduleCode && horariosDB[scheduleCode])
    ? scheduleCode
    : (horariosDB['ADMO'] ? 'ADMO' : Object.keys(horariosDB)[0]);
  if (!effectiveCode || !horariosDB[effectiveCode]) return null;
  const config = horariosDB[effectiveCode];
  if (!config.dias) return null;
  return normalizarHorarioDia(config.dias[dayOfWeek] || null);
}

/**
 * Obtiene un día de horario de referencia del empleado (el primer día activo de su semana programada).
 * Sirve para saber si un empleado es de turno nocturno o diurno incluso en sus días de descanso (ej. Sábado o Domingo).
 */
export function getReferenceScheduleForEmployee(
  horariosDB: Record<string, ScheduleConfig>,
  scheduleCode: string | undefined
): DaySchedule | null {
  const effectiveCode = (scheduleCode && horariosDB[scheduleCode])
    ? scheduleCode
    : (horariosDB['ADMO'] ? 'ADMO' : Object.keys(horariosDB)[0]);
  if (!effectiveCode || !horariosDB[effectiveCode]) return null;
  const config = horariosDB[effectiveCode];
  if (!config.dias) return null;
  for (let i = 1; i <= 6; i++) {
    if (config.dias[i]) return normalizarHorarioDia(config.dias[i]);
  }
  if (config.dias[0]) return normalizarHorarioDia(config.dias[0]);
  return null;
}

/**
 * Determina si una checada (en minutos) pertenece al bloque de Entrada nocturna o al bloque de Salida matutina
 * de un horario que cruza medianoche.
 */
function esChecadaDeEntradaNocturna(horaStr: string, horarioNocturno: DaySchedule): boolean {
  const minPunch = timeToMinutes(horaStr);
  const minEnt = timeToMinutes(horarioNocturno.entrada);
  const minSal = timeToMinutes(horarioNocturno.salida);
  const diffEnt = circularTimeDiffMinutes(minPunch, minEnt);
  const diffSal = circularTimeDiffMinutes(minPunch, minSal);
  if (diffEnt !== diffSal) {
    return diffEnt < diffSal;
  }
  return minPunch >= 14 * 60;
}

/**
 * Calcula la jornada esperada en horas a partir del horario programado,
 * soportando turnos normales y turnos que cruzan medianoche.
 */
export function calcularJornadaEsperadaHrs(
  horarioProgramado: DaySchedule | null,
  tiempoComidaHrs: number,
  jornadaBase = 8.0
): number {
  const norm = normalizarHorarioDia(horarioProgramado);
  if (!norm) return jornadaBase;

  const entradaMin = timeToMinutes(norm.entrada);
  const salidaMin = timeToMinutes(norm.salida);
  let diffMin = salidaMin - entradaMin;
  if (diffMin <= 0 || norm.cruzaMedianoche) {
    diffMin += 1440; // Cruce de medianoche: suma 24 horas
  }

  const horas = (diffMin / 60) - tiempoComidaHrs;
  return Math.max(0, horas);
}

/**
 * Garantiza que un DayEventStore tenga su lista `registrosCrudos` completa y ordenada,
 * incluso si proviene de un respaldo anterior.
 */
function ensureRegistrosCrudos(dia: DayEventStore): RawPunchItem[] {
  if (dia.registrosCrudos && dia.registrosCrudos.length > 0) {
    return dia.registrosCrudos
      .slice()
      .sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
  }

  const reconstruidos: RawPunchItem[] = [];
  const agregar = (hora: string, codigo: string) => {
    if (!hora || hora === '--:--') return;
    if (!reconstruidos.some(r => r.hora === hora && r.codigo === codigo)) {
      reconstruidos.push({ hora, codigo });
    }
  };

  Object.keys(dia.entradas || {}).forEach(cod => {
    (dia.entradas[cod] || []).forEach(h => agregar(h, cod));
  });
  Object.keys(dia.salidas || {}).forEach(cod => {
    (dia.salidas[cod] || []).forEach(h => agregar(h, cod));
  });
  (dia.rstHoras || []).forEach(h => agregar(h, 'RST'));
  if (reconstruidos.length === 0 && dia.todas) {
    dia.todas.forEach(h => agregar(h, dia.isRST ? 'RST' : 'CHE'));
  }

  reconstruidos.sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
  dia.registrosCrudos = reconstruidos;
  return reconstruidos;
}

export interface ConsolidateOptions {
  modoLectura?: ReadingMode;
  minutosRebote?: number;
}

/**
 * Consolida los eventos biométricos por empleado.
 * Corrige de raíz el problema donde un evento RST descartaba las entradas/salidas normales,
 * acomodaba una checada única de salida en la columna de entrada, o invertía Entrada y Salida.
 */
export function consolidarEventosConHorarios(
  eventosDB: EventsDB,
  empleadosDB: Record<string, Employee>,
  horariosDB: Record<string, ScheduleConfig>,
  options: ConsolidateOptions = {}
): EventsDB {
  const modoLectura: ReadingMode = options.modoLectura ?? 'checadas_reales';
  const minutosRebote = options.minutosRebote ?? 15;
  const resultado: EventsDB = JSON.parse(JSON.stringify(eventosDB));

  for (const empId in resultado) {
    const emp = empleadosDB[empId];
    const horarioRef = getReferenceScheduleForEmployee(horariosDB, emp?.horario);

    for (const fecha in resultado[empId]) {
      const dia = resultado[empId][fecha];
      const dayOfWeek = getDayOfWeekFromISO(fecha);
      const horarioProgramado = getScheduleForDay(horariosDB, emp?.horario, dayOfWeek);
      const refDia = horarioProgramado || horarioRef;

      const crudos = ensureRegistrosCrudos(dia);
      const efectivas = filtrarRebotesChecadas(crudos, minutosRebote);

      if (efectivas.length === 0) {
        dia.entradaFinal = null;
        dia.salidaFinal = null;
        dia.todas = [];
        continue;
      }

      // CASO 1: Solo hay 1 checada física efectiva en todo el día (checada huérfana)
      if (efectivas.length === 1) {
        const unica = efectivas[0];
        const posicion = clasificarChecadaUnica(unica, horarioProgramado, horarioRef);
        if (posicion === 'salida') {
          dia.entradaFinal = null;
          dia.salidaFinal = unica.hora;
        } else {
          dia.entradaFinal = unica.hora;
          dia.salidaFinal = null;
        }
        dia.todas = [unica.hora];
        continue;
      }

      // CASO 2: Hay 2 o más checadas efectivas en el día
      const todasLasHorasEfectivas = sortHoursNumerically(efectivas.map(e => e.hora));
      const esNocturno = Boolean(refDia && refDia.cruzaMedianoche);

      if (esNocturno && refDia) {
        // En un turno nocturno (ej. Entrada 22:00, Salida 06:00), las checadas de la noche son Entrada
        // y las checadas de la mañana son Salida (jamás poner 06:00 como Entrada y 22:00 como Salida).
        const candidatasEnt = todasLasHorasEfectivas.filter(h => esChecadaDeEntradaNocturna(h, refDia));
        const candidatasSal = todasLasHorasEfectivas.filter(h => !esChecadaDeEntradaNocturna(h, refDia));

        dia.entradaFinal = candidatasEnt.length > 0
          ? elegirHoraMasCercana(candidatasEnt, refDia.entrada, 'ultima')
          : null;
        dia.salidaFinal = candidatasSal.length > 0
          ? elegirHoraMasCercana(candidatasSal, refDia.salida, 'primera')
          : null;
      } else if (modoLectura === 'checadas_reales') {
        // MODO POR CHECADAS REALES (Turnos diurnos / vespertinos):
        if (horarioProgramado && !horarioProgramado.cruzaMedianoche && efectivas.length > 2) {
          // Si hay más de 2 checadas (ej. checó comida), elegir entrada cercana al inicio y salida cercana al fin
          const candidatasEnt = todasLasHorasEfectivas.slice(0, -1);
          const entElegida = elegirHoraMasCercana(candidatasEnt, horarioProgramado.entrada, 'primera');
          const minEnt = timeToMinutes(entElegida);
          const candidatasSal = todasLasHorasEfectivas.filter(h => timeToMinutes(h) > minEnt);
          const salElegida = candidatasSal.length > 0
            ? elegirHoraMasCercana(candidatasSal, horarioProgramado.salida, 'ultima')
            : todasLasHorasEfectivas[todasLasHorasEfectivas.length - 1];

          dia.entradaFinal = entElegida;
          dia.salidaFinal = salElegida;
        } else {
          // Con 2 checadas efectivas en turno diurno: primera del día = Entrada, última del día = Salida
          dia.entradaFinal = todasLasHorasEfectivas[0];
          dia.salidaFinal = todasLasHorasEfectivas[todasLasHorasEfectivas.length - 1];
        }
      } else {
        // MODO POR JERARQUÍA DE EVENTOS + RESCATE INTELIGENTE DE RST:
        let entradaSeleccionada: string | null = null;
        let mejorPrioridadEntrada = 999;

        for (const codigo in dia.entradas) {
          const prioridad = ENTRADAS_PRIORIDAD[codigo] ?? 99;
          if (prioridad < mejorPrioridadEntrada && dia.entradas[codigo]?.length > 0) {
            mejorPrioridadEntrada = prioridad;
            entradaSeleccionada = elegirHoraMasCercana(
              dia.entradas[codigo],
              horarioProgramado?.entrada,
              'primera'
            );
          }
        }

        let salidaSeleccionada: string | null = null;
        let mejorPrioridadSalida = 999;

        for (const codigo in dia.salidas) {
          const prioridad = SALIDAS_PRIORIDAD[codigo] ?? 99;
          if (prioridad < mejorPrioridadSalida && dia.salidas[codigo]?.length > 0) {
            mejorPrioridadSalida = prioridad;
            salidaSeleccionada = elegirHoraMasCercana(
              dia.salidas[codigo],
              horarioProgramado?.salida,
              'ultima'
            );
          }
        }

        // RESCATE CON RST / CHECADAS RESTANTES:
        if (!entradaSeleccionada && !salidaSeleccionada) {
          entradaSeleccionada = todasLasHorasEfectivas[0];
          salidaSeleccionada = todasLasHorasEfectivas[todasLasHorasEfectivas.length - 1];
        } else if (entradaSeleccionada && !salidaSeleccionada) {
          const minEnt = timeToMinutes(entradaSeleccionada);
          const posteriores = todasLasHorasEfectivas.filter(h => timeToMinutes(h) - minEnt > minutosRebote);
          if (posteriores.length > 0) {
            salidaSeleccionada = elegirHoraMasCercana(posteriores, horarioProgramado?.salida, 'ultima');
          } else {
            const anteriores = todasLasHorasEfectivas.filter(h => minEnt - timeToMinutes(h) > minutosRebote);
            if (anteriores.length > 0) {
              salidaSeleccionada = entradaSeleccionada;
              entradaSeleccionada = elegirHoraMasCercana(anteriores, horarioProgramado?.entrada, 'primera');
            }
          }
        } else if (!entradaSeleccionada && salidaSeleccionada) {
          const minSal = timeToMinutes(salidaSeleccionada);
          const anteriores = todasLasHorasEfectivas.filter(h => minSal - timeToMinutes(h) > minutosRebote);
          if (anteriores.length > 0) {
            entradaSeleccionada = elegirHoraMasCercana(anteriores, horarioProgramado?.entrada, 'primera');
          } else {
            const posteriores = todasLasHorasEfectivas.filter(h => timeToMinutes(h) - minSal > minutosRebote);
            if (posteriores.length > 0) {
              entradaSeleccionada = salidaSeleccionada;
              salidaSeleccionada = elegirHoraMasCercana(posteriores, horarioProgramado?.salida, 'ultima');
            }
          }
        }

        // Asegurar que en turnos diurnos la entrada sea siempre anterior a la salida
        if (
          entradaSeleccionada &&
          salidaSeleccionada &&
          !esNocturno &&
          timeToMinutes(entradaSeleccionada) > timeToMinutes(salidaSeleccionada)
        ) {
          const temp = entradaSeleccionada;
          entradaSeleccionada = salidaSeleccionada;
          salidaSeleccionada = temp;
        }

        dia.entradaFinal = entradaSeleccionada;
        dia.salidaFinal = salidaSeleccionada;
      }

      dia.todas = [];
      if (dia.entradaFinal) dia.todas.push(dia.entradaFinal);
      if (dia.salidaFinal && dia.salidaFinal !== dia.entradaFinal) {
        dia.todas.push(dia.salidaFinal);
      }
    }
  }

  return resultado;
}

/**
 * Aplica las reglas de redondeo y tope diario sobre los minutos de tiempo extra computables.
 */
function aplicarRedondeoYTopeExtra(
  minutosExtraRaw: number,
  rules: OvertimeRulesConfig
): number {
  if (minutosExtraRaw <= 0 || minutosExtraRaw < (rules.minutosMinimosParaExtra ?? 30)) {
    return 0;
  }

  let minutosComputables =
    rules.modoCalculoExtra === 'despues_del_umbral'
      ? Math.max(0, minutosExtraRaw - (rules.minutosMinimosParaExtra ?? 30))
      : minutosExtraRaw;

  switch (rules.redondeoExtra) {
    case '15_min':
      minutosComputables = Math.floor(minutosComputables / 15) * 15;
      break;
    case '30_min':
      minutosComputables = Math.floor(minutosComputables / 30) * 30;
      break;
    case '60_min':
      minutosComputables = Math.floor(minutosComputables / 60) * 60;
      break;
    case 'exacto':
    default:
      break;
  }

  let horasExtra = Number((minutosComputables / 60).toFixed(2));
  if (rules.topeMaximoExtraDiarioHrs && rules.topeMaximoExtraDiarioHrs > 0) {
    horasExtra = Math.min(horasExtra, rules.topeMaximoExtraDiarioHrs);
  }
  return Math.max(0, horasExtra);
}

/**
 * Calcula las horas normales, horas extras, incidencia y advertencias de un día
 * a partir de una hora de entrada y salida dadas.
 * Se utiliza tanto en el cálculo automático como cuando el usuario edita manualmente una hora en la tabla.
 */
export function calcularMetricasDia(
  ent: string,
  sal: string,
  horarioProgramado: DaySchedule | null,
  jornadaBase = 8.0,
  isRST = false,
  vca?: string,
  isoDate?: string,
  tieneHorarioEmpleado?: boolean,
  overtimeRules?: OvertimeRulesConfig
): {
  hNormal: number;
  hExtra: number;
  incidencia: string;
  advertencia: string;
  huerfana: boolean;
  rowClass: ProcessedDay['rowClass'];
} {
  const rules: OvertimeRulesConfig = {
    ...DEFAULT_OVERTIME_RULES,
    ...(overtimeRules || {}),
  };
  const normHorario = normalizarHorarioDia(horarioProgramado);
  let hNormal = 0;
  let hExtra = 0;
  let inc = '';
  let msg = '';
  let huerfana = false;
  let cls: ProcessedDay['rowClass'] = 'row-default';

  const tieneEnt = ent !== '--:--' && Boolean(ent);
  const tieneSal = sal !== '--:--' && Boolean(sal);

  if (tieneEnt && tieneSal) {
    const m1 = timeToMinutes(ent);
    const m2 = timeToMinutes(sal);
    let m1Efectiva = m1;

    // Si tiene horario programado y llegó antes de su hora de entrada (ej. 10 min antes),
    // aplicar la regla para NO contar llegada anticipada como tiempo extra.
    if (normHorario && rules.ignorarEntradaAnticipada) {
      const mEntProgramada = timeToMinutes(normHorario.entrada);
      let minAntesDeEntrada = mEntProgramada - m1;
      if (minAntesDeEntrada < -720) minAntesDeEntrada += 1440;
      if (minAntesDeEntrada > 720) minAntesDeEntrada -= 1440;

      if (minAntesDeEntrada > 0) {
        const superaUmbralAnticipado =
          rules.permitirExtraAntesEntradaConUmbral &&
          minAntesDeEntrada >= (rules.minutosMinimosAntesEntrada || 60);

        if (!superaUmbralAnticipado) {
          m1Efectiva = mEntProgramada;
        }
      }
    }

    let d = m2 - m1Efectiva;
    if (d < 0) d += 1440; // Cruce de medianoche
    // Si el colaborador entró temprano pero también salió antes de la hora de entrada programada, evitar desborde de 24h
    if (m1Efectiva !== m1 && d > 12 * 60 && !normHorario?.cruzaMedianoche) {
      d = 0;
    }

    let totalDelDia = d / 60;
    const tiempoComida = normHorario ? (normHorario.comida / 60) : 1.0;

    if (totalDelDia > 6) {
      totalDelDia -= tiempoComida;
    }

    const esDiaDescanso = normHorario === null;

    if (esDiaDescanso) {
      const rawExtraMin = Math.max(0, Math.round(totalDelDia * 60));
      hExtra = aplicarRedondeoYTopeExtra(rawExtraMin, rules);
      hNormal = 0;
      inc = 'Descanso';
      cls = 'row-success';
      msg =
        hExtra > 0
          ? `⭐ El empleado laboró en su día de descanso (+${hExtra.toFixed(2)} hrs)`
          : `⭐ Checada en día de descanso (${Math.round(totalDelDia * 60)} min, menor al mínimo de ${rules.minutosMinimosParaExtra} min para extra)`;
    } else {
      const jornadaEsperada = calcularJornadaEsperadaHrs(normHorario, tiempoComida, jornadaBase);
      hNormal = Math.max(0, Math.min(totalDelDia, jornadaEsperada));
      const rawExtraMin = Math.max(0, Math.round((totalDelDia - jornadaEsperada) * 60));
      hExtra = aplicarRedondeoYTopeExtra(rawExtraMin, rules);
      inc = 'Asistencia';
      cls = 'row-success';

      if (hExtra > 0) {
        if (isRST && normHorario) {
          const mSalEsperada = timeToMinutes(normHorario.salida);
          const mSalReal = timeToMinutes(sal);
          let diffMin = mSalReal - mSalEsperada;
          if (diffMin < -720) diffMin += 1440;
          if (diffMin > 0) {
            const hExceso = Math.floor(diffMin / 60);
            const mExceso = diffMin % 60;
            const excesoTexto = hExceso > 0 ? `${hExceso}h ${mExceso}min` : `${mExceso}min`;
            msg = `⏰ Tiempo extra: +${excesoTexto} después de su salida (${normHorario.salida}) · Computable: ${hExtra.toFixed(2)} hrs`;
          } else {
            msg = `⏰ Tiempo extra detectado (${hExtra.toFixed(2)} hrs)`;
          }
        } else {
          msg = `⏰ Tiempo extra detectado (${hExtra.toFixed(2)} hrs)`;
        }
      }
    }
  } else if (tieneEnt !== tieneSal) {
    if (normHorario === null) {
      // Checada en día de descanso
      huerfana = false;
      inc = 'Descanso';
      cls = 'row-warning';
      msg = `⭐ Checada registrada en día de descanso (${tieneEnt ? `Entrada ${ent}` : `Salida ${sal}`})`;
    } else {
      huerfana = true;
      inc = 'Asistencia';
      cls = 'row-warning';
      const refHorario = ` (Horario: ${normHorario.entrada}-${normHorario.salida})`;
      msg = !tieneEnt
        ? `⚠️ Falta checada de entrada${refHorario} — requiere Formato de Checada`
        : `⚠️ Falta checada de salida${refHorario} — requiere Formato de Checada`;
    }
  } else {
    // Sin ninguna de las 2 checadas
    if (isoDate && FESTIVOS_OFICIALES[isoDate]) {
      inc = 'Festivo';
      cls = 'row-default';
      msg = '';
    } else if (normHorario === null) {
      inc = 'Descanso';
      cls = 'row-default';
      msg = '';
    } else if (normHorario) {
      // Es un día laboral según la programación de horarios y no tiene ninguna de las 2 checadas
      cls = 'row-warning';
      msg = `⚠️ Sin checadas en día laboral (${normHorario.entrada}-${normHorario.salida}) — ¿Generar Formato o es Falta?`;
    }
  }

  // Aplicar vacaciones/permisos omitiendo cualquier texto de Falta Injustificada (FINJ)
  const vcaClean = (vca || '').trim();
  const vcaUpper = vcaClean.toUpperCase();
  const esFINJ =
    vcaUpper === 'FINJ' ||
    vcaUpper.includes('FALTA') ||
    vcaUpper === 'FI';

  if (vcaClean && !esFINJ) {
    inc = vcaUpper.includes('VAC') ? 'Vacaciones' : vcaClean;
    cls = 'row-default';
    msg = '';
    huerfana = false;
  }

  return {
    hNormal,
    hExtra,
    incidencia: inc,
    advertencia: msg,
    huerfana,
    rowClass: cls
  };
}

export interface EngineRunOptions {
  jornadaBase?: number; // default: 8.0
  modoLectura?: ReadingMode;
  minutosRebote?: number;
  overtimeRules?: OvertimeRulesConfig;
}

/**
 * Motor central de asistencia: calcula los días, horas normales/extras, incidencias
 * y alertas para la lista de empleados en el periodo solicitado.
 */
export function generarReporteAsistencia(
  empleados: Employee[],
  eventosDB: EventsDB,
  vacacionesDB: Record<string, Record<string, string>>,
  horariosDB: Record<string, ScheduleConfig>,
  startISO: string,
  endISO: string,
  options: EngineRunOptions = {}
): {
  reportes: EmployeeReport[];
  resumen: PayrollSummary;
} {
  const jornadaBase = options.jornadaBase ?? 8.0;
  const minutosRebote = options.minutosRebote ?? 15;
  const fechasRango = getDateRangeISO(startISO, endISO);

  // Registro temporal de checadas específicas ("empId|isoDate|hora") ya usadas como salida
  // de un turno nocturno del día anterior para no duplicarlas al día siguiente.
  const horasConsumidasNocturnas = new Set<string>();

  const reportes: EmployeeReport[] = [];
  const resumen: PayrollSummary = {
    totalHoras: 0,
    totalHorasExtra: 0,
    totalFaltas: 0,
    totalVac: 0,
    totalRetardos: 0,
    totalRetardosExcesivos: 0,
    totalEmpleados: empleados.length,
    tasaCumplimiento: 100,
    promedioHoras: 0,
    asistenciasPerfectas: 0,
    incidenciasConteo: {}
  };

  let totalDiasAuditoria = 0;

  empleados.forEach(emp => {
    let sumNormal = 0;
    let sumExtra = 0;
    let countAsistencia = 0;
    let countFalta = 0;
    let countRetardo = 0;

    const diasProcesados: ProcessedDay[] = [];
    const horarioRefEmpleado = getReferenceScheduleForEmployee(horariosDB, emp.horario);

    // Pre-verificar si el primer día del rango (startISO) tiene una checada matutina de salida
    // que pertenece al turno nocturno iniciado la noche anterior (startISO - 1).
    if (fechasRango.length > 0 && horarioRefEmpleado?.cruzaMedianoche) {
      const primeraFecha = fechasRango[0];
      const prevFecha = addDaysToISO(primeraFecha, -1);
      const evPrev = eventosDB[emp.id]?.[prevFecha];
      const evPrimera = eventosDB[emp.id]?.[primeraFecha];
      const evSegunda = fechasRango.length > 1 ? eventosDB[emp.id]?.[fechasRango[1]] : undefined;

      if (evPrimera) {
        const crudosPrimera = ensureRegistrosCrudos(evPrimera);
        const efectivasPrimera = filtrarRebotesChecadas(crudosPrimera, minutosRebote);
        const salidasMananaPrimera = efectivasPrimera.filter(
          r => !esChecadaDeEntradaNocturna(r.hora, horarioRefEmpleado)
        );
        const entradasNochePrimera = efectivasPrimera.filter(
          r => esChecadaDeEntradaNocturna(r.hora, horarioRefEmpleado)
        );

        const prevTuvoEntradaNoche = evPrev
          ? filtrarRebotesChecadas(ensureRegistrosCrudos(evPrev), minutosRebote).some(r =>
              esChecadaDeEntradaNocturna(r.hora, horarioRefEmpleado)
            )
          : false;

        const segundaTieneSalidaManana = evSegunda
          ? filtrarRebotesChecadas(ensureRegistrosCrudos(evSegunda), minutosRebote).some(
              r => !esChecadaDeEntradaNocturna(r.hora, horarioRefEmpleado)
            )
          : false;

        // Si el día previo tuvo entrada nocturna, o si el primer día tiene tanto salida matutina (06:00)
        // como entrada nocturna (22:00) y el segundo día tiene su propia salida matutina (06:00),
        // la salida matutina del primer día corresponde al cierre del turno de la noche anterior.
        if (salidasMananaPrimera.length > 0 && (prevTuvoEntradaNoche || (entradasNochePrimera.length > 0 && segundaTieneSalidaManana))) {
          const salConsumida = elegirHoraMasCercana(
            salidasMananaPrimera.map(r => r.hora),
            horarioRefEmpleado.salida,
            'primera'
          );
          crudosPrimera.forEach(r => {
            if (Math.abs(timeToMinutes(r.hora) - timeToMinutes(salConsumida)) <= minutosRebote) {
              horasConsumidasNocturnas.add(`${emp.id}|${primeraFecha}|${r.hora}`);
            }
          });
        }
      }
    }

    fechasRango.forEach(isoF => {
      totalDiasAuditoria++;
      const dayOfWeek = getDayOfWeekFromISO(isoF);
      const dayName = NOMBRES_DIAS_CORTO[dayOfWeek];
      const ev: DayEventStore | undefined = eventosDB[emp.id]?.[isoF];
      const vca: string | undefined = vacacionesDB[emp.id]?.[isoF];

      const horarioProgramado = getScheduleForDay(horariosDB, emp.horario, dayOfWeek);

      // Obtener todas las checadas crudas de hoy que NO hayan sido consumidas por la salida nocturna de ayer
      const crudosHoy = (ev ? ensureRegistrosCrudos(ev) : []).filter(
        r => !horasConsumidasNocturnas.has(`${emp.id}|${isoF}|${r.hora}`)
      );
      const efectivasHoy = filtrarRebotesChecadas(crudosHoy, minutosRebote);

      // Determinar si este día opera como turno nocturno:
      // 1) Porque el horario programado de hoy cruza medianoche, o
      // 2) Porque el empleado es de turno nocturno (horarioRefEmpleado.cruzaMedianoche) y entró en la noche de un día de descanso (ej. Domingo 22:00 para amanecer Lunes 06:00)
      const horarioNocturnoActivo: DaySchedule | null =
        horarioProgramado && horarioProgramado.cruzaMedianoche
          ? horarioProgramado
          : !horarioProgramado &&
            horarioRefEmpleado?.cruzaMedianoche &&
            efectivasHoy.some(r => esChecadaDeEntradaNocturna(r.hora, horarioRefEmpleado))
          ? horarioRefEmpleado
          : null;

      const esNocturno = Boolean(horarioNocturnoActivo);

      let ent = '--:--';
      let sal = '--:--';

      if (esNocturno && horarioNocturnoActivo) {
        // TURNO NOCTURNO (ej. Entrada 22:00, Salida 06:00):
        // 1. Entrada hoy por la tarde/noche (cercana a horarioNocturnoActivo.entrada).
        // JAMÁS colocar una checada matutina (ej. 06:00 AM) en la columna de Entrada.
        const candidatasNocheHoy = efectivasHoy.filter(r =>
          esChecadaDeEntradaNocturna(r.hora, horarioNocturnoActivo)
        );
        const candidatasMananaHoy = efectivasHoy.filter(
          r => !esChecadaDeEntradaNocturna(r.hora, horarioNocturnoActivo)
        );

        if (candidatasNocheHoy.length > 0) {
          ent = elegirHoraMasCercana(
            candidatasNocheHoy.map(r => r.hora),
            horarioNocturnoActivo.entrada,
            'ultima'
          );
        }

        // 2. Buscar Salida en la mañana del día siguiente (isoF + 1)
        const isoSiguiente = addDaysToISO(isoF, 1);
        const evSiguiente = eventosDB[emp.id]?.[isoSiguiente];
        if (evSiguiente && ent !== '--:--') {
          const crudosManana = ensureRegistrosCrudos(evSiguiente).filter(
            r => !horasConsumidasNocturnas.has(`${emp.id}|${isoSiguiente}|${r.hora}`)
          );
          const efectivasManana = filtrarRebotesChecadas(crudosManana, minutosRebote);
          const candidatasMananaSig = efectivasManana.filter(
            r => !esChecadaDeEntradaNocturna(r.hora, horarioNocturnoActivo)
          );

          if (candidatasMananaSig.length > 0) {
            sal = elegirHoraMasCercana(
              candidatasMananaSig.map(r => r.hora),
              horarioNocturnoActivo.salida,
              'primera'
            );
            // Marcar esa checada matutina de mañana (y sus rebotes cercanos) como consumida
            crudosManana.forEach(r => {
              if (Math.abs(timeToMinutes(r.hora) - timeToMinutes(sal)) <= minutosRebote) {
                horasConsumidasNocturnas.add(`${emp.id}|${isoSiguiente}|${r.hora}`);
              }
            });
          }
        }

        // 3. Respaldo si no hubo checada matutina en isoF + 1 (ej. último día del archivo Excel cargado,
        // o día donde solo quedó registrada la salida matutina en la misma fecha):
        // Si hoy hay una checada matutina no consumida (ej. 06:00 AM), colocarla SIEMPRE en Salida (`sal`), nunca en Entrada.
        if (sal === '--:--' && candidatasMananaHoy.length > 0) {
          sal = elegirHoraMasCercana(
            candidatasMananaHoy.map(r => r.hora),
            horarioNocturnoActivo.salida,
            'primera'
          );
        }
      } else if (efectivasHoy.length > 0) {
        // TURNO DIURNO / VESPERTINO NORMAL (con soporte completo para mezclas ENT/SNT + RST)
        if (efectivasHoy.length === 1) {
          // Solo quedó 1 checada hoy: clasificar si es Entrada o Salida comparando con su horario
          const unica = efectivasHoy[0];
          const posicion = clasificarChecadaUnica(unica, horarioProgramado, horarioRefEmpleado);
          if (posicion === 'salida') {
            ent = '--:--';
            sal = unica.hora;
          } else {
            ent = unica.hora;
            sal = '--:--';
          }
        } else {
          // Hay 2 o más checadas hoy: usar las consolidadas si están disponibles y en orden cronológico,
          // o tomar primera y última de efectivasHoy
          const entCons = ev?.entradaFinal && efectivasHoy.some(r => r.hora === ev.entradaFinal)
            ? ev.entradaFinal
            : null;
          const salCons = ev?.salidaFinal && efectivasHoy.some(r => r.hora === ev.salidaFinal)
            ? ev.salidaFinal
            : null;

          if (entCons && salCons && entCons !== salCons) {
            if (timeToMinutes(entCons) <= timeToMinutes(salCons)) {
              ent = entCons;
              sal = salCons;
            } else {
              ent = salCons;
              sal = entCons;
            }
          } else {
            const horasOrdenadas = sortHoursNumerically(efectivasHoy.map(r => r.hora));
            ent = horasOrdenadas[0];
            sal = horasOrdenadas[horasOrdenadas.length - 1];
          }
        }
      }

      const metricas = calcularMetricasDia(
        ent,
        sal,
        horarioProgramado,
        jornadaBase,
        Boolean(ev?.isRST),
        vca,
        isoF,
        Boolean(emp.horario),
        options.overtimeRules
      );

      if (vca) {
        resumen.totalVac++;
      }

      if (metricas.incidencia === 'Asistencia') {
        countAsistencia++;
      } else if (metricas.incidencia.toUpperCase().includes('FALTA')) {
        countFalta++;
        resumen.totalFaltas++;
      } else if (metricas.incidencia.toUpperCase().includes('RETARDO')) {
        countRetardo++;
        resumen.totalRetardos++;
        if (metricas.incidencia.toUpperCase().includes('EXCESIVO')) {
          resumen.totalRetardosExcesivos++;
        }
      }

      sumNormal += metricas.hNormal;
      // El total de horas extras empieza en 0 y se suma conforme se van autorizando los días de tiempo extra
      sumExtra += 0;

      if (metricas.incidencia) {
        resumen.incidenciasConteo[metricas.incidencia] =
          (resumen.incidenciasConteo[metricas.incidencia] || 0) + 1;
      }

      diasProcesados.push({
        isoDate: isoF,
        dayName,
        dayOfWeek,
        entrada: ent,
        salida: sal,
        entradaOriginal: ent,
        salidaOriginal: sal,
        hNormal: metricas.hNormal,
        hExtra: metricas.hExtra,
        incidencia: metricas.incidencia,
        advertencia: metricas.advertencia,
        huerfana: metricas.huerfana,
        rowClass: metricas.rowClass,
        horarioProgramado,
        registrosCrudosDia: crudosHoy
      });
    });

    const esPerfecta = countFalta === 0 && countRetardo === 0 && countAsistencia > 0;
    if (esPerfecta) {
      resumen.asistenciasPerfectas++;
    }

    resumen.totalHoras += sumNormal;
    resumen.totalHorasExtra += sumExtra;

    reportes.push({
      empleado: emp,
      dias: diasProcesados,
      totalNormal: sumNormal,
      totalExtra: sumExtra,
      asistencias: countAsistencia,
      faltas: countFalta,
      retardos: countRetardo,
      asistenciaPerfecta: esPerfecta
    });
  });

  if (empleados.length > 0) {
    resumen.promedioHoras = Number((resumen.totalHoras / empleados.length).toFixed(2));
    const tasaFaltas = (resumen.totalFaltas / Math.max(1, totalDiasAuditoria)) * 100;
    resumen.tasaCumplimiento = Number(Math.max(0, 100 - tasaFaltas).toFixed(1));
  }

  return { reportes, resumen };
}
