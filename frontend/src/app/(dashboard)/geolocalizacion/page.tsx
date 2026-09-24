'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  Activity,
  Flame,
  Calendar,
  Filter,
  RotateCcw,
  Clock,
  AlertTriangle,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { geofencesApi } from '@/lib/api/geofences';
import { animalsApi } from '@/lib/api/animals';
import { animalTypesApi } from '@/lib/api/animal-types';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import type { TrajectoryPoint, HeatmapPoint, AnimalLocation } from '@/types';

// Load Map with SSR disabled
const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

type MapMode = 'live' | 'trajectory' | 'heatmap';

const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

export default function GeolocalizacionPage() {
  const { user, emulatedUser } = useAuth();
  const { data: farms = [], loading: fetchingFarms, error: farmsError } = useApi(farmsApi.getAll);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  // Mode switcher: 'live' | 'trajectory' | 'heatmap'
  const [activeMode, setActiveMode] = useState<MapMode>('live');

  // Filters for Live Map
  const [filterZoneId, setFilterZoneId] = useState<string>('');
  const [filterAnimalTypeId, setFilterAnimalTypeId] = useState<string>('');

  // Trajectory state
  const [trajectoryAnimalId, setTrajectoryAnimalId] = useState<string>('');
  const [trajectoryFrom, setTrajectoryFrom] = useState<string>(() =>
    formatDateForInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  );
  const [trajectoryTo, setTrajectoryTo] = useState<string>(() => formatDateForInput(new Date()));
  const [trajectoryPoints, setTrajectoryPoints] = useState<TrajectoryPoint[] | null>(null);
  const [trajectoryAnimalInfo, setTrajectoryAnimalInfo] = useState<{
    tag: string | null;
    breed: string;
    animalTypeName?: string | null;
  } | null>(null);
  const [loadingTrajectory, setLoadingTrajectory] = useState<boolean>(false);
  const [trajectorySearched, setTrajectorySearched] = useState<boolean>(false);

  // Heatmap state
  const [heatmapDays, setHeatmapDays] = useState<number>(7);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[] | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);
  const [heatmapTotalPoints, setHeatmapTotalPoints] = useState<number>(0);

  // Fetch zones
  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: zones = [], loading: loadingZones } = useApi(fetchZones, [activeFarmId]);

  // Fetch animal types for filtering
  const { data: animalTypes = [] } = useApi(animalTypesApi.getAll);

  // Fetch geofences for active zones
  const fetchGeofences = useCallback(async () => {
    if (zones.length === 0) return [];
    const results = await Promise.all(zones.map((zone) => geofencesApi.getByZone(zone.id)));
    return results.flat();
  }, [zones]);
  const { data: geofences = [], refetch: refetchGeofences } = useApi(fetchGeofences, [zones]);

  // Fetch animal live locations
  const fetchLocations = useCallback(
    () => (activeFarmId ? animalsApi.getLocations(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const {
    data: rawAnimals = [],
    loading: loadingAnimals,
    refetch: refetchLocations,
  } = useApi(fetchLocations, [activeFarmId]);

  const refreshAll = useCallback(() => {
    refetchLocations();
    refetchGeofences();
  }, [refetchLocations, refetchGeofences]);

  // 30-second polling for live locations (only when in live mode)
  useEffect(() => {
    if (!activeFarmId || activeMode !== 'live') return;
    const interval = setInterval(() => {
      refetchLocations();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFarmId, activeMode, refetchLocations]);

  // Filtered animals list
  const filteredAnimals = useMemo(() => {
    return rawAnimals.filter((animal) => {
      if (filterZoneId && animal.zone?.id !== filterZoneId) {
        return false;
      }
      if (filterAnimalTypeId && animal.animalType?.id !== filterAnimalTypeId) {
        return false;
      }
      return true;
    });
  }, [rawAnimals, filterZoneId, filterAnimalTypeId]);

  // Derived statistics (based on active farm)
  const now = Date.now();
  const staleThreshold = 6 * 60 * 60 * 1000; // 6 hours

  const activeAnimalsWithGps = rawAnimals.filter((a) => a.latestReading !== null);
  const liveAnimals = activeAnimalsWithGps.filter(
    (a) => now - new Date(a.latestReading!.timestamp).getTime() <= staleThreshold
  );
  const staleAnimals = activeAnimalsWithGps.filter(
    (a) => now - new Date(a.latestReading!.timestamp).getTime() > staleThreshold
  );
  const offlineCollars = rawAnimals.filter((a) => a.collar && !a.latestReading);

  // Fetch trajectory handler
  const handleFetchTrajectory = useCallback(
    async (animalIdToQuery?: string) => {
      const targetId = animalIdToQuery || trajectoryAnimalId;
      if (!targetId) return;

      setLoadingTrajectory(true);
      setTrajectorySearched(true);
      try {
        const res = await animalsApi.getTrajectory(targetId, {
          from: trajectoryFrom,
          to: trajectoryTo,
        });
        setTrajectoryPoints(res.points);
        setTrajectoryAnimalInfo({
          tag: res.animal.tag,
          breed: res.animal.breed,
          animalTypeName: res.animal.animalType?.name || null,
        });
      } catch (err) {
        console.error('Error fetching trajectory:', err);
        setTrajectoryPoints([]);
      } finally {
        setLoadingTrajectory(false);
      }
    },
    [trajectoryAnimalId, trajectoryFrom, trajectoryTo]
  );

  // Shortcut to query trajectory directly from an animal card or marker
  const handleSelectAnimalForTrajectory = useCallback(
    (animalId: string) => {
      setTrajectoryAnimalId(animalId);
      setActiveMode('trajectory');
      handleFetchTrajectory(animalId);
    },
    [handleFetchTrajectory]
  );

  // Fetch heatmap handler
  const handleFetchHeatmap = useCallback(
    async (days: number) => {
      if (!activeFarmId) return;
      setLoadingHeatmap(true);
      try {
        const res = await animalsApi.getHeatmap(activeFarmId, { days });
        setHeatmapPoints(res.points);
        setHeatmapTotalPoints(res.totalPoints);
      } catch (err) {
        console.error('Error fetching heatmap:', err);
        setHeatmapPoints([]);
      } finally {
        setLoadingHeatmap(false);
      }
    },
    [activeFarmId]
  );

  // Trigger heatmap fetch when entering heatmap mode or changing days
  useEffect(() => {
    if (activeMode === 'heatmap') {
      handleFetchHeatmap(heatmapDays);
    }
  }, [activeMode, heatmapDays, handleFetchHeatmap]);

  // Set default selected animal for trajectory if none selected
  useEffect(() => {
    if (!trajectoryAnimalId && rawAnimals.length > 0) {
      setTrajectoryAnimalId(rawAnimals[0].id);
    }
  }, [rawAnimals, trajectoryAnimalId]);

  const loadingMapData = loadingZones || loadingAnimals;

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Geolocalización y Monitoreo en Tiempo Real" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Geolocalización y Seguimiento Satelital
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Visualización en tiempo real, recorrido histórico por animal y mapa de calor de pastoreo.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => {
              setActiveMode('live');
              setTrajectoryPoints(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'live'
                ? 'bg-white dark:bg-zinc-900 text-green-700 dark:text-green-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>En Vivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('trajectory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'trajectory'
                ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Recorrido Histórico</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('heatmap')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'heatmap'
                ? 'bg-white dark:bg-zinc-900 text-orange-650 dark:text-orange-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Mapa de Calor</span>
          </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Map display */}
          <div className="lg:col-span-3 space-y-4">
            {/* Control Bar: Farm Selector & Mode-specific filters */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div className="flex flex-col gap-1 w-full sm:max-w-xs">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Establecimiento Activo
                  </label>
                  <select
                    value={activeFarmId}
                    onChange={(e) => {
                      setSelectedFarm(e.target.value);
                      setTrajectoryPoints(null);
                      setTrajectorySearched(false);
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                  >
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>

                {activeMode === 'live' && (
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span>Actualización cada 30s</span>
                    </div>
                    <button
                      type="button"
                      onClick={refreshAll}
                      className="text-xs font-semibold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 rounded-lg px-3 py-1.5 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Refrescar</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode 1: Filters for Live View */}
              {activeMode === 'live' && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtros de visualización:</span>
                  </div>

                  {/* Filter by Zone / Paddock */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={filterZoneId}
                      onChange={(e) => setFilterZoneId(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 font-medium cursor-pointer"
                    >
                      <option value="">Todos los potreros ({zones.length})</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          Potrero: {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Animal Type / Category */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={filterAnimalTypeId}
                      onChange={(e) => setFilterAnimalTypeId(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 font-medium cursor-pointer"
                    >
                      <option value="">Todas las categorías ({animalTypes.length})</option>
                      {animalTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.species})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(filterZoneId || filterAnimalTypeId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterZoneId('');
                        setFilterAnimalTypeId('');
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                    >
                      Limpiar filtros
                    </button>
                  )}

                  <div className="ml-auto text-xs text-zinc-400">
                    Mostrando <b className="text-zinc-700 dark:text-zinc-300">{filteredAnimals.length}</b> de{' '}
                    <b>{rawAnimals.length}</b> animales
                  </div>
                </div>
              )}

              {/* Mode 2: Trajectory Controls */}
              {activeMode === 'trajectory' && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    {/* Animal Selector */}
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Seleccionar Animal
                      </label>
                      <select
                        value={trajectoryAnimalId}
                        onChange={(e) => setTrajectoryAnimalId(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                      >
                        {rawAnimals.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.tag || `ID: ${a.id.slice(0, 5)}`} — {a.breed} ({a.animalType?.name || 'S/C'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* From Date */}
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Fecha Desde
                      </label>
                      <input
                        type="date"
                        value={trajectoryFrom}
                        onChange={(e) => setTrajectoryFrom(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    {/* To Date */}
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Fecha Hasta
                      </label>
                      <input
                        type="date"
                        value={trajectoryTo}
                        onChange={(e) => setTrajectoryTo(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    {/* Query Button */}
                    <div>
                      <button
                        type="button"
                        onClick={() => handleFetchTrajectory()}
                        disabled={loadingTrajectory || !trajectoryAnimalId}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        {loadingTrajectory ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        <span>{loadingTrajectory ? 'Buscando...' : 'Consultar Recorrido'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Date Quick Presets */}
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-medium">Accesos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const today = formatDateForInput(new Date());
                        setTrajectoryFrom(today);
                        setTrajectoryTo(today);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = formatDateForInput(new Date());
                        const weekAgo = formatDateForInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                        setTrajectoryFrom(weekAgo);
                        setTrajectoryTo(today);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Últimos 7 días
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = formatDateForInput(new Date());
                        const monthAgo = formatDateForInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                        setTrajectoryFrom(monthAgo);
                        setTrajectoryTo(today);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Últimos 30 días
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 3: Heatmap Controls */}
              {activeMode === 'heatmap' && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Ventana temporal de pastoreo:
                    </span>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      {[7, 15, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setHeatmapDays(days)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            heatmapDays === days
                              ? 'bg-orange-500 text-white shadow-xs font-bold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                          }`}
                        >
                          {days} días
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Heatmap Legend */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold">Intensidad de uso:</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-lime-500"></span> Leve / Paso
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Moderado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Frecuente
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Intensivo
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Camino Alternativo 2: Alerta cuando no hay recorrido histórico */}
            {activeMode === 'trajectory' && trajectorySearched && trajectoryPoints?.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex items-start gap-3 text-amber-850 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-sm">Sin datos de telemetría para el período seleccionado</p>
                  <p>
                    No se registraron posiciones para este animal entre el <b>{trajectoryFrom}</b> y el{' '}
                    <b>{trajectoryTo}</b>. Esto puede ocurrir si el collar estuvo inactivo, el animal se encontraba
                    fuera de cobertura o no tenía collar asignado en ese lapso.
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Sugerencia: Amplíe el rango de fechas hacia períodos anteriores o verifique el historial de collares
                    del animal.
                  </p>
                </div>
              </div>
            )}

            {/* Trajectory Active Info Banner */}
            {activeMode === 'trajectory' && trajectoryPoints && trajectoryPoints.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3 flex items-center justify-between gap-3 text-blue-900 dark:text-blue-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                  <span>
                    Mostrando recorrido de <b>{trajectoryAnimalInfo?.tag || 'Animal'}</b> (
                    {trajectoryAnimalInfo?.breed}): <b>{trajectoryPoints.length}</b> posiciones registradas entre{' '}
                    {trajectoryFrom} y {trajectoryTo}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrajectoryPoints(null);
                    setTrajectorySearched(false);
                  }}
                  className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Cerrar recorrido
                </button>
              </div>
            )}

            {/* Heatmap Active Info Banner */}
            {activeMode === 'heatmap' && (
              <div className="bg-orange-50 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-800/40 rounded-xl p-3 flex items-center justify-between text-orange-900 dark:text-orange-200 text-xs">
                <span>
                  Mapa de calor acumulado: <b>{heatmapTotalPoints}</b> registros analizados de los últimos{' '}
                  <b>{heatmapDays} días</b>. Las zonas rojas indican alta permanencia / pisoteo, mientras que las
                  zonas sin color representan áreas subutilizadas o zonas de pastoreo muerto.
                </span>
                {loadingHeatmap && (
                  <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-600 rounded-full animate-spin shrink-0"></div>
                )}
              </div>
            )}

            {/* Map Container */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
              {loadingMapData && zones.length === 0 && rawAnimals.length === 0 ? (
                <Skeleton className="w-full h-137.5" />
              ) : (
                <LiveTrackingMap
                  zones={zones}
                  geofences={geofences}
                  animals={filteredAnimals}
                  trajectory={activeMode === 'trajectory' ? trajectoryPoints : null}
                  trajectoryAnimalName={trajectoryAnimalInfo?.tag}
                  heatmapPoints={activeMode === 'heatmap' ? heatmapPoints : null}
                  showHeatmap={activeMode === 'heatmap'}
                  onSelectAnimalForTrajectory={handleSelectAnimalForTrajectory}
                />
              )}
            </div>
          </div>

          {/* Right panel: Legend, Metrics, and Devices / Trajectory Details */}
          <div className="lg:col-span-1 space-y-4">
            {/* Quick Metrics */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Estado del Rodeo
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">En línea</span>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                    {liveAnimals.length}
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Desactualizados</span>
                  <div className="text-xl font-bold text-amber-500 mt-0.5" title="Sin señal reciente (> 6 horas)">
                    {staleAnimals.length}
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Sin Collar/Off</span>
                  <div className="text-xl font-bold text-zinc-500 mt-0.5">{offlineCollars.length}</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Potreros</span>
                  <div className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{zones.length}</div>
                </div>
              </div>
            </div>

            {/* Trajectory Details Card (if in trajectory mode and points found) */}
            {activeMode === 'trajectory' && trajectoryPoints && trajectoryPoints.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-xs space-y-3">
                <h3 className="font-bold text-xs text-blue-700 dark:text-blue-400 uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Resumen del Recorrido</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Puntos registrados:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{trajectoryPoints.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Primer registro:</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 text-[11px]">
                      {new Date(trajectoryPoints[0].timestamp).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Último registro:</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 text-[11px]">
                      {new Date(trajectoryPoints[trajectoryPoints.length - 1].timestamp).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Animals list with latest details */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-xs space-y-3 max-h-125 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <h3 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">
                  Animales ({filteredAnimals.length})
                </h3>
                {filteredAnimals.length !== rawAnimals.length && (
                  <span className="text-[10px] text-zinc-400">Filtrados</span>
                )}
              </div>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                {filteredAnimals.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-6">
                    No hay animales que coincidan con los filtros seleccionados.
                  </p>
                ) : (
                  filteredAnimals.map((animal) => {
                    const hasGps = animal.latestReading !== null;
                    const isStale = hasGps
                      ? now - new Date(animal.latestReading!.timestamp).getTime() > staleThreshold
                      : false;

                    return (
                      <div
                        key={animal.id}
                        className="p-2.5 border border-zinc-100 dark:border-zinc-850 rounded-xl space-y-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/animals?search=${encodeURIComponent(animal.tag || animal.id)}`}
                              className="font-bold text-xs text-zinc-900 dark:text-white hover:text-green-600 dark:hover:text-green-400 transition-colors"
                            >
                              {animal.tag || `ID: ${animal.id.slice(0, 5)}`}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                              <span>{animal.breed}</span>
                              <span>&bull;</span>
                              <span>{animal.zone?.name || 'Campo abierto'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {hasGps ? (
                              isStale ? (
                                <span
                                  className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/40 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                  title="Última señal hace más de 6 horas"
                                >
                                  ⏱ Desact.
                                </span>
                              ) : (
                                <span className="bg-green-100 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  {animal.latestReading!.temperature.toFixed(1)}°C
                                </span>
                              )
                            ) : (
                              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                Offline
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100/80 dark:border-zinc-800/80 text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAnimalForTrajectory(animal.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Ver recorrido</span>
                          </button>
                          <Link
                            href={`/animals?search=${encodeURIComponent(animal.tag || animal.id)}`}
                            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center gap-0.5"
                          >
                            <span>Ficha</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
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
