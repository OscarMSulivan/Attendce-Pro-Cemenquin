/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings, Mail, Clock, ShieldCheck, Cpu, Lock, Eye, EyeOff, Send, CheckCircle2 } from 'lucide-react';
import { AppConfig, ReadingMode } from '../types/attendance';
import { EmailServerConfig, PortalUser, userHasModuleAccess } from '../types/portal';
import { PortalService } from '../services/portalService';
import { HeadlessModal } from './ui/HeadlessModal';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
  currentUser?: PortalUser;
  emailConfig?: EmailServerConfig;
  onSaveEmailConfig?: (cfg: EmailServerConfig) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  currentUser,
  emailConfig,
  onSaveEmailConfig,
}) => {
  const [emailDestino, setEmailDestino] = useState(config.emailDestino || '');
  const [toleranciaAntes, setToleranciaAntes] = useState(config.toleranciaAntes || 29);
  const [toleranciaDespues, setToleranciaDespues] = useState(config.toleranciaDespues || 14);
  const [jornadaBase, setJornadaBase] = useState(config.jornadaBase || 8.0);
  const [comidaDefault, setComidaDefault] = useState(config.comidaDefault || 60);
  const [modoLectura, setModoLectura] = useState<ReadingMode>(config.modoLectura || 'checadas_reales');
  const [minutosRebote, setMinutosRebote] = useState<number>(config.minutosRebote ?? 15);
  const [horasLimiteLiberacion, setHorasLimiteLiberacion] = useState<number>(config.horasLimiteLiberacion ?? 24);

  // Estado de Credenciales SMTP
  const [smtpForm, setSmtpForm] = useState<EmailServerConfig>(() => emailConfig || PortalService.loadEmailConfig());
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (emailConfig) {
      setSmtpForm(emailConfig);
    }
  }, [emailConfig]);

  useEffect(() => {
    setHorasLimiteLiberacion(config.horasLimiteLiberacion ?? 24);
  }, [config.horasLimiteLiberacion]);

  const canConfigureTimeLimit = !currentUser || userHasModuleAccess(currentUser, 'tiempo_limite');
  const canConfigureSmtp = !currentUser || userHasModuleAccess(currentUser, 'smtp_correo');

  const handleTestSmtp = async () => {
    if (!smtpForm.smtpUser || !smtpForm.smtpPass) {
      setSmtpFeedback({
        ok: false,
        message: 'Ingresa el usuario (correo) y contraseña / clave de aplicación para probar la conexión.',
      });
      return;
    }
    setIsTestingSmtp(true);
    setSmtpFeedback(null);
    try {
      const cleaned: EmailServerConfig = {
        ...PortalService.loadEmailConfig(),
        ...(emailConfig || {}),
        ...smtpForm,
        smtpHost: (smtpForm.smtpHost || 'smtp.gmail.com').trim(),
        smtpPort: Number(smtpForm.smtpPort) || 587,
        smtpUser: (smtpForm.smtpUser || '').trim(),
        smtpPass: (smtpForm.smtpPass || '').trim(),
        smtpSecure: Boolean(smtpForm.smtpSecure) || Number(smtpForm.smtpPort) === 465,
        smtpFromName: (smtpForm.smtpFromName || 'CemenQtime Nóminas').trim(),
      };
      PortalService.saveEmailConfig(cleaned);
      if (onSaveEmailConfig) onSaveEmailConfig(cleaned);

      const res = await fetch('/api/notifications/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSmtpFeedback({
          ok: true,
          message: data.message || `✓ Conexión verificada. Correo de prueba enviado a ${cleaned.smtpUser}.`,
        });
      } else {
        setSmtpFeedback({
          ok: false,
          message: data.error || 'Error al autenticar con el servidor SMTP.',
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        ok: false,
        message: err.message || 'Error al probar el servidor SMTP.',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSave = () => {
    if (canConfigureSmtp) {
      const cleanedSmtp: EmailServerConfig = {
        ...PortalService.loadEmailConfig(),
        ...(emailConfig || {}),
        ...smtpForm,
        smtpHost: (smtpForm.smtpHost || 'smtp.gmail.com').trim(),
        smtpPort: Number(smtpForm.smtpPort) || 587,
        smtpUser: (smtpForm.smtpUser || '').trim(),
        smtpPass: (smtpForm.smtpPass || '').trim(),
        smtpSecure: Boolean(smtpForm.smtpSecure) || Number(smtpForm.smtpPort) === 465,
        smtpFromName: (smtpForm.smtpFromName || 'CemenQtime Nóminas').trim(),
      };
      PortalService.saveEmailConfig(cleanedSmtp);
      if (onSaveEmailConfig) {
        onSaveEmailConfig(cleanedSmtp);
      }
    }

    onSaveConfig({
      emailDestino,
      toleranciaAntes: Number(toleranciaAntes),
      toleranciaDespues: Number(toleranciaDespues),
      jornadaBase: Number(jornadaBase),
      comidaDefault: Number(comidaDefault),
      modoLectura,
      minutosRebote: Number(minutosRebote),
      ...(canConfigureTimeLimit ? { horasLimiteLiberacion: Number(horasLimiteLiberacion) } : {}),
    });
    onClose();
  };

  return (
    <HeadlessModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-600 dark:text-[#A9DFD8]">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Configuración del Sistema y Servidor SMTP</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Parámetros globales de lectura biométrica, límite de horas, SMTP y tolerancias</p>
          </div>
        </div>
      }
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" />
            Modo de Lectura de Checadas / Eventos
          </label>
          <select
            value={modoLectura}
            onChange={(e) => setModoLectura(e.target.value as ReadingMode)}
            className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] transition-all"
          >
            <option value="checadas_reales">
              Por Checadas Reales (Recomendado: Une pares Entrada/Salida con fusión RST)
            </option>
            <option value="jerarquia_eventos">
              Por Jerarquía de Eventos (Respeta tipo de evento del biométrico con rescate RST)
            </option>
          </select>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            &ldquo;Checadas Reales&rdquo; resuelve los casos donde el reloj invierte o mezcla eventos RST, asignando automáticamente según el horario programado.
          </p>
        </div>

        {/* Límite de Horas para Liberar Nómina (Supervisores) */}
        {canConfigureTimeLimit && (
          <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-[#171821] border border-amber-200 dark:border-amber-500/30 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-[#FEB95A] block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Límite de Tiempo para Liberar Nómina tras Dispersión (Horas)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={horasLimiteLiberacion}
                onChange={(e) => setHorasLimiteLiberacion(Math.max(0, Number(e.target.value)))}
                min={0}
                max={336}
                className="w-32 text-xs rounded-xl px-3 py-2 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 transition-all font-mono font-bold"
              />
              <div className="flex flex-wrap gap-1">
                {[12, 24, 36, 48, 72].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorasLimiteLiberacion(h)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono border cursor-pointer ${
                      horasLimiteLiberacion === h
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-white dark:bg-[#21222D] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Tiempo permitido por defecto para que los supervisores liberen su lista después de dispersada (se muestra como cuenta regresiva en su portal).
            </p>
          </div>
        )}

        {/* Configuración Segura de Credenciales SMTP */}
        {canConfigureSmtp && (
          <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-[#171821] border border-indigo-200 dark:border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Credenciales SMTP (Envío Automático de Correos de Dispersión)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSmtpForm(prev => ({ ...prev, smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpSecure: false }))}
                  className="px-2 py-0.5 rounded bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpForm(prev => ({ ...prev, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecure: false }))}
                  className="px-2 py-0.5 rounded bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Office 365
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Servidor SMTP (Host)</span>
                <input
                  type="text"
                  value={smtpForm.smtpHost || ''}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full text-xs rounded-xl px-3 py-1.5 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Puerto</span>
                <input
                  type="number"
                  value={smtpForm.smtpPort || 587}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 587;
                    setSmtpForm(prev => ({ ...prev, smtpPort: p, smtpSecure: p === 465 }));
                  }}
                  placeholder="587"
                  className="w-full text-xs rounded-xl px-3 py-1.5 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Usuario / Correo Remitente</span>
                <input
                  type="email"
                  value={smtpForm.smtpUser || ''}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpUser: e.target.value }))}
                  placeholder="nominas@empresa.com"
                  className="w-full text-xs rounded-xl px-3 py-1.5 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-indigo-500" /> Contraseña / Clave App
                </span>
                <div className="relative">
                  <input
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpForm.smtpPass || ''}
                    onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpPass: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full text-xs rounded-xl pl-3 pr-8 py-1.5 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/[0.08] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(smtpForm.smtpSecure)}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpSecure: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Conexión SSL Directa (465)</span>
              </label>

              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{isTestingSmtp ? 'Probando...' : 'Probar Conexión SMTP'}</span>
              </button>
            </div>

            {smtpFeedback && (
              <div
                className={`p-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
                  smtpFeedback.ok
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{smtpFeedback.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Minutos de rebote anti-duplicados */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-[#FEB95A]" />
            Ventana Anti-Rebote Biométrica (Minutos)
          </label>
          <input
            type="number"
            value={minutosRebote}
            onChange={(e) => setMinutosRebote(Number(e.target.value))}
            min={1}
            max={60}
            className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] transition-all font-mono"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Ignora marcas biométricas repetidas de un mismo colaborador si ocurren dentro de este lapso (ej. checada doble por error).
          </p>
        </div>

        {/* Correo de Destino */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-[#20AEF3]" />
            Correo Corporativo de Nómina
          </label>
          <input
            type="email"
            value={emailDestino}
            onChange={(e) => setEmailDestino(e.target.value)}
            placeholder="nomina@empresa.com"
            className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] transition-all font-mono"
          />
        </div>

        {/* Tolerancias */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-[#FEB95A]" />
              Tolerancia Entrada (min antes)
            </label>
            <input
              type="number"
              value={toleranciaAntes}
              onChange={(e) => setToleranciaAntes(Number(e.target.value))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] text-center font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-[#FEB95A]" />
              Tolerancia Retardo (min después)
            </label>
            <input
              type="number"
              value={toleranciaDespues}
              onChange={(e) => setToleranciaDespues(Number(e.target.value))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] text-center font-mono"
            />
          </div>
        </div>

        {/* Jornada Base y Comida */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" />
              Jornada Base Diaria (hrs)
            </label>
            <input
              type="number"
              step="0.5"
              value={jornadaBase}
              onChange={(e) => setJornadaBase(Number(e.target.value))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] text-center font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-[#FEB95A]" />
              Comida Predeterminada (min)
            </label>
            <input
              type="number"
              value={comidaDefault}
              onChange={(e) => setComidaDefault(Number(e.target.value))}
              min={0}
              max={120}
              className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] text-center font-mono"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white dark:bg-[#A9DFD8] dark:hover:bg-[#A9DFD8]/90 dark:text-[#171821] shadow-sm hover:shadow transition-all cursor-pointer"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </HeadlessModal>
  );
};
