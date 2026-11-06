/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DaySchedule, RawPunchItem } from '../types/attendance';

// Jerarquías de eventos del checador biométrico (1 = máxima prioridad)
export const ENTRADAS_PRIORIDAD: Record<string, number> = {
  'ENT': 1, // Entrada Normal Turno
  'ERT': 2, // Entrada con Retardo Turno
  'EFT': 3, // Entrada Fuera de Turno
  'ENC': 4, // Entrada No Clasificada
};

export const SALIDAS_PRIORIDAD: Record<string, number> = {
  'SNT': 1, // Salida Normal Turno
  'SAT': 2, // Salida Anticipada Turno
  'SRC': 3, // Salida Registro Checador
  'SNC': 4, // Salida No Clasificada
};

/**
 * Convierte "HH:MM" a minutos desde medianoche (0..1439)
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Convierte minutos a "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calcula la distancia mínima en minutos entre dos horas dentro de un reloj circular de 24 horas (0..720).
 * Evita errores cerca de medianoche (ej. entre 23:50 y 00:05 hay 15 minutos, no 1425).
 */
export function circularTimeDiffMinutes(minA: number, minB: number): number {
  const diff = Math.abs(minA - minB);
  return Math.min(diff, 1440 - diff);
}

/**
 * Normaliza inteligentemente un horario diario para prevenir inversiones entre Entrada y Salida:
 * 1. Corrige errores de captura AM/PM en turnos matutinos/diurnos (ej. Entrada 08:00 y Salida 05:00 -> 17:00, o Salida 01:00 -> 13:00).
 * 2. Corrige inversiones accidentales en turnos diurnos (ej. capturar Entrada 17:00 y Salida 08:00 cuando la diferencia nocturna sería >13.5h).
 * 3. Activa o desactiva automáticamente `cruzaMedianoche` según las horas reales para que:
 *    - Un turno diurno (08:00 a 17:00) NUNCA sea tratado como nocturno aunque la casilla haya quedado marcada por error.
 *    - Un turno nocturno real (ej. 22:00 a 06:00, 21:00 a 05:00, 19:00 a 07:00) SIEMPRE sea detectado como nocturno aunque hayan olvidado marcar la casilla.
 */
export function normalizarHorarioDia(horario: DaySchedule | null | undefined): DaySchedule | null {
  if (!horario || !horario.entrada || !horario.salida) return null;

  let minEnt = timeToMinutes(horario.entrada);
  let minSal = timeToMinutes(horario.salida);
  const comida = typeof horario.comida === 'number' ? horario.comida : 60;

  // Caso 1: Entrada en la mañana (05:00 a 11:59) y Salida capturada en formato 12h (01:00 a 07:59, menor o igual a la entrada)
  // Ejemplo real: Entrada 08:00 y Salida 05:00 (queriendo decir 5:00 PM = 17:00) o Sábado 08:00 a 01:00 (1:00 PM = 13:00).
  if (minEnt >= 5 * 60 && minEnt < 12 * 60 && minSal >= 1 * 60 && minSal <= 7 * 60 + 59 && minSal <= minEnt) {
    minSal += 12 * 60;
    return {
      entrada: minutesToTime(minEnt),
      salida: minutesToTime(minSal),
      comida,
      cruzaMedianoche: false,
    };
  }

  // Caso 2: Si la hora de salida es mayor que la de entrada en el mismo día (ej. 08:00 a 17:00, 06:00 a 14:00, 14:00 a 22:00),
  // jamás cruza medianoche. Forzar cruzaMedianoche = false evita que el motor invierta Entrada (17:00) y Salida (08:00).
  if (minSal > minEnt) {
    return {
      entrada: minutesToTime(minEnt),
      salida: minutesToTime(minSal),
      comida,
      cruzaMedianoche: false,
    };
  }

  // Caso 3: minSal <= minEnt (ej. 22:00 a 06:00, o captura invertida 17:00 a 08:00)
  const duracionSiCruzaMedianocheMin = 1440 - minEnt + minSal;
  const duracionSiInvertidoDiurnoMin = minEnt - minSal;

  // Si cruzando medianoche daría una jornada irreal (> 13.5 horas, ej. 17:00 a 08:00 = 15 hrs)
  // pero como turno diurno (08:00 a 17:00 = 9 hrs) es una jornada normal de 5 a 12 horas en horario de día:
  if (
    duracionSiCruzaMedianocheMin > 13.5 * 60 &&
    minSal >= 5 * 60 &&
    minSal <= 11 * 60 &&
    minEnt >= 13 * 60 &&
    minEnt <= 20 * 60 &&
    duracionSiInvertidoDiurnoMin >= 5 * 60 &&
    duracionSiInvertidoDiurnoMin <= 12 * 60
  ) {
    // El usuario capturó la Salida en el campo de Entrada y la Entrada en el campo de Salida
    return {
      entrada: minutesToTime(minSal),
      salida: minutesToTime(minEnt),
      comida,
      cruzaMedianoche: false,
    };
  }

  // Es un turno nocturno legítimo que cruza medianoche (ej. 22:00 a 06:00, 21:00 a 05:00, 19:00 a 07:00, 16:00 a 00:30)
  return {
    entrada: minutesToTime(minEnt),
    salida: minutesToTime(minSal),
    comida,
    cruzaMedianoche: true,
  };
}

/**
 * Ordena una lista de horas "HH:MM" numéricamente (evita el bug donde "17:00" < "8:00")
 */
export function sortHoursNumerically(horas: string[]): string[] {
  return horas
    .slice()
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/**
 * Filtra checadas repetidas ("rebote" en el reloj checador) dentro de una ventana de minutos.
 * Si hay dos checadas con pocos minutos de diferencia (ej. 08:00 ENT y 08:02 RST),
 * conserva la que tenga código clasificado (ENT/SNT) sobre RST, o la primera.
 */
export function filtrarRebotesChecadas(
  registros: RawPunchItem[],
  ventanaMinutos = 15
): RawPunchItem[] {
  if (!registros || registros.length === 0) return [];

  const ordenados = registros
    .slice()
    .sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));

  const resultado: RawPunchItem[] = [];

  for (const actual of ordenados) {
    if (resultado.length === 0) {
      resultado.push(actual);
      continue;
    }

    const previo = resultado[resultado.length - 1];
    const diff = Math.abs(timeToMinutes(actual.hora) - timeToMinutes(previo.hora));

    if (diff <= ventanaMinutos) {
      // Es un rebote en la misma ventana de tiempo.
      // Si el previo era RST y el actual sí tiene código de Entrada/Salida oficial, preferimos el oficial
      const previoEsRST = previo.codigo === 'RST' || (!ENTRADAS_PRIORIDAD[previo.codigo] && !SALIDAS_PRIORIDAD[previo.codigo]);
      const actualEsOficial = Boolean(ENTRADAS_PRIORIDAD[actual.codigo] || SALIDAS_PRIORIDAD[actual.codigo]);
      if (previoEsRST && actualEsOficial) {
        resultado[resultado.length - 1] = actual;
      }
    } else {
      resultado.push(actual);
    }
  }

  return resultado;
}

/**
 * Cuando en todo el día solo existe UNA checada física (checada huérfana),
 * determina inteligentemente si corresponde a una ENTRADA o a una SALIDA
 * para no acomodarla en la columna equivocada.
 */
export function clasificarChecadaUnica(
  punch: RawPunchItem,
  horarioProgramado: DaySchedule | null,
  horarioReferenciaEmpleado?: DaySchedule | null
): 'entrada' | 'salida' {
  const minPunch = timeToMinutes(punch.hora);
  const refHorario = normalizarHorarioDia(horarioProgramado || horarioReferenciaEmpleado || null);

  // 1. Si el empleado tiene horario programado ese día (o horario de referencia en su semana),
  // comparar cercanía circular de 24h contra Entrada vs Salida
  if (refHorario) {
    const minEnt = timeToMinutes(refHorario.entrada);
    const minSal = timeToMinutes(refHorario.salida);
    const diffEnt = circularTimeDiffMinutes(minPunch, minEnt);
    const diffSal = circularTimeDiffMinutes(minPunch, minSal);
    if (diffSal !== diffEnt) {
      return diffSal < diffEnt ? 'salida' : 'entrada';
    }
  }

  // 2. Si no tiene horario pero el checador la etiquetó explícitamente como Salida o Entrada
  if (SALIDAS_PRIORIDAD[punch.codigo]) return 'salida';
  if (ENTRADAS_PRIORIDAD[punch.codigo]) return 'entrada';

  // 3. Si es RST sin horario asignado: antes de las 13:00 es Entrada, de 13:00 en adelante es Salida
  return minPunch >= 13 * 60 ? 'salida' : 'entrada';
}

/**
 * De una lista de horas ("HH:MM") con el mismo código de evento,
 * elige la más cercana a la horaObjetivo programada usando distancia circular de 24h.
 * Si no hay horario, usa la primera o la última según preferencia.
 */
export function elegirHoraMasCercana(
  horas: string[],
  horaObjetivo: string | null | undefined,
  preferenciaSinHorario: 'primera' | 'ultima' = 'primera'
): string {
  if (!horas || horas.length === 0) return '';
  const ordenadas = sortHoursNumerically(horas);
  if (ordenadas.length === 1) return ordenadas[0];

  if (!horaObjetivo) {
    return preferenciaSinHorario === 'primera' ? ordenadas[0] : ordenadas[ordenadas.length - 1];
  }

  const objetivoMin = timeToMinutes(horaObjetivo);
  let mejor = preferenciaSinHorario === 'ultima' ? ordenadas[ordenadas.length - 1] : ordenadas[0];
  let menorDiff = Infinity;

  ordenadas.forEach(h => {
    const min = timeToMinutes(h);
    const diff = circularTimeDiffMinutes(min, objetivoMin);
    if (diff < menorDiff || (diff === menorDiff && preferenciaSinHorario === 'ultima')) {
      menorDiff = diff;
      mejor = h;
    }
  });

  return mejor;
}

/**
 * Evalúa la hora de entrada real contra la hora programada y tolerancias
 */
export function evaluarHoraEntrada(
  horaReal: string,
  horaEsperada: string,
  toleranciaAntes = 29,
  toleranciaDespues = 14
): { status: 'puntual' | 'retardo' | 'falta' | 'temprano'; minutosDiff: number } {
  const minutosEsperados = timeToMinutes(horaEsperada);
  const minutosReales = timeToMinutes(horaReal);
  const diferencia = minutosReales - minutosEsperados;

  if (diferencia >= -toleranciaAntes && diferencia <= 0) {
    return { status: 'puntual', minutosDiff: 0 };
  }
  if (diferencia > 0 && diferencia <= toleranciaDespues) {
    return { status: 'retardo', minutosDiff: diferencia };
  }
  if (diferencia > toleranciaDespues) {
    return { status: 'falta', minutosDiff: diferencia };
  }
  if (diferencia < -toleranciaAntes) {
    return { status: 'temprano', minutosDiff: Math.abs(diferencia) };
  }
  return { status: 'puntual', minutosDiff: 0 };
}
