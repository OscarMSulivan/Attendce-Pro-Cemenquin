/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Palmtree,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Paperclip,
  Download,
  Search,
  FileText
} from 'lucide-react';
import { IncidentRequest, IncidentStatus, PortalUser } from '../../types/portal';
import saveAs from 'file-saver';

interface IncidentsManagementViewProps {
  currentUser: PortalUser;
  incidents: IncidentRequest[];
  onOpenNewModal: () => void;
  onApproveIncident: (incidentId: string, notes?: string) => void;
  onRejectIncident: (incidentId: string, notes?: string) => void;
  onOpenAssignSchedules?: () => void;
}

export const IncidentsManagementView: React.FC<IncidentsManagementViewProps> = ({
  currentUser,
  incidents,
  onOpenNewModal,
  onApproveIncident,
  onRejectIncident,
  onOpenAssignSchedules,
}) => {
  const isRHOrAdmin = currentUser.role === 'rh' || currentUser.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const userFiltered = incidents.filter((inc) => {
    if (isRHOrAdmin) return true;
    return inc.solicitanteId === currentUser.id;
  });

  const pendingScheduleChangeRequests = userFiltered.filter(
    (inc) => inc.tipo === 'Cambio de horario' && inc.status === 'pendiente'
  );

  const displayList = userFiltered.filter((inc) => {
    if (statusFilter !== 'todos' && inc.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const termNum = parseInt(term, 10);
      const termNumStr = !isNaN(termNum) ? termNum.toString() : '';
      const matchName = inc.empleadoNombre.toLowerCase().includes(term);
      const matchId =
        inc.empleadoId.toLowerCase().includes(term) ||
        (Boolean(termNumStr) && inc.empleadoId.includes(termNumStr));
      const matchMotivo = inc.motivo.toLowerCase().includes(term);
      const matchTipo = inc.tipo.toLowerCase().includes(term);
      return matchName || matchId || matchMotivo || matchTipo;
    }
    return true;
  });

  const getStatusBadge = (inc: IncidentRequest) => {
    const status: IncidentStatus = inc.status;
    switch (status) {
      case 'aprobada':
        if (
          inc.autoAprobadaPorSupervisor ||
          inc.tipo === 'Permiso sin goce' ||
          (inc.revisadoPor && inc.revisadoPor.toLowerCase().includes('supervisor'))
        ) {
          return (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
              <CheckCircle2 className="w-3 h-3" /> Aprobada por Supervisor (Sin validación RH)
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35">
            <CheckCircle2 className="w-3 h-3" /> Aprobada por RH
          </span>
        );
      case 'rechazada':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/35">
            <XCircle className="w-3 h-3" /> Rechazada
          </span>
        );
      case 'pendiente':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/35">
            <Clock className="w-3 h-3" /> Pendiente de Validación RH
          </span>
        );
    }
  };

  const pendingCount = userFiltered.filter((i) => i.status === 'pendiente').length;
  const approvedCount = userFiltered.filter((i) => i.status === 'aprobada').length;
  const rejectedCount = userFiltered.filter((i) => i.status === 'rechazada').length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Alerta Destacada para RH cuando un Supervisor solicitó un Cambio de Horario */}
      {isRHOrAdmin && pendingScheduleChangeRequests.length > 0 && (
        <div className="rounded-2xl p-4 sm:p-5 bg-sky-950/40 border border-sky-500/40 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  🔔 Alerta RH: El supervisor solicitó un cambio de horario — Hay que aplicarlo en el sistema ({pendingScheduleChangeRequests.length})
                </h3>
                <p className="text-xs text-sky-200/80 mt-0.5">
                  Revisa las solicitudes de cambio de turno abajo, aplícalas en el módulo de Asignar Turno y aprueba la solicitud para actualizar la nómina.
                </p>
              </div>
            </div>
            {onOpenAssignSchedules && (
              <button
                type="button"
                onClick={onOpenAssignSchedules}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
              >
                Abrir Asignación de Turnos en Sistema
              </button>
            )}
          </div>
          <div className="space-y-1.5 pt-1">
            {pendingScheduleChangeRequests.map((req) => (
              <div
                key={req.id}
                className="px-3.5 py-2.5 rounded-xl bg-[#171821]/90 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="text-slate-200">
                  <span className="font-bold text-sky-300">
                    Supervisor {req.solicitanteNombre}
                  </span>{' '}
                  solicitó cambio de horario para{' '}
                  <strong className="text-white">
                    #{req.empleadoId} {req.empleadoNombre}
                  </strong>{' '}
                  · Vigencia:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {req.esIndefinido || req.fechaFin === 'INDEFINIDO'
                      ? `Indefinido / Permanente (desde ${req.fechaInicio})`
                      : `${req.fechaInicio} al ${req.fechaFin}`}
                  </span>
                  {req.horarioSolicitado ? (
                    <span className="ml-2 px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono font-bold text-[11px]">
                      Turno: {req.horarioSolicitado}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onOpenAssignSchedules && (
                    <button
                      type="button"
                      onClick={onOpenAssignSchedules}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 text-[11px] font-bold cursor-pointer"
                    >
                      Aplicar en Sistema
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onApproveIncident(
                        req.id,
                        'Cambio de horario aplicado en el sistema y validado por RH'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-[11px] font-extrabold cursor-pointer"
                  >
                    Marcar Aplicado y Aprobar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encabezado Principal y Resumen Bento (#21222D / #171821 / #A9DFD8) */}
      <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isRHOrAdmin
                  ? 'Bandeja de Incidencias y Solicitudes (RH)'
                  : 'Mis Solicitudes e Incidencias Registradas'}
              </h2>
              <p className="text-xs text-[#87888C] mt-0.5">
                {isRHOrAdmin
                  ? 'Autoriza o rechaza solicitudes de supervisores. Al aprobarse, se reflejan automáticamente en el cálculo de asistencia.'
                  : 'Consulta el estatus de tus formatos de checada sin gafete, permisos y solicitudes enviadas a Recursos Humanos.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNewModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud</span>
          </button>
        </div>

        {/* 4 Tarjetas Internas Estilo "Today's Sales" */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04]">
            <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
              {userFiltered.length}
            </p>
            <p className="text-xs font-medium text-[#E8E8EA] mt-1">Total Solicitudes</p>
            <p className="text-[10px] font-mono text-[#20AEF3] mt-1">Registradas en sistema</p>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04]">
            <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#FEB95A]">
              {pendingCount}
            </p>
            <p className="text-xs font-medium text-[#E8E8EA] mt-1">Pendientes</p>
            <p className="text-[10px] font-mono text-[#FEB95A] mt-1">Por validar en RH</p>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04]">
            <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#A9DFD8]">
              {approvedCount}
            </p>
            <p className="text-xs font-medium text-[#E8E8EA] mt-1">Aprobadas</p>
            <p className="text-[10px] font-mono text-[#A9DFD8] mt-1">Sincronizadas en nómina</p>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04]">
            <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-rose-400">
              {rejectedCount}
            </p>
            <p className="text-xs font-medium text-[#E8E8EA] mt-1">Rechazadas</p>
            <p className="text-[10px] font-mono text-rose-400 mt-1">No procedentes</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#171821] rounded-xl border border-white/[0.06] overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                : 'text-[#87888C] hover:text-white'
            }`}
          >
            Todas ({userFiltered.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pendiente')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'pendiente'
                ? 'bg-[#FEB95A] text-[#171821] shadow-sm'
                : 'text-[#87888C] hover:text-white'
            }`}
          >
            <span>Pendientes</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#171821] text-[#FEB95A] font-black text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('aprobada')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'aprobada'
                ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                : 'text-[#87888C] hover:text-white'
            }`}
          >
            Aprobadas ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rechazada')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'rechazada'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-[#87888C] hover:text-white'
            }`}
          >
            Rechazadas ({rejectedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar colaborador, #ID (00615) o motivo..."
            className="w-full rounded-xl pl-8 pr-3 py-2 bg-[#171821] border border-white/[0.08] text-white placeholder-[#87888C] text-xs outline-none focus:border-[#A9DFD8] font-mono"
          />
        </div>
      </div>

      {/* Lista de Solicitudes */}
      {displayList.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#21222D] border border-white/[0.06]">
          <Palmtree className="w-10 h-10 mx-auto text-[#87888C] mb-2" />
          <p className="text-sm font-bold text-white">No hay solicitudes para mostrar</p>
          <p className="text-xs text-[#87888C] mt-1">
            Usa el botón &ldquo;Nueva Solicitud&rdquo; para registrar permisos o incidencias justificadas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {displayList.map((inc) => (
            <div
              key={inc.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                inc.status === 'aprobada'
                  ? 'bg-[#21222D] border-[#A9DFD8]/35'
                  : inc.status === 'rechazada'
                  ? 'bg-[#21222D] border-rose-500/30'
                  : 'bg-[#21222D] border-[#FEB95A]/40 shadow-lg'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30">
                    #{inc.empleadoId}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {inc.empleadoNombre}
                  </span>
                  <span className="text-[11px] font-semibold text-[#A9DFD8] bg-[#A9DFD8]/12 px-2.5 py-0.5 rounded-md border border-[#A9DFD8]/30">
                    {inc.tipo === 'Otro' && inc.especificacionOtro
                      ? `Otra Justificación: ${inc.especificacionOtro}`
                      : inc.tipo}
                  </span>
                  {inc.entradaPropuesta && inc.salidaPropuesta && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F2C8ED]/15 text-[#F2C8ED] border border-[#F2C8ED]/35 font-mono">
                      Checada Supervisor: {inc.entradaPropuesta} - {inc.salidaPropuesta}
                    </span>
                  )}
                  {inc.tipo === 'Cambio de horario' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/35 font-mono">
                      {inc.esIndefinido || inc.fechaFin === 'INDEFINIDO'
                        ? 'Vigencia: Indefinido / Permanente'
                        : 'Cambio Temporal'}
                      {inc.horarioSolicitado ? ` · ${inc.horarioSolicitado}` : ''}
                    </span>
                  )}
                  {getStatusBadge(inc)}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#87888C]">
                  <span className="flex items-center gap-1 font-mono text-[#E8E8EA]">
                    <Calendar className="w-3.5 h-3.5 text-[#FEB95A]" />
                    {inc.esIndefinido || inc.fechaFin === 'INDEFINIDO'
                      ? `Desde ${inc.fechaInicio} (Indefinido)`
                      : `${inc.fechaInicio} al ${inc.fechaFin}`}
                  </span>
                  <span>·</span>
                  <span>
                    Solicitado por: <strong className="text-white">{inc.solicitanteNombre}</strong> ({inc.supervisorNombre})
                  </span>
                  <span>·</span>
                  <span>{new Date(inc.fechaCreacion).toLocaleDateString('es-MX')}</span>
                </div>

                <div className="text-xs text-[#E8E8EA] bg-[#171821] p-3 rounded-xl border border-white/[0.06]">
                  <span className="text-[10px] uppercase font-bold text-[#87888C] block">
                    Motivo / Justificación:
                  </span>
                  <p className="mt-0.5">{inc.motivo}</p>
                </div>

                {inc.archivoFormatoNombre && inc.archivoFormatoBase64 && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#171821] border border-[#F2C8ED]/35 text-xs">
                    <span className="flex items-center gap-1.5 text-[#F2C8ED] font-semibold truncate">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      Formato adjunto: <strong>{inc.archivoFormatoNombre}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const b64 = inc.archivoFormatoBase64!;
                          const commaIdx = b64.indexOf(',');
                          const mimeMatch = b64.match(/data:([^;]+);/);
                          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                          const raw = commaIdx >= 0 ? b64.slice(commaIdx + 1) : b64;
                          const chars = atob(raw);
                          const bytes = new Uint8Array(chars.length);
                          for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
                          saveAs(new Blob([bytes], { type: mime }), inc.archivoFormatoNombre!);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-[10px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </button>
                  </div>
                )}

                {inc.notasResolucion && (
                  <div className="text-xs text-[#A9DFD8] bg-[#A9DFD8]/10 p-2.5 rounded-xl border border-[#A9DFD8]/30">
                    <span className="text-[10px] uppercase font-bold block">
                      Resolución RH ({inc.revisadoPor}):
                    </span>
                    <p className="mt-0.5 italic">&ldquo;{inc.notasResolucion}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* Botones de Acción para RH / Admin */}
              {isRHOrAdmin && inc.status === 'pendiente' && (
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      onApproveIncident(inc.id, 'Aprobado conforme a políticas de la empresa');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold transition-all shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRejectIncident(inc.id, 'No procedente conforme a validación de RH');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 text-xs font-bold transition-all cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
