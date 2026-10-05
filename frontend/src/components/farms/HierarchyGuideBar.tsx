'use client';

import React from 'react';
import Link from 'next/link';
import { Tractor, Layers, Zap, ChevronRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface HierarchyGuideBarProps {
  currentLevel: 1 | 2 | 3;
  farmName?: string;
  farmId?: string;
  zoneName?: string;
  zoneId?: string;
  zonesCount?: number;
  fencesCount?: number;
  className?: string;
}

export function HierarchyGuideBar({
  currentLevel,
  farmName,
  farmId,
  zoneName,
  zoneId,
  zonesCount,
  fencesCount,
  className = '',
}: HierarchyGuideBarProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}
    >
      {/* Visual Step Tracker / Flow */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Step 1: Granja / Establecimiento */}
        <div
          className={`flex-1 flex items-start gap-3 p-3 rounded-xl transition-all ${
            currentLevel === 1
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/10 text-amber-950 dark:text-amber-200 shadow-xs'
              : currentLevel > 1
                ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-amber-950 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 cursor-pointer'
                : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 ${
              currentLevel === 1
                ? 'bg-amber-500 text-white'
                : 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Tractor className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <span>Nivel 1: Campo</span>
              {currentLevel === 1 ? (
                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                  Activo
                </span>
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="font-semibold text-sm truncate text-zinc-900 dark:text-white mt-0.5">
              {currentLevel > 1 ? (
                <Link href="/farms" className="hover:underline text-amber-700 dark:text-amber-300">
                  {farmName || 'Todos los campos'}
                </Link>
              ) : (
                farmName || 'Establecimiento Seleccionado'
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Perímetro general del campo</div>
          </div>
        </div>

        {/* Separator Arrow */}
        <div className="hidden md:flex items-center text-zinc-300 dark:text-zinc-700 shrink-0">
          <ChevronRight className="w-5 h-5" />
        </div>

        {/* Step 2: Zona / Potrero */}
        <div
          className={`flex-1 flex items-start gap-3 p-3 rounded-xl transition-all ${
            currentLevel === 2
              ? 'bg-green-50/70 dark:bg-green-950/30 border-2 border-green-600 dark:border-green-500 ring-2 ring-green-500/10 text-green-950 dark:text-green-200 shadow-xs'
              : currentLevel > 2
                ? 'bg-green-50/40 dark:bg-green-950/20 border border-green-200/80 dark:border-green-800/40 text-green-900 dark:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-900/30 cursor-pointer'
                : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 ${
              currentLevel === 2
                ? 'bg-green-600 text-white'
                : 'bg-green-500/15 dark:bg-green-500/20 text-green-600 dark:text-green-400'
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
              <span>Nivel 2: Zonas</span>
              {currentLevel === 2 ? (
                <span className="bg-green-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                  Activo
                </span>
              ) : currentLevel > 2 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              ) : null}
            </div>
            <div className="font-semibold text-sm truncate text-zinc-900 dark:text-white mt-0.5">
              {currentLevel !== 2 ? (
                <Link
                  href={farmId ? `/zonas?farmId=${farmId}` : '/zonas'}
                  className="hover:underline text-green-700 dark:text-green-400"
                >
                  {zoneName || (zonesCount !== undefined ? `${zonesCount} zona(s)` : 'Gestionar Zonas')}
                </Link>
              ) : zoneName ? (
                zoneName
              ) : zonesCount !== undefined ? (
                `${zonesCount} zona(s) registradas`
              ) : (
                'Subdivisiones del campo'
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Contenido dentro del Campo</div>
          </div>
        </div>

        {/* Separator Arrow */}
        <div className="hidden md:flex items-center text-zinc-300 dark:text-zinc-700 shrink-0">
          <ChevronRight className="w-5 h-5" />
        </div>

        {/* Step 3: Cerco Eléctrico Virtual */}
        <div
          className={`flex-1 flex items-start gap-3 p-3 rounded-xl transition-all ${
            currentLevel === 3
              ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-2 border-cyan-600 dark:border-cyan-500 ring-2 ring-cyan-500/10 text-cyan-950 dark:text-cyan-200 shadow-xs'
              : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 ${
              currentLevel === 3
                ? 'bg-cyan-600 text-white'
                : 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
            }`}
          >
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              <span>Nivel 3: Cercos</span>
              {currentLevel === 3 ? (
                <span className="bg-cyan-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                  Activo
                </span>
              ) : null}
            </div>
            <div className="font-semibold text-sm truncate text-zinc-900 dark:text-white mt-0.5">
              {currentLevel !== 3 ? (
                <Link
                  href={zoneId ? `/cercos?zoneId=${zoneId}${farmId ? `&farmId=${farmId}` : ''}` : '/cercos'}
                  className="hover:underline text-cyan-700 dark:text-cyan-400"
                >
                  {fencesCount !== undefined ? `${fencesCount} cerco(s)` : 'Gestionar Cercos'}
                </Link>
              ) : fencesCount !== undefined ? (
                `${fencesCount} cerco(s) en esta zona`
              ) : (
                'Cercos Eléctricos Virtuales'
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Contenido dentro de la Zona</div>
          </div>
        </div>
      </div>

      {/* Containment Policy Banner */}
      <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/80 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
        <ShieldAlert className="w-4 h-4 shrink-0 text-green-600 dark:text-green-500" />
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">Principio de Contención Espacial:</strong>{' '}
          {currentLevel === 1 ? (
            <>
              El <strong>Campo</strong> define el límite general. Cualquier potrero o zona interna debe estar dentro del
              perímetro delimitado.
            </>
          ) : currentLevel === 2 ? (
            <>
              Al crear o editar una <strong>Zona</strong>, cada punto debe posicionarse dentro del{' '}
              <span className="text-amber-600 dark:text-amber-400 font-semibold">perímetro del Campo</span>.
            </>
          ) : (
            <>
              Al crear o editar un <strong>Cerco Eléctrico</strong>, cada punto debe posicionarse dentro del{' '}
              <span className="text-green-600 dark:text-green-400 font-semibold">perímetro de la Zona</span>.
            </>
          )}
        </span>
      </div>
    </div>
  );
}
