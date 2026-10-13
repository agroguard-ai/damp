'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Route, Search, AlertTriangle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { parsePolygon } from '@/lib/geo/spatial';
import type { Farm } from '@/types';
import type { MapTrajectory } from '@/components/maps/LiveTrackingMap';
import FarmMapModal from './FarmMapModal';

const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

const MAX_ANIMALS = 5;
// Colores bien distintos entre sí y de los del mapa (verde = campo, cian = cercos, rojo = alertas)
const TRAJECTORY_COLORS = ['#2563eb', '#db2777', '#f59e0b', '#7c3aed', '#0d9488'];
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { days: 0, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
] as const;

const formatDate = (d: Date) => d.toISOString().split('T')[0];

interface TrajectoriesModalProps {
  farm: Pick<Farm, 'id' | 'name' | 'polygonCoordinates'>;
  /** Animales preseleccionados (p. ej. al abrirlo desde el popup de un animal). */
  initialAnimalIds?: string[];
  onClose: () => void;
}

/** Recorrido de hasta 5 animales del campo en el período elegido, cada uno con su color. */
export default function TrajectoriesModal({ farm, initialAnimalIds = [], onClose }: TrajectoriesModalProps) {
  const [days, setDays] = useState<number>(7);
  const [search, setSearch] = useState('');
  // Cada animal elegido guarda su color, así no cambia al sacar otro de la selección
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialAnimalIds.slice(0, MAX_ANIMALS).map((id, i) => [id, TRAJECTORY_COLORS[i]]))
  );
  const selectedIds = Object.keys(selected);
  const selectedKey = selectedIds.join(',');

  const farmPolygon = useMemo(() => parsePolygon(farm.polygonCoordinates), [farm.polygonCoordinates]);

  const fetchAnimals = useCallback(() => animalsApi.getAll({ farmId: farm.id, status: 'ACTIVE' }), [farm.id]);
  const { data: animals = [], loading: loadingAnimals } = useApi(fetchAnimals, [farm.id]);

  const fetchGeofences = useCallback(() => geofencesApi.getByFarm(farm.id), [farm.id]);
  const { data: geofences = [] } = useApi(fetchGeofences, [farm.id]);

  // Un request por animal (la API devuelve el recorrido de a uno); si falla uno, no rompe el resto
  const fetchTrajectories = useCallback(() => {
    const ids = selectedKey ? selectedKey.split(',') : [];
    const now = Date.now();
    const range = { from: formatDate(new Date(now - days * DAY_MS)), to: formatDate(new Date(now)) };
    return Promise.all(
      ids.map((id) =>
        animalsApi
          .getTrajectory(id, range)
          .then((res) => ({ id, points: res.points }))
          .catch(() => ({ id, points: null }))
      )
    );
  }, [selectedKey, days]);
  const { data: results = [], loading: loadingTrajectories } = useApi(fetchTrajectories, [selectedKey, days]);

  const pointsById = useMemo(() => new Map(results.map((r) => [r.id, r.points])), [results]);

  const trajectories = useMemo<MapTrajectory[]>(
    () =>
      results
        .filter((r) => r.points && r.points.length > 0 && selected[r.id])
        .map((r) => {
          const animal = animals.find((a) => a.id === r.id);
          return {
            id: r.id,
            name: animal?.tag || `Animal ${r.id.slice(0, 6)}`,
            color: selected[r.id],
            points: r.points!,
          };
        }),
    [results, selected, animals]
  );

  const filteredAnimals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return animals;
    return animals.filter((a) => a.tag?.toLowerCase().includes(term) || a.breed?.toLowerCase().includes(term));
  }, [animals, search]);

  const toggleAnimal = (id: string) => {
    setSelected((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (Object.keys(prev).length >= MAX_ANIMALS) return prev;
      const used = new Set(Object.values(prev));
      const color = TRAJECTORY_COLORS.find((c) => !used.has(c)) ?? TRAJECTORY_COLORS[0];
      return { ...prev, [id]: color };
    });
  };

  const isFull = selectedIds.length >= MAX_ANIMALS;

  return (
    <FarmMapModal
      icon={Route}
      iconClassName="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
      title={`Recorridos — ${farm.name || 'Campo'}`}
      subtitle={`Elegí hasta ${MAX_ANIMALS} animales para ver por dónde anduvieron.`}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Lista de animales */}
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por caravana o raza..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {selectedIds.length} de {MAX_ANIMALS} elegidos
            </span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected({})}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="max-h-[50vh] lg:max-h-[58vh] overflow-y-auto space-y-1 pr-1">
            {loadingAnimals ? (
              <p className="text-xs text-zinc-400 text-center py-6">Cargando hacienda...</p>
            ) : filteredAnimals.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No hay animales que coincidan.</p>
            ) : (
              filteredAnimals.map((a) => {
                const color = selected[a.id];
                const points = pointsById.get(a.id);
                const disabled = !color && isFull;
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      color
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-white'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!color}
                      disabled={disabled}
                      onChange={() => toggleAnimal(a.id)}
                      className="w-3.5 h-3.5 cursor-pointer accent-blue-600"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-300 dark:border-zinc-600"
                      style={color ? { backgroundColor: color, borderColor: color } : undefined}
                    ></span>
                    <span className="truncate flex-1">
                      {a.tag || `Animal ${a.id.slice(0, 6)}`}
                      {a.breed && <span className="text-[10px] text-zinc-400 font-normal"> · {a.breed}</span>}
                    </span>
                    {color && !loadingTrajectories && points !== undefined && (
                      <span className="text-[10px] font-normal text-zinc-400 shrink-0">
                        {points && points.length > 0 ? `${points.length} pos.` : 'sin datos'}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    days === range.days
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-zinc-400 flex items-center gap-2">
              {loadingTrajectories && selectedIds.length > 0 ? (
                <span className="w-3.5 h-3.5 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></span>
              ) : selectedIds.length === 0 ? (
                'Elegí animales de la lista'
              ) : (
                `${trajectories.length} recorrido(s) en el mapa`
              )}
            </span>
          </div>

          {!loadingTrajectories && selectedIds.length > 0 && trajectories.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              No hay posiciones de estos animales en el período elegido. Probá con un período más largo.
            </p>
          )}

          <LiveTrackingMap
            farmPolygon={farmPolygon}
            geofences={geofences}
            animals={[]}
            trajectories={trajectories}
            heightClassName="h-[55vh] lg:h-[60vh] min-h-80"
          />
        </div>
      </div>
    </FarmMapModal>
  );
}
