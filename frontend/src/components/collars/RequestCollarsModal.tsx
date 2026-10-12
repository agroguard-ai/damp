'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, X, Check, Building2, AlertTriangle } from 'lucide-react';

interface RequestCollarsModalProps {
  isOpen: boolean;
  farms: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (data: { farmId: string; requestedCount: number; notes?: string }) => Promise<void>;
}

export function RequestCollarsModal({ isOpen, farms, onClose, onSubmit }: RequestCollarsModalProps) {
  const [farmId, setFarmId] = useState(farms[0]?.id || '');
  const [requestedCount, setRequestedCount] = useState<number | string>(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar farmId cada vez que se abre el modal o cambian los establecimientos disponibles
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setNotes('');
      setFarmId((prev) => {
        if (prev && farms.some((f) => f.id === prev)) {
          return prev;
        }
        return farms[0]?.id || '';
      });
    }
  }, [isOpen, farms]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveFarmId = farmId || farms[0]?.id || '';
    if (!effectiveFarmId) {
      setError('Seleccione un establecimiento');
      return;
    }

    const countNum = typeof requestedCount === 'string' ? parseInt(requestedCount, 10) : requestedCount;
    if (isNaN(countNum) || countNum < 1) {
      setError('La cantidad requerida debe ser al menos 1 unidad');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        farmId: effectiveFarmId,
        requestedCount: countNum,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al solicitar collares');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 text-zinc-900 dark:text-white font-bold text-base">
            <PlusCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
            Solicitar Más Collares
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {farms.length === 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>No tienes establecimientos registrados en la plataforma. Creá un campo primero para solicitar collares.</span>
            </div>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enviá un pedido formal a la administración central de AgroGuard para ampliar la dotación contratada de
            collares para tu hacienda.
          </p>

          {/* Farm selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              Establecimiento destino *
            </label>
            <select
              value={farmId || farms[0]?.id || ''}
              onChange={(e) => {
                setFarmId(e.target.value);
                setError(null);
              }}
              disabled={farms.length === 0}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer disabled:opacity-50"
            >
              {farms.length === 0 ? (
                <option value="" disabled>
                  No hay establecimientos disponibles
                </option>
              ) : (
                farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Cantidad de collares adicionales requeridos *
            </label>
            <div className="flex items-center gap-3">
              <input
                required
                type="number"
                min={1}
                max={200}
                value={requestedCount}
                onChange={(e) => {
                  const val = e.target.value;
                  setRequestedCount(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                  setError(null);
                }}
                className="w-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-xs text-zinc-400">unidades de hardware</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Observaciones / Justificación comercial (opcional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Incorporación de 10 terneros en potrero norte el próximo mes..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
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
              disabled={loading || farms.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enviar Solicitud
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
