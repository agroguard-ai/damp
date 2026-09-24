'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { collarsApi } from '@/lib/api/collars';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import type { CollarStatus } from '@/types';
import { Radio, Trash2, CheckCircle2, AlertCircle, Wrench, Building2, ArrowRight } from 'lucide-react';

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
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: collars = [], loading, refetch } = useApi(collarsApi.getAll);
  const { mutate: createCollar, loading: submitting, error: createError } = useMutation(collarsApi.create);
  const { mutate: updateStatus } = useMutation(collarsApi.updateStatus);

  const [identifier, setIdentifier] = useState('');
  const [targetFarmId, setTargetFarmId] = useState('');
  const [allFarms, setAllFarms] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: collarDetail, refetch: refetchDetail } = useApi(
    () => (expandedId !== null ? collarsApi.getOne(expandedId) : Promise.resolve(undefined)),
    [expandedId]
  );

  // Load all platform farms for SuperAdmin dropdown
  useEffect(() => {
    if (isSuperAdmin) {
      async function loadAllFarms() {
        try {
          const res = await fetch('/api/admin/farms');
          if (res.ok) {
            const data = await res.json();
            setAllFarms(data);
          }
        } catch {
          // ignore
        }
      }
      void loadAllFarms();
    }
  }, [isSuperAdmin]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    try {
      await createCollar({
        identifier: identifier.trim(),
        farmId: targetFarmId || undefined,
      });
      setIdentifier('');
      setTargetFarmId('');
      toast.success('Collar registrado con éxito en la flota');
      refetch();
    } catch {}
  };

  const handleStatusChange = async (id: number, status: CollarStatus) => {
    if (!isSuperAdmin) return;
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

  const handleDelete = async (id: number, collarIdentifier: string) => {
    if (!isSuperAdmin) return;
    const ok = await confirm({
      title: `Eliminar collar ${collarIdentifier}`,
      description: 'Esta acción dará de baja el dispositivo físico y lo removerá del inventario. ¿Continuar?',
      confirmLabel: 'Eliminar Collar',
      danger: true,
    });
    if (!ok) return;

    try {
      await collarsApi.delete(id);
      toast.success('Collar eliminado del inventario');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el collar');
    }
  };

  // Farmer summary counts
  const placedCount = collars.filter((c) => c.assignedAnimal).length;
  const availableCount = collars.filter((c) => !c.assignedAnimal && c.status === 'AVAILABLE').length;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-green-600 dark:text-green-500" />
          {isSuperAdmin ? 'Inventario de Collares IoT (Flota Global)' : 'Collares IoT de tu Establecimiento'}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          {isSuperAdmin
            ? 'Gestión central de dispositivos: alta de nuevo hardware, asignación de flota a campos, actualización de estado técnico y bajas.'
            : 'Dispositivos contratados para tu hacienda. Consultá su estado de colocación en animales y última telemetría.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                {isSuperAdmin ? 'Flota Completa del Sistema' : 'Tus Collares Contratados'}
              </h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Total: {collars.length}
              </span>
            </div>

            {loading ? (
              <SkeletonRowList count={4} />
            ) : collars.length === 0 ? (
              <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                {isSuperAdmin
                  ? 'Todavía no hay collares registrados en el inventario global.'
                  : 'No tienes collares contratados o asignados a tu campo actualmente.'}
              </p>
            ) : (
              <div className="space-y-3">
                {collars.map((c) => (
                  <div key={c.id} className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-left cursor-pointer flex-1"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-white font-mono">{c.identifier}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[c.status]}`}
                          >
                            {STATUS_LABELS[c.status]}
                          </span>
                          {c.farm?.name && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                              <Building2 className="w-3 h-3" />
                              {c.farm.name}
                            </span>
                          )}
                          {!c.farm?.name && isSuperAdmin && (
                            <span className="text-[11px] text-zinc-400 italic">Stock libre</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1.5">
                          {c.assignedAnimal ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              Colocado en: {c.assignedAnimal.tag || `Animal (${c.assignedAnimal.id.slice(0, 5)})`}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Disponible para colocar
                            </span>
                          )}
                          {' · '}
                          {c.lastTelemetryDate ? (
                            <>Última señal: {new Date(c.lastTelemetryDate).toLocaleString('es-AR')}</>
                          ) : (
                            'Sin telemetría reciente'
                          )}
                        </p>
                      </button>

                      {/* Admin controls: Status changer and Delete button */}
                      {isSuperAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={c.status}
                            onChange={(e) => void handleStatusChange(c.id, e.target.value as CollarStatus)}
                            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                          >
                            <option value="AVAILABLE">Disponible</option>
                            <option value="DAMAGED">Dañado</option>
                            <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                          </select>
                          <button
                            onClick={() => void handleDelete(c.id, c.identifier)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Eliminar collar de flota"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expandable assignment history */}
                    {expandedId === c.id && collarDetail && (
                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Historial de asignaciones
                        </p>
                        {!collarDetail.animalCollars || collarDetail.animalCollars.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic">Este collar nunca fue asignado a un animal.</p>
                        ) : (
                          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
                            {collarDetail.animalCollars.map((ac) => (
                              <li
                                key={ac.id}
                                className="flex justify-between items-center py-1 border-b border-zinc-100/50 dark:border-zinc-800/40 last:border-0"
                              >
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  {ac.animal.tag || `Animal (${ac.animal.id.slice(0, 5)})`}
                                </span>
                                <span className="text-zinc-400 font-mono text-[11px]">
                                  {new Date(ac.startAt).toLocaleDateString('es-AR')} —{' '}
                                  {ac.endAt ? new Date(ac.endAt).toLocaleDateString('es-AR') : 'Actual'}
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

        {/* Right column: SuperAdmin form vs Farmer Summary Panel */}
        <div className="lg:col-span-1">
          {isSuperAdmin ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar en Flota</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Ingresá el identificador del collar físico y opcionalmente asignalo a un campo cliente.
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
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Asignar a Campo (Opcional)
                  </label>
                  <select
                    value={targetFarmId}
                    onChange={(e) => setTargetFarmId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                  >
                    <option value="">Sin asignar (Stock libre)</option>
                    {allFarms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-400">
                    Si lo asignás a un campo, el productor podrá visualizarlo y colocarlo a sus animales.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Registrar en Flota'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Estado de tus Collares</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Dispositivos asignados para el rastreo y bienestar de tu ganado.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                    Colocados en animales
                  </div>
                  <span className="font-bold text-base text-green-700 dark:text-green-300 font-mono">
                    {placedCount}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    Libres para colocar
                  </div>
                  <span className="font-bold text-base text-amber-700 dark:text-amber-300 font-mono">
                    {availableCount}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/animals"
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all"
                >
                  Asignar Collares en Hacienda
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-200">
                  <Wrench className="w-3.5 h-3.5 text-zinc-500" />
                  Soporte y Garantía
                </div>
                <p className="text-[11px] leading-relaxed">
                  Para contratar collares adicionales o solicitar reemplazo por rotura, comunicate con tu asesor
                  comercial o enviá un correo a{' '}
                  <a
                    href="mailto:soporte@damp.com"
                    className="text-green-600 dark:text-green-400 underline font-medium"
                  >
                    soporte@damp.com
                  </a>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
