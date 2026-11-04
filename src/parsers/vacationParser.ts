/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { normalizeEmployeeId } from '../utils/calendarUtils';

export interface ParseVacationsResult {
  vacacionesDB: Record<string, Record<string, string>>; // empId -> isoDate -> descripcion
  totalRegistros: number;
}

/**
 * Determina si una descripción del archivo de incidencias corresponde a "Falta Injustificada" (FINJ),
 * la cual debe omitirse por completo para no alarmar a los usuarios en el reporte ni en el Excel.
 */
function esFaltaInjustificada(desc: string): boolean {
  const upper = desc.trim().toUpperCase();
  if (!upper) return false;
  return (
    upper === 'FINJ' ||
    upper.includes('FALTA INJUSTIFICADA') ||
    upper.includes('FALTA_INJUSTIFICADA') ||
    upper === 'FALTA' ||
    upper === 'FI'
  );
}

/**
 * Parsea el archivo de Vacaciones / Incidencias autorizadas (omitiendo avisos de faltas injustificadas)
 */
export async function parseVacationsFile(file: File): Promise<ParseVacationsResult> {
  const fileName = file.name.toLowerCase();
  const vacacionesDB: Record<string, Record<string, string>> = {};
  let totalRegistros = 0;

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

    let headerRowIdx = -1;
    let colId = 0;
    let colFecha = 1;
    let colDesc = 2;

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      const joined = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
      if (joined.includes('codigo') || joined.includes('fecha') || joined.includes('evento') || joined.includes('descrip')) {
        headerRowIdx = i;
        row.forEach((cell: any, idx: number) => {
          const t = String(cell || '').toLowerCase();
          if (t.includes('codigo') || t.includes('id')) colId = idx;
          else if (t.includes('fecha')) colFecha = idx;
          else if (t.includes('evento') || t.includes('descrip')) colDesc = idx;
        });
        break;
      }
    }

    let lastId = '';
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const rawId = row[colId];
      if (rawId && !isNaN(parseInt(String(rawId), 10))) {
        lastId = normalizeEmployeeId(rawId);
      }

      const rawFecha = row[colFecha];
      const desc = String(row[colDesc] || '').trim();

      // Omitir completamente las faltas injustificadas
      if (esFaltaInjustificada(desc)) continue;

      if (lastId && rawFecha && desc) {
        let fStr = '';
        if (typeof rawFecha === 'number') {
          const d = XLSX.SSF.parse_date_code(rawFecha);
          fStr = `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
        } else {
          fStr = String(rawFecha).trim();
        }

        const p = fStr.split(/[-/]/);
        if (p.length === 3) {
          const iso = p[0].length === 4
            ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`
            : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;

          if (!vacacionesDB[lastId]) vacacionesDB[lastId] = {};
          vacacionesDB[lastId][iso] = desc;
          totalRegistros++;
        }
      }
    }

    return { vacacionesDB, totalRegistros };

  } else {
    // Modo CSV
    return new Promise((resolve, reject) => {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "ISO-8859-1",
        complete: (results) => {
          try {
            let lastId = '';
            results.data.forEach(row => {
              const idCol = row["DatatbReporte_CodigoEmpleado"] || row["CodigoEmpleado"] || row["Codigo"] || row["ID"];
              if (idCol && !isNaN(parseInt(String(idCol), 10))) {
                lastId = normalizeEmployeeId(idCol);
              }

              const f = String(row["DatatbReporte_FechaHoraRegistrada"] || row["Fecha"] || "").trim();
              const desc = String(row["DatatbReporte_DescripcionEvento"] || row["Descripcion"] || row["Incidencia"] || "").trim();

              // Omitir completamente las faltas injustificadas
              if (esFaltaInjustificada(desc)) return;

              if (lastId && f && desc) {
                const p = f.split(/[-/]/);
                if (p.length === 3) {
                  const iso = p[0].length === 4
                    ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`
                    : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;

                  if (!vacacionesDB[lastId]) vacacionesDB[lastId] = {};
                  vacacionesDB[lastId][iso] = desc;
                  totalRegistros++;
                }
              }
            });

            resolve({ vacacionesDB, totalRegistros });
          } catch (err) {
            reject(err);
          }
        },
        error: reject
      });
    });
  }
}
