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
  horarioProgramado: DaySchedule | null
): 'entrada' | 'salida' {
  const minPunch = timeToMinutes(punch.hora);

  // 1. Si el empleado tiene horario programado ese día, comparar cercanía contra Entrada vs Salida
  if (horarioProgramado) {
    const minEnt = timeToMinutes(horarioProgramado.entrada);
    const minSal = timeToMinutes(horarioProgramado.salida);
    const diffEnt = Math.abs(minPunch - minEnt);
    const diffSal = Math.abs(minPunch - minSal);
    return diffSal < diffEnt ? 'salida' : 'entrada';
  }

  // 2. Si no tiene horario pero el checador la etiquetó explícitamente como Salida o Entrada
  if (SALIDAS_PRIORIDAD[punch.codigo]) return 'salida';
  if (ENTRADAS_PRIORIDAD[punch.codigo]) return 'entrada';

  // 3. Si es RST sin horario asignado: antes de las 13:00 es Entrada, de 13:00 en adelante es Salida
  return minPunch >= 13 * 60 ? 'salida' : 'entrada';
}

/**
 * De una lista de horas ("HH:MM") con el mismo código de evento,
 * elige la más cercana a la horaObjetivo programada.
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
  let mejor = ordenadas[0];
  let menorDiff = Infinity;

  ordenadas.forEach(h => {
    const min = timeToMinutes(h);
    const diff = Math.abs(min - objetivoMin);
    if (diff < menorDiff) {
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
