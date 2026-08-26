'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { collarsApi } from '@/lib/api/collars';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import type { CollarStatus } from '@/types';

const STATUS_LABELS: Record<CollarStatus, string> = {
  AVAILABLE: 'Disponible',
  DAMAGED: 'Dañado',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const STATUS_CLASSES: Record<CollarStatus, string> = {
  AVAILABLE:
    'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
  DAMAGED: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  OUT_OF_SERVICE: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/30',
};

export default function CollaresPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: collars = [], loading, refetch } = useApi(collarsApi.getAll);
  const { mutate: createCollar, loading: submitting, error: createError } = useMutation(collarsApi.create);
  const { mutate: updateStatus } = useMutation(collarsApi.updateStatus);

  const [identifier, setIdentifier] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: collarDetail, refetch: refetchDetail } = useApi(
    () => (expandedId !== null ? collarsApi.getOne(expandedId) : Promise.resolve(undefined)),
    [expandedId]
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCollar({ identifier });
      setIdentifier('');
      toast.success('Collar registrado con éxito');
      refetch();
    } catch {}
  };

  const handleStatusChange = async (id: number, status: CollarStatus) => {
    if (status !== 'AVAILABLE') {
      const ok = await confirm({
        title: `Marcar collar como ${STATUS_LABELS[status]}`,
        description: 'Si está asignado a un animal, se liberará automáticamente.',
        confirmLabel: 'Confirmar',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await updateStatus(id, status);
      toast.success('Estado del collar actualizado');
      refetch();
      if (expandedId === id) refetchDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Collares IoT</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Inventario físico de collares: alta, estado, asignación e historial de uso.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
              Listado de Collares
            </h3>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
              </div>
            ) : collars.length === 0 ? (
              <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                Todavía no hay collares registrados en el sistema.
              </p>
            ) : (
              <div className="space-y-3">
                {collars.map((c) => (
                  <div key={c.id} className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white">{c.identifier}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[c.status]}`}
                          >
                            {STATUS_LABELS[c.status]}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1">
                          {c.assignedAnimal ? (
                            <>Asignado a: {c.assignedAnimal.tag || `Animal (${c.assignedAnimal.id.slice(0, 5)})`}</>
                          ) : (
                            'Sin asignar'
                          )}
                          {' · '}
                          {c.lastTelemetryDate ? (
                            <>Última señal: {new Date(c.lastTelemetryDate).toLocaleString()}</>
                          ) : (
                            'Nunca envió telemetría'
                          )}
                        </p>
                      </button>
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c.id, e.target.value as CollarStatus)}
                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                      >
                        <option value="AVAILABLE">Disponible</option>
                        <option value="DAMAGED">Dañado</option>
                        <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                      </select>
                    </div>

                    {expandedId === c.id && collarDetail && (
                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Historial de asignaciones
                        </p>
                        {!collarDetail.animalCollars || collarDetail.animalCollars.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic">Este collar nunca fue asignado a un animal.</p>
                        ) : (
                          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                            {collarDetail.animalCollars.map((ac) => (
                              <li key={ac.id} className="flex justify-between">
                                <span>{ac.animal.tag || `Animal (${ac.animal.id.slice(0, 5)})`}</span>
                                <span className="text-zinc-400">
                                  {new Date(ac.startAt).toLocaleDateString()} —{' '}
                                  {ac.endAt ? new Date(ac.endAt).toLocaleDateString() : 'Actual'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
            <div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar Collar</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                Ingresá el identificador único impreso o leído por QR en el dispositivo físico.
              </p>
            </div>
            {createError && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
                {createError}
              </div>
            )}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Identificador único
                </label>
                <input
                  required
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ej: COLLAR-0042"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Registrar Collar'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
