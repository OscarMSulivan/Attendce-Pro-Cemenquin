/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Employee } from '../types/attendance';
import { normalizeEmployeeId, normalizeSupervisorName } from '../utils/calendarUtils';

export interface ParseEmployeesResult {
  empleados: Record<string, Employee>;
  count: number;
  jefes: string[];
  modo: 'excel_avanzado' | 'csv_estandar';
}

/**
 * Parsea el archivo de base de empleados (.xlsx, .xls o .csv)
 * con autodetección inteligente de formato (filas dobles de checador o filas estándar).
 */
export async function parseEmployeesFile(file: File): Promise<ParseEmployeesResult> {
  const fileName = file.name.toLowerCase();
  const empleados: Record<string, Employee> = {};

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

    // 1. Buscar fila de encabezado
    let headerRowIdx = -1;
    let headerValues: string[] = [];
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i] || [];
      const joined = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
      if (joined.includes('código') || joined.includes('codigo') || joined.includes('empleado') || joined.includes('supervisor')) {
        headerRowIdx = i;
        headerValues = row.map((c: any) => String(c || '').trim().toLowerCase());
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new Error('No se detectaron los encabezados en la hoja de Excel de empleados.');
    }

    // Comprobar si es el formato de 2 filas por empleado (típico de sistemas de checadas como ZKTeco/Timenet)
    // donde la fila 1 tiene código, nombre y supervisor, y la fila 2 tiene el código de horario.
    const isDoubleRowFormat = rows.length > headerRowIdx + 2 &&
      rows[headerRowIdx + 2] &&
      (rows[headerRowIdx + 1]?.[0] || rows[headerRowIdx + 1]?.[1]);

    if (isDoubleRowFormat) {
      for (let i = headerRowIdx + 1; i < rows.length; i += 2) {
        const row1 = rows[i] || [];
        const row2 = rows[i + 1] || [];

        const rawCodigo = row1[0] ?? row1[1];
        if (!rawCodigo) continue;

        const id = normalizeEmployeeId(rawCodigo);
        // Columna nombre usualmente en [2], supervisor en [25] o buscado por nombre
        const nombre = String(row1[2] || '').trim();
        let supervisor = String(row1[25] || '').trim();

        // Si no está en el índice fijo [25], buscar columna con nombre de supervisor
        if (!supervisor || supervisor.includes('SEMANAL')) {
          for (let col = 15; col < row1.length; col++) {
            const val = String(row1[col] || '').trim();
            if (val && !val.includes('SEMANAL') && isNaN(Number(val)) && val.length > 3) {
              supervisor = val;
              break;
            }
          }
        }

        supervisor = normalizeSupervisorName(supervisor);
        const horario = String(row2[2] || '').trim();
        const tipoHorario = String(row2[10] || '').trim();

        if (id && nombre && supervisor && !supervisor.includes('SEMANAL')) {
          empleados[id] = {
            id,
            nombre,
            jefe: supervisor,
            horario,
            tipoHorario
          };
        }
      }
    } else {
      // Formato estándar de una sola fila
      const colId = headerValues.findIndex(h => h.includes('código') || h.includes('codigo') || h.includes('id'));
      const colNom = headerValues.findIndex(h => h.includes('nombre') || h.includes('empleado'));
      const colSup = headerValues.findIndex(h => h.includes('supervisor') || h.includes('jefe') || h.includes('area'));
      const colHor = headerValues.findIndex(h => h.includes('horario') || h.includes('turno'));

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const id = normalizeEmployeeId(row[colId !== -1 ? colId : 0]);
        const nombre = String(row[colNom !== -1 ? colNom : 1] || '').trim();
        const supervisor = normalizeSupervisorName(String(row[colSup !== -1 ? colSup : 2] || '').trim());
        const horario = colHor !== -1 ? String(row[colHor] || '').trim() : '';

        if (id && nombre) {
          empleados[id] = {
            id,
            nombre,
            jefe: supervisor || 'General',
            horario
          };
        }
      }
    }

    const jefes = [...new Set(Object.values(empleados).map(e => e.jefe))].filter(Boolean).sort();
    return {
      empleados,
      count: Object.keys(empleados).length,
      jefes,
      modo: 'excel_avanzado'
    };

  } else {
    // Modo CSV con PapaParse
    return new Promise((resolve, reject) => {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "ISO-8859-1",
        complete: (results) => {
          try {
            results.data.forEach(row => {
              // Buscar IDs por columnas del checador o genéricas
              const id = normalizeEmployeeId(
                row["DatatbReporte_FechaHoraRegistrada"] ||
                row["CodigoEmpleado"] ||
                row["Codigo"] ||
                row["ID"] ||
                row["id"]
              );
              const nombre = String(row["Text7"] || row["Nombre"] || row["NombreEmpleado"] || "").trim();
              const jefe = normalizeSupervisorName(String(row["Text9"] || row["Supervisor"] || row["Jefe"] || row["Area"] || "").trim());

              if (id && nombre && jefe && !jefe.includes("SEMANAL")) {
                empleados[id] = {
                  id,
                  nombre,
                  jefe,
                  horario: ''
                };
              }
            });

            const jefes = [...new Set(Object.values(empleados).map(e => e.jefe))].filter(Boolean).sort();
            resolve({
              empleados,
              count: Object.keys(empleados).length,
              jefes,
              modo: 'csv_estandar'
            });
          } catch (err) {
            reject(err);
          }
        },
        error: reject
      });
    });
  }
}
