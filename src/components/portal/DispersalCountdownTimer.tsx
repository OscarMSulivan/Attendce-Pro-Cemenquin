/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';

interface DispersalCountdownTimerProps {
  limiteLiberacion?: string;
  isReleased?: boolean;
  isCancelled?: boolean;
  compact?: boolean;
  className?: string;
}

export const DispersalCountdownTimer: React.FC<DispersalCountdownTimerProps> = ({
  limiteLiberacion,
  isReleased = false,
  isCancelled = false,
  compact = false,
  className = '',
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!limiteLiberacion || isReleased || isCancelled) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [limiteLiberacion, isReleased, isCancelled]);

  if (isCancelled) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30 ${className}`}
      >
        <Ban className="w-3.5 h-3.5" />
        <span>Cancelada</span>
      </span>
    );
  }

  if (isReleased) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-teal-500/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-500/30 ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Liberada a tiempo</span>
      </span>
    );
  }

  if (!limiteLiberacion) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 ${className}`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>Sin límite estricto</span>
      </span>
    );
  }

  const target = new Date(limiteLiberacion).getTime();
  const diff = target - now;

  if (isNaN(target)) {
    return null;
  }

  // Si ya venció
  if (diff <= 0) {
    const elapsed = Math.abs(diff);
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse ${className}`}
        title={`El límite fijado fue ${new Date(limiteLiberacion).toLocaleString()}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span>
          {compact ? `Vencida +${hours}h ${minutes}m` : `⚠️ Superó límite (+${hours}h ${minutes}m)`}
        </span>
      </span>
    );
  }

  // Aún dentro del tiempo límite
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const isUrgent = diff < 2 * 3600000; // Menos de 2 horas

  const formattedTime = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(
    2,
    '0'
  )}m ${String(seconds).padStart(2, '0')}s`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition-colors ${
        isUrgent
          ? 'bg-amber-500/15 text-amber-700 dark:text-[#FEB95A] border-amber-500/40'
          : 'bg-sky-500/15 text-sky-700 dark:text-[#20AEF3] border-sky-500/35'
      } ${className}`}
      title={`Fecha límite: ${new Date(limiteLiberacion).toLocaleString()}`}
    >
      <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-500 animate-spin-slow' : 'text-sky-500'}`} />
      <span>{compact ? formattedTime : `Plazo restante: ${formattedTime}`}</span>
    </span>
  );
};
