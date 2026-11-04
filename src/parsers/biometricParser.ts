/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { EventsDB, Employee } from '../types/attendance';
import { normalizeEmployeeId } from '../utils/calendarUtils';
import { ENTRADAS_PRIORIDAD, SALIDAS_PRIORIDAD, timeToMinutes } from '../core/eventsHierarchy';

export interface ParseBiometricResult {
  eventosDB: EventsDB;
  totalEventos: number;
}

/**
 * Extrae fecha ISO ("YYYY-MM-DD") y hora 24h ("HH:MM") de cualquier valor de celda Excel
 * (número serial de Excel, objeto Date, o texto con formato 12h AM/PM o 24h).
 */
export function parseExcelDateTime(rawFechaHora: any): { iso: string; hora: string } | null {
  if (rawFechaHora === null || rawFechaHora === undefined || rawFechaHora === '') {
    return null;
  }

  // 1. Si viene como número serial de Excel
  if (typeof rawFechaHora === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(rawFechaHora);
    if (!excelDate || !excelDate.y) return null;
    const yyyy = String(excelDate.y).padStart(4, '0');
    const mm = String(excelDate.m).padStart(2, '0');
    const dd = String(excelDate.d).padStart(2, '0');
    const hh = String(excelDate.H || 0).padStart(2, '0');
    const min = String(excelDate.M || 0).padStart(2, '0');
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      hora: `${hh}:${min}`
    };
  }

  // 2. Si viene como instancia Date
  if (rawFechaHora instanceof Date && !isNaN(rawFechaHora.getTime())) {
    const yyyy = rawFechaHora.getFullYear();
    const mm = String(rawFechaHora.getMonth() + 1).padStart(2, '0');
    const dd = String(rawFechaHora.getDate()).padStart(2, '0');
    const hh = String(rawFechaHora.getHours()).padStart(2, '0');
    const min = String(rawFechaHora.getMinutes()).padStart(2, '0');
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      hora: `${hh}:${min}`
    };
  }

  // 3. Si viene como cadena de texto
  const str = String(rawFechaHora).trim();
  if (!str) return null;

  // Buscar fecha (DD/MM/YYYY, D/M/YYYY o YYYY-MM-DD)
  const dateMatch = str.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
  if (!dateMatch) return null;

  let iso = '';
  const p1 = dateMatch[1];
  const p2 = dateMatch[2];
  const p3 = dateMatch[3];

  if (p1.length === 4) {
    iso = `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
  } else {
    const year = p3.length === 2 ? `20${p3}` : p3;
    iso = `${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
  }

  // Buscar hora (H:MM, HH:MM, HH:MM:SS) y indicador AM/PM opcional ("a. m.", "p. m.", "am", "pm")
  const resto = str.slice(dateMatch.index! + dateMatch[0].length).trim();
  const timeMatch = resto.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*([ap]\.?\s*m\.?)?/i);
  if (!timeMatch) return null;

  let h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const ampm = (timeMatch[4] || '').toLowerCase();

  if (isNaN(h) || isNaN(m)) return null;

  if (ampm) {
    const isPM = ampm.includes('p');
    const isAM = ampm.includes('a');
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
  }

  const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { iso, hora };
}

/**
 * Parsea el archivo Excel de Eventos / Checadas del reloj biométrico.
 * Conserva tanto las checadas crudas cronológicas como los códigos de evento,
 * evitando que un código RST oculte o descarte entradas/salidas del mismo día.
 */
export async function parseBiometricEventsFile(
  file: File,
  empleadosDB?: Record<string, Employee>
): Promise<ParseBiometricResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

  // 1. Buscar la fila de encabezados
  let headerRowIdx = -1;
  let colCodigoEmpleado = 0;
  let colIdEmpleado = 7;
  let colFechaHora = 15;
  let colCodigoEvento = 19;
  let colDescripcion = 24;

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] || [];
    const joined = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
    if (
      joined.includes('codigoempleado') ||
      joined.includes('fechahoraregistrada') ||
      joined.includes('codigoevento') ||
      joined.includes('fecha')
    ) {
      headerRowIdx = i;
      row.forEach((cell: any, idx: number) => {
        const text = String(cell || '').toLowerCase().trim();
        if (text === 'codigoempleado' || text === 'código' || text === 'codigo') {
          colCodigoEmpleado = idx;
        } else if (text.includes('idempleadoregistrado') || (text.includes('idempleado') && !text.includes('area'))) {
          colIdEmpleado = idx;
        } else if (text.includes('fechahora') || text === 'fecha' || text === 'checada') {
          colFechaHora = idx;
        } else if (text.includes('codigoevento') || text === 'evento') {
          colCodigoEvento = idx;
        } else if (text.includes('descripcionevento') || text === 'descripcion') {
          colDescripcion = idx;
        }
      });
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('No se detectaron los encabezados de eventos/checadas en el archivo Excel.');
  }

  const eventosDB: EventsDB = {};
  let totalEventos = 0;
  let lastValidId = '';

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Resolver ID del empleado probando tanto CodigoEmpleado (col 0) como idEmpleadoRegistrado (col 7)
    const id0 = normalizeEmployeeId(row[colCodigoEmpleado]);
    const id7 = normalizeEmployeeId(row[colIdEmpleado]);

    let id = '';
    if (empleadosDB && Object.keys(empleadosDB).length > 0) {
      if (id7 && empleadosDB[id7]) id = id7;
      else if (id0 && empleadosDB[id0]) id = id0;
      else id = id7 || id0;
    } else {
      id = id7 || id0;
    }

    if (id && !isNaN(Number(id))) {
      lastValidId = id;
    } else if (!id && lastValidId && row[colFechaHora]) {
      // Soportar filas agrupadas donde el Excel omite repetir el ID en la siguiente línea
      id = lastValidId;
    }

    const rawFechaHora = row[colFechaHora];
    if (!id || !rawFechaHora) continue;

    const codigoEvento = String(row[colCodigoEvento] || '').trim().toUpperCase();
    const descripcion = String(row[colDescripcion] || '').trim().toUpperCase();

    // Ignorar registros meramente administrativos de Día de Descanso (DDD) sin checada física
    const esDDD = codigoEvento === 'DDD' || descripcion.includes('DÍA DE DESCANSO') || descripcion.includes('DIA DE DESCANSO');
    if (esDDD) continue;

    const parsedDT = parseExcelDateTime(rawFechaHora);
    if (!parsedDT) continue;

    const { iso, hora: horaStr } = parsedDT;

    const esEntrada = ENTRADAS_PRIORIDAD.hasOwnProperty(codigoEvento);
    const esSalida = SALIDAS_PRIORIDAD.hasOwnProperty(codigoEvento);
    const esRST = codigoEvento === 'RST' || descripcion.includes('REGISTRO SIN TURNO') || (!esEntrada && !esSalida);

    if (!eventosDB[id]) eventosDB[id] = {};
    if (!eventosDB[id][iso]) {
      eventosDB[id][iso] = {
        entradas: {},
        salidas: {},
        rstHoras: [],
        registrosCrudos: [],
        isRST: false,
        ret: false,
        todas: []
      };
    }

    const dia = eventosDB[id][iso];

    // 1. Guardar SIEMPRE en registrosCrudos (evitando duplicados idénticos en el mismo minuto y código)
    const yaExisteExacto = dia.registrosCrudos.some(
      r => r.hora === horaStr && r.codigo === (codigoEvento || 'RST')
    );
    if (!yaExisteExacto) {
      dia.registrosCrudos.push({
        hora: horaStr,
        codigo: codigoEvento || 'RST',
        descripcion
      });
      // Mantener ordenado numéricamente por minutos
      dia.registrosCrudos.sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
    }

    // 2. Clasificar también por tipo de evento (sin que RST destruya entradas/salidas normales)
    if (esEntrada) {
      if (!dia.entradas[codigoEvento]) dia.entradas[codigoEvento] = [];
      if (!dia.entradas[codigoEvento].includes(horaStr)) {
        dia.entradas[codigoEvento].push(horaStr);
      }
      if (codigoEvento === 'ERT') {
        dia.ret = true;
      }
    } else if (esSalida) {
      if (!dia.salidas[codigoEvento]) dia.salidas[codigoEvento] = [];
      if (!dia.salidas[codigoEvento].includes(horaStr)) {
        dia.salidas[codigoEvento].push(horaStr);
      }
    } else if (esRST) {
      dia.isRST = true;
      if (!dia.rstHoras.includes(horaStr)) {
        dia.rstHoras.push(horaStr);
      }
    }

    totalEventos++;
  }

  return { eventosDB, totalEventos };
}
