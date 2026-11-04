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
  FileText, 
  Filter, 
  Calendar, 
  User, 
  ShieldCheck, 
  MessageSquare,
  Sparkles,
  Info,
  Paperclip,
  Download
} from 'lucide-react';
import { IncidentRequest, IncidentStatus, PortalUser } from '../../types/portal';
import saveAs from 'file-saver';

interface IncidentsManagementViewProps {
  currentUser: PortalUser;
  incidents: IncidentRequest[];
  onOpenNewModal: () => void;
  onApproveIncident: (incidentId: string, notes?: string) => void;
  onRejectIncident: (incidentId: string, notes?: string) => void;
}

export const IncidentsManagementView: React.FC<IncidentsManagementViewProps> = ({
  currentUser,
  incidents,
  onOpenNewModal,
  onApproveIncident,
  onRejectIncident,
}) => {
  const isRHOrAdmin = currentUser.role === 'rh' || currentUser.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filtrado de incidencias
  // Si es supervisor, ÚNICAMENTE ve las solicitudes que él mismo ingresó (aislamiento total entre supervisores)
  const userFiltered = incidents.filter((inc) => {
    if (isRHOrAdmin) return true;
    return inc.solicitanteId === currentUser.id;
  });


  const displayList = userFiltered.filter((inc) => {
    if (statusFilter !== 'todos' && inc.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const termNum = parseInt(term, 10);
      const termNumStr = !isNaN(termNum) ? termNum.toString() : '';
      const matchName = inc.empleadoNombre.toLowerCase().includes(term);
      const matchId = inc.empleadoId.toLowerCase().includes(term) || (Boolean(termNumStr) && inc.empleadoId.includes(termNumStr));
      const matchMotivo = inc.motivo.toLowerCase().includes(term);
      const matchTipo = inc.tipo.toLowerCase().includes(term);
      return matchName || matchId || matchMotivo || matchTipo;
    }
    return true;
  });

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'aprobada':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3" /> Aprobada por RH
          </span>
        );
      case 'rechazada':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3" /> Rechazada
          </span>
        );
      case 'pendiente':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Clock className="w-3 h-3" /> Pendiente de Revisión
          </span>
        );
    }
  };

  const pendingCount = userFiltered.filter((i) => i.status === 'pendiente').length;

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="rounded-xl p-5 bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Palmtree className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isRHOrAdmin ? 'Bandeja de Incidencias y Vacaciones (RH)' : 'Mis Solicitudes de Vacaciones e Incidencias'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRHOrAdmin
                  ? 'Gestiona, autoriza o rechaza solicitudes de supervisores. Al aprobarse, se integran en automático al motor de asistencia.'
                  : 'Registra vacaciones para ti o para los colaboradores asignados a tu supervisión.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo de Sincronización Automática */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2.5">
        <Info className="w-4 h-4 shrink-0 text-blue-400" />
        <div>
          <span>
            <strong>Sincronización Inteligente:</strong> Toda incidencia o vacación aprobada se refleja instantáneamente en el cálculo de horas, eliminando alertas de falta y marcando las checadas en el reporte Excel generado.
          </span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'todos'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas ({userFiltered.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pendiente')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'pendiente'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Pendientes</span>
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('aprobada')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'aprobada'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aprobadas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rechazada')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'rechazada'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rechazadas
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por colaborador, ID o motivo..."
            className="w-full sm:w-64 rounded-xl px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Lista de Solicitudes */}
      {displayList.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
          <Palmtree className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-300">No hay incidencias para mostrar</p>
          <p className="text-xs text-slate-500 mt-1">
            Usa el botón "Nueva Solicitud" para registrar permisos o periodos vacacionales.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {displayList.map((inc) => (
            <div
              key={inc.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                inc.status === 'aprobada'
                  ? 'bg-slate-900/80 border-slate-800'
                  : inc.status === 'rechazada'
                  ? 'bg-slate-900/60 border-rose-950/40'
                  : 'bg-slate-900/95 border-amber-500/30 shadow-sm'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-100">
                    {inc.empleadoNombre}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    ID: #{inc.empleadoId}
                  </span>
                  <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {inc.tipo === 'Otro' && inc.especificacionOtro
                      ? `Otra Justificación: ${inc.especificacionOtro}`
                      : inc.tipo}
                  </span>
                  {inc.entradaPropuesta && inc.salidaPropuesta && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                      🟣 Checada Supervisor: {inc.entradaPropuesta} - {inc.salidaPropuesta}
                    </span>
                  )}
                  {getStatusBadge(inc.status)}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                  <span className="flex items-center gap-1 font-mono text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {inc.fechaInicio} al {inc.fechaFin}
                  </span>
                  <span>·</span>
                  <span>
                    Solicitado por: <strong className="text-slate-300">{inc.solicitanteNombre}</strong> ({inc.supervisorNombre})
                  </span>
                  <span>·</span>
                  <span>{new Date(inc.fechaCreacion).toLocaleDateString('es-MX')}</span>
                </div>

                <div className="mt-2 text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Motivo / Justificación:
                  </span>
                  <p className="mt-0.5">{inc.motivo}</p>
                </div>

                {inc.archivoFormatoNombre && inc.archivoFormatoBase64 && (
                  <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs">
                    <span className="flex items-center gap-1.5 text-purple-200 font-semibold truncate">
                      <Paperclip className="w-3.5 h-3.5 text-purple-400 shrink-0" />
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
                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Descargar Formato
                    </button>
                  </div>
                )}

                {inc.notasResolucion && (
                  <div className="mt-1.5 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
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
                      const notes = prompt('Notas de aprobación (opcional):', 'Aprobado conforme a políticas de la empresa') || '';
                      onApproveIncident(inc.id, notes);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const notes = prompt('Motivo del rechazo:', 'No cuenta con saldo disponible o fecha improcedente') || '';
                      onRejectIncident(inc.id, notes);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all"
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
