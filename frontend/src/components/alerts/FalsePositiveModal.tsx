'use client';

import { useState } from 'react';
import { AlertTriangle, X, Check, BrainCircuit } from 'lucide-react';
import { alertsApi } from '@/lib/api/alerts';
import { useToast } from '@/context/ToastContext';
import type { Alert } from '@/types';

interface FalsePositiveModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PREDEFINED_REASONS = [
  'Animal clínicamente sano (revisado por veterinario/operario en campo)',
  'Fiebre no confirmada (temperatura rectal o corporal dentro de rango normal)',
  'Comportamiento normal (animal en período de descanso o rumia habitual)',
  'Lectura atípica transitoria de sensor / collar',
  'Intervención médica o manejo previo reciente',
  'Otro motivo',
];

export default function FalsePositiveModal({ alert, isOpen, onClose, onSuccess }: FalsePositiveModalProps) {
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState<string>(PREDEFINED_REASONS[0]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen || !alert) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fullNote = customNotes.trim() ? `${selectedReason}: ${customNotes.trim()}` : selectedReason;

      await alertsApi.markFalsePositive(alert.id, fullNote);
      toast.success('Alerta marcada como falso positivo. Feedback guardado para reentrenamiento.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar falso positivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">
              Marcar como Falso Positivo (Feedback IA)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info de la alerta */}
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800 space-y-1 text-xs">
          <p className="font-semibold text-zinc-900 dark:text-white">
            Animal: {alert.animal?.tag || `ID: ${alert.animalId.slice(0, 8)}`}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">{alert.message}</p>
          <p className="text-[11px] text-zinc-400 pt-0.5">Fecha: {new Date(alert.createdAt).toLocaleString()}</p>
        </div>

        {/* Explicación de reentrenamiento CU014 */}
        <div className="flex items-start gap-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-3 rounded-xl text-xs text-blue-800 dark:text-blue-300">
          <BrainCircuit className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p>
            Al marcar esta alerta como falso positivo, el sistema guarda este feedback junto con la ventana de
            telemetría para incorporarlo en los futuros reentrenamientos del modelo de Machine Learning.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300">
              Motivo principal del falso positivo:
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-900 dark:text-white text-xs focus:ring-1 focus:ring-amber-500"
            >
              {PREDEFINED_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300">
              Observaciones adicionales del operario o veterinario (opcional):
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Ej: Se midió temperatura rectal de 38.6°C, el animal come con normalidad..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-900 dark:text-white text-xs focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
