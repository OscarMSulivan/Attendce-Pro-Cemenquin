/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
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

    // Bloquear scroll de la página mientras el modal está activo
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop con blur suave y tono amigable */}
      <div
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${maxWidth} relative transform overflow-hidden rounded-2xl p-5 sm:p-6 text-left align-middle shadow-2xl transition-all border
            bg-white dark:bg-[#21222D]
            border-slate-200 dark:border-white/[0.08]
            text-slate-900 dark:text-slate-100
            animate-scale-in`}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-white/[0.06]">
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
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  aria-label="Cerrar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};
