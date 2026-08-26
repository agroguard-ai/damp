'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Resalta el botón de confirmar en rojo — para acciones destructivas (archivar, eliminar, revocar). */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | undefined>(undefined);

/**
 * Reemplazo de `window.confirm()` (item 5.2 del análisis UX/UI: "Modales de Confirmación
 * Descriptivos... para acciones destructivas"). Misma forma de uso que confirm() nativo pero
 * async: `if (!(await confirm({ title: '...' }))) return;`
 */
export const useConfirm = (): ConfirmFn => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
};

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const ConfirmDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-99999 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-6 space-y-4 animate-toast-slide-in">
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  pending.danger
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="confirm-dialog-title" className="font-bold text-zinc-900 dark:text-white text-sm">
                  {pending.title}
                </h3>
                {pending.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{pending.description}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => handleClose(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer ${
                  pending.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};
