/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  X, 
  FileCheck, 
  Users,
  MessageSquare
} from 'lucide-react';
import { PortalUser } from '../../types/portal';

interface SupervisorReleaseModalProps {
  currentUser: PortalUser;
  targetSupervisor: string;
  semanaNumero: number;
  semanaPeriodo: string;
  empleadosCount: number;
  horasNormales: number;
  horasExtras: number;
  alertasCount: number;
  pendingOvertimeCount?: number;
  pendingMissingPunchCount?: number;
  onClose: () => void;
  onConfirmRelease: (comments: string) => void;
}

export const SupervisorReleaseModal: React.FC<SupervisorReleaseModalProps> = ({
  currentUser,
  targetSupervisor,
  semanaNumero,
  semanaPeriodo,
  empleadosCount,
  horasNormales,
  horasExtras,
  alertasCount,
  pendingOvertimeCount = 0,
  pendingMissingPunchCount = 0,
  onClose,
  onConfirmRelease,
}) => {
  const [comments, setComments] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasPendingTasks = alertasCount > 0 || pendingOvertimeCount > 0 || pendingMissingPunchCount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPendingTasks) {
      setValidationError('Tienes tareas pendientes (alertas, checadas o tiempos extras) que debes resolver antes de liberar.');
      return;
    }
    onConfirmRelease(comments.trim());
  };

  const isSuplente = currentUser.supervisorName !== targetSupervisor;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#21222D] border border-[#2C2D3C] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2C2D3C] bg-[#171821] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Liberar Nómina a Recursos Humanos
              </h3>
              <p className="text-[10px] text-[#8C8D9B]">
                Semana {semanaNumero} · {targetSupervisor}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {isSuplente && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span className="text-[10px] uppercase font-bold block">
                Liberación en Calidad de Suplente:
              </span>
              <p className="mt-0.5">
                Estás liberando la nómina de <strong>{targetSupervisor}</strong> autorizado por tu perfil de suplente ({currentUser.name}).
              </p>
            </div>
          )}

          {/* Resumen de Cifras */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <span className="text-[9px] uppercase text-[#8C8D9B] block">Empleados</span>
              <span className="text-sm font-bold text-slate-200 tabular-nums">
                {empleadosCount}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <span className="text-[9px] uppercase text-[#8C8D9B] block">H. Normales</span>
              <span className="text-sm font-bold text-slate-200 tabular-nums">
                {horasNormales.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <span className="text-[9px] uppercase text-[#8C8D9B] block">H. Extras</span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {horasExtras.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <span className="text-[9px] uppercase text-[#8C8D9B] block">Alertas</span>
              <span className={`text-sm font-bold tabular-nums ${alertasCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {alertasCount}
              </span>
            </div>
          </div>

          {hasPendingTasks && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 space-y-1.5">
              <div className="flex items-start gap-2 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>Bloqueo: Tienes pendientes que resolver antes de liberar:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5 pl-1">
                {alertasCount > 0 && (
                  <li><strong>{alertasCount}</strong> alerta(s) de checada o inconsistencia en la semana.</li>
                )}
                {pendingOvertimeCount > 0 && (
                  <li><strong>{pendingOvertimeCount}</strong> jornada(s) con tiempo extra pendiente de autorizar (SÍ / NO).</li>
                )}
                {pendingMissingPunchCount > 0 && (
                  <li><strong>{pendingMissingPunchCount}</strong> día(s) con checadas incompletas sin justificar.</li>
                )}
              </ul>
              <p className="text-[10px] text-rose-300 font-semibold pt-1">
                Regresa a la tabla de asistencia y resuelve cada pendiente para habilitar la liberación.
              </p>
            </div>
          )}

          {validationError && (
            <p className="text-rose-400 text-[11px] font-bold">{validationError}</p>
          )}

          {/* Comentarios del Supervisor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8D9B] block mb-1">
              Observaciones / Comentarios para RH (Opcional)
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ej: Se revisaron y confirmaron las checadas del personal..."
              className="w-full rounded-xl px-3 py-2 bg-[#171821] border border-[#2C2D3C] text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-600 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2C2D3C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#8C8D9B] hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={hasPendingTasks}
              className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center gap-1.5 ${
                hasPendingTasks
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {hasPendingTasks ? 'Resuelve los pendientes para liberar' : 'Liberar Nómina a RH'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
