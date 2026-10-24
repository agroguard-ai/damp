'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Flame } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { parsePolygon } from '@/lib/geo/spatial';
import type { Farm } from '@/types';
import FarmMapModal from './FarmMapModal';

const LiveTrackingMap = dynamic(() => import('@/components/maps/LiveTrackingMap'), { ssr: false });

const HEATMAP_RANGES = [7, 15, 30, 90] as const;

const HEATMAP_LEGEND = [
  { color: 'bg-lime-500', label: 'Poco' },
  { color: 'bg-amber-400', label: 'Moderado' },
  { color: 'bg-orange-500', label: 'Frecuente' },
  { color: 'bg-red-500', label: 'Intensivo' },
];

interface HeatmapModalProps {
  farm: Pick<Farm, 'id' | 'name' | 'polygonCoordinates'>;
  onClose: () => void;
}

/** Mapa de calor de uso del campo: dónde pasó más tiempo la hacienda en los últimos días. */
export default function HeatmapModal({ farm, onClose }: HeatmapModalProps) {
  const [days, setDays] = useState<number>(7);
  // Peso / intensidad que aporta cada lectura a la sumatoria (en %, de 10% a 150%, por defecto 50%)
  const [intensityPct, setIntensityPct] = useState<number>(50);
  const farmPolygon = useMemo(() => parsePolygon(farm.polygonCoordinates), [farm.polygonCoordinates]);

  const fetchHeatmap = useCallback(() => animalsApi.getHeatmap(farm.id, { days }), [farm.id, days]);
  const { data: heatmap, loading } = useApi(fetchHeatmap, [farm.id, days]);

  const fetchGeofences = useCallback(() => geofencesApi.getByFarm(farm.id), [farm.id]);
  const { data: geofences = [] } = useApi(fetchGeofences, [farm.id]);

  return (
    <FarmMapModal
      icon={Flame}
      iconClassName="bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
      title={`Mapa de calor — ${farm.name || 'Campo'}`}
      subtitle="Dónde pasó más tiempo la hacienda. Las zonas sin color son áreas poco usadas."
      onClose={onClose}
    >
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {HEATMAP_RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  days === d
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {d} días
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
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-orange-500/20 border-t-orange-600 rounded-full animate-spin"></span>
            ) : (
              `${heatmap?.totalPoints ?? 0} posiciones analizadas`
            )}
          </span>
        </div>

        {/* Control deslizante (Slider) para graduar el peso/intensidad de cada punto */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Peso por punto (detalle):</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              Menor valor exige más lecturas acumuladas para llegar al rojo
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 sm:max-w-xs min-w-48">
            <span className="text-[10px] text-zinc-400 shrink-0">Más detalle</span>
            <input
              type="range"
              min="10"
              max="140"
              step="5"
              value={intensityPct}
              onChange={(e) => setIntensityPct(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              title="Graduar cuánto aporta cada lectura a la sumatoria del mapa de calor"
            />
            <span className="text-[10px] text-zinc-400 shrink-0">Más intenso</span>
            <span className="font-mono font-bold text-[11px] text-orange-600 dark:text-orange-400 w-10 text-right shrink-0">
              {intensityPct}%
            </span>
          </div>
        </div>

        {!loading && (heatmap?.totalPoints ?? 0) === 0 && (
          <p className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
            No hay posiciones registradas en los últimos {days} días. Probá con un período más largo.
          </p>
        )}

        <LiveTrackingMap
          farmPolygon={farmPolygon}
          geofences={geofences}
          animals={[]}
          heatmapPoints={heatmap?.points ?? null}
          showHeatmap
          heatmapIntensity={intensityPct / 100}
          heightClassName="h-[60vh] min-h-96"
        />
      </div>
    </FarmMapModal>
  );
}
