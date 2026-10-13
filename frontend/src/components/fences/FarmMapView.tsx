'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, Zap } from 'lucide-react';
import { useAnimalsToggle } from '@/hooks/useAnimalLocations';
import { parsePolygon } from '@/lib/geo/spatial';
import { Select } from '@/components/ui/Select';
import type { Farm, Geofence } from '@/types';

const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });
const TrajectoriesModal = dynamic(() => import('@/components/farms/TrajectoriesModal'), { ssr: false });

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 horas sin señal = desactualizado

interface FarmMapViewProps {
  farm: Pick<Farm, 'id' | 'name' | 'polygonCoordinates'>;
  geofences: Geofence[];
}

/**
 * Mapa del campo con sus cercos. La hacienda es una capa opcional (botón "Animales"
 * del mapa, apagado por defecto): solo con la capa prendida se consultan posiciones.
 * "Ver recorrido" en un animal abre la ventana de Recorridos con ese animal elegido.
 */
export default function FarmMapView({ farm, geofences }: FarmMapViewProps) {
  const [filterGeofenceId, setFilterGeofenceId] = useState('');
  const [trajectoryAnimalId, setTrajectoryAnimalId] = useState<string | null>(null);

  const farmPolygon = useMemo(() => parsePolygon(farm.polygonCoordinates), [farm.polygonCoordinates]);
  const herd = useAnimalsToggle(farm.id);
  const { animals, fetchedAt } = herd;

  const visibleAnimals = useMemo(
    () => (filterGeofenceId ? animals.filter((a) => a.geofence?.id === filterGeofenceId) : animals),
    [animals, filterGeofenceId]
  );

  const herdStatus = useMemo(() => {
    let live = 0;
    let stale = 0;
    let noSignal = 0;
    for (const a of animals) {
      if (a.latestReading) {
        if (fetchedAt - new Date(a.latestReading.timestamp).getTime() <= STALE_THRESHOLD_MS) live++;
        else stale++;
      } else if (a.collar) {
        noSignal++;
      }
    }
    return { live, stale, noSignal };
  }, [animals, fetchedAt]);

  return (
    <div className="space-y-3">
      {/* Estado de la hacienda: solo con la capa de animales prendida */}
      {herd.enabled && (
        <div className="flex flex-wrap items-center gap-2 px-2 pt-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            {herdStatus.live} con señal
          </span>
          {herdStatus.stale > 0 && (
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
              title="Sin señal en las últimas 6 horas"
            >
              {herdStatus.stale} sin señal reciente
            </span>
          )}
          {herdStatus.noSignal > 0 && (
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Tienen collar pero todavía no enviaron ninguna posición"
            >
              {herdStatus.noSignal} collar(es) sin datos
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {geofences.length > 1 && (
              <Select
                size="sm"
                className="w-44"
                value={filterGeofenceId}
                onChange={setFilterGeofenceId}
                options={[
                  { value: '', label: 'Todos los cercos' },
                  ...geofences.map((g) => ({ value: g.id, label: g.name, icon: Zap })),
                ]}
              />
            )}
            <button
              type="button"
              onClick={herd.refetch}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer"
              title="Actualizar ahora (se actualiza solo cada 30 s)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <LiveTrackingMap
        farmPolygon={farmPolygon}
        geofences={geofences}
        animals={herd.enabled ? visibleAnimals : []}
        animalsReferenceTime={fetchedAt}
        animalsToggle={herd.control}
        onSelectAnimalForTrajectory={setTrajectoryAnimalId}
        heightClassName="h-[55vh] min-h-96"
      />

      {trajectoryAnimalId && (
        <TrajectoriesModal
          farm={farm}
          initialAnimalIds={[trajectoryAnimalId]}
          onClose={() => setTrajectoryAnimalId(null)}
        />
      )}
    </div>
  );
}
