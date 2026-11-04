/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DayEventStore,
  DaySchedule,
  Employee,
  EmployeeReport,
  EventsDB,
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
  clasificarChecadaUnica,
  elegirHoraMasCercana,
  ENTRADAS_PRIORIDAD,
  filtrarRebotesChecadas,
  SALIDAS_PRIORIDAD,
  sortHoursNumerically,
  timeToMinutes
} from './eventsHierarchy';

/**
 * Obtiene la configuración de horario para un día específico de la semana (0..6).
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
  return config.dias[dayOfWeek] || null;
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
  if (!horarioProgramado) return jornadaBase;

  const entradaMin = timeToMinutes(horarioProgramado.entrada);
  const salidaMin = timeToMinutes(horarioProgramado.salida);
  let diffMin = salidaMin - entradaMin;
  if (diffMin < 0 || horarioProgramado.cruzaMedianoche) {
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
 * Corrige de raíz el problema donde un evento RST descartaba las entradas/salidas normales
 * o acomodaba una checada única de salida en la columna de entrada.
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

    for (const fecha in resultado[empId]) {
      const dia = resultado[empId][fecha];
      const dayOfWeek = getDayOfWeekFromISO(fecha);
      const horarioProgramado = getScheduleForDay(horariosDB, emp?.horario, dayOfWeek);

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
        const posicion = clasificarChecadaUnica(unica, horarioProgramado);
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
      const todasLasHorasEfectivas = efectivas.map(e => e.hora);

      if (modoLectura === 'checadas_reales') {
        // MODO POR CHECADAS REALES (Recomendado):
        // Une todas las checadas del día (incluyendo RST, ENT, SNT, etc.) sin perder ninguna.
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
          // Con 2 checadas efectivas (o sin horario): primera del día = Entrada, última del día = Salida
          dia.entradaFinal = todasLasHorasEfectivas[0];
          dia.salidaFinal = todasLasHorasEfectivas[todasLasHorasEfectivas.length - 1];
        }
      } else {
        // MODO POR JERARQUÍA DE EVENTOS + RESCATE INTELIGENTE DE RST:
        // 1. Buscar entrada con mayor jerarquía oficial (ENT > ERT > EFT > ENC)
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

        // 2. Buscar salida con mayor jerarquía oficial (SNT > SAT > SRC > SNC)
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

        // 3. RESCATE CON RST / CHECADAS RESTANTES:
        // Si falta la Entrada o falta la Salida porque el checador la etiquetó como RST (o como otro código),
        // rescatamos la checada faltante de las checadas efectivas del día.
        if (!entradaSeleccionada && !salidaSeleccionada) {
          entradaSeleccionada = todasLasHorasEfectivas[0];
          salidaSeleccionada = todasLasHorasEfectivas[todasLasHorasEfectivas.length - 1];
        } else if (entradaSeleccionada && !salidaSeleccionada) {
          const minEnt = timeToMinutes(entradaSeleccionada);
          const posteriores = todasLasHorasEfectivas.filter(h => timeToMinutes(h) - minEnt > minutosRebote);
          if (posteriores.length > 0) {
            salidaSeleccionada = elegirHoraMasCercana(posteriores, horarioProgramado?.salida, 'ultima');
          } else {
            // ¿Y si la supuesta "entrada" era en realidad de la tarde y había un RST en la mañana?
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

        // Asegurar que en turnos diurnos la entrada sea anterior a la salida
        if (
          entradaSeleccionada &&
          salidaSeleccionada &&
          !horarioProgramado?.cruzaMedianoche &&
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
  tieneHorarioEmpleado?: boolean
): {
  hNormal: number;
  hExtra: number;
  incidencia: string;
  advertencia: string;
  huerfana: boolean;
  rowClass: ProcessedDay['rowClass'];
} {
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
    let d = m2 - m1;
    if (d < 0) d += 1440; // Cruce de medianoche

    let totalDelDia = d / 60;
    const tiempoComida = horarioProgramado ? (horarioProgramado.comida / 60) : 1.0;

    if (totalDelDia > 6) {
      totalDelDia -= tiempoComida;
    }

    const jornadaEsperada = calcularJornadaEsperadaHrs(horarioProgramado, tiempoComida, jornadaBase);
    hNormal = Math.max(0, Math.min(totalDelDia, jornadaEsperada));
    hExtra = Math.max(0, totalDelDia - jornadaEsperada);
    inc = 'Asistencia';
    cls = 'row-success';

    if (isRST && horarioProgramado) {
      const mSalEsperada = timeToMinutes(horarioProgramado.salida);
      const mSalReal = timeToMinutes(sal);
      let diffMin = mSalReal - mSalEsperada;
      if (diffMin < -720) diffMin += 1440;

      if (diffMin > 40) {
        const hExceso = Math.floor(diffMin / 60);
        const mExceso = diffMin % 60;
        const excesoTexto = hExceso > 0 ? `${hExceso}h ${mExceso}min` : `${mExceso}min`;
        msg = `⏰ Tiempo extra: +${excesoTexto} después de su salida (${horarioProgramado.salida})`;
      }
    } else if (hExtra >= 0.5) {
      msg = `⏰ Tiempo extra detectado (${hExtra.toFixed(2)} hrs)`;
    }
  } else if (tieneEnt !== tieneSal) {
    huerfana = true;
    inc = 'Asistencia';
    cls = 'row-warning';
    const refHorario = horarioProgramado ? ` (Horario: ${horarioProgramado.entrada}-${horarioProgramado.salida})` : '';
    msg = !tieneEnt
      ? `⚠️ Falta checada de entrada${refHorario} — requiere Formato de Checada`
      : `⚠️ Falta checada de salida${refHorario} — requiere Formato de Checada`;
  } else {
    // Sin ninguna de las 2 checadas
    if (isoDate && FESTIVOS_OFICIALES[isoDate]) {
      inc = 'Festivo';
      cls = 'row-default';
    } else if (horarioProgramado === null) {
      inc = 'Descanso';
      cls = 'row-default';
    } else if (horarioProgramado) {
      // Es un día laboral según la programación de horarios y no tiene ninguna de las 2 checadas
      cls = 'row-warning';
      msg = `⚠️ Sin checadas en día laboral (${horarioProgramado.entrada}-${horarioProgramado.salida}) — ¿Generar Formato o es Falta?`;
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

    fechasRango.forEach(isoF => {
      totalDiasAuditoria++;
      const dayOfWeek = getDayOfWeekFromISO(isoF);
      const dayName = NOMBRES_DIAS_CORTO[dayOfWeek];
      const ev: DayEventStore | undefined = eventosDB[emp.id]?.[isoF];
      const vca: string | undefined = vacacionesDB[emp.id]?.[isoF];

      const horarioProgramado = getScheduleForDay(horariosDB, emp.horario, dayOfWeek);
      const esNocturno = !!(horarioProgramado && horarioProgramado.cruzaMedianoche);

      // Obtener todas las checadas crudas de hoy que NO hayan sido consumidas por la salida nocturna de ayer
      const crudosHoy = (ev ? ensureRegistrosCrudos(ev) : []).filter(
        r => !horasConsumidasNocturnas.has(`${emp.id}|${isoF}|${r.hora}`)
      );
      const efectivasHoy = filtrarRebotesChecadas(crudosHoy, minutosRebote);

      let ent = '--:--';
      let sal = '--:--';

      if (esNocturno) {
        // TURNO NOCTURNO (incluso si el checador marcó RST):
        // 1. Entrada hoy por la tarde/noche (>= 14:00, o la última checada disponible de hoy)
        const candidatasNocheHoy = efectivasHoy.filter(r => timeToMinutes(r.hora) >= 14 * 60);
        if (candidatasNocheHoy.length > 0) {
          ent = elegirHoraMasCercana(
            candidatasNocheHoy.map(r => r.hora),
            horarioProgramado?.entrada,
            'ultima'
          );
        } else if (efectivasHoy.length > 0) {
          ent = efectivasHoy[efectivasHoy.length - 1].hora;
        }

        // 2. Salida mañana por la mañana (<= 13:00 del día siguiente)
        const isoSiguiente = addDaysToISO(isoF, 1);
        const evSiguiente = eventosDB[emp.id]?.[isoSiguiente];
        if (evSiguiente) {
          const crudosManana = ensureRegistrosCrudos(evSiguiente).filter(
            r => !horasConsumidasNocturnas.has(`${emp.id}|${isoSiguiente}|${r.hora}`)
          );
          const efectivasManana = filtrarRebotesChecadas(crudosManana, minutosRebote);
          const candidatasManana = efectivasManana.filter(r => timeToMinutes(r.hora) <= 13 * 60);

          if (candidatasManana.length > 0) {
            sal = elegirHoraMasCercana(
              candidatasManana.map(r => r.hora),
              horarioProgramado?.salida,
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
      } else if (efectivasHoy.length > 0) {
        // TURNO DIURNO / NORMAL (con soporte completo para mezclas ENT/SNT + RST)
        if (efectivasHoy.length === 1) {
          // Solo quedó 1 checada hoy: clasificar si es Entrada o Salida
          const unica = efectivasHoy[0];
          const posicion = clasificarChecadaUnica(unica, horarioProgramado);
          if (posicion === 'salida') {
            ent = '--:--';
            sal = unica.hora;
          } else {
            ent = unica.hora;
            sal = '--:--';
          }
        } else {
          // Hay 2 o más checadas hoy: usar las consolidadas si están disponibles y no fueron consumidas,
          // o tomar primera y última de efectivasHoy
          const entCons = ev?.entradaFinal && efectivasHoy.some(r => r.hora === ev.entradaFinal)
            ? ev.entradaFinal
            : null;
          const salCons = ev?.salidaFinal && efectivasHoy.some(r => r.hora === ev.salidaFinal)
            ? ev.salidaFinal
            : null;

          if (entCons && salCons && entCons !== salCons) {
            ent = entCons;
            sal = salCons;
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
        Boolean(emp.horario)
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
      sumExtra += metricas.hExtra;

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
