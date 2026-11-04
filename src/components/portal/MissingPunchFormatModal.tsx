/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Printer,
  X,
  CreditCard,
  Briefcase,
  FileSignature
} from 'lucide-react';
import { Employee, ProcessedDay } from '../../types/attendance';
import { IncidentType, doesIncidentRequireMandatoryFile } from '../../types/portal';

export type ResolutionMode = 'checada_sin_gafete' | 'permiso' | 'falta';

export interface DayResolutionPayload {
  employeeId: string;
  isoDate: string;
  mode: ResolutionMode;
  entrada: string;
  salida: string;
  tipoIncidencia: IncidentType | 'Falta Confirmada';
  especificacionOtro?: string;
  motivo: string;
  archivoNombre?: string;
  archivoBase64?: string;
}

interface MissingPunchFormatModalProps {
  employee: Employee;
  day: ProcessedDay;
  initialMode: ResolutionMode;
  supervisorName: string;
  onClose: () => void;
  onConfirmResolution: (payload: DayResolutionPayload) => void;
}

const SUGERENCIAS_OTRA_JUSTIFICACION = [
  'Permiso de Paternidad',
  'Permiso por Matrimonio',
  'Permiso por Defunción',
  'Trámite Oficial / Legal',
];

export const MissingPunchFormatModal: React.FC<MissingPunchFormatModalProps> = ({
  employee,
  day,
  initialMode,
  supervisorName,
  onClose,
  onConfirmResolution,
}) => {
  const [mode, setMode] = useState<ResolutionMode>(initialMode);

  // Horas pre-llenadas con base en el horario programado si faltaban
  const defaultEnt =
    day.entrada && day.entrada !== '--:--'
      ? day.entrada
      : day.horarioProgramado?.entrada || '08:00';
  const defaultSal =
    day.salida && day.salida !== '--:--'
      ? day.salida
      : day.horarioProgramado?.salida || '17:00';

  const [entrada, setEntrada] = useState<string>(defaultEnt);
  const [salida, setSalida] = useState<string>(defaultSal);
  const [permisoTipo, setPermisoTipo] = useState<IncidentType>('Permiso con goce');
  const [especificacionOtro, setEspecificacionOtro] = useState<string>('');
  const [motivo, setMotivo] = useState<string>(
    day.notaSupervisorDia ||
      (initialMode === 'checada_sin_gafete'
        ? 'Trabajador sí laboró su turno completo; omitió checar con gafete (validado por supervisor).'
        : initialMode === 'falta'
        ? 'El trabajador no se presentó a laborar en su turno programado.'
        : '')
  );
  const [uploadedFile, setUploadedFile] = useState<{ nombre: string; base64: string } | null>(
    day.formatoSubidoNombre && day.formatoSubidoBase64
      ? { nombre: day.formatoSubidoNombre, base64: day.formatoSubidoBase64 }
      : null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleModeChange = (newMode: ResolutionMode) => {
    setMode(newMode);
    setErrorMsg(null);
    if (newMode === 'checada_sin_gafete' && (!motivo || motivo.includes('no se presentó'))) {
      setMotivo('Trabajador sí laboró su turno; omitió checar con gafete (validado por supervisor).');
    } else if (newMode === 'falta') {
      setMotivo('El trabajador no se presentó a laborar en su día programado.');
    } else if (newMode === 'permiso' && (motivo.includes('omitió checar') || motivo.includes('no se presentó'))) {
      setMotivo('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile({
        nombre: file.name,
        base64: reader.result as string,
      });
    };
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  // Verificar checadas originales del día
  const origEnt = day.entradaOriginal ?? day.entrada;
  const origSal = day.salidaOriginal ?? day.salida;
  const hadOriginalEnt = Boolean(origEnt && origEnt !== '--:--');
  const hadOriginalSal = Boolean(origSal && origSal !== '--:--');
  const isMissingBothPunchesOriginally = !hadOriginalEnt && !hadOriginalSal;

  // Regla de obligatoriedad de archivo según lo seleccionado:
  const activeIncidentType: IncidentType =
    mode === 'checada_sin_gafete' ? 'Checado sin Gafete' : permisoTipo;
  const isFileMandatory =
    mode !== 'falta' &&
    doesIncidentRequireMandatoryFile(activeIncidentType, isMissingBothPunchesOriginally);

  const getMandatoryBadgeText = (): string => {
    if (!isFileMandatory) {
      if (mode === 'checada_sin_gafete') {
        return 'OPCIONAL (Solo faltaba 1 checada)';
      }
      if (permisoTipo === 'Permiso sin goce') {
        return 'OPCIONAL (Permiso sin goce no exige formato)';
      }
      return 'OPCIONAL';
    }

    if (mode === 'checada_sin_gafete') {
      return 'OBLIGATORIO (Sin Entrada ni Salida original)';
    }
    if (permisoTipo === 'Otro') {
      return 'OBLIGATORIO (Archivo firmado requerido para Otra Justificación)';
    }
    return `OBLIGATORIO (Formato de ${permisoTipo} requerido)`;
  };

  // Generar e imprimir/descargar plantilla de formato lista para firma si el supervisor la necesita
  const handleDownloadPrintableFormat = () => {
    const conceptoPermiso =
      permisoTipo === 'Otro' && especificacionOtro.trim()
        ? `OTRA JUSTIFICACIÓN: ${especificacionOtro.trim().toUpperCase()}`
        : permisoTipo;

    const titulo =
      mode === 'checada_sin_gafete'
        ? 'FORMATO DE AUTORIZACIÓN DE CHECADA SIN GAFETE / OMISIÓN BIOMÉTRICA'
        : `FORMATO DE ${conceptoPermiso.toUpperCase()}`;
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${titulo} - #${employee.id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 36px; color: #0f172a; max-width: 720px; margin: 0 auto; }
    .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 16px; font-weight: bold; color: #1e3a8a; }
    .badge { background: #dbeafe; color: #1e3a8a; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; text-align: left; }
    th { background: #f1f5f9; width: 32%; font-weight: bold; color: #334155; }
    .signatures { display: flex; justify-content: space-between; margin-top: 64px; gap: 24px; text-align: center; }
    .sig-box { flex: 1; border-top: 1px solid #334155; padding-top: 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${titulo}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Control de Asistencia y Recursos Humanos</div>
    </div>
    <div class="badge">FolioFecha: ${day.isoDate}</div>
  </div>
  <table>
    <tr><th>Número de Empleado (5 dígitos)</th><td><strong>#${employee.id}</strong></td></tr>
    <tr><th>Nombre del Colaborador</th><td><strong>${employee.nombre}</strong></td></tr>
    <tr><th>Supervisor que Autoriza</th><td>${supervisorName}</td></tr>
    <tr><th>Fecha del Día Laboral</th><td>${day.isoDate} (${day.dayName})</td></tr>
    <tr><th>Horario Programado</th><td>${day.horarioProgramado ? `${day.horarioProgramado.entrada} a ${day.horarioProgramado.salida}` : 'Turno Estándar'}</td></tr>
    <tr><th>Checadas Originales en Reloj</th><td>Entrada: ${day.entradaOriginal || '--:--'} | Salida: ${day.salidaOriginal || '--:--'}</td></tr>
    ${
      mode === 'checada_sin_gafete'
        ? `<tr><th>Checadas Autorizadas por Supervisor</th><td><strong>Entrada: ${entrada} | Salida: ${salida}</strong></td></tr>`
        : `<tr><th>Tipo de Solicitud / Permiso</th><td><strong>${conceptoPermiso}</strong></td></tr>`
    }
    <tr><th>Justificación / Observaciones</th><td>${motivo || 'Sin observaciones adicionales'}</td></tr>
  </table>
  <div class="signatures">
    <div class="sig-box"><strong>${employee.nombre} (#${employee.id})</strong><br/>Firma del Colaborador</div>
    <div class="sig-box"><strong>${supervisorName}</strong><br/>Firma del Supervisor</div>
    <div class="sig-box"><strong>Recursos Humanos / Nóminas</strong><br/>Sello y Recepción</div>
  </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Formato_${mode === 'checada_sin_gafete' ? 'Checada' : 'Permiso'}_${employee.id}_${day.isoDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'checada_sin_gafete') {
      if (!entrada || !salida || entrada === '--:--' || salida === '--:--') {
        setErrorMsg('Por favor ingresa tanto la hora de Entrada como la de Salida que vas a validar.');
        return;
      }

      if (isMissingBothPunchesOriginally && (!uploadedFile || !uploadedFile.base64)) {
        setErrorMsg(
          '⚠️ Regla Obligatoria: Como el colaborador no tiene registrada ni la Entrada ni la Salida, es forzoso adjuntar el archivo del formato firmado que lo respalde para poder guardar la Checada sin Gafete.'
        );
        return;
      }
    }

    if (mode === 'permiso') {
      if (permisoTipo === 'Otro' && !especificacionOtro.trim()) {
        setErrorMsg(
          '⚠️ Regla Obligatoria: Para "Otra Justificación" debes especificar para qué es la solicitud (por ejemplo: Permiso de Paternidad).'
        );
        return;
      }

      if (isFileMandatory && (!uploadedFile || !uploadedFile.base64)) {
        if (permisoTipo === 'Otro') {
          setErrorMsg(
            `⚠️ Regla Obligatoria: Para registrar "${especificacionOtro.trim() || 'Otra Justificación'}" es forzoso subir el archivo o formato firmado que lo respalde.`
          );
        } else {
          setErrorMsg(
            `⚠️ Regla Obligatoria: Las solicitudes de "${permisoTipo}" requieren forzosamente subir su formato firmado para poder registrarse.`
          );
        }
        return;
      }
    }

    if (!motivo.trim()) {
      setErrorMsg('Por favor escribe una breve justificación o comentario para RH.');
      return;
    }

    const finalMotivo =
      mode === 'permiso' && permisoTipo === 'Otro' && especificacionOtro.trim()
        ? `[${especificacionOtro.trim()}] ${motivo.trim()}`
        : motivo.trim();

    onConfirmResolution({
      employeeId: employee.id,
      isoDate: day.isoDate,
      mode,
      entrada: mode === 'checada_sin_gafete' ? entrada : '--:--',
      salida: mode === 'checada_sin_gafete' ? salida : '--:--',
      tipoIncidencia:
        mode === 'checada_sin_gafete'
          ? 'Checado sin Gafete'
          : mode === 'falta'
          ? 'Falta Confirmada'
          : permisoTipo,
      especificacionOtro:
        mode === 'permiso' && permisoTipo === 'Otro' ? especificacionOtro.trim() : undefined,
      motivo: finalMotivo,
      archivoNombre: uploadedFile?.nombre,
      archivoBase64: uploadedFile?.base64,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Encabezado */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Resolver Día sin Checadas Completas
                </h3>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  #{employee.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {employee.nombre} • <strong className="text-slate-200">{day.dayName} {day.isoDate}</strong>
                {day.horarioProgramado && (
                  <span className="ml-2 text-amber-300 font-mono">
                    (Horario: {day.horarioProgramado.entrada} - {day.horarioProgramado.salida})
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Selector de ¿Qué deseas hacer con este día laboral? */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              ¿Qué sucedió este día laboral? Selecciona una opción:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleModeChange('checada_sin_gafete')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mode === 'checada_sin_gafete'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4 text-purple-400 mb-1.5" />
                <div>
                  <div className="font-bold text-xs text-slate-100">Checada sin Gafete</div>
                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                    {isMissingBothPunchesOriginally
                      ? 'Faltan 2 checadas: formato obligatorio'
                      : 'Falta 1 checada: formato opcional'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('permiso')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mode === 'permiso'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200 shadow-md shadow-blue-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-4 h-4 text-blue-400 mb-1.5" />
                <div>
                  <div className="font-bold text-xs text-slate-100">Solicitud / Permiso</div>
                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                    Vacaciones, permisos, Home Office u otra justificación
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('falta')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mode === 'falta'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-200 shadow-md shadow-rose-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Ban className="w-4 h-4 text-rose-400 mb-1.5" />
                <div>
                  <div className="font-bold text-xs text-slate-100">Es Falta (No vino)</div>
                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                    Confirmar a RH que el trabajador no asistió
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* MODO 1: CHECADA SIN GAFETE */}
          {mode === 'checada_sin_gafete' && (
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Capturar horas laboradas (se marcarán en color violeta para RH):
                </span>
                {day.horarioProgramado && (
                  <button
                    type="button"
                    onClick={() => {
                      setEntrada(day.horarioProgramado!.entrada);
                      setSalida(day.horarioProgramado!.salida);
                    }}
                    className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 cursor-pointer"
                  >
                    Usar Horario Programado ({day.horarioProgramado.entrada} - {day.horarioProgramado.salida})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Hora de Entrada (Orig: {day.entradaOriginal || '--:--'})
                  </label>
                  <input
                    type="time"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-purple-500/40 text-slate-100 font-mono text-xs outline-none focus:border-purple-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Hora de Salida (Orig: {day.salidaOriginal || '--:--'})
                  </label>
                  <input
                    type="time"
                    value={salida}
                    onChange={(e) => setSalida(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-purple-500/40 text-slate-100 font-mono text-xs outline-none focus:border-purple-400"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODO 2: FORMATO DE PERMISO / SOLICITUD */}
          {mode === 'permiso' && (
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-blue-300 block mb-1">
                  Selecciona el Tipo de Solicitud / Permiso:
                </label>
                <select
                  value={permisoTipo}
                  onChange={(e) => {
                    setPermisoTipo(e.target.value as IncidentType);
                    setErrorMsg(null);
                  }}
                  className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-blue-500/40 text-slate-100 text-xs font-semibold outline-none focus:border-blue-400"
                >
                  <option value="Permiso con goce">📑 Permiso con goce de sueldo (Requiere formato)</option>
                  <option value="Vacaciones">🏖️ Día de Vacaciones (Requiere formato)</option>
                  <option value="Permiso de viaje">✈️ Permiso de viaje / Comisión (Requiere formato)</option>
                  <option value="Home Office">🏠 Solicitud de Home Office (Requiere formato)</option>
                  <option value="Permiso sin goce">⚖️ Permiso sin goce de sueldo (Formato opcional)</option>
                  <option value="Pase Médico">🏥 Pase Médico / IMSS (Formato opcional)</option>
                  <option value="Incapacidad">🩺 Incapacidad Médica (Formato opcional)</option>
                  <option value="Cambio de horario">🔄 Cambio de horario / Descanso laborado</option>
                  <option value="Otro">📝 Otra Justificación Especial (Ej. Permiso de Paternidad - Requiere formato)</option>
                </select>
              </div>

              {permisoTipo === 'Otro' && (
                <div className="pt-2 border-t border-blue-500/20 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                    <span>Especificar la solicitud es para lo siguiente (Obligatorio):</span>
                  </label>
                  <input
                    type="text"
                    value={especificacionOtro}
                    onChange={(e) => {
                      setEspecificacionOtro(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Ej: Permiso de Paternidad, Permiso por Matrimonio, Permiso por Defunción..."
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-amber-500/50 text-slate-100 font-semibold text-xs outline-none focus:border-amber-400"
                    required
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Opciones rápidas:</span>
                    {SUGERENCIAS_OTRA_JUSTIFICACION.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          setEspecificacionOtro(sug);
                          setErrorMsg(null);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          especificacionOtro === sug
                            ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500/40'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO 3: FALTA CONFIRMADA */}
          {mode === 'falta' && (
            <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-rose-200 leading-relaxed">
                <strong>Confirmación de Falta:</strong> Se notificará a Recursos Humanos y Nóminas que el colaborador{' '}
                <strong>{employee.nombre} (#{employee.id})</strong> no asistió a laborar el día{' '}
                <strong>{day.isoDate}</strong>, quedando con 0.00 horas trabajadas y marcado como falta validada por el supervisor.
              </div>
            </div>
          )}

          {/* Justificación / Observaciones */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Justificación / Observaciones:
            </label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Escribe el motivo de la checada agregada, permiso o falta..."
              className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500 resize-none text-xs"
              required
            />
          </div>

          {/* Subida del archivo de formato (para Checada sin gafete o Permiso) */}
          {mode !== 'falta' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 flex-wrap">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Archivo de Respaldo ({mode === 'checada_sin_gafete' ? 'Formato de Checada' : 'Formato Firmado'}):
                  </span>
                  {isFileMandatory ? (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-extrabold">
                      {getMandatoryBadgeText()}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                      {getMandatoryBadgeText()}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleDownloadPrintableFormat}
                  className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>Descargar Plantilla de Formato Pre-llenado</span>
                </button>
              </div>

              <div
                className={`p-3.5 rounded-xl bg-slate-950 border-2 border-dashed text-center relative cursor-pointer transition-all ${
                  isFileMandatory && !uploadedFile
                    ? 'border-rose-500/60 hover:border-rose-400 bg-rose-950/10'
                    : 'border-slate-800 hover:border-indigo-500/50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.html"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {uploadedFile ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Archivo adjunto: {uploadedFile.nombre}</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {isFileMandatory
                        ? '⚠️ Haz clic aquí para adjuntar el archivo firmado que respalda la solicitud (Requerido)'
                        : 'Haz clic aquí si deseas adjuntar algún comprobante (Opcional para este caso)'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Soporta PDF, Foto (JPG/PNG), Word o Excel — RH podrá descargarlo directamente
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Botones de confirmación */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                mode === 'falta'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : mode === 'permiso'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {mode === 'checada_sin_gafete'
                  ? isMissingBothPunchesOriginally
                    ? 'Guardar Checada con Respaldo'
                    : 'Aplicar Checada en Lista'
                  : mode === 'permiso'
                  ? 'Registrar Solicitud en Lista'
                  : 'Confirmar Falta en Lista'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
