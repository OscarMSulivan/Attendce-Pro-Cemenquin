/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Palmtree, 
  UserCheck, 
  X, 
  AlertCircle,
  Clock,
  Upload,
  CheckCircle2,
  Printer,
  FileSignature
} from 'lucide-react';
import {
  IncidentRequest,
  IncidentType,
  PortalUser,
  doesIncidentRequireMandatoryFile,
} from '../../types/portal';
import { EmpleadoProcesado } from '../../types/attendance';

interface NewIncidentModalProps {
  currentUser: PortalUser;
  availableEmployees: EmpleadoProcesado[];
  initialEmployeeId?: string;
  onClose: () => void;
  onSubmit: (incident: IncidentRequest) => void;
}

const SUGERENCIAS_OTRA_JUSTIFICACION = [
  'Permiso de Paternidad',
  'Permiso por Matrimonio',
  'Permiso por Defunción',
  'Trámite Oficial / Legal',
];

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  currentUser,
  availableEmployees,
  initialEmployeeId,
  onClose,
  onSubmit,
}) => {
  const isSupervisor = currentUser.role === 'supervisor';
  
  // Si es supervisor, puede pedir para sí mismo o para sus empleados
  const [esParaMi, setEsParaMi] = useState<boolean>(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmployeeId || availableEmployees[0]?.id || ''
  );

  const [tipo, setTipo] = useState<IncidentType>('Vacaciones');
  const [especificacionOtro, setEspecificacionOtro] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [fechaFin, setFechaFin] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [entradaPropuesta, setEntradaPropuesta] = useState<string>('08:00');
  const [salidaPropuesta, setSalidaPropuesta] = useState<string>('17:00');
  const [motivo, setMotivo] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<{ nombre: string; base64: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetEmpId = esParaMi ? (currentUser.employeeId || '00615') : selectedEmpId;

  // Verificar si en la fecha seleccionada el colaborador tenía al menos 1 checada o no tenía ni entrada ni salida
  const punchStatusForSelectedDate = useMemo(() => {
    const emp = availableEmployees.find(e => e.id === targetEmpId);
    const dayRecord = emp?.dias?.find(d => d.isoDate === fechaInicio);
    if (!dayRecord) {
      return {
        hasRecord: false,
        origEnt: '--:--',
        origSal: '--:--',
        missingBothPunches: true,
      };
    }
    const origEnt = dayRecord.entradaOriginal ?? dayRecord.entrada ?? '--:--';
    const origSal = dayRecord.salidaOriginal ?? dayRecord.salida ?? '--:--';
    const hasEnt = Boolean(origEnt && origEnt !== '--:--');
    const hasSal = Boolean(origSal && origSal !== '--:--');
    return {
      hasRecord: true,
      origEnt,
      origSal,
      missingBothPunches: !hasEnt && !hasSal,
    };
  }, [availableEmployees, targetEmpId, fechaInicio]);

  // Regla de obligatoriedad de archivo según tipo de solicitud
  const isFileMandatory = doesIncidentRequireMandatoryFile(
    tipo,
    punchStatusForSelectedDate.missingBothPunches
  );

  const getMandatoryBadgeLabel = (): string => {
    if (!isFileMandatory) {
      if (tipo === 'Permiso sin goce') {
        return 'OPCIONAL (Permiso sin goce no requiere formato forzoso)';
      }
      if (tipo === 'Checado sin Gafete') {
        return 'OPCIONAL (Solo le falta 1 checada al colaborador)';
      }
      return 'OPCIONAL';
    }

    switch (tipo) {
      case 'Vacaciones':
        return 'OBLIGATORIO (Formato de Vacaciones requerido)';
      case 'Permiso con goce':
        return 'OBLIGATORIO (Formato de Permiso con Goce requerido)';
      case 'Permiso de viaje':
        return 'OBLIGATORIO (Formato de Permiso de Viaje requerido)';
      case 'Home Office':
        return 'OBLIGATORIO (Formato de Home Office requerido)';
      case 'Otro':
        return 'OBLIGATORIO (Archivo firmado requerido para Otra Justificación)';
      case 'Checado sin Gafete':
        return 'OBLIGATORIO (Sin Entrada ni Salida registradas)';
      default:
        return 'OBLIGATORIO';
    }
  };

  const handleParaMiToggle = (paraMi: boolean) => {
    setEsParaMi(paraMi);
    setErrorMsg(null);
    if (paraMi) {
      setSelectedEmpId(currentUser.employeeId || '00615');
    } else {
      setSelectedEmpId(availableEmployees[0]?.id || '');
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
    reader.readAsDataURL(file);
  };

  // Descargar plantilla pre-llenada para firma
  const handleDownloadPrintableTemplate = () => {
    const emp = availableEmployees.find(e => e.id === targetEmpId);
    const empNombre = esParaMi ? currentUser.name : emp?.nombre || `Colaborador #${targetEmpId}`;
    const supNombre = esParaMi
      ? currentUser.supervisorName || currentUser.name
      : emp?.supervisor || currentUser.supervisorName || currentUser.name;
    const conceptoMostrado =
      tipo === 'Otro' && especificacionOtro.trim()
        ? `OTRA JUSTIFICACIÓN: ${especificacionOtro.trim().toUpperCase()}`
        : tipo.toUpperCase();

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>FORMATO DE SOLICITUD - ${conceptoMostrado} - #${targetEmpId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 36px; color: #0f172a; max-width: 720px; margin: 0 auto; }
    .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 16px; font-weight: bold; color: #1e3a8a; }
    .badge { background: #dbeafe; color: #1e3a8a; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; text-align: left; }
    th { background: #f1f5f9; width: 34%; font-weight: bold; color: #334155; }
    .signatures { display: flex; justify-content: space-between; margin-top: 64px; gap: 24px; text-align: center; }
    .sig-box { flex: 1; border-top: 1px solid #334155; padding-top: 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">FORMATO OFICIAL DE SOLICITUD — ${conceptoMostrado}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Recursos Humanos y Nóminas</div>
    </div>
    <div class="badge">Fecha: ${fechaInicio}</div>
  </div>
  <table>
    <tr><th>Número de Empleado (5 dígitos)</th><td><strong>#${targetEmpId}</strong></td></tr>
    <tr><th>Nombre del Colaborador</th><td><strong>${empNombre}</strong></td></tr>
    <tr><th>Supervisor que Autoriza</th><td>${supNombre}</td></tr>
    <tr><th>Tipo de Solicitud</th><td><strong>${conceptoMostrado}</strong></td></tr>
    <tr><th>Periodo Solicitado</th><td>Del <strong>${fechaInicio}</strong> al <strong>${tipo === 'Checado sin Gafete' ? fechaInicio : fechaFin}</strong></td></tr>
    ${
      tipo === 'Checado sin Gafete'
        ? `<tr><th>Horas Validada por Supervisor</th><td><strong>Entrada: ${entradaPropuesta} | Salida: ${salidaPropuesta}</strong></td></tr>`
        : ''
    }
    <tr><th>Motivo / Justificación</th><td>${motivo || 'Sin observaciones adicionales'}</td></tr>
  </table>
  <div class="signatures">
    <div class="sig-box"><strong>${empNombre} (#${targetEmpId})</strong><br/>Firma del Colaborador</div>
    <div class="sig-box"><strong>${supNombre}</strong><br/>Firma del Supervisor</div>
    <div class="sig-box"><strong>Recursos Humanos / Nóminas</strong><br/>Sello y Recepción</div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Formato_${tipo.replace(/\s+/g, '_')}_${targetEmpId}_${fechaInicio}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (tipo === 'Otro' && !especificacionOtro.trim()) {
      setErrorMsg(
        '⚠️ Regla Obligatoria: En "Otra Justificación Especial" debes especificar para qué es la solicitud (por ejemplo: Permiso de Paternidad).'
      );
      return;
    }

    if (!motivo.trim()) {
      setErrorMsg('Por favor describe el motivo o justificación detallada de la solicitud.');
      return;
    }

    if (isFileMandatory && (!uploadedFile || !uploadedFile.base64)) {
      if (tipo === 'Checado sin Gafete') {
        setErrorMsg(
          '⚠️ Regla Obligatoria: El colaborador no tiene registrada ni la Entrada ni la Salida en esa fecha. No puedes enviar la incidencia de Checada sin Gafete sin adjuntar el formato firmado que la respalde.'
        );
      } else if (tipo === 'Otro') {
        setErrorMsg(
          `⚠️ Regla Obligatoria: Para enviar "${especificacionOtro.trim() || 'Otra Justificación'}" es forzoso subir el archivo o formato firmado que la respalde.`
        );
      } else {
        setErrorMsg(
          `⚠️ Regla Obligatoria: Las solicitudes de "${tipo}" requieren forzosamente subir su formato firmado adjunto para poder enviarse a RH.`
        );
      }
      return;
    }

    let empNombre = '';
    let supNombre = currentUser.supervisorName || 'N/A';

    if (esParaMi) {
      empNombre = currentUser.name;
    } else {
      const emp = availableEmployees.find((e) => e.id === selectedEmpId);
      empNombre = emp?.nombre || `Empleado #${selectedEmpId}`;
      if (emp?.supervisor) {
        supNombre = emp.supervisor;
      }
    }

    const finalMotivo =
      tipo === 'Otro' && especificacionOtro.trim()
        ? `[${especificacionOtro.trim()}] ${motivo.trim()}`
        : motivo.trim();

    const newIncident: IncidentRequest = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      solicitanteId: currentUser.id,
      solicitanteNombre: currentUser.name,
      solicitanteRol: currentUser.role,
      esParaMi,
      empleadoId: targetEmpId,
      empleadoNombre: empNombre,
      supervisorNombre: supNombre,
      tipo,
      especificacionOtro: tipo === 'Otro' ? especificacionOtro.trim() : undefined,
      fechaInicio,
      fechaFin: tipo === 'Checado sin Gafete' ? fechaInicio : (fechaFin < fechaInicio ? fechaInicio : fechaFin),
      motivo: finalMotivo,
      status: 'pendiente',
      fechaCreacion: new Date().toISOString(),
      entradaPropuesta: tipo === 'Checado sin Gafete' ? entradaPropuesta : undefined,
      salidaPropuesta: tipo === 'Checado sin Gafete' ? salidaPropuesta : undefined,
      archivoFormatoNombre: uploadedFile?.nombre,
      archivoFormatoBase64: uploadedFile?.base64,
    };

    onSubmit(newIncident);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Palmtree className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Nueva Solicitud de Incidencia o Vacaciones
              </h3>
              <p className="text-[10px] text-slate-400">
                Se enviará a Recursos Humanos / Nóminas para su autorización oficial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Selector Para Mí vs Colaborador */}
          {isSupervisor && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                ¿Para quién es la solicitud?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleParaMiToggle(false)}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !esParaMi
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Para mi Colaborador</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleParaMiToggle(true)}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    esParaMi
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Palmtree className="w-3.5 h-3.5" />
                  <span>Para Mí ({currentUser.name.split(' ')[0]})</span>
                </button>
              </div>
            </div>
          )}

          {/* Selección de Colaborador */}
          {!esParaMi ? (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Colaborador Asignado
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500"
                required
              >
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    #{emp.id} - {emp.nombre} ({emp.supervisor || 'Sin Supervisor'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
              <span className="text-[10px] uppercase font-bold block">Solicitante / Beneficiario:</span>
              <p className="font-semibold text-xs mt-1 flex items-center gap-1.5">
                <span className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-[11px] font-bold text-blue-200 border border-blue-500/30">
                  ID: #{currentUser.employeeId || '00615'}
                </span>
                <span>{currentUser.name}</span>
                <span className="text-[11px] text-blue-400/80">({currentUser.email})</span>
              </p>
            </div>
          )}

          {/* Tipo de Incidencia */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Tipo de Solicitud / Incidencia
            </label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as IncidentType);
                setErrorMsg(null);
              }}
              className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 font-semibold"
            >
              <option value="Vacaciones">🏖️ Vacaciones (Requiere formato)</option>
              <option value="Permiso con goce">📑 Permiso con goce de sueldo (Requiere formato)</option>
              <option value="Permiso de viaje">✈️ Permiso de Viaje / Comisión (Requiere formato)</option>
              <option value="Home Office">🏠 Solicitud de Home Office (Requiere formato)</option>
              <option value="Permiso sin goce">⚖️ Permiso sin goce de sueldo (Formato opcional)</option>
              <option value="Checado sin Gafete">⏱️ Checado sin Gafete (1 falta = opcional | 2 faltas = obligatorio)</option>
              <option value="Cambio de horario">🔄 Cambio de Horario / Turno</option>
              <option value="Pase Médico">🏥 Pase Médico (IMSS / Clínica)</option>
              <option value="Incapacidad">🩺 Incapacidad Temporal</option>
              <option value="Otro">📝 Otra Justificación Especial (Ej. Permiso de Paternidad - Requiere formato)</option>
            </select>
          </div>

          {/* Si elige "Otro" (Otra Justificación): campo obligatorio para especificar la solicitud (ej. Permiso de Paternidad) */}
          {tipo === 'Otro' && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2">
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
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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

          {/* Rango de Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {tipo === 'Checado sin Gafete' ? 'Fecha de la Checada' : 'Fecha Inicio'}
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setErrorMsg(null);
                  if (e.target.value > fechaFin || tipo === 'Checado sin Gafete') {
                    setFechaFin(e.target.value);
                  }
                }}
                className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            {tipo !== 'Checado sin Gafete' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            )}
          </div>

          {/* Si es Checado sin Gafete: mostrar horas propuestas y estatus de checadas originales */}
          {tipo === 'Checado sin Gafete' && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[10px] font-bold uppercase text-purple-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Horas a Validar por Supervisor:
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Original en reloj: Ent {punchStatusForSelectedDate.origEnt} | Sal {punchStatusForSelectedDate.origSal}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Hora Entrada</label>
                  <input
                    type="time"
                    value={entradaPropuesta}
                    onChange={(e) => setEntradaPropuesta(e.target.value)}
                    className="w-full rounded-lg px-3 py-1.5 bg-slate-950 border border-purple-500/40 text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Hora Salida</label>
                  <input
                    type="time"
                    value={salidaPropuesta}
                    onChange={(e) => setSalidaPropuesta(e.target.value)}
                    className="w-full rounded-lg px-3 py-1.5 bg-slate-950 border border-purple-500/40 text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Motivo o Justificación */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Motivo o Justificación Detallada
            </label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === 'Otro'
                  ? 'Describe los detalles de la justificación especial (ej. nacimiento de hijo para permiso de paternidad)...'
                  : 'Describe el motivo o justificación de la solicitud...'
              }
              className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none"
              required
            />
          </div>

          {/* Adjuntar Archivo de Respaldo / Formato */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 flex-wrap">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Formato Firmado / Respaldo:</span>
                {isFileMandatory ? (
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-extrabold">
                    {getMandatoryBadgeLabel()}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                    {getMandatoryBadgeLabel()}
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={handleDownloadPrintableTemplate}
                className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 cursor-pointer"
              >
                <Printer className="w-3 h-3" />
                <span>Descargar Formato para Firma</span>
              </button>
            </div>

            <div
              className={`p-3.5 rounded-xl bg-slate-950 border-2 border-dashed text-center relative cursor-pointer transition-all ${
                isFileMandatory && !uploadedFile
                  ? 'border-rose-500/60 bg-rose-950/10 hover:border-rose-400'
                  : 'border-slate-800 hover:border-blue-500/50'
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
                  <span>Formato firmado adjunto: {uploadedFile.nombre}</span>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">
                    {isFileMandatory
                      ? `⚠️ Haz clic aquí para subir el formato firmado de ${
                          tipo === 'Otro' && especificacionOtro.trim()
                            ? especificacionOtro.trim()
                            : tipo
                        } (Requerido para enviar)`
                      : 'Haz clic si deseas adjuntar algún comprobante (No es forzoso para esta solicitud)'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Formatos admitidos: PDF, Imagen (JPG/PNG), Word o Excel
                  </p>
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Palmtree className="w-3.5 h-3.5" />
              Enviar a RH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
