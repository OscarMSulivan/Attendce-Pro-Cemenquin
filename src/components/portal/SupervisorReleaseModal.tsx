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
  onClose,
  onConfirmRelease,
}) => {
  const [comments, setComments] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmRelease(comments.trim());
  };

  const isSuplente = currentUser.supervisorName !== targetSupervisor;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Liberar Nómina a Recursos Humanos
              </h3>
              <p className="text-[10px] text-slate-400">
                Semana {semanaNumero} · {targetSupervisor}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
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
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[9px] uppercase text-slate-500 block">Empleados</span>
              <span className="text-sm font-bold text-slate-200 tabular-nums">
                {empleadosCount}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[9px] uppercase text-slate-500 block">H. Normales</span>
              <span className="text-sm font-bold text-slate-200 tabular-nums">
                {horasNormales.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[9px] uppercase text-slate-500 block">H. Extras</span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {horasExtras.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[9px] uppercase text-slate-500 block">Alertas</span>
              <span className={`text-sm font-bold tabular-nums ${alertasCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {alertasCount}
              </span>
            </div>
          </div>

          {alertasCount > 0 && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>
                Hay <strong>{alertasCount}</strong> alerta(s) de checada pendiente(s). Si procedes con la liberación, por favor explica el motivo o la validación en los comentarios de abajo.
              </span>
            </div>
          )}

          {/* Comentarios del Supervisor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Observaciones / Comentarios para RH (Opcional)
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ej: Se revisaron y confirmaron las checadas del personal. El tiempo extra de Rolando Barrera queda autorizado conforme al turno extraordinario del fin de semana..."
              className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-600 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Liberar Nómina a RH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
