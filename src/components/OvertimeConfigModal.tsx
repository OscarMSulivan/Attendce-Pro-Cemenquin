/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Ban,
  ArrowRight,
  Timer,
} from 'lucide-react';
import {
  DEFAULT_OVERTIME_RULES,
  OvertimeCalculationMode,
  OvertimeRoundingMode,
  OvertimeRulesConfig,
} from '../types/attendance';
import { calcularMetricasDia } from '../core/attendanceEngine';
import { HeadlessModal } from './ui/HeadlessModal';

interface OvertimeConfigContentProps {
  rules: OvertimeRulesConfig;
  jornadaBase?: number;
  onSaveRules: (newRules: OvertimeRulesConfig) => void;
  onCancel?: () => void;
  isStandaloneModule?: boolean;
}

export const OvertimeConfigContent: React.FC<OvertimeConfigContentProps> = ({
  rules,
  jornadaBase = 8.0,
  onSaveRules,
  onCancel,
  isStandaloneModule = false,
}) => {
  const [form, setForm] = useState<OvertimeRulesConfig>(() => ({
    ...DEFAULT_OVERTIME_RULES,
    ...(rules || {}),
  }));
  const [savedBanner, setSavedBanner] = useState(false);

  // Estado del Simulador en vivo para que el usuario compruebe cómo funcionan sus reglas
  const [simScheduleEnt, setSimScheduleEnt] = useState('08:00');
  const [simScheduleSal, setSimScheduleSal] = useState('17:00');
  const [simPunchEnt, setSimPunchEnt] = useState('07:50');
  const [simPunchSal, setSimPunchSal] = useState('17:15');

  useEffect(() => {
    setForm({
      ...DEFAULT_OVERTIME_RULES,
      ...(rules || {}),
    });
  }, [rules]);

  const simResult = useMemo(() => {
    return calcularMetricasDia(
      simPunchEnt,
      simPunchSal,
      {
        entrada: simScheduleEnt,
        salida: simScheduleSal,
        comida: 60,
        cruzaMedianoche: false,
      },
      jornadaBase,
      false,
      undefined,
      undefined,
      true,
      form
    );
  }, [simScheduleEnt, simScheduleSal, simPunchEnt, simPunchSal, jornadaBase, form]);

  const handleResetDefaults = () => {
    setForm({ ...DEFAULT_OVERTIME_RULES });
    setSavedBanner(false);
  };

  const handleSubmit = () => {
    const cleaned: OvertimeRulesConfig = {
      minutosMinimosParaExtra: Math.max(0, Number(form.minutosMinimosParaExtra) || 0),
      ignorarEntradaAnticipada: Boolean(form.ignorarEntradaAnticipada),
      permitirExtraAntesEntradaConUmbral: Boolean(form.permitirExtraAntesEntradaConUmbral),
      minutosMinimosAntesEntrada: Math.max(1, Number(form.minutosMinimosAntesEntrada) || 60),
      modoCalculoExtra: form.modoCalculoExtra || 'desde_minuto_uno',
      redondeoExtra: form.redondeoExtra || 'exacto',
      topeMaximoExtraDiarioHrs: Math.max(0, Number(form.topeMaximoExtraDiarioHrs) || 0),
    };
    onSaveRules(cleaned);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 4000);
  };

  return (
    <div className="space-y-5">
      {/* Resumen de Política Activa */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-[#171821] border border-amber-200 dark:border-[#FEB95A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-[#FEB95A]/15 border border-amber-300 dark:border-[#FEB95A]/30 flex items-center justify-center text-amber-700 dark:text-[#FEB95A] shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200/70 dark:bg-[#FEB95A]/20 text-amber-900 dark:text-[#FEB95A]">
                Regla Activa en Nómina
              </span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                Extra a partir de {form.minutosMinimosParaExtra} min ·{' '}
                {form.ignorarEntradaAnticipada
                  ? 'Llegadas anticipadas NO cuentan como extra'
                  : 'Llegadas anticipadas sí suman'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Al guardar, el motor de nómina recalcula automáticamente todos los reportes y quita cualquier tiempo extra menor al mínimo o por llegar temprano.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#21222D] hover:bg-slate-100 dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Recomendados</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* BLOQUE 1: LLEGADAS ANTICIPADAS (EJ. 10 MIN ANTES) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-[#A9DFD8] block">
                1. Control de Entrada Temprana
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                ¿Qué pasa si checan antes de su hora de entrada?
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Evita que si un colaborador llega 10 o 15 minutos antes de su turno (ej. 07:50 para entrar a las 08:00), el sistema se lo tome como tiempo extra.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  ignorarEntradaAnticipada: true,
                  permitirExtraAntesEntradaConUmbral: false,
                }))
              }
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                form.ignorarEntradaAnticipada && !form.permitirExtraAntesEntradaConUmbral
                  ? 'bg-teal-50/80 dark:bg-[#A9DFD8]/15 border-teal-400 dark:border-[#A9DFD8] shadow-sm'
                  : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06] hover:border-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  form.ignorarEntradaAnticipada && !form.permitirExtraAntesEntradaConUmbral
                    ? 'bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821]'
                    : 'bg-slate-200 dark:bg-slate-800 text-transparent'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-rose-500" />
                  <span>Ignorar SIEMPRE llegadas antes de su hora de entrada (Recomendado)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Si su horario inicia a las <strong>08:00</strong> y checa a las <strong>07:50</strong> (10 min antes), su conteo inicia a las <strong>08:00</strong>. Cero minutos extra por llegar antes.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  ignorarEntradaAnticipada: true,
                  permitirExtraAntesEntradaConUmbral: true,
                }))
              }
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                form.ignorarEntradaAnticipada && form.permitirExtraAntesEntradaConUmbral
                  ? 'bg-teal-50/80 dark:bg-[#A9DFD8]/15 border-teal-400 dark:border-[#A9DFD8] shadow-sm'
                  : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06] hover:border-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  form.ignorarEntradaAnticipada && form.permitirExtraAntesEntradaConUmbral
                    ? 'bg-teal-600 dark:bg-[#A9DFD8] text-white dark:text-[#171821]'
                    : 'bg-slate-200 dark:bg-slate-800 text-transparent'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Ignorar llegadas normales (10-30 min), pero contar si entra mucho antes
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Útil si alguien entra 1 o 2 horas antes por turno especial, pero descartando los 10-20 min de llegada cotidiana.
                </p>
                {form.ignorarEntradaAnticipada && form.permitirExtraAntesEntradaConUmbral && (
                  <div
                    className="mt-2.5 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Contar entrada anticipada solo si llega al menos:
                    </span>
                    <input
                      type="number"
                      min={15}
                      max={480}
                      value={form.minutosMinimosAntesEntrada}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          minutosMinimosAntesEntrada: Math.max(15, Number(e.target.value) || 60),
                        }))
                      }
                      className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-center text-slate-900 dark:text-white"
                    />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      min antes
                    </span>
                  </div>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  ignorarEntradaAnticipada: false,
                  permitirExtraAntesEntradaConUmbral: false,
                }))
              }
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                !form.ignorarEntradaAnticipada
                  ? 'bg-amber-50/80 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/50'
                  : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06] hover:border-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  !form.ignorarEntradaAnticipada
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-200 dark:bg-slate-800 text-transparent'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Tomar hora exacta de checada de entrada (Incluir minutos previos)
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Suma los minutos desde el instante en que checa entrada aunque sea antes de su turno.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* BLOQUE 2: A PARTIR DE CUÁNTO TIEMPO ES TIEMPO EXTRA */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-[#FEB95A] block">
              2. Umbral Mínimo para Tiempo Extra
            </span>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              ¿A partir de cuántos minutos después de la salida cuenta como Tiempo Extra?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Si el colaborador sale unos minutos tarde (ej. en lo que recoge sus cosas y checa), no se marcará como Tiempo Extra hasta cumplir este mínimo:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { min: 15, label: '15 min' },
              { min: 20, label: '20 min' },
              { min: 30, label: '30 min (Media hora)' },
              { min: 45, label: '45 min' },
              { min: 60, label: '60 min (1 hora)' },
            ].map((preset) => (
              <button
                key={preset.min}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, minutosMinimosParaExtra: preset.min }))
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  form.minutosMinimosParaExtra === preset.min
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-[#171821] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-amber-400'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Minutos mínimos personalizados:
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Menos de {form.minutosMinimosParaExtra} minutos extra = <strong>0.00 hrs extra</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={240}
                value={form.minutosMinimosParaExtra}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    minutosMinimosParaExtra: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/15 text-sm font-mono font-extrabold text-center text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">minutos</span>
            </div>
          </div>

          {/* Cómo contar cuando sí supera el mínimo */}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Cuando SÍ supera los {form.minutosMinimosParaExtra} minutos, ¿cómo se calcula?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    modoCalculoExtra: 'desde_minuto_uno' as OvertimeCalculationMode,
                  }))
                }
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  form.modoCalculoExtra === 'desde_minuto_uno'
                    ? 'bg-blue-50/80 dark:bg-blue-500/15 border-blue-400 dark:border-blue-400'
                    : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06]'
                }`}
              >
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Contar todo desde la hora de salida
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Ej: Si el mínimo es {form.minutosMinimosParaExtra} min y se quedó 45 min, cuenta los <strong>45 min</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    modoCalculoExtra: 'despues_del_umbral' as OvertimeCalculationMode,
                  }))
                }
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  form.modoCalculoExtra === 'despues_del_umbral'
                    ? 'bg-blue-50/80 dark:bg-blue-500/15 border-blue-400 dark:border-blue-400'
                    : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06]'
                }`}
              >
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Contar solo después del umbral
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Ej: Si el mínimo es {form.minutosMinimosParaExtra} min y se quedó 45 min, cuenta <strong>{Math.max(0, 45 - form.minutosMinimosParaExtra)} min</strong>.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 3: REDONDEO POR BLOQUES Y TOPE DIARIO */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-[#F2C8ED] block mb-1">
            3. Redondeo de Tiempo Extra
          </label>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Elige si deseas pagar minutos exactos o únicamente bloques cerrados (ej. medias horas u horas completas):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'exacto', label: 'Minutos Exactos', sub: 'Ej. 45m = 0.75 hrs' },
                { id: '15_min', label: 'Cada 15 Minutos', sub: 'Bloques de 0.25 hrs' },
                { id: '30_min', label: 'Cada 30 Minutos', sub: 'Solo medias horas (0.5h)' },
                { id: '60_min', label: 'Horas Completas', sub: 'Solo bloques de 1.0h' },
              ] as Array<{ id: OvertimeRoundingMode; label: string; sub: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, redondeoExtra: opt.id }))}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  form.redondeoExtra === opt.id
                    ? 'bg-purple-50 dark:bg-purple-500/15 border-purple-400 dark:border-purple-400'
                    : 'bg-slate-50 dark:bg-[#171821] border-slate-200 dark:border-white/[0.06]'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-[#20AEF3] block mb-1">
            4. Límite / Tope Máximo Diario (Opcional)
          </label>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Si deseas limitar el máximo de horas extras que puede acumular una persona en un solo día (coloca 0 para sin límite):
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { hrs: 0, label: 'Sin límite (0)' },
              { hrs: 2, label: 'Máx 2 hrs/día' },
              { hrs: 3, label: 'Máx 3 hrs/día' },
              { hrs: 4, label: 'Máx 4 hrs/día' },
            ].map((item) => (
              <button
                key={item.hrs}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, topeMaximoExtraDiarioHrs: item.hrs }))
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  form.topeMaximoExtraDiarioHrs === item.hrs
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-[#171821] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="number"
                min={0}
                max={16}
                step={0.5}
                value={form.topeMaximoExtraDiarioHrs}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    topeMaximoExtraDiarioHrs: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-center text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* SIMULADOR INTERACTIVO EN TIEMPO REAL */}
      <div className="p-4 rounded-2xl bg-slate-100/90 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Simulador en Vivo — Prueba cómo se calculan las checadas con tu configuración
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSimPunchEnt('07:50');
                setSimPunchSal('17:00');
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-teal-400"
            >
              Ej 1: Llegó 10m antes (07:50 a 17:00)
            </button>
            <button
              type="button"
              onClick={() => {
                setSimPunchEnt('07:50');
                setSimPunchSal('17:15');
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-teal-400"
            >
              Ej 2: Llegó 10m antes y salió 15m después
            </button>
            <button
              type="button"
              onClick={() => {
                setSimPunchEnt('07:50');
                setSimPunchSal('17:45');
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-teal-400"
            >
              Ej 3: Salió 45m después (17:45)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Horario Entrada
            </span>
            <input
              type="time"
              value={simScheduleEnt}
              onChange={(e) => setSimScheduleEnt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Horario Salida (1h comida)
            </span>
            <input
              type="time"
              value={simScheduleSal}
              onChange={(e) => setSimScheduleSal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#21222D] border border-slate-300 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-teal-700 dark:text-[#A9DFD8] block mb-1">
              Checada Entrada Real
            </span>
            <input
              type="time"
              value={simPunchEnt}
              onChange={(e) => setSimPunchEnt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#21222D] border border-teal-400 dark:border-[#A9DFD8]/50 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-700 dark:text-[#FEB95A] block mb-1">
              Checada Salida Real
            </span>
            <input
              type="time"
              value={simPunchSal}
              onChange={(e) => setSimPunchSal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#21222D] border border-amber-400 dark:border-[#FEB95A]/50 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/10 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Resultado Nómina
            </span>
            <div className="flex items-center gap-2 mt-0.5 font-mono">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {simResult.hNormal.toFixed(2)}h Norm
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${
                  simResult.hExtra > 0
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {simResult.hExtra.toFixed(2)}h Extra
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback de guardado */}
      {savedBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            ✓ Reglas de Tiempo Extra guardadas y aplicadas a la nómina en tiempo real.
          </span>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-end gap-3">
        {onCancel && !isStandaloneModule && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-teal-600 hover:bg-teal-500 dark:bg-[#A9DFD8] dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] shadow-md transition-all cursor-pointer flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Guardar Reglas y Recalcular Nómina</span>
        </button>
      </div>
    </div>
  );
};

interface OvertimeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: OvertimeRulesConfig;
  jornadaBase?: number;
  onSaveRules: (newRules: OvertimeRulesConfig) => void;
}

export const OvertimeConfigModal: React.FC<OvertimeConfigModalProps> = ({
  isOpen,
  onClose,
  rules,
  jornadaBase = 8.0,
  onSaveRules,
}) => {
  return (
    <HeadlessModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-[#FEB95A]/15 border border-amber-300 dark:border-[#FEB95A]/30 flex items-center justify-center text-amber-700 dark:text-[#FEB95A]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Módulo de Configuración de Tiempo Extra
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              Define desde cuántos minutos aplica el tiempo extra y bloquea llegadas anticipadas (ej. 10 min antes)
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <OvertimeConfigContent
        rules={rules}
        jornadaBase={jornadaBase}
        onSaveRules={(newRules) => {
          onSaveRules(newRules);
          onClose();
        }}
        onCancel={onClose}
      />
    </HeadlessModal>
  );
};
