/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';

export interface ActionMenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface HeadlessMenuProps {
  trigger: React.ReactNode;
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
}

export const HeadlessMenu: React.FC<HeadlessMenuProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
  menuClassName = '',
}) => {
  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <MenuButton as="div" className="cursor-pointer">
        {trigger}
      </MenuButton>

      <MenuItems
        transition
        anchor={align === 'right' ? 'bottom end' : 'bottom start'}
        className={`z-50 mt-1 min-w-[200px] overflow-hidden rounded-2xl p-1.5 shadow-2xl border outline-none
          bg-white/98 dark:bg-[#21222D]/98
          border-slate-200 dark:border-white/[0.1]
          text-slate-800 dark:text-slate-200
          backdrop-blur-md
          transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0
          ${menuClassName}`}
      >
        {items.map((item) => (
          <MenuItem key={item.id} disabled={item.disabled}>
            <button
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              className={`w-full group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left
                data-[focus]:bg-slate-100 dark:data-[focus]:bg-[#2B2B36]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  item.danger
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
};
