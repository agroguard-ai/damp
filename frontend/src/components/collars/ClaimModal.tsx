'use client';

import { useState } from 'react';
import { AlertTriangle, Wrench, X, Check } from 'lucide-react';
import type { Collar } from '@/types';

interface ClaimModalProps {
  isOpen: boolean;
  collar: Collar | null;
  onClose: () => void;
  onSubmit: (data: { reason: string; description?: string; markAsDamaged: boolean }) => Promise<void>;
}

const COMMON_REASONS = [
  'Batería no retiene carga / Falla de energía',
  'Sin señal LoRa / Pérdida continua de telemetría',
  'Rotura física de sujeción / Correa cortada',
  'Daño en carcasa plástica / Hermeticidad rota',
  'Lecturas erráticas de temperatura / Sensor defectuoso',
  'Collar extraviado o caído en campo',
  'Otro motivo técnico',
];

export function ClaimModal({ isOpen, collar, onClose, onSubmit }: ClaimModalProps) {
  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [markAsDamaged, setMarkAsDamaged] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !collar) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Otro motivo técnico' && customReason.trim() ? customReason.trim() : reason;
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        reason: finalReason,
        description: description.trim() || undefined,
        markAsDamaged,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el reclamo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 text-zinc-900 dark:text-white font-bold text-base">
            <Wrench className="w-5 h-5 text-amber-500" />
            Iniciar Reclamo Técnico / Reportar Falla
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Collar header info */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Dispositivo
              </span>
              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                {collar.identifier}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Estado Actual
              </span>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {collar.assignedAnimal ? `Colocado en ${collar.assignedAnimal.tag || 'Animal'}` : 'Sin animal colocado'}
              </span>
            </div>
          </div>

          {/* Reason selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Motivo principal del reclamo *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Otro motivo técnico' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Especifique el motivo *
              </label>
              <input
                required
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ej: Falla en la antena LoRa"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Detalle u observaciones adicionales (opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa qué ocurrió, cómo se detectó el problema o si requiere recambio físico..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Mark as damaged checkbox */}
          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsDamaged}
                onChange={(e) => setMarkAsDamaged(e.target.checked)}
                className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-amber-900 dark:text-amber-300 block">
                  Marcar de inmediato el collar como DAÑADO
                </span>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed block mt-0.5">
                  {collar.assignedAnimal ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-600" />
                      Se liberará automáticamente al animal <strong>{collar.assignedAnimal.tag || 'asignado'}</strong>{' '}
                      para que puedas colocarle otro collar sano sin bloquearlo.
                    </>
                  ) : (
                    'El collar pasará a estado Dañado en el inventario hasta su revisión o recambio.'
                  )}
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enviar Reclamo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
