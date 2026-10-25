'use client';

import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Pantalla para rutas a las que el rol de campo del usuario no tiene acceso (ej. entrar por URL directa). */
export function AccessDeniedState({
  description = 'Tu rol en este establecimiento no tiene permisos para esta sección. Consultá con el administrador del campo.',
  backHref = '/dashboard',
}: {
  description?: string;
  backHref?: string;
}) {
  return (
    <div className="p-6 md:p-8 w-full">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 md:p-16 rounded-xl text-center shadow-sm flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm">
          <ShieldOff className="w-7 h-7" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Acceso restringido</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{description}</p>
        </div>
        <div className="pt-2">
          <Button href={backHref} variant="outline" size="md">
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
