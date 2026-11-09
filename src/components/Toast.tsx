/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle, 
  X, 
  Sparkles,
  Send,
  Save,
  Check
} from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // en milisegundos, por defecto 4000
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      role="region"
      aria-live="polite"
      aria-label="Notificaciones del sistema"
    >
      {toasts.map(toast => (
        <SingleToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

interface SingleToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const SingleToastItem: React.FC<SingleToastProps> = ({ toast, onDismiss }) => {
  const duration = toast.duration ?? 4500;
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (duration <= 0) return;
    
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress(prev => {
          if (prev <= step) {
            clearInterval(timer);
            onDismiss(toast.id);
            return 0;
          }
          return prev - step;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, isPaused, onDismiss, toast.id]);

  // Paleta y estilos Bento según el tipo
  const typeConfig = {
    success: {
      border: 'border-[#A9DFD8]/30',
      glow: 'shadow-[0_10px_25px_-5px_rgba(169,223,216,0.15)]',
      iconBg: 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30',
      progressBar: 'bg-[#A9DFD8]',
      titleColor: 'text-[#A9DFD8]',
      defaultTitle: 'Acción completada',
      icon: CheckCircle2
    },
    info: {
      border: 'border-[#20AEF3]/30',
      glow: 'shadow-[0_10px_25px_-5px_rgba(32,174,243,0.15)]',
      iconBg: 'bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30',
      progressBar: 'bg-[#20AEF3]',
      titleColor: 'text-[#20AEF3]',
      defaultTitle: 'Aviso del sistema',
      icon: Info
    },
    warning: {
      border: 'border-[#FEB95A]/30',
      glow: 'shadow-[0_10px_25px_-5px_rgba(254,185,90,0.15)]',
      iconBg: 'bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30',
      progressBar: 'bg-[#FEB95A]',
      titleColor: 'text-[#FEB95A]',
      defaultTitle: 'Atención requerida',
      icon: AlertTriangle
    },
    error: {
      border: 'border-[#F43F5E]/30',
      glow: 'shadow-[0_10px_25px_-5px_rgba(244,63,94,0.15)]',
      iconBg: 'bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30',
      progressBar: 'bg-[#F43F5E]',
      titleColor: 'text-[#F43F5E]',
      defaultTitle: 'Error en la operación',
      icon: XCircle
    }
  }[toast.type];

  const IconComponent = typeConfig.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative overflow-hidden bg-[#21222D]/95 backdrop-blur-md border ${typeConfig.border} ${typeConfig.glow} text-slate-100 rounded-2xl p-3.5 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${typeConfig.iconBg}`}>
          <IconComponent className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${typeConfig.titleColor}`}>
              {toast.title || typeConfig.defaultTitle}
            </h4>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed mt-0.5 break-words">
            {toast.message}
          </p>

          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="mt-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          aria-label="Cerrar notificación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de progreso inferior para feedback de tiempo */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
          <div
            className={`h-full ${typeConfig.progressBar} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
