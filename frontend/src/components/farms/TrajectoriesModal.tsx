'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Route,
  Search,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Calendar as CalendarIcon,
  ChevronDown,
} from 'lucide-react';
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

const PRESET_RANGES = [
  { days: 0, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 15, label: '15 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
] as const;

const formatDate = (d: Date) => d.toISOString().split('T')[0];

interface TrajectoriesModalProps {
  farm: Pick<Farm, 'id' | 'name' | 'polygonCoordinates'>;
  /** Animales preseleccionados (p. ej. al abrirlo desde el popup de un animal). */
  initialAnimalIds?: string[];
  onClose: () => void;
}

export default function TrajectoriesModal({ farm, initialAnimalIds = [], onClose }: TrajectoriesModalProps) {
  // Rango de fechas
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(7);
  const now = useMemo(() => new Date(), []);
  const [customFrom, setCustomFrom] = useState<string>(() => formatDate(new Date(Date.now() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState<string>(() => formatDate(now));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [search, setSearch] = useState('');
  // Cada animal elegido guarda su color, así no cambia al sacar otro de la selección
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialAnimalIds.slice(0, MAX_ANIMALS).map((id, i) => [id, TRAJECTORY_COLORS[i]]))
  );
  const selectedIds = Object.keys(selected);
  const selectedKey = selectedIds.join(',');

  // Estado del reproductor de animación (Playback)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(1); // De 0 a 1 (1 = 100% / final)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.5); // 0.1x, 0.25x, 0.5x, 1x, 2x, 5x
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const farmPolygon = useMemo(() => parsePolygon(farm.polygonCoordinates), [farm.polygonCoordinates]);

  const fetchAnimals = useCallback(() => animalsApi.getAll({ farmId: farm.id, status: 'ACTIVE' }), [farm.id]);
  const { data: animals = [], loading: loadingAnimals } = useApi(fetchAnimals, [farm.id]);

  const fetchGeofences = useCallback(() => geofencesApi.getByFarm(farm.id), [farm.id]);
  const { data: geofences = [] } = useApi(fetchGeofences, [farm.id]);

  // Cálculo del rango efectivo
  const effectiveRange = useMemo(() => {
    if (selectedPreset === 'custom') {
      return { from: customFrom, to: customTo };
    }
    const currentMs = Date.now();
    return {
      from: formatDate(new Date(currentMs - selectedPreset * DAY_MS)),
      to: formatDate(new Date(currentMs)),
    };
  }, [selectedPreset, customFrom, customTo]);

  // Traer recorridos
  const fetchTrajectories = useCallback(() => {
    const ids = selectedKey ? selectedKey.split(',') : [];
    if (ids.length === 0) return Promise.resolve([]);
    return Promise.all(
      ids.map((id) =>
        animalsApi
          .getTrajectory(id, effectiveRange)
          .then((res) => ({ id, points: res.points }))
          .catch(() => ({ id, points: null }))
      )
    );
  }, [selectedKey, effectiveRange]);

  const { data: results = [], loading: loadingTrajectories } = useApi(fetchTrajectories, [
    selectedKey,
    effectiveRange.from,
    effectiveRange.to,
  ]);

  const pointsById = useMemo(() => new Map(results.map((r) => [r.id, r.points])), [results]);

  // Número máximo de puntos entre los recorridos elegidos (para coordinar el timeline)
  const maxTrajectoryPoints = useMemo(() => {
    let max = 0;
    for (const r of results) {
      if (r.points && r.points.length > max) {
        max = r.points.length;
      }
    }
    return max;
  }, [results]);

  // Al cambiar datos o filtros, pausar y posicionar al 100%
  useEffect(() => {
    setIsPlaying(false);
    setPlaybackProgress(1);
  }, [selectedKey, effectiveRange.from, effectiveRange.to]);

  // Bucle de reproducción progresiva (Animation Loop)
  useEffect(() => {
    if (!isPlaying || maxTrajectoryPoints <= 1) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    // Duración total de la animación más pausada para poder apreciar el recorrido punto a punto
    const baseDurationMs = Math.min(75000, Math.max(15000, maxTrajectoryPoints * 400));
    const effectiveDurationMs = baseDurationMs / playbackSpeed;

    const animate = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setPlaybackProgress((prev) => {
        const next = prev + delta / effectiveDurationMs;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, maxTrajectoryPoints, playbackSpeed]);

  // Trajectories con cálculo progresivo según playbackProgress
  const trajectories = useMemo<MapTrajectory[]>(
    () =>
      results
        .filter((r) => r.points && r.points.length > 0 && selected[r.id])
        .map((r) => {
          const animal = animals.find((a) => a.id === r.id);
          const totalPts = r.points!.length;
          // Calcular índice correspondiente al porcentaje actual
          const progressIndex = Math.min(totalPts - 1, Math.floor(playbackProgress * (totalPts - 1)));

          return {
            id: r.id,
            name: animal?.tag || `Animal ${r.id.slice(0, 6)}`,
            color: selected[r.id],
            points: r.points!,
            progressIndex,
          };
        }),
    [results, selected, animals, playbackProgress]
  );

  // Información del punto de tiempo actual
  const currentTimestampLabel = useMemo(() => {
    if (trajectories.length === 0) return null;
    let latestTs: string | null = null;
    for (const t of trajectories) {
      const idx = t.progressIndex ?? t.points.length - 1;
      const pt = t.points[idx];
      if (pt && (!latestTs || new Date(pt.timestamp) > new Date(latestTs))) {
        latestTs = pt.timestamp;
      }
    }
    return latestTs ? new Date(latestTs).toLocaleString() : null;
  }, [trajectories]);

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

  const handlePresetClick = (daysVal: number) => {
    setSelectedPreset(daysVal);
    setShowDatePicker(false);
    const end = new Date();
    const start = new Date(end.getTime() - daysVal * DAY_MS);
    setCustomTo(formatDate(end));
    setCustomFrom(formatDate(start));
  };

  const handleApplyCustomDates = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setSelectedPreset('custom');
      setShowDatePicker(false);
    }
  };

  const handlePlayToggle = () => {
    if (playbackProgress >= 1) {
      setPlaybackProgress(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  return (
    <FarmMapModal
      icon={Route}
      iconClassName="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
      title={`Recorridos — ${farm.name || 'Campo'}`}
      subtitle={`Elegí hasta ${MAX_ANIMALS} animales y mirá su evolución progresiva en el tiempo.`}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Panel lateral: Lista de animales */}
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

          <div className="max-h-[46vh] lg:max-h-[55vh] overflow-y-auto space-y-1 pr-1">
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

        {/* Panel principal: Controles de Tiempo, Reproductor y Mapa */}
        <div className="p-3 sm:p-4 space-y-3 flex flex-col justify-between">
          {/* Barra Superior de Filtros y Fechas */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {PRESET_RANGES.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handlePresetClick(preset.days)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      selectedPreset === preset.days
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Botón de Selector Personalizado de Calendario */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePicker((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    selectedPreset === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>
                    {selectedPreset === 'custom' ? `${customFrom} al ${customTo}` : 'Rango personalizado'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {/* Popover con inputs de Fecha */}
                {showDatePicker && (
                  <div className="absolute left-0 mt-2 z-40 w-72 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                      Seleccionar Rango de Estadía
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[11px] text-zinc-500 font-semibold block mb-1">Desde fecha:</label>
                        <input
                          type="date"
                          value={customFrom}
                          max={customTo || formatDate(new Date())}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-500 font-semibold block mb-1">Hasta fecha:</label>
                        <input
                          type="date"
                          value={customTo}
                          min={customFrom}
                          max={formatDate(new Date())}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyCustomDates}
                        disabled={!customFrom || !customTo || customFrom > customTo}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contador / Estado */}
            <span className="text-xs text-zinc-400 flex items-center gap-2">
              {loadingTrajectories && selectedIds.length > 0 ? (
                <span className="w-3.5 h-3.5 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></span>
              ) : selectedIds.length === 0 ? (
                'Elegí animales de la lista'
              ) : (
                `${trajectories.length} recorrido(s) cargado(s)`
              )}
            </span>
          </div>

          {!loadingTrajectories && selectedIds.length > 0 && trajectories.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              No hay posiciones de estos animales en el período elegido. Probá ampliando el rango de fechas.
            </p>
          )}

          {/* Componente de Mapa */}
          <div className="relative rounded-xl overflow-hidden">
            <LiveTrackingMap
              farmPolygon={farmPolygon}
              geofences={geofences}
              animals={[]}
              trajectories={trajectories}
              heightClassName="h-[50vh] lg:h-[55vh] min-h-80"
            />
          </div>

          {/* REPRODUCTOR PROGRESIVO DE MOVIMIENTO (PLAYBACK CONTROLLER) */}
          {trajectories.length > 0 && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                {/* Botones de control Play / Pause / Reset */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayToggle}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                    title={isPlaying ? 'Pausar recorrido' : 'Reproducir progreso del movimiento'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pausa' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetPlayback}
                    className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Reiniciar al inicio"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Selector de velocidad */}
                  <div className="flex items-center gap-1 ml-2 text-[11px] font-semibold text-zinc-500 flex-wrap">
                    <span>Velocidad:</span>
                    {[0.1, 0.25, 0.5, 1, 2, 5].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          playbackSpeed === speed
                            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white font-bold'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Momento del tiempo actual reproducido */}
                <div className="text-right">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                    {currentTimestampLabel || 'Reproduciendo...'}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Progreso: {Math.round(playbackProgress * 100)}%
                  </div>
                </div>
              </div>

              {/* Barra de progreso interactiva (Scrubber) */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={playbackProgress}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setPlaybackProgress(parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </FarmMapModal>
  );
}
