/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  DialogDescription
} from '@headlessui/react';
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
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop con blur suave y tono amigable */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 z-50 w-screen overflow-y-auto p-4 flex min-h-full items-center justify-center">
        <DialogPanel
          transition
          className={`w-full ${maxWidth} transform overflow-hidden rounded-2xl p-5 sm:p-6 text-left align-middle shadow-2xl transition-all duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 border
            bg-white dark:bg-[#21222D]
            border-slate-200 dark:border-white/[0.08]
            text-slate-900 dark:text-slate-100`}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                {title && (
                  <DialogTitle as="div" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {title}
                  </DialogTitle>
                )}
                {subtitle && (
                  <DialogDescription as="div" className="text-xs text-slate-500 dark:text-[#87888C] mt-1">
                    {subtitle}
                  </DialogDescription>
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
        </DialogPanel>
      </div>
    </Dialog>
  );
};
