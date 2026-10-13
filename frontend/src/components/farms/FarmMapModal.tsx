'use client';

import type { ComponentType, ReactNode } from 'react';
import { X } from 'lucide-react';

interface FarmMapModalProps {
  icon: ComponentType<{ className?: string }>;
  /** Clases de color del ícono del header (fondo + texto). */
  iconClassName: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Ventana grande para los mapas de análisis de un campo (mapa de calor, recorridos). */
export default function FarmMapModal({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  onClose,
  children,
}: FarmMapModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="farm-map-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="farm-map-modal-title" className="font-bold text-base text-zinc-900 dark:text-white truncate">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
