/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface HeadlessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // 'max-w-md' | 'max-w-lg' | 'max-w-2xl' | 'max-w-4xl' etc.
  showCloseButton?: boolean;
}

export const HeadlessModal: React.FC<HeadlessModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Bloquear scroll del documento mientras el modal está activo
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Cerrar al presionar la tecla Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop fijo a la ventana actual del usuario */}
      <div
        className="fixed inset-0 backdrop-blur-xs transition-opacity"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del Modal siempre centrado en la vista actual del usuario */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} relative z-10 my-auto max-h-[90vh] flex flex-col rounded-2xl text-left shadow-2xl transition-all border
          bg-white dark:bg-[#21222D]
          border-slate-200 dark:border-white/[0.08]
          text-slate-900 dark:text-slate-100
          animate-scale-in overflow-hidden`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200 dark:border-white/[0.06] shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-xs text-slate-500 dark:text-[#87888C] mt-1">
                  {subtitle}
                </div>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
};
