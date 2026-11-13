'use client';

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAnimalLocations } from '@/hooks/useAnimalLocations';
import { geofencesApi } from '@/lib/api/geofences';
import { parsePolygon } from '@/lib/geo/spatial';
import { Select } from '@/components/ui/Select';
import type { Farm } from '@/types';

const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

interface DashboardFieldCycleCardProps {
  farms: Farm[];
  selectedFarmId: string;
  onSelectFarmId: (id: string) => void;
  loadingFarms?: boolean;
}

export function DashboardFieldCycleCard({
  farms,
  selectedFarmId,
  onSelectFarmId,
  loadingFarms = false,
}: DashboardFieldCycleCardProps) {
  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) ?? farms[0] ?? null,
    [farms, selectedFarmId]
  );
  const farmId = selectedFarm?.id ?? '';

  const farmPolygon = useMemo(
    () => (selectedFarm ? parsePolygon(selectedFarm.polygonCoordinates) : []),
    [selectedFarm]
  );

  const fetchGeofences = useCallback(
    () => (farmId ? geofencesApi.getByFarm(farmId) : Promise.resolve([])),
    [farmId]
  );
  const { data: geofences = [] } = useApi(fetchGeofences, [farmId]);

  const { animals: liveAnimals, fetchedAt } = useAnimalLocations(farmId, Boolean(farmId));
  const locatedCount = useMemo(
    () => liveAnimals.filter((a) => a.latestReading !== null).length,
    [liveAnimals]
  );

  if (loadingFarms) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs h-[420px] animate-pulse" />
    );
  }

  if (!selectedFarm) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <span>Animales en tiempo real</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {locatedCount} {locatedCount === 1 ? 'animal con ubicación GPS' : 'animales con ubicación GPS'} en{' '}
            {selectedFarm.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {farms.length > 1 && (
            <div className="w-48">
              <Select
                value={farmId}
                onChange={onSelectFarmId}
                options={farms.map((f) => ({ value: f.id, label: f.name }))}
                size="sm"
              />
            </div>
          )}

          <Link
            href="/farms"
            className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline px-2 py-1"
          >
            Ver campos
          </Link>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <LiveTrackingMap
          farmId={farmId}
          farmPolygon={farmPolygon}
          geofences={geofences}
          animals={liveAnimals}
          animalsReferenceTime={fetchedAt}
          heightClassName="h-[360px]"
        />
      </div>
    </div>
  );
}
