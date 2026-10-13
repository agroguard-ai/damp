'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, MapPin, X, AlertTriangle, Layers } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Zone } from '@/types';

const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

const POLL_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 horas sin señal = desactualizado
const DAY_MS = 24 * 60 * 60 * 1000;

const TRAJECTORY_RANGES = [
  { days: 0, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
] as const;

const HEATMAP_RANGES = [7, 15, 30] as const;

const HEATMAP_LEGEND = [
  { color: 'bg-lime-500', label: 'Poco' },
  { color: 'bg-amber-400', label: 'Moderado' },
  { color: 'bg-orange-500', label: 'Frecuente' },
  { color: 'bg-red-500', label: 'Intensivo' },
];

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export type HerdMapMode = 'live' | 'heatmap';

interface HerdMapViewProps {
  farmId: string;
  zones: Zone[];
  mode: HerdMapMode;
}

/**
 * Mapa de la hacienda del campo: posición en vivo de cada animal (con
 * recorrido histórico al tocar uno) o mapa de calor de uso del campo.
 */
export default function HerdMapView({ farmId, zones, mode }: HerdMapViewProps) {
  const [filterZoneId, setFilterZoneId] = useState('');
  const [trajectoryAnimalId, setTrajectoryAnimalId] = useState<string | null>(null);
  const [trajectoryDays, setTrajectoryDays] = useState<number>(7);
  const [heatmapDays, setHeatmapDays] = useState<number>(7);

  const fetchGeofences = useCallback(async () => {
    const results = await Promise.all(zones.map((zone) => geofencesApi.getByZone(zone.id)));
    return results.flat();
  }, [zones]);
  const { data: geofences = [] } = useApi(fetchGeofences, [zones]);

  // Se guarda la hora de la consulta para calcular qué señales están desactualizadas
  const fetchLocations = useCallback(async () => {
    const fetchedAt = Date.now();
    const animals = farmId ? await animalsApi.getLocations(farmId) : [];
    return { animals, fetchedAt };
  }, [farmId]);
  const { data: locations, loading: loadingAnimals, refetch: refetchLocations } = useApi(fetchLocations, [farmId]);
  const animals = useMemo(() => locations?.animals ?? [], [locations]);

  // Polling de posiciones solo mientras se mira la vista en vivo
  useEffect(() => {
    if (!farmId || mode !== 'live') return;
    const interval = setInterval(refetchLocations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [farmId, mode, refetchLocations]);

  const fetchTrajectory = useCallback(() => {
    if (!trajectoryAnimalId) return Promise.resolve(null);
    const now = Date.now();
    return animalsApi.getTrajectory(trajectoryAnimalId, {
      from: formatDateForInput(new Date(now - trajectoryDays * DAY_MS)),
      to: formatDateForInput(new Date(now)),
    });
  }, [trajectoryAnimalId, trajectoryDays]);
  const { data: trajectory, loading: loadingTrajectory } = useApi(fetchTrajectory, [
    trajectoryAnimalId,
    trajectoryDays,
  ]);

  const fetchHeatmap = useCallback(
    () => (mode === 'heatmap' && farmId ? animalsApi.getHeatmap(farmId, { days: heatmapDays }) : Promise.resolve(null)),
    [mode, farmId, heatmapDays]
  );
  const { data: heatmap, loading: loadingHeatmap } = useApi(fetchHeatmap, [mode, farmId, heatmapDays]);

  const visibleAnimals = useMemo(
    () => (filterZoneId ? animals.filter((a) => a.zone?.id === filterZoneId) : animals),
    [animals, filterZoneId]
  );

  const herdStatus = useMemo(() => {
    const now = locations?.fetchedAt ?? 0;
    let live = 0;
    let stale = 0;
    let noSignal = 0;
    for (const a of animals) {
      if (a.latestReading) {
        if (now - new Date(a.latestReading.timestamp).getTime() <= STALE_THRESHOLD_MS) live++;
        else stale++;
      } else if (a.collar) {
        noSignal++;
      }
    }
    return { live, stale, noSignal };
  }, [animals, locations?.fetchedAt]);

  const trajectoryAnimal = animals.find((a) => a.id === trajectoryAnimalId);
  const trajectoryPoints = trajectoryAnimalId && trajectory ? trajectory.points : null;

  return (
    <div className="space-y-3">
      {mode === 'live' ? (
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
            {zones.length > 1 && (
              <Select
                size="sm"
                className="w-44"
                value={filterZoneId}
                onChange={setFilterZoneId}
                options={[
                  { value: '', label: 'Todas las zonas' },
                  ...zones.map((z) => ({ value: z.id, label: z.name, icon: Layers })),
                ]}
              />
            )}
            <button
              type="button"
              onClick={refetchLocations}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer"
              title="Actualizar ahora (se actualiza solo cada 30 s)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 px-2 pt-1">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {HEATMAP_RANGES.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHeatmapDays(days)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  heatmapDays === days
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {days} días
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {HEATMAP_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                {item.label}
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs text-zinc-400 flex items-center gap-2">
            {loadingHeatmap ? (
              <span className="w-3.5 h-3.5 border-2 border-orange-500/20 border-t-orange-600 rounded-full animate-spin"></span>
            ) : (
              `${heatmap?.totalPoints ?? 0} posiciones analizadas`
            )}
          </span>
        </div>
      )}

      {/* Recorrido de un animal (se activa desde el popup del marcador) */}
      {mode === 'live' && trajectoryAnimalId && (
        <div className="mx-2 bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-xl px-3 py-2 flex flex-wrap items-center gap-3 text-xs text-blue-900 dark:text-blue-200">
          <span className="flex items-center gap-1.5 font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            Recorrido de {trajectoryAnimal?.tag || trajectory?.animal.tag || 'animal'}
          </span>
          <div className="flex bg-white/70 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-blue-200 dark:border-blue-800/40">
            {TRAJECTORY_RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setTrajectoryDays(range.days)}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  trajectoryDays === range.days
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-blue-100 dark:hover:bg-blue-900/40'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <span className="text-blue-700/80 dark:text-blue-300/80">
            {loadingTrajectory ? (
              'Buscando…'
            ) : trajectoryPoints && trajectoryPoints.length > 0 ? (
              `${trajectoryPoints.length} posiciones`
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Sin posiciones en este período
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setTrajectoryAnimalId(null)}
            className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cerrar
          </button>
        </div>
      )}

      {loadingAnimals && animals.length === 0 ? (
        <Skeleton className="w-full h-[55vh] min-h-96" />
      ) : (
        <LiveTrackingMap
          zones={zones}
          geofences={geofences}
          animals={mode === 'live' ? visibleAnimals : []}
          trajectory={mode === 'live' ? trajectoryPoints : null}
          trajectoryAnimalName={trajectoryAnimal?.tag}
          heatmapPoints={mode === 'heatmap' ? (heatmap?.points ?? null) : null}
          showHeatmap={mode === 'heatmap'}
          onSelectAnimalForTrajectory={setTrajectoryAnimalId}
          heightClassName="h-[55vh] min-h-96"
        />
      )}

      {mode === 'live' && !trajectoryAnimalId && animals.length > 0 && (
        <p className="px-2 pb-1 text-[11px] text-zinc-400">Tocá un animal en el mapa para ver su recorrido.</p>
      )}
    </div>
  );
}
