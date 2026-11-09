/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
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
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, filterText]);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
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
        <label className="text-xs font-semibold text-slate-400 dark:text-[#87888C] mb-1.5 flex items-center gap-1.5 select-none">
          {icon}
          {label}
        </label>
      )}

      <div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
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
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/30">
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

        {isOpen && (
          <div
            role="listbox"
            className={`absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-[200px] overflow-auto rounded-2xl p-1.5 text-xs outline-none shadow-2xl border
              bg-white/98 dark:bg-[#21222D]/98
              border-slate-200 dark:border-white/[0.1]
              text-slate-800 dark:text-slate-200
              backdrop-blur-md animate-scale-in
              ${optionsClassName}`}
          >
            {searchable && (
              <div className="p-1 mb-1 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filtrar opciones..."
                    className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-[#171821] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none border border-slate-200 dark:border-white/[0.08] focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-2 px-3 text-center text-[11px] text-slate-400 dark:text-slate-500 italic">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs select-none cursor-pointer transition-colors
                      ${
                        isSelected
                          ? 'bg-teal-50/80 dark:bg-[#A9DFD8]/15 text-teal-900 dark:text-[#A9DFD8] font-bold'
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
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
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
        )}
      </div>
    </div>
  );
};
