/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Settings, Mail, Clock, ShieldCheck, Cpu } from 'lucide-react';
import { AppConfig, ReadingMode } from '../types/attendance';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [emailDestino, setEmailDestino] = useState(config.emailDestino || '');
  const [toleranciaAntes, setToleranciaAntes] = useState(config.toleranciaAntes || 29);
  const [toleranciaDespues, setToleranciaDespues] = useState(config.toleranciaDespues || 14);
  const [jornadaBase, setJornadaBase] = useState(config.jornadaBase || 8.0);
  const [comidaDefault, setComidaDefault] = useState(config.comidaDefault || 60);
  const [modoLectura, setModoLectura] = useState<ReadingMode>(config.modoLectura || 'checadas_reales');
  const [minutosRebote, setMinutosRebote] = useState<number>(config.minutosRebote ?? 15);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      emailDestino,
      toleranciaAntes: Number(toleranciaAntes),
      toleranciaDespues: Number(toleranciaDespues),
      jornadaBase: Number(jornadaBase),
      comidaDefault: Number(comidaDefault),
      modoLectura,
      minutosRebote: Number(minutosRebote)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Configuración del Sistema</h3>
              <p className="text-[10px] text-slate-400">Parámetros globales de lectura biométrica, nómina y tolerancias</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Modo de Lectura de Checadas / Eventos
            </label>
            <select
              value={modoLectura}
              onChange={(e) => setModoLectura(e.target.value as ReadingMode)}
              className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="checadas_reales">Por Checadas Reales (Recomendado: une RST y eventos por hora)</option>
              <option value="jerarquia_eventos">Por Jerarquía de Eventos (ENT/SNT con rescate de RST)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              El modo &quot;Por Checadas Reales&quot; evita que un código RST oculte la entrada o salida de otro evento en el mismo día.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Ventana Anti-Rebote (min)
              </label>
              <input
                type="number"
                value={minutosRebote}
                onChange={(e) => setMinutosRebote(Number(e.target.value))}
                min={1}
                max={60}
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 text-center font-mono"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">Ignora doble checada seguida (default 15 min)</span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                Correo de Nómina
              </label>
              <input
                type="email"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
                placeholder="nomina@empresa.com"
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Tolerancia Antes (min)
              </label>
              <input
                type="number"
                value={toleranciaAntes}
                onChange={(e) => setToleranciaAntes(Number(e.target.value))}
                min={0}
                max={120}
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 text-center font-mono"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">Llegada anticipada permitida (default 29)</span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Tolerancia Después (min)
              </label>
              <input
                type="number"
                value={toleranciaDespues}
                onChange={(e) => setToleranciaDespues(Number(e.target.value))}
                min={0}
                max={60}
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 text-center font-mono"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">Minutos antes de falta/retardo (default 14)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Jornada Base Estándar (horas)
              </label>
              <input
                type="number"
                step="0.5"
                value={jornadaBase}
                onChange={(e) => setJornadaBase(Number(e.target.value))}
                min={4}
                max={12}
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 text-center font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Comida por Defecto (minutos)
              </label>
              <input
                type="number"
                step="5"
                value={comidaDefault}
                onChange={(e) => setComidaDefault(Number(e.target.value))}
                min={0}
                max={120}
                className="w-full text-xs rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-amber-500 text-center font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
