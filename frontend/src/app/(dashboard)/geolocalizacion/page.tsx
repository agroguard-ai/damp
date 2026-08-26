'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useApi } from '@/hooks/useApi';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { animalsApi } from '@/lib/api/animals';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

// Load Map with SSR disabled
const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

export default function GeolocalizacionPage() {
  const { data: farms = [], loading: fetchingFarms, error: farmsError } = useApi(farmsApi.getAll);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  // Zones fetcher — re-runs when activeFarmId changes
  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );

  // Locations fetcher — re-runs when activeFarmId changes
  const fetchLocations = useCallback(
    () => (activeFarmId ? animalsApi.getLocations(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );

  const { data: zones = [], loading: loadingZones } = useApi(fetchZones, [activeFarmId]);

  const {
    data: animals = [],
    loading: loadingAnimals,
    refetch: refetchLocations,
  } = useApi(fetchLocations, [activeFarmId]);

  // 30-second polling for live locations
  useEffect(() => {
    if (!activeFarmId) return;
    const interval = setInterval(() => {
      refetchLocations();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFarmId, refetchLocations]);

  const loadingMapData = loadingZones || loadingAnimals;

  // Derived statistics
  const activeAnimalsWithGps = animals.filter((a) => a.latestReading !== null);
  const offlineCollars = animals.filter((a) => a.collar && !a.latestReading);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Geolocalización en Vivo</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Monitoreo satelital en tiempo real de hacienda y límites geográficos (potreros). Actualizado cada 30
            segundos.
          </p>
        </div>
      </div>

      {farmsError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
          {farmsError}
        </div>
      )}

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Map display */}
          <div className="lg:col-span-3 space-y-6">
            {/* Campo Selector */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex flex-col gap-1 w-full sm:max-w-xs">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Establecimiento Activo
                </label>
                <select
                  value={activeFarmId}
                  onChange={(e) => setSelectedFarm(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                <span>Rastreo activo (actualizaciones automáticas)</span>
              </div>
            </div>

            {/* Map Container */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
              {loadingMapData && zones.length === 0 && animals.length === 0 ? (
                <Skeleton className="w-full h-137.5" />
              ) : (
                <LiveTrackingMap zones={zones} animals={animals} />
              )}
            </div>
          </div>

          {/* Right panel: Legend and Devices status */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Metrics */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Resumen de Dispositivos
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase font-semibold">Online</span>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {activeAnimalsWithGps.length}
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase font-semibold">Offline</span>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{offlineCollars.length}</div>
                </div>
              </div>
            </div>

            {/* Animals list with latest details */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4 max-h-115 flex flex-col">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                Dispositivos en Lote
              </h3>

              <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                {animals.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-6">
                    No hay animales registrados con collares en este campo.
                  </p>
                ) : (
                  animals.map((animal) => {
                    const hasGps = animal.latestReading !== null;
                    return (
                      <div
                        key={animal.id}
                        className="p-3 border border-zinc-100 dark:border-zinc-850 rounded-lg flex items-center justify-between hover:bg-zinc-55/30 dark:hover:bg-zinc-950/30 transition-all"
                      >
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-white">
                            {animal.tag || `ID: ${animal.id.slice(0, 5)}`}
                          </h4>
                          <div className="flex gap-1.5 text-[10px] text-zinc-400">
                            <span>{animal.breed}</span>
                            <span>&bull;</span>
                            <span>{animal.zone?.name || 'Campo abierto'}</span>
                          </div>
                        </div>

                        <div>
                          {hasGps ? (
                            <span className="bg-green-150/10 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              {animal.latestReading!.temperature.toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-500 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              Offline
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
