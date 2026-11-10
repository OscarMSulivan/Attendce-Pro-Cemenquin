/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface HeadlessSelectProps {
  label?: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  buttonClassName?: string;
  optionsClassName?: string;
}

export const HeadlessSelect: React.FC<HeadlessSelectProps> = ({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  searchable = false,
  className = '',
  buttonClassName = '',
  optionsClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!filterText.trim()) return options;
    const q = filterText.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, filterText]);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const minWidth = Math.max(rect.width, 240);
    const left = Math.min(rect.left, Math.max(8, viewportWidth - minWidth - 12));

    // Si hay poco espacio abajo (< 220px) y más espacio arriba, abrir hacia arriba
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      const maxHeight = Math.min(340, Math.max(160, spaceAbove - 8));
      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        bottom: `${viewportHeight - rect.top + 6}px`,
        width: `${minWidth}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 9999,
      });
    } else {
      const maxHeight = Math.min(340, Math.max(180, spaceBelow - 8));
      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.bottom + 6}px`,
        width: `${minWidth}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 9999,
      });
    }
  }, []);

  // Actualizar posición al abrir y al hacer scroll o resize
  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handleScrollOrResize = (e: Event) => {
      // Si el scroll ocurre dentro del propio menú desplegable, no recalcular ni cerrar
      if (dropdownRef.current && e.target instanceof Node && dropdownRef.current.contains(e.target)) {
        return;
      }
      updateMenuPosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateMenuPosition]);

  // Cerrar al hacer clic fuera tanto del botón como del menú en el Portal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current && containerRef.current.contains(target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Enfocar buscador al abrir si es searchable
  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setFilterText('');
  };

  return (
    <div ref={containerRef} className={`w-full ${className} relative`}>
      {label && (
        <label className="text-xs font-semibold text-slate-500 dark:text-[#87888C] mb-1.5 flex items-center gap-1.5 select-none">
          {icon}
          {label}
        </label>
      )}

      <div>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (!isOpen) {
              updateMenuPosition();
            }
            setIsOpen((prev) => !prev);
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-left transition-all outline-none cursor-pointer border
            bg-white dark:bg-[#171821]
            text-slate-800 dark:text-slate-100
            border-slate-200 dark:border-white/[0.08]
            hover:border-slate-300 dark:hover:border-white/20
            focus-visible:ring-2 focus-visible:ring-teal-500/30 dark:focus-visible:ring-[#A9DFD8]/30
            focus-visible:border-teal-500 dark:focus-visible:border-[#A9DFD8]
            shadow-xs dark:shadow-none
            ${buttonClassName}`}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            {selectedOption?.icon}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/30 shrink-0">
                {selectedOption.badge}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 dark:text-[#87888C] shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              style={menuStyle}
              className={`flex flex-col rounded-2xl p-1.5 text-xs outline-none shadow-2xl border
                bg-white dark:bg-[#21222D]
                border-slate-200 dark:border-white/[0.12]
                text-slate-800 dark:text-slate-200
                animate-scale-in overflow-hidden
                ${optionsClassName}`}
            >
              {searchable && (
                <div className="p-1.5 mb-1 border-b border-slate-100 dark:border-white/[0.08] shrink-0">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Buscar en la lista..."
                      className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#171821] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none border border-slate-200 dark:border-white/[0.08] focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              <div className="overflow-y-auto flex-1 pr-0.5 space-y-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="py-3 px-3 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                    Sin resultados ({options.length} disponibles)
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <div
                        key={opt.value || '__all__'}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(opt.value)}
                        className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs select-none cursor-pointer transition-colors
                          ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-900 dark:text-[#A9DFD8] font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-[#2B2B36] text-slate-700 dark:text-slate-300 font-medium'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          {opt.icon}
                          <div className="truncate">
                            <div className="truncate">{opt.label}</div>
                            {opt.sublabel && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <span className="w-4 flex items-center justify-center text-teal-600 dark:text-[#A9DFD8]">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
