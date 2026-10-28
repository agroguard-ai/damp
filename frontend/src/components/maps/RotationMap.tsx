'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls from './controls/MapActionControls';
import AnimalMarkersLayer from './AnimalMarkersLayer';
import HeatmapCanvasLayer from './HeatmapCanvasLayer';
import { useAnimalsToggle } from '@/hooks/useAnimalLocations';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';
import type { Geofence } from '@/types';

function parsePolygon(raw: unknown): [number, number][] {
  try {
    const poly = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(poly)) return [];
    return poly.filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length === 2);
  } catch {
    return [];
  }
}

function MapAutoBounds({
  farmCoords,
  fenceCoords,
  recenterTick,
}: {
  farmCoords: [number, number][];
  fenceCoords: [number, number][];
  recenterTick: number;
}) {
  const map = useMap();
  const lastTargetKeyRef = useRef<string>('');
  const lastRecenterTick = useRef(recenterTick);

  const targetKey = useMemo(() => {
    const farmSig =
      farmCoords.length > 0 ? `${farmCoords.length}:${farmCoords[0][0].toFixed(5)},${farmCoords[0][1].toFixed(5)}` : 'empty';
    const fenceSig =
      fenceCoords.length > 0 ? `${fenceCoords.length}:${fenceCoords[0][0].toFixed(5)},${fenceCoords[0][1].toFixed(5)}` : 'empty';
    return `${farmSig}|${fenceSig}`;
  }, [farmCoords, fenceCoords]);

  useEffect(() => {
    const manualRecenter = recenterTick !== lastRecenterTick.current;
    lastRecenterTick.current = recenterTick;

    const targetChanged = targetKey !== lastTargetKeyRef.current;
    lastTargetKeyRef.current = targetKey;

    if (!targetChanged && !manualRecenter) return;

    const coords = fenceCoords.length > 0 ? fenceCoords : farmCoords;
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [farmCoords, fenceCoords, targetKey, map, recenterTick]);

  return null;
}

export interface RotationMapProps {
  /** Campo donde corre la rotación (se dibuja su perímetro como referencia). */
  farm: { name: string | null; polygonCoordinates?: unknown };
  fromGeofence?: Geofence | null;
  currentGeofence?: Geofence | null;
  nextGeofence?: Geofence | null;
  activeTransitionPolygon?: [number, number][] | null;
  transitionInfo?: {
    isTransitioning: boolean;
    current5MinStep: number;
    total5MinSteps: number;
    progressPercent: number;
  } | null;
  allGeofences?: Geofence[];
  /** Campo del mapa: habilita el botón "Animales" (apagado por defecto). */
  farmId?: string;
  heatmapPoints?: { latitude: number; longitude: number }[];
  showHeatmap?: boolean;
}

export default function RotationMap({
  farm,
  fromGeofence,
  currentGeofence,
  nextGeofence,
  activeTransitionPolygon,
  transitionInfo,
  allGeofences = [],
  farmId,
  heatmapPoints = [],
  showHeatmap = false,
}: RotationMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const center: [number, number] = [-34.6037, -58.3816];

  const activeProvider = MAP_PROVIDERS[currentLayer];

  const farmCoords = useMemo(() => parsePolygon(farm?.polygonCoordinates), [farm]);
  const fromCoords = useMemo(() => parsePolygon(fromGeofence?.polygonCoordinates), [fromGeofence]);
  const currentCoords = useMemo(() => parsePolygon(currentGeofence?.polygonCoordinates), [currentGeofence]);
  const nextCoords = useMemo(() => parsePolygon(nextGeofence?.polygonCoordinates), [nextGeofence]);
  const activeTransitionCoords = useMemo(
    () =>
      Array.isArray(activeTransitionPolygon) && activeTransitionPolygon.length >= 3 ? activeTransitionPolygon : [],
    [activeTransitionPolygon]
  );

  // All coordinates for auto bounds
  const fenceCoords = useMemo(() => {
    const pts: [number, number][] = [];
    if (activeTransitionCoords.length > 0) pts.push(...activeTransitionCoords);
    if (currentCoords.length > 0) pts.push(...currentCoords);
    if (fromCoords.length > 0) pts.push(...fromCoords);
    if (nextCoords.length > 0) pts.push(...nextCoords);
    return pts;
  }, [activeTransitionCoords, currentCoords, fromCoords, nextCoords]);

  // Filter animals that have GPS coordinates
  const herd = useAnimalsToggle(farmId);
  const initialCenter: [number, number] = farmCoords.length > 0 ? farmCoords[0] : center;

  return (
    <div
      ref={containerRef}
      className="w-full h-130 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-inner group"
    >
      <MapActionControls
        targetRef={containerRef}
        currentLayer={currentLayer}
        onChangeLayer={setCurrentLayer}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((prev) => !prev)}
        onRecenter={() => setRecenterTick((t) => t + 1)}
        animalsToggle={herd.control}
      />

      <MapContainer center={initialCenter} zoom={14} className="w-full h-full">
        <TileLayer
          key={currentLayer}
          attribution={activeProvider.attribution}
          url={activeProvider.url}
          maxZoom={activeProvider.maxZoom || 19}
        />
        {showLabels && activeProvider.roadsUrl && (
          <TileLayer
            key={`${currentLayer}-roads`}
            url={activeProvider.roadsUrl}
            zIndex={10}
            opacity={0.9}
            maxZoom={activeProvider.maxZoom || 19}
          />
        )}
        {showLabels && activeProvider.labelsUrl && (
          <TileLayer
            key={`${currentLayer}-labels`}
            url={activeProvider.labelsUrl}
            zIndex={11}
            opacity={0.95}
            maxZoom={activeProvider.maxZoom || 19}
          />
        )}

        {/* 1. Perímetro del campo */}
        {farmCoords.length > 0 && (
          <Polygon
            positions={farmCoords}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#22c55e',
              fillOpacity: 0.08,
              weight: 2,
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs text-zinc-900">
                <p className="font-bold text-green-700">🌱 Campo: {farm.name ?? 'Sin nombre'}</p>
                <p className="text-[11px] text-zinc-600">Perímetro general del campo.</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 2. Otros cercos del campo (inactivos / secundarios) */}
        {allGeofences.map((gf) => {
          if (gf.id === fromGeofence?.id || gf.id === currentGeofence?.id || gf.id === nextGeofence?.id) {
            return null;
          }
          const coords = parsePolygon(gf.polygonCoordinates);
          if (coords.length === 0) return null;
          return (
            <Polygon
              key={gf.id}
              positions={coords}
              pathOptions={{
                color: '#94a3b8',
                fillColor: '#94a3b8',
                fillOpacity: 0.04,
                weight: 1.5,
                dashArray: '4 4',
              }}
            >
              <Popup>
                <div className="p-1.5 text-xs text-zinc-900">
                  <p className="font-bold text-zinc-700">Cerco: {gf.name}</p>
                  <p className="text-[11px] text-zinc-500">Inactivo en este paso</p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* 3. Desde dónde partió (fromGeofence) */}
        {fromCoords.length > 0 && (
          <Polygon
            positions={fromCoords}
            pathOptions={{
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.12,
              weight: 2.5,
              dashArray: '8 6',
            }}
          >
            <Popup>
              <div className="p-2 text-xs space-y-1 text-zinc-900">
                <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                  🟢 Desde dónde partió (Paso previo)
                </span>
                <h4 className="font-bold text-sm">{fromGeofence?.name}</h4>
                <p className="text-zinc-600 text-[11px]">Sector pastoreado en la etapa anterior de la rotación.</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 4. A dónde va (nextGeofence) */}
        {nextCoords.length > 0 && (
          <Polygon
            positions={nextCoords}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 3,
              dashArray: '6 6',
            }}
          >
            <Popup>
              <div className="p-2 text-xs space-y-1 text-zinc-900">
                <span className="inline-block bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                  🔵 A dónde va (Próximo destino)
                </span>
                <h4 className="font-bold text-sm">{nextGeofence?.name}</h4>
                <p className="text-zinc-600 text-[11px]">
                  Próximo perímetro programado para activarse según el calendario de rotación.
                </p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 5. DÓNDE ESTÁ AHORA (currentGeofence) */}
        {currentCoords.length > 0 && (
          <Polygon
            positions={currentCoords}
            pathOptions={{
              color: '#f97316',
              fillColor: '#ea580c',
              fillOpacity: 0.22,
              weight: 4,
            }}
          >
            <Popup>
              <div className="p-2 text-xs space-y-1 text-zinc-900">
                <span className="inline-block bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                  ⚡ ACTIVO AHORA (Hacienda Pastando)
                </span>
                <h4 className="font-bold text-sm">{currentGeofence?.name}</h4>
                <p className="text-zinc-600 text-[11px]">
                  Perímetro eléctrico virtual vigente. Los animales que salgan de este límite disparan alerta de escape.
                </p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 5.1 Perímetro en transición gradual activa (enviado en downlink a collares cada ~5 min) */}
        {activeTransitionCoords.length > 0 && (
          <Polygon
            positions={activeTransitionCoords}
            pathOptions={{
              color: '#06b6d4',
              fillColor: '#06b6d4',
              fillOpacity: 0.28,
              weight: 3.5,
              dashArray: '3 5',
            }}
          >
            <Popup>
              <div className="p-2 text-xs space-y-1 text-zinc-900">
                <span className="inline-block bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                  📡 Perímetro en Transición Gradual
                </span>
                <h4 className="font-bold text-sm text-cyan-900">
                  {transitionInfo
                    ? `Paso ${transitionInfo.current5MinStep}/${transitionInfo.total5MinSteps} (${transitionInfo.progressPercent}%)`
                    : 'Ajuste incremental hacia destino'}
                </h4>
                <p className="text-zinc-600 text-[11px]">
                  Coordenadas activas que los collares reciben en su downlink LoRa cada ~5 minutos para guiar al rodeo
                  progresivamente.
                </p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 6. Capa de Puntos Calientes (Heatmap de Pastoreo en Nebulosa Continua) */}
        {showHeatmap && heatmapPoints && heatmapPoints.length > 0 && <HeatmapCanvasLayer points={heatmapPoints} />}

        {/* 7. Hacienda (capa opcional) */}
        {herd.enabled && <AnimalMarkersLayer animals={herd.animals} referenceTime={herd.fetchedAt} />}

        <MapAutoBounds farmCoords={farmCoords} fenceCoords={fenceCoords} recenterTick={recenterTick} />
      </MapContainer>
    </div>
  );
}
