'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';
import type { Geofence, Zone, AnimalLocation } from '@/types';

// Ícono para animales pastando
const createAnimalGrazingIcon = (tag: string) => {
  return new L.DivIcon({
    className: 'animal-grazing-badge',
    html: `
      <div style="position:relative;width:34px;height:34px;">
        <div style="
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 15px;
          border: 2px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        ">🐄</div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
        ">${tag}</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

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
  zoneCoords,
  fenceCoords,
  recenterTick,
}: {
  zoneCoords: [number, number][];
  fenceCoords: [number, number][];
  recenterTick: number;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);
  const lastRecenterTick = useRef(recenterTick);

  useEffect(() => {
    const manualRecenter = recenterTick !== lastRecenterTick.current;
    lastRecenterTick.current = recenterTick;

    if (didInitialFit.current && !manualRecenter) return;

    const coords = fenceCoords.length > 0 ? fenceCoords : zoneCoords;
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40] });
      didInitialFit.current = true;
    }
  }, [zoneCoords, fenceCoords, map, recenterTick]);

  return null;
}

export interface GrazingAnimal {
  id: string;
  tag: string | null;
  breed?: string;
  animalType?: { name: string; species?: string } | null;
  latestReading?: {
    latitude: number;
    longitude: number;
    temperature: number;
  } | null;
}

export interface ZoneRotationMapProps {
  zone: Zone;
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
  animals?: GrazingAnimal[];
  heatmapPoints?: { latitude: number; longitude: number }[];
  showHeatmap?: boolean;
}

export default function ZoneRotationMap({
  zone,
  fromGeofence,
  currentGeofence,
  nextGeofence,
  activeTransitionPolygon,
  transitionInfo,
  allGeofences = [],
  animals = [],
  heatmapPoints = [],
  showHeatmap = false,
}: ZoneRotationMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const center: [number, number] = [-34.6037, -58.3816];

  const activeProvider = MAP_PROVIDERS[currentLayer];

  const zoneCoords = useMemo(() => parsePolygon(zone?.polygonCoordinates), [zone]);
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

  // Heatmap binning
  const heatmapData = useMemo(() => {
    if (!showHeatmap || !heatmapPoints || heatmapPoints.length === 0) {
      return { cells: [], maxCount: 1 };
    }
    const binSize = 0.0004; // ~40m
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    let max = 1;

    heatmapPoints.forEach((p) => {
      const bLat = Math.round(p.latitude / binSize) * binSize;
      const bLng = Math.round(p.longitude / binSize) * binSize;
      const key = `${bLat.toFixed(5)}_${bLng.toFixed(5)}`;
      const existing = grid.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.count > max) max = existing.count;
      } else {
        grid.set(key, { lat: bLat, lng: bLng, count: 1 });
      }
    });

    return {
      cells: Array.from(grid.values()),
      maxCount: max,
    };
  }, [heatmapPoints, showHeatmap]);

  // Filter animals that have GPS coordinates
  const validAnimals = useMemo(() => animals.filter((a) => a.latestReading !== null), [animals]);

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
      />

      <MapContainer center={center} zoom={14} className="w-full h-full">
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

        {/* 1. Potrero completo (Zone boundary) */}
        {zoneCoords.length > 0 && (
          <Polygon
            positions={zoneCoords}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#22c55e',
              fillOpacity: 0.08,
              weight: 2,
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs text-zinc-900">
                <p className="font-bold text-green-700">🌱 Potrero: {zone.name}</p>
                <p className="text-[11px] text-zinc-600">Perímetro general del lote.</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 2. Otros cercos de la zona (inactivos / secundarios) */}
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

        {/* 6. Capa de Puntos Calientes (Heatmap de Pastoreo) */}
        {showHeatmap &&
          heatmapData.cells.map((cell, idx) => {
            const ratio = cell.count / heatmapData.maxCount;
            let color = '#84cc16';
            if (ratio > 0.7) color = '#ef4444';
            else if (ratio > 0.4) color = '#f97316';
            else if (ratio > 0.2) color = '#eab308';

            const radius = Math.min(32, Math.max(14, 14 + ratio * 18));

            return (
              <CircleMarker
                key={`rot-heat-${idx}`}
                center={[cell.lat, cell.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.35 + ratio * 0.35,
                  stroke: false,
                }}
              >
                <Popup>
                  <div className="p-1.5 text-xs text-zinc-900">
                    <p className="font-bold">Punto Caliente de Pastoreo</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Intensidad: <b>{cell.count}</b> lecturas detectadas ({Math.round(ratio * 100)}% del máximo)
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* 7. Animales pastando en vivo */}
        {validAnimals.map((animal) => {
          const { latitude, longitude, temperature } = animal.latestReading!;
          return (
            <Marker
              key={animal.id}
              position={[latitude, longitude]}
              icon={createAnimalGrazingIcon(animal.tag || animal.id.slice(0, 4))}
            >
              <Popup>
                <div className="p-2 space-y-1 text-xs text-zinc-900 min-w-40">
                  <h4 className="font-bold text-sm">{animal.tag || 'Animal'}</h4>
                  <p className="text-zinc-500 text-[10px]">
                    {animal.animalType?.name || 'Vacuno'} &bull; {animal.breed}
                  </p>
                  <p className="text-zinc-700">Temp: {temperature.toFixed(1)} °C</p>
                  <p className="text-orange-600 font-semibold text-[11px]">
                    Pastando en: {currentGeofence?.name || 'Cerco activo'}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapAutoBounds zoneCoords={zoneCoords} fenceCoords={fenceCoords} recenterTick={recenterTick} />
      </MapContainer>
    </div>
  );
}
