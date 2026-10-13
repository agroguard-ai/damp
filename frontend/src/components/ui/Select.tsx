'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

const MENU_MAX_HEIGHT = 280;
const MENU_MIN_WIDTH = 176;
const MENU_GAP = 6;

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

/**
 * Calcula dónde dibujar el menú (fijo respecto a la ventana, vía portal) para que no lo
 * recorten los contenedores con overflow, como los modales. Si no entra abajo, abre hacia arriba.
 */
function computeMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width, MENU_MIN_WIDTH);
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow) {
    return { left, width, bottom: window.innerHeight - rect.top + MENU_GAP };
  }
  return { left, width, top: rect.bottom + MENU_GAP };
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  /** Validación nativa del formulario ("Completá este campo") mientras no haya valor. */
  required?: boolean;
  /** Nombre del campo para formularios que leen el valor por `name`. */
  name?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar una opción',
  label,
  helperText,
  error,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  className = '',
  size = 'md',
  id: customId,
  required = false,
  name,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const selectId = customId || autoId;

  const openMenu = useCallback(() => {
    if (triggerRef.current) setMenuPosition(computeMenuPosition(triggerRef.current));
    setSearchQuery('');
    setIsOpen(true);
  }, []);

  // Mientras está abierto, el menú sigue al botón si se scrollea o cambia el tamaño de la ventana
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      if (triggerRef.current) setMenuPosition(computeMenuPosition(triggerRef.current));
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen]);

  // Selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filtered options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.description && opt.description.toLowerCase().includes(query)) ||
      (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  });

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // El menú vive en un portal: un clic adentro de él no cuenta como "afuera"
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        openMenu();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
        const nextIndex = currentIndex < filteredOptions.length - 1 ? currentIndex + 1 : 0;
        if (filteredOptions[nextIndex] && !filteredOptions[nextIndex].disabled) {
          onChange(filteredOptions[nextIndex].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredOptions.length - 1;
        if (filteredOptions[prevIndex] && !filteredOptions[prevIndex].disabled) {
          onChange(filteredOptions[prevIndex].value);
        }
      }
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-3.5 py-2.5 text-sm rounded-xl',
    lg: 'px-4 py-3 text-base rounded-xl',
  }[size];

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block select-none"
        >
          {label}
        </label>
      )}

      {/* Input oculto: permite la validación nativa `required` y leer el valor por `name` */}
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          onInvalid={() => triggerRef.current?.focus()}
          className="absolute bottom-0 left-1/2 w-px h-px opacity-0 pointer-events-none"
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-listbox`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (isOpen) setIsOpen(false);
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between text-left transition-all duration-200 outline-none cursor-pointer ${sizeClasses} ${
          error
            ? 'bg-red-50/50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 focus:ring-2 focus:ring-red-500/20'
            : isOpen
              ? 'bg-white dark:bg-zinc-900 border-2 border-green-600 dark:border-green-500 ring-2 ring-green-500/15 shadow-sm'
              : 'bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white shadow-xs'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          {selectedOption?.icon && (
            <selectedOption.icon className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          )}
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-zinc-900 dark:text-white truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-green-600 dark:text-green-400' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu (portal: no lo recortan los contenedores con overflow) */}
      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={menuPosition}
            className="fixed z-1100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Optional Search Bar */}
            {searchable && (
              <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5" role="listbox" id={`${selectId}-listbox`}>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  No se encontraron opciones
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (!opt.disabled) {
                          onChange(opt.value);
                          setIsOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        {opt.icon && (
                          <opt.icon
                            className={`w-4 h-4 shrink-0 ${
                              isSelected ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'
                            }`}
                          />
                        )}
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{opt.label}</span>
                            {opt.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal truncate mt-0.5">
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{helperText}</span>
      ) : null}
    </div>
  );
}
