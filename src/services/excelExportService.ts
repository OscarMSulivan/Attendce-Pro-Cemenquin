/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import { EmployeeReport, ProcessedDay } from '../types/attendance';

/**
 * Construye el texto de revisión únicamente cuando:
 * 1) Al colaborador realmente le falta una checada (entrada o salida huérfana).
 * 2) Se identifica tiempo extra / jornada excedida.
 * Omite por completo cualquier aviso de "Falta Injustificada" para no alarmar a los usuarios.
 */
function obtenerNotaRevisionExcel(d: ProcessedDay): string {
  if (d.modificadoPorSupervisor) {
    const origEnt = d.entradaOriginal || '--:--';
    const origSal = d.salidaOriginal || '--:--';
    if (d.tipoModificacionSupervisor === 'falta_confirmada') {
      return '🚫 FALTA CONFIRMADA POR SUPERVISOR (No asistió)';
    }
    if (d.tipoModificacionSupervisor === 'formato_checada_sin_gafete') {
      return `🟣 CHECADA AGREGADA C/FORMATO (Orig: ${origEnt} - ${origSal})`;
    }
    if (d.tipoModificacionSupervisor === 'formato_permiso') {
      return `🟣 FORMATO DE PERMISO (${d.incidencia || 'Justificado'})`;
    }
    return `🟣 CHECADA AGREGADA POR SUPERVISOR (Orig: ${origEnt} - ${origSal})`;
  }

  const tieneEnt = d.entrada !== '--:--' && Boolean(d.entrada);
  const tieneSal = d.salida !== '--:--' && Boolean(d.salida);

  // Caso 1: Le falta una de las dos checadas (checada incompleta)
  if (tieneEnt !== tieneSal || d.huerfana) {
    return '⚠️ VALIDAR CHECADA EN SISTEMA';
  }

  // Caso 2: Día laboral según horario programado sin ninguna de las 2 checadas y sin resolver
  if (!tieneEnt && !tieneSal && d.horarioProgramado && !d.incidencia) {
    return `⚠️ SIN CHECADAS EN DÍA LABORAL (${d.horarioProgramado.entrada}-${d.horarioProgramado.salida})`;
  }

  // Caso 3: Incidencia identificada como tiempo extra
  if (d.advertencia && (d.advertencia.toLowerCase().includes('extra') || d.advertencia.toLowerCase().includes('excedida'))) {
    return d.advertencia;
  }

  if (d.hExtra >= 0.5) {
    return `⏰ TIEMPO EXTRA (+${d.hExtra.toFixed(2)} HRS)`;
  }

  return '';
}

/**
 * Limpia cualquier etiqueta automática de "Falta Injustificada" / "FINJ",
 * pero conserva "Falta Confirmada" cuando el supervisor indicó explícitamente que el trabajador no vino.
 */
function limpiarIncidenciaExcel(incidencia: string, modificadoPorSupervisor?: boolean, tipoMod?: string): string {
  const clean = (incidencia || '').trim();
  if (modificadoPorSupervisor && tipoMod === 'falta_confirmada') {
    return 'Falta Confirmada (No asistió)';
  }
  const upper = clean.toUpperCase();
  if (
    upper === 'FINJ' ||
    upper.includes('FALTA') ||
    upper === 'FI' ||
    upper.includes('INCOMPLETO')
  ) {
    return '';
  }
  return clean;
}

/**
 * Genera y descarga UN SOLO archivo Excel de nómina correspondiente
 * a la lista de empleados actualmente filtrada, con diseño corporativo a color
 * desde la columna A hasta la L (incluyendo ID, Colaborador y Supervisor estilizados).
 */
export async function exportPayrollExcelBySupervisor(
  reportes: EmployeeReport[],
  numeroSemana: number | string,
  selectedSupervisor?: string
): Promise<string> {
  if (!reportes || reportes.length === 0) {
    throw new Error('No hay registros para exportar.');
  }

  // Paleta de colores ejecutiva unificada (un solo color institucional en encabezados, conservando intactos los colores de alertas e inconsistencias)
  const PALETTE = {
    navyDark: 'FF1E3A8A',       // Color único institucional para encabezados (Azul Marino Ejecutivo uniforme de A a L)
    slateHeader: 'FF1E3A8A',    // Subencabezado uniforme en el mismo tono institucional (sin mezcla de azul y negro)
    indigoAccent: 'FF1E3A8A',   // Columnas A-C unificadas con el resto del encabezado
    empBannerBg: 'FFDBEAFE',    // Barra superior de cada bloque de empleado (Azul cielo ejecutivo)
    empBannerText: 'FF1E3A8A',  // Texto azul marino intenso
    empIdBadgeBg: 'FF1E3A8A',   // Badge azul marino uniforme para el ID del empleado
    colIdBgEven: 'FFF8FAFC',    // Fondo neutro limpio para Columna A (ID)
    colIdBgOdd: 'FFF1F5F9',     // Fondo neutro alternado para Columna A (ID)
    colMetaEven: 'FFF8FAFC',    // Fondo gris perla para Nombre y Supervisor (par)
    colMetaOdd: 'FFF1F5F9',     // Fondo gris perla para Nombre y Supervisor (impar)
    rowEven: 'FFFFFFFF',        // Fila de datos par
    rowOdd: 'FFF8FAFC',         // Fila de datos impar (zebra sutil)
    asistenciaBg: 'FFECFDF5',   // Verde esmeralda muy suave para Asistencia
    asistenciaText: 'FF047857', // Texto verde esmeralda oscuro
    descansoBg: 'FFD1FAE5',     // Verde agua suave para Descanso / RST
    descansoText: 'FF065F46',   // Texto verde bosque
    vacacionesBg: 'FFFEF08A',   // Amarillo cálido para Vacaciones / Permisos
    vacacionesText: 'FF854D0E', // Texto bronce oscuro
    alertaBg: 'FFFBBF24',       // Ámbar dorado intenso para filas por revisar
    alertaLeftBg: 'FFFEF3C7',   // Ámbar suave en A:C cuando la fila tiene alerta
    alertaText: 'FF78350F',     // Texto café/ámbar oscuro en alertas
    supModBg: 'FFEDE9FE',       // Violeta suave para checadas agregadas/modificadas por supervisor
    supModLeftBg: 'FFDDD6FE',   // Violeta más marcado en A:C para filas modificadas por supervisor
    supModText: 'FF5B21B6',     // Texto púrpura intenso para distinguir modificaciones del supervisor
    extraText: 'FFB45309',      // Color ámbar para horas extras > 0
    totalRowBg: 'FFE2E8F0',     // Fondo gris azulado para fila TOTAL
    totalAccentBg: 'FFCBD5E1',  // Fondo más marcado para celdas de suma en TOTAL
    borderLight: 'FFCBD5E1',    // Borde interior suave
    borderStrong: 'FF64748B',   // Borde divisor fuerte
    bannerWarnBg: 'FFFEF3C7',   // Banner superior de atención
    bannerWarnText: 'FF92400E',
    bannerOkBg: 'FFDBEAFE',     // Banner superior informativo
    bannerOkText: 'FF1E3A8A'
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: PALETTE.borderLight } },
    left: { style: 'thin', color: { argb: PALETTE.borderLight } },
    bottom: { style: 'thin', color: { argb: PALETTE.borderLight } },
    right: { style: 'thin', color: { argb: PALETTE.borderLight } }
  };

  // Determinar el nombre del supervisor para el archivo
  const supervisoresUnicos = [...new Set(reportes.map(r => r.empleado.jefe).filter(Boolean))];
  const etiquetaSupervisor = selectedSupervisor
    ? selectedSupervisor
    : supervisoresUnicos.length === 1
      ? supervisoresUnicos[0]
      : 'Todos';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CemenQtime';
  workbook.created = new Date();

  // ============================================================================
  // HOJA 1: REPORTE DE ASISTENCIA (CON COLUMNAS A, B, C ESTILIZADAS + BLOQUES)
  // ============================================================================
  const worksheet = workbook.addWorksheet('Reporte de Asistencia', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 2 }]
  });

  // Calcular cuántos registros tienen checada faltante o fueron modificados por supervisor
  const totalAlertas = reportes.reduce(
    (sum, emp) => sum + emp.dias.filter(d => !d.modificadoPorSupervisor && Boolean(obtenerNotaRevisionExcel(d))).length,
    0
  );
  const totalModificadosSup = reportes.reduce(
    (sum, emp) => sum + emp.dias.filter(d => Boolean(d.modificadoPorSupervisor)).length,
    0
  );

  // Fila 1: Banner informativo superior
  const bannerTexto = totalModificadosSup > 0
    ? `🟣 CONTROL RH: Incluye ${totalModificadosSup} registro(s) con checada agregada / validada por el supervisor (resaltados en violeta)${totalAlertas > 0 ? ` y ${totalAlertas} alerta(s) en ámbar.` : '.'}`
    : totalAlertas > 0
      ? `⚠ ATENCIÓN: Se detectaron ${totalAlertas} registro(s) con checada incompleta o tiempo extra (resaltados en ámbar). Usa las flechas de la Fila 2 para filtrar.`
      : `✓ REPORTE DE ASISTENCIA — SEMANA ${numeroSemana} | SUPERVISOR: ${etiquetaSupervisor.toUpperCase()} (${reportes.length} colaboradores)`;

  const bannerRow = worksheet.addRow([bannerTexto]);
  worksheet.mergeCells(`A${bannerRow.number}:L${bannerRow.number}`);
  bannerRow.height = 26;
  bannerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: totalAlertas > 0 ? PALETTE.bannerWarnBg : PALETTE.bannerOkBg }
    };
    cell.font = {
      name: 'Calibri',
      bold: true,
      size: 11,
      color: { argb: totalAlertas > 0 ? PALETTE.bannerWarnText : PALETTE.bannerOkText }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });

  // Fila 2: Encabezado maestro con AutoFiltro activo en A2:L2
  const masterFilterRow = worksheet.addRow([
    'ID',
    'Colaborador',
    'Supervisor',
    'Fecha',
    'Día',
    'Entrada',
    'Salida',
    'H. Normal',
    'H. Extra',
    'Incidencia',
    'Revisar',
    'Comentarios'
  ]);
  masterFilterRow.height = 24;
  masterFilterRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 3 ? PALETTE.indigoAccent : PALETTE.navyDark }
    };
    cell.font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: PALETTE.navyDark } },
      bottom: { style: 'medium', color: { argb: 'FFF59E0B' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  worksheet.addRow([]);

  reportes.forEach(emp => {
    const idFormatted = emp.empleado.id
      ? (isNaN(parseInt(emp.empleado.id, 10)) ? emp.empleado.id : emp.empleado.id.padStart(5, '0'))
      : '';

    // 1. Fila de Cabezal del Empleado (Unificada y con color de A a L)
    const titleRow = worksheet.addRow([
      `#${idFormatted}`,
      emp.empleado.nombre,
      emp.empleado.jefe,
      idFormatted,
      'NOMBRE:',
      emp.empleado.nombre,
      '',
      'SUPERVISOR:',
      emp.empleado.jefe,
      emp.empleado.horario ? `HORARIO: ${emp.empleado.horario}` : '',
      '',
      ''
    ]);
    titleRow.height = 22;

    for (let c = 1; c <= 12; c++) {
      const cell = titleRow.getCell(c);
      if (c === 1) {
        // Badge de ID en columna A
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.empIdBadgeBg } };
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.empBannerBg } };
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: PALETTE.empBannerText } };
        cell.alignment = { vertical: 'middle', horizontal: c === 4 ? 'center' : 'left' };
      }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF3B82F6' } },
        bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
        left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        right: { style: 'thin', color: { argb: 'FFBFDBFE' } }
      };
    }

    // 2. Fila de Sub-encabezado del bloque (Coloreada de A a L para que no se vea cortada)
    const headRow = worksheet.addRow([
      'ID',
      'Colaborador',
      'Supervisor',
      'Fecha',
      'Día',
      'Entrada',
      'Salida',
      'H. Normal',
      'H. Extra',
      'Incidencia',
      'Revisar',
      'Comentarios'
    ]);
    headRow.height = 20;
    for (let c = 1; c <= 12; c++) {
      const cell = headRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c <= 3 ? PALETTE.indigoAccent : PALETTE.slateHeader }
      };
      cell.font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderThin;
    }

    let totalNormal = 0;
    let totalExtra = 0;

    // 3. Filas de días de la semana
    emp.dias.forEach((d, dayIdx) => {
      const isEven = dayIdx % 2 === 0;
      const isModSup = Boolean(d.modificadoPorSupervisor);
      const incidenciaLimpia = limpiarIncidenciaExcel(d.incidencia, isModSup, d.tipoModificacionSupervisor);
      const alerta = obtenerNotaRevisionExcel(d);
      const comentarioDia = [
        d.notaSupervisorDia || '',
        d.formatoSubidoNombre ? `[Formato adjunto: ${d.formatoSubidoNombre}]` : ''
      ].filter(Boolean).join(' ');

      const rowData = [
        idFormatted,
        emp.empleado.nombre,
        emp.empleado.jefe,
        d.isoDate,
        d.dayName,
        d.entrada,
        d.salida,
        d.hNormal,
        d.hExtra,
        incidenciaLimpia,
        alerta,
        comentarioDia
      ];

      const row = worksheet.addRow(rowData);
      row.height = 19;
      totalNormal += d.hNormal;
      if (d.horasExtrasAutorizadas === true) {
        totalExtra += d.hExtra;
      }

      const inc = incidenciaLimpia.toUpperCase();

      // Determinar color de fondo para las columnas de datos D..K
      let dataBgColor = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
      let incBgColor: string | null = null;
      let incTextColor = 'FF0F172A';

      if (isModSup) {
        dataBgColor = PALETTE.supModBg;
        incBgColor = PALETTE.supModBg;
        incTextColor = PALETTE.supModText;
      } else if (alerta) {
        dataBgColor = PALETTE.alertaBg;
      } else if (inc.includes('VACAC') || inc.includes('PERMISO') || inc.includes('INCAPACIDAD')) {
        dataBgColor = PALETTE.vacacionesBg;
        incBgColor = PALETTE.vacacionesBg;
        incTextColor = PALETTE.vacacionesText;
      } else if (inc.includes('RST') || inc.includes('DESCANSO') || inc.includes('FESTIVO')) {
        dataBgColor = PALETTE.descansoBg;
        incBgColor = PALETTE.descansoBg;
        incTextColor = PALETTE.descansoText;
      } else if (inc === 'ASISTENCIA') {
        incBgColor = PALETTE.asistenciaBg;
        incTextColor = PALETTE.asistenciaText;
      }

      const leftBg = isModSup
        ? PALETTE.supModLeftBg
        : alerta
          ? PALETTE.alertaLeftBg
          : (isEven ? PALETTE.colIdBgEven : PALETTE.colIdBgOdd);
      const leftMetaBg = isModSup
        ? PALETTE.supModLeftBg
        : alerta
          ? PALETTE.alertaLeftBg
          : (isEven ? PALETTE.colMetaEven : PALETTE.colMetaOdd);

      // Estilizar Columnas A, B y C (ID, Colaborador, Supervisor) con color ejecutivo
      const cellId = row.getCell(1);
      cellId.numFmt = '@';
      cellId.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: leftBg }
      };
      cellId.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: isModSup ? PALETTE.supModText : PALETTE.empBannerText } };
      cellId.alignment = { horizontal: 'center', vertical: 'middle' };
      cellId.border = borderThin;

      const cellNombre = row.getCell(2);
      cellNombre.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: leftMetaBg }
      };
      cellNombre.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: isModSup ? PALETTE.supModText : 'FF0F172A' } };
      cellNombre.alignment = { horizontal: 'left', vertical: 'middle' };
      cellNombre.border = borderThin;

      const cellSup = row.getCell(3);
      cellSup.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: leftMetaBg }
      };
      cellSup.font = { name: 'Calibri', size: 9, color: { argb: isModSup ? PALETTE.supModText : 'FF334155' } };
      cellSup.alignment = { horizontal: 'left', vertical: 'middle' };
      cellSup.border = borderThin;

      // Estilizar Columnas D a K (4 a 11)
      for (let colNumber = 4; colNumber <= 11; colNumber++) {
        const cell = row.getCell(colNumber);
        const bgToUse = (colNumber === 10 && incBgColor && !alerta && !isModSup) ? incBgColor : dataBgColor;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgToUse } };
        cell.border = borderThin;

        // Alineación por columna
        if (colNumber >= 4 && colNumber <= 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 8 || colNumber === 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        // Tipografía y color de texto según el contenido
        if (isModSup) {
          cell.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: PALETTE.supModText } };
        } else if (alerta) {
          cell.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: PALETTE.alertaText } };
        } else if (colNumber === 8 && d.hNormal > 0) {
          cell.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: PALETTE.asistenciaText } };
        } else if (colNumber === 9 && d.hExtra > 0) {
          cell.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: PALETTE.extraText } };
        } else if (colNumber === 10 && incBgColor) {
          cell.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: incTextColor } };
        } else {
          cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
        }
      }

      // Formatos numéricos para H. Normal y H. Extra
      row.getCell(8).numFmt = '0.00';
      row.getCell(9).numFmt = '0.00';

      // Columna L (12) — Comentarios
      const comentCell = row.getCell(12);
      comentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isModSup ? PALETTE.supModBg : 'FFFFFFFF' } };
      comentCell.font = { name: 'Calibri', bold: isModSup, size: 9.5, color: { argb: isModSup ? PALETTE.supModText : 'FF0F172A' } };
      comentCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // 4. Fila de TOTAL del empleado (Coloreada de A a L con acento en los totales)
    const footerRow = worksheet.addRow([
      idFormatted,
      emp.empleado.nombre,
      emp.empleado.jefe,
      '',
      '',
      '',
      'TOTAL:',
      totalNormal,
      totalExtra,
      '',
      '',
      ''
    ]);
    footerRow.height = 21;

    for (let c = 1; c <= 12; c++) {
      const cell = footerRow.getCell(c);
      const isSumCell = c === 7 || c === 8 || c === 9;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isSumCell ? PALETTE.totalAccentBg : PALETTE.totalRowBg }
      };
      cell.font = {
        name: 'Calibri',
        bold: true,
        size: isSumCell ? 10.5 : 9.5,
        color: { argb: c === 9 && totalExtra > 0 ? PALETTE.extraText : 'FF0F172A' }
      };
      cell.alignment = {
        horizontal: c === 1 ? 'center' : (c === 7 || c === 8 || c === 9 ? 'right' : 'left'),
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: PALETTE.borderStrong } },
        bottom: { style: 'medium', color: { argb: PALETTE.borderStrong } },
        left: { style: 'thin', color: { argb: PALETTE.borderLight } },
        right: { style: 'thin', color: { argb: PALETTE.borderLight } }
      };
    }
    footerRow.getCell(8).numFmt = '0.00';
    footerRow.getCell(9).numFmt = '0.00';

    worksheet.addRow([]);
  });

  // Activar AutoFiltro en toda la tabla desde la fila 2 (A2:L...)
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: worksheet.rowCount, column: 12 }
  };

  // Ajustar anchos de columnas A a L
  const widthsHoja1 = [10, 32, 24, 13, 8, 10, 10, 12, 12, 22, 38, 42];
  worksheet.columns.forEach((col, i) => {
    col.width = widthsHoja1[i] || 14;
  });

  // ============================================================================
  // HOJA 2: TABLA RÁPIDA FILTRABLE (CONTINUA SIN FILAS EN BLANCO + SUBTOTALES)
  // ============================================================================
  const flatSheet = workbook.addWorksheet('Tabla Rápida Filtrable', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 2 }]
  });

  // Fila 1: Barra de Subtotales dinámicos que se actualizan al filtrar en Excel
  const subtotalRow = flatSheet.addRow([
    '',
    'TOTAL DE FILAS FILTRADAS:',
    '',
    '',
    '',
    '',
    '',
    '',
    { formula: 'SUBTOTAL(9,I3:I5000)' },
    { formula: 'SUBTOTAL(9,J3:J5000)' },
    '',
    '',
    ''
  ]);
  subtotalRow.height = 24;
  for (let c = 1; c <= 13; c++) {
    const cell = subtotalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.empBannerBg } };
    cell.font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: PALETTE.empBannerText } };
    cell.border = borderThin;
  }
  subtotalRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
  subtotalRow.getCell(9).numFmt = '0.00';
  subtotalRow.getCell(10).numFmt = '0.00';

  // Fila 2: Encabezados de la tabla continua
  const flatHeader = flatSheet.addRow([
    'ID',
    'Colaborador',
    'Supervisor',
    'Horario',
    'Fecha',
    'Día',
    'Entrada',
    'Salida',
    'H. Normal',
    'H. Extra',
    'Incidencia',
    'Revisar',
    'Comentarios'
  ]);
  flatHeader.height = 23;
  flatHeader.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 4 ? PALETTE.indigoAccent : PALETTE.navyDark }
    };
    cell.font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  let flatRowIndex = 0;
  reportes.forEach(emp => {
    const idFormatted = emp.empleado.id
      ? (isNaN(parseInt(emp.empleado.id, 10)) ? emp.empleado.id : emp.empleado.id.padStart(5, '0'))
      : '';

    emp.dias.forEach(d => {
      flatRowIndex++;
      const isEven = flatRowIndex % 2 === 0;
      const isModSup = Boolean(d.modificadoPorSupervisor);
      const incidenciaLimpia = limpiarIncidenciaExcel(d.incidencia, isModSup, d.tipoModificacionSupervisor);
      const alerta = obtenerNotaRevisionExcel(d);
      const comentarioDia = [
        d.notaSupervisorDia || '',
        d.formatoSubidoNombre ? `[Formato adjunto: ${d.formatoSubidoNombre}]` : ''
      ].filter(Boolean).join(' ');

      const row = flatSheet.addRow([
        idFormatted,
        emp.empleado.nombre,
        emp.empleado.jefe,
        emp.empleado.horario || 'ADMO',
        d.isoDate,
        d.dayName,
        d.entrada,
        d.salida,
        d.hNormal,
        d.hExtra,
        incidenciaLimpia,
        alerta,
        comentarioDia
      ]);
      row.height = 19;

      const inc = incidenciaLimpia.toUpperCase();
      let rowBg = isEven ? PALETTE.rowEven : PALETTE.rowOdd;
      if (isModSup) rowBg = PALETTE.supModBg;
      else if (alerta) rowBg = PALETTE.alertaBg;
      else if (inc.includes('VACAC')) rowBg = PALETTE.vacacionesBg;
      else if (inc.includes('RST') || inc.includes('DESCANSO')) rowBg = PALETTE.descansoBg;

      for (let colNumber = 1; colNumber <= 12; colNumber++) {
        const cell = row.getCell(colNumber);
        const colBg = isModSup
          ? (colNumber <= 3 ? PALETTE.supModLeftBg : PALETTE.supModBg)
          : (!alerta && colNumber === 1)
            ? (isEven ? PALETTE.colIdBgEven : PALETTE.colIdBgOdd)
            : (!alerta && (colNumber === 2 || colNumber === 3))
              ? (isEven ? PALETTE.colMetaEven : PALETTE.colMetaOdd)
              : rowBg;

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colBg } };
        cell.border = borderThin;
        cell.font = {
          name: 'Calibri',
          bold: Boolean(isModSup || alerta || colNumber <= 2 || colNumber === 9 || colNumber === 10),
          size: 9.5,
          color: {
            argb: isModSup
              ? PALETTE.supModText
              : alerta
                ? PALETTE.alertaText
                : colNumber === 1
                  ? PALETTE.empBannerText
                  : colNumber === 9 && d.hNormal > 0
                    ? PALETTE.asistenciaText
                    : colNumber === 10 && d.hExtra > 0
                      ? PALETTE.extraText
                      : 'FF1E293B'
          }
        };

        if (colNumber === 1 || (colNumber >= 4 && colNumber <= 8)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 9 || colNumber === 10) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      row.getCell(9).numFmt = '0.00';
      row.getCell(10).numFmt = '0.00';

      const comentCell = row.getCell(13);
      comentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isModSup ? PALETTE.supModBg : 'FFFFFFFF' } };
      comentCell.font = { name: 'Calibri', bold: isModSup, size: 9.5, color: { argb: isModSup ? PALETTE.supModText : 'FF0F172A' } };
      comentCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });
  });

  flatSheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: flatSheet.rowCount, column: 13 }
  };

  const widthsHoja2 = [10, 32, 24, 12, 13, 8, 10, 10, 12, 12, 22, 34, 38];
  flatSheet.columns.forEach((col, i) => {
    col.width = widthsHoja2[i] || 14;
  });

  // Sanitizar nombre de supervisor para el archivo
  const nombreLimpio = etiquetaSupervisor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  const nombreArchivo = `area(${nombreLimpio || 'General'})_nomina(${numeroSemana}).xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), nombreArchivo);

  return nombreArchivo;
}
