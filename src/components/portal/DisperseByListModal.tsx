/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Employee } from '../../types/attendance';
import { PortalUser, PayrollDispersal } from '../../types/portal';

interface DisperseByListModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeekNumber: number;
  selectedWeek: string;
  disperseSendEmail: boolean;
  onChangeDisperseSendEmail: (val: boolean) => void;
  disperseByListMsg: string;
  onChangeDisperseByListMsg: (val: string) => void;
  supervisorsList: string[];
  currentWeekDispersalObj?: PayrollDispersal;
  portalUsers: PortalUser[];
  getUserAllowedLists: (user: PortalUser) => string[];
  empleadosDB: Record<string, Employee>;
  onDisperseWeek: (
    weekNumber: number,
    weekKey: string,
    message: string,
    targetSupervisors?: string[],
    sendEmail?: boolean
  ) => void;
}

export const DisperseByListModal: React.FC<DisperseByListModalProps> = ({
  isOpen,
  onClose,
  currentWeekNumber,
  selectedWeek,
  disperseSendEmail,
  onChangeDisperseSendEmail,
  disperseByListMsg,
  onChangeDisperseByListMsg,
  supervisorsList,
  currentWeekDispersalObj,
  portalUsers,
  getUserAllowedLists,
  empleadosDB,
  onDisperseWeek,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#21222D] rounded-3xl shadow-2xl border border-white/[0.1] max-w-2xl w-full overflow-hidden animate-scale-in">
        <div className="bg-gradient-to-r from-[#171821] via-[#1B1C26] to-[#21222D] border-b border-white/[0.08] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] font-black text-base">
              ✉
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#A9DFD8] bg-[#A9DFD8]/15 px-2.5 py-0.5 rounded-md border border-[#A9DFD8]/30">
                Semana {currentWeekNumber} · Dispersión Individual o Masiva
              </span>
              <h3 className="text-lg font-extrabold tracking-tight mt-1 text-white">
                Dispersar Listas de Asistencia y Notificar
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#87888C] hover:text-white px-2.5 py-1 rounded-xl hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="bg-[#171821] border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-white">
                Notificación Dual: Sistema + Correo Empresarial
              </p>
              <p className="text-[11px] text-[#87888C] mt-0.5">
                Al dispersar una lista o todas las listas, el supervisor recibe alerta inmediata en la campana del sistema y en su correo corporativo con botón de acceso directo.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-[#21222D] px-3 py-2 rounded-xl border border-white/[0.1] shrink-0">
              <input
                type="checkbox"
                checked={disperseSendEmail}
                onChange={(e) => onChangeDisperseSendEmail(e.target.checked)}
                className="w-4 h-4 rounded accent-[#A9DFD8]"
              />
              <span className="text-xs font-bold text-white">Enviar Correo</span>
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#87888C] uppercase tracking-wider mb-1.5">
              Mensaje / Instrucciones para Supervisores
            </label>
            <input
              type="text"
              value={disperseByListMsg}
              onChange={(e) => onChangeDisperseByListMsg(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-medium text-white focus:border-[#A9DFD8] outline-none"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#87888C] uppercase tracking-wider">
                Supervisores ({supervisorsList.length} Listas)
              </span>
              <button
                onClick={() => {
                  onDisperseWeek(
                    currentWeekNumber,
                    selectedWeek,
                    disperseByListMsg,
                    undefined,
                    disperseSendEmail
                  );
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold shadow-xs transition-all cursor-pointer"
              >
                Dispersar Todas en un Solo Botón
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden">
              {supervisorsList.map((sup: string) => {
                const isAlreadyDispersed = currentWeekDispersalObj?.supervisoresNotificados.some(
                  (n: string) => n.trim().toUpperCase() === sup.trim().toUpperCase()
                );
                const supUser = portalUsers.find((u) =>
                  getUserAllowedLists(u).some(
                    (l: string) => l.trim().toUpperCase() === sup.trim().toUpperCase()
                  )
                );
                const empCount = Object.values(empleadosDB).filter((e) => e.jefe === sup).length;
                return (
                  <div
                    key={sup}
                    className="p-3.5 bg-[#171821] hover:bg-white/[0.02] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-white truncate">{sup}</span>
                        <span className="text-[10px] font-bold text-[#87888C] bg-[#21222D] border border-white/[0.08] px-2 py-0.5 rounded-md">
                          {empCount} colab.
                        </span>
                        {isAlreadyDispersed && (
                          <span className="text-[10px] font-extrabold text-[#A9DFD8] bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 px-2 py-0.5 rounded-md">
                            Dispersada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#87888C] font-medium truncate mt-0.5">
                        Correo corporativo:{' '}
                        <span className="font-bold text-[#20AEF3]">
                          {supUser?.email || 'No asignado'}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        onDisperseWeek(
                          currentWeekNumber,
                          selectedWeek,
                          disperseByListMsg,
                          [sup],
                          disperseSendEmail
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                        isAlreadyDispersed
                          ? 'bg-[#21222D] hover:bg-[#2B2B36] text-slate-200 border border-white/[0.1]'
                          : 'bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] shadow-xs'
                      }`}
                    >
                      {isAlreadyDispersed ? 'Re-Dispersar y Notificar' : 'Dispersar esta Lista'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#171821] border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#21222D] border border-white/[0.1] text-xs font-bold text-slate-200 hover:bg-[#2B2B36] transition-colors cursor-pointer"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  );
};
