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
  activeCount: number;
  inactiveCount: number;
  hasStatusColumn: boolean;
  jefes: string[];
  empresaDetectada: string;
  modo: 'excel_avanzado' | 'csv_estandar';
}

/**
 * Normaliza el valor del campo Status / Estatus de un colaborador en el reporte de base de datos.
 * Reconoce variantes comunes en español e inglés (Activo/Inactivo, Alta/Baja, A/B, 1/0, Sí/No, etc.).
 */
export function parseEmployeeStatus(raw: unknown): 'activo' | 'inactivo' | undefined {
  if (raw === null || raw === undefined) return undefined;
  const clean = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!clean) return undefined;

  if (
    clean === 'inactivo' ||
    clean === 'inactiva' ||
    clean === 'baja' ||
    clean === 'b' ||
    clean === 'i' ||
    clean === '0' ||
    clean === 'no' ||
    clean === 'false' ||
    clean === 'inactive' ||
    clean === 'off' ||
    clean.includes('inactiv') ||
    clean.includes('baja') ||
    clean.includes('finiquit') ||
    clean.includes('renunc') ||
    clean.includes('despid') ||
    clean.includes('cesad') ||
    clean.includes('suspend') ||
    clean.includes('terminat')
  ) {
    return 'inactivo';
  }

  if (
    clean === 'activo' ||
    clean === 'activa' ||
    clean === 'alta' ||
    clean === 'a' ||
    clean === '1' ||
    clean === 'si' ||
    clean === 'true' ||
    clean === 'vigente' ||
    clean === 'active' ||
    clean === 'on' ||
    clean.includes('activ') ||
    clean.includes('alta') ||
    clean.includes('vigente')
  ) {
    return 'activo';
  }

  return undefined;
}

function isStatusHeader(header: string): boolean {
  const h = header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return (
    h === 'status' ||
    h === 'estatus' ||
    h === 'estado' ||
    h === 'situacion' ||
    h.includes('status') ||
    h.includes('estatus') ||
    h.includes('situacion') ||
    h === 'activo' ||
    h === 'baja'
  );
}

function inferCompanyNameFromFilename(fileName: string): string {
  const base = fileName
    .replace(/\.(xlsx|xls|csv)$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(empleados|catalogo|base|datos|nomina|lista|checador|reporte|202\d)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (base.length >= 2) {
    return base.toUpperCase();
  }
  return fileName.replace(/\.(xlsx|xls|csv)$/i, '').trim().toUpperCase() || 'GENERAL';
}

/**
 * Parsea el archivo de base de empleados (.xlsx, .xls o .csv)
 * con autodetección inteligente de formato (filas dobles de checador o filas estándar),
 * soporte para columna `status` (Activo / Inactivo)
 * y etiquetado automático de empresa/origen para soporte multi-empresa.
 */
export async function parseEmployeesFile(
  file: File,
  empresaOverride?: string
): Promise<ParseEmployeesResult> {
  const fileName = file.name.toLowerCase();
  const empleados: Record<string, Employee> = {};
  const nowISO = new Date().toISOString();
  let detectedCompany = (empresaOverride || '').trim().toUpperCase();
  let hasStatusColumn = false;

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

    // 1. Buscar fila de encabezado y posible nombre de empresa en las filas superiores
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

    const colStatus = headerValues.findIndex(isStatusHeader);
    if (colStatus !== -1) {
      hasStatusColumn = true;
    }

    if (!detectedCompany && headerRowIdx > 0) {
      for (let r = 0; r < headerRowIdx; r++) {
        const rowCells = (rows[r] || [])
          .map((c: any) => String(c || '').trim())
          .filter(Boolean);
        const candidate = rowCells.find(
          txt =>
            txt.length >= 4 &&
            txt.length <= 60 &&
            !/reporte|catalogo|listado|fecha|pagina|página|hora|sistema/i.test(txt)
        );
        if (candidate) {
          detectedCompany = candidate.toUpperCase();
          break;
        }
      }
    }

    if (!detectedCompany) {
      detectedCompany = inferCompanyNameFromFilename(file.name);
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

        const parsedStatus =
          colStatus !== -1
            ? parseEmployeeStatus(row1[colStatus] ?? row2[colStatus])
            : undefined;
        if (parsedStatus) hasStatusColumn = true;

        // Si no está en el índice fijo [25], buscar columna con nombre de supervisor (excluyendo columna status)
        if (!supervisor || supervisor.includes('SEMANAL') || parseEmployeeStatus(supervisor)) {
          supervisor = '';
          for (let col = 15; col < row1.length; col++) {
            if (col === colStatus) continue;
            const val = String(row1[col] || '').trim();
            if (
              val &&
              !val.includes('SEMANAL') &&
              !parseEmployeeStatus(val) &&
              isNaN(Number(val)) &&
              val.length > 3
            ) {
              supervisor = val;
              break;
            }
          }
        }

        supervisor = normalizeSupervisorName(supervisor);
        const horario = String(row2[2] || '').trim();
        const tipoHorario = String(row2[10] || '').trim();

        const isInactive = parsedStatus === 'inactivo';
        if (id && (isInactive || (nombre && supervisor && !supervisor.includes('SEMANAL')))) {
          empleados[id] = {
            id,
            nombre,
            jefe: supervisor || 'GENERAL',
            horario,
            tipoHorario,
            empresa: detectedCompany,
            origenArchivo: file.name,
            actualizadoEn: nowISO,
            ...(parsedStatus ? { status: parsedStatus } : {}),
            ...(isInactive ? { fechaBaja: nowISO } : {}),
          };
        }
      }
    } else {
      // Formato estándar de una sola fila
      const colId = headerValues.findIndex(h => h.includes('código') || h.includes('codigo') || h.includes('id'));
      const colNom = headerValues.findIndex(h => h.includes('nombre') || h.includes('empleado'));
      const colSup = headerValues.findIndex(h => h.includes('supervisor') || h.includes('jefe') || h.includes('area') || h.includes('lista'));
      const colHor = headerValues.findIndex(h => h.includes('horario') || h.includes('turno'));
      const colEmp = headerValues.findIndex(h => h.includes('empresa') || h.includes('razon') || h.includes('planta'));

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const id = normalizeEmployeeId(row[colId !== -1 ? colId : 0]);
        const nombre = String(row[colNom !== -1 ? colNom : 1] || '').trim();
        const supervisor = normalizeSupervisorName(String(row[colSup !== -1 ? colSup : 2] || '').trim());
        const horario = colHor !== -1 ? String(row[colHor] || '').trim() : '';
        const rowEmpresa = colEmp !== -1 ? String(row[colEmp] || '').trim().toUpperCase() : '';
        const parsedStatus = colStatus !== -1 ? parseEmployeeStatus(row[colStatus]) : undefined;
        if (parsedStatus) hasStatusColumn = true;
        const isInactive = parsedStatus === 'inactivo';

        if (id && (nombre || isInactive)) {
          empleados[id] = {
            id,
            nombre,
            jefe: supervisor || 'GENERAL',
            horario,
            empresa: rowEmpresa || detectedCompany,
            origenArchivo: file.name,
            actualizadoEn: nowISO,
            ...(parsedStatus ? { status: parsedStatus } : {}),
            ...(isInactive ? { fechaBaja: nowISO } : {}),
          };
        }
      }
    }

    const allList = Object.values(empleados);
    const activeCount = allList.filter(e => (e.status || 'activo') !== 'inactivo').length;
    const inactiveCount = allList.filter(e => e.status === 'inactivo').length;
    const jefes = [...new Set(allList.filter(e => (e.status || 'activo') !== 'inactivo').map(e => e.jefe))].filter(Boolean).sort();
    return {
      empleados,
      count: allList.length,
      activeCount,
      inactiveCount,
      hasStatusColumn,
      jefes,
      empresaDetectada: detectedCompany,
      modo: 'excel_avanzado'
    };

  } else {
    if (!detectedCompany) {
      detectedCompany = inferCompanyNameFromFilename(file.name);
    }
    // Modo CSV con PapaParse
    return new Promise((resolve, reject) => {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "ISO-8859-1",
        complete: (results) => {
          try {
            const fields = results.meta?.fields || [];
            const detectedStatusKey = fields.find(isStatusHeader);
            if (detectedStatusKey) {
              hasStatusColumn = true;
            }

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
              const jefe = normalizeSupervisorName(String(row["Text9"] || row["Supervisor"] || row["Jefe"] || row["Area"] || row["Lista"] || "").trim());
              const rowEmpresa = String(row["Empresa"] || row["empresa"] || "").trim().toUpperCase();

              const statusKey = detectedStatusKey || Object.keys(row).find(isStatusHeader);
              const parsedStatus = statusKey ? parseEmployeeStatus(row[statusKey]) : undefined;
              if (parsedStatus) hasStatusColumn = true;
              const isInactive = parsedStatus === 'inactivo';

              if (id && (isInactive || (nombre && jefe && !jefe.includes("SEMANAL")))) {
                empleados[id] = {
                  id,
                  nombre,
                  jefe: jefe || 'GENERAL',
                  horario: '',
                  empresa: rowEmpresa || detectedCompany,
                  origenArchivo: file.name,
                  actualizadoEn: nowISO,
                  ...(parsedStatus ? { status: parsedStatus } : {}),
                  ...(isInactive ? { fechaBaja: nowISO } : {}),
                };
              }
            });

            const allList = Object.values(empleados);
            const activeCount = allList.filter(e => (e.status || 'activo') !== 'inactivo').length;
            const inactiveCount = allList.filter(e => e.status === 'inactivo').length;
            const jefes = [...new Set(allList.filter(e => (e.status || 'activo') !== 'inactivo').map(e => e.jefe))].filter(Boolean).sort();
            resolve({
              empleados,
              count: allList.length,
              activeCount,
              inactiveCount,
              hasStatusColumn,
              jefes,
              empresaDetectada: detectedCompany,
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
