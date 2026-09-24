'use client';

import { useAuth } from '@/context/AuthContext';
import { Eye, X, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function EmulationBanner() {
  const { user, emulatedUser, setEmulation } = useAuth();

  if (user?.globalRole !== 'SUPER_ADMIN' || !emulatedUser) {
    return null;
  }

  return (
    <aside
      aria-label="Aviso de Modo Emulación"
      className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-900 dark:text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0"
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1 bg-amber-500/20 rounded-md text-amber-600 dark:text-amber-400 shrink-0">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold uppercase tracking-wider text-[11px] text-amber-600 dark:text-amber-400 mr-1.5 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Modo Emulación Activo:
          </span>
          <span>
            Estás interactuando como{' '}
            <strong className="text-zinc-900 dark:text-white font-semibold">
              {emulatedUser.name || emulatedUser.email}
            </strong>{' '}
            <span className="opacity-80 font-mono text-[11px]">({emulatedUser.email})</span>. Todas las operaciones y
            creaciones se ejecutarán en su nombre.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          Cambiar Usuario
        </Link>
        <button
          onClick={() => void setEmulation(null)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Finalizar Emulación
        </button>
      </div>
    </aside>
  );
}
