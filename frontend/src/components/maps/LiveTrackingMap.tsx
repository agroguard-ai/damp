'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';
import type { TrajectoryPoint, HeatmapPoint } from '@/types';

// Ícono para animales: verde si está en línea, rojo con pulso si tiene alerta de escape,
// y ámbar con badge de reloj si la señal tiene más de 6 horas (desactualizada).
const createAnimalIcon = (label: string, hasAlert: boolean, isStale = false) => {
  let bg = 'linear-gradient(135deg, #22c55e, #15803d)';
  if (hasAlert) {
    bg = 'linear-gradient(135deg, #ef4444, #b91c1c)';
  } else if (isStale) {
    bg = 'linear-gradient(135deg, #f59e0b, #b45309)';
  }

  const fontSize = label.length > 2 ? '13px' : '18px';
  return new L.DivIcon({
    className: 'animal-cluster-badge',
    html: `
      <div style="position:relative;width:38px;height:38px;">
        <div style="
          width: 38px;
          height: 38px;
          background: ${bg};
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: ${fontSize};
          border: 2.5px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          letter-spacing: -0.5px;
        ">${label}</div>
        ${
          hasAlert
            ? '<div style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;background:#ef4444;border-radius:50%;border:2px solid white;animation:pulse-alert 1s ease-in-out infinite;"></div>'
            : isStale
              ? '<div style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;background:#f59e0b;border-radius:50%;border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;" title="Señal desactualizada">⏱</div>'
              : ''
        }
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

const createTrajectoryEndpointIcon = (type: 'start' | 'end') => {
  const isStart = type === 'start';
  const bg = isStart ? '#16a34a' : '#2563eb';
  const icon = isStart ? '🟢' : '🏁';
  return new L.DivIcon({
    className: 'trajectory-endpoint-icon',
    html: `
      <div style="
        background: ${bg};
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        border: 2px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      ">
        ${icon}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

interface Zone {
  id: string;
  name: string;
  polygonCoordinates: unknown;
}

interface AnimalLocation {
  id: string;
  tag: string | null;
  breed: string;
  weightKg: number;
  status: string;
  hasActiveAlert?: boolean;
  animalType: { name: string; species: string } | null;
  zone: { name: string } | null;
  latestReading: {
    latitude: number;
    longitude: number;
    temperature: number;
    timestamp: string;
  } | null;
}

interface Geofence {
  id: string;
  name: string;
  active: boolean;
  polygonCoordinates: unknown;
}

export interface LiveTrackingMapProps {
  zones: Zone[];
  geofences: Geofence[];
  animals: AnimalLocation[];
  trajectory?: TrajectoryPoint[] | null;
  trajectoryAnimalName?: string | null;
  heatmapPoints?: HeatmapPoint[] | null;
  showHeatmap?: boolean;
  onSelectAnimalForTrajectory?: (animalId: string) => void;
}

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
  zones,
  geofences,
  animals,
  trajectory,
  recenterTick,
}: {
  zones: Zone[];
  geofences: Geofence[];
  animals: AnimalLocation[];
  trajectory?: TrajectoryPoint[] | null;
  recenterTick: number;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);
  const lastRecenterTick = useRef(recenterTick);
  const prevTrajectoryLen = useRef(trajectory?.length ?? 0);

  useEffect(() => {
    const manualRecenter = recenterTick !== lastRecenterTick.current;
    lastRecenterTick.current = recenterTick;

    const trajectoryChanged = (trajectory?.length ?? 0) !== prevTrajectoryLen.current;
    prevTrajectoryLen.current = trajectory?.length ?? 0;

    // Si hay un recorrido activo recién cargado o el usuario pide recentrarlo
    if (trajectory && trajectory.length > 0 && (trajectoryChanged || manualRecenter)) {
      const coords: [number, number][] = trajectory.map((p) => [p.latitude, p.longitude]);
      map.fitBounds(coords, { padding: [50, 50] });
      return;
    }

    if (didInitialFit.current && !manualRecenter) return;

    const coords: [number, number][] = [];
    zones.forEach((zone) => coords.push(...parsePolygon(zone.polygonCoordinates)));
    geofences.forEach((geofence) => coords.push(...parsePolygon(geofence.polygonCoordinates)));

    animals.forEach((animal) => {
      if (animal.latestReading) {
        coords.push([animal.latestReading.latitude, animal.latestReading.longitude]);
      }
    });

    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40] });
      didInitialFit.current = true;
    }
  }, [zones, geofences, animals, trajectory, map, recenterTick]);

  return null;
}

interface ClusterGroup {
  id: string;
  lat: number;
  lng: number;
  animals: AnimalLocation[];
  hasAlert: boolean;
  allStale: boolean;
}

function ClusteredAnimalMarkers({
  animals,
  onSelectAnimalForTrajectory,
}: {
  animals: AnimalLocation[];
  onSelectAnimalForTrajectory?: (animalId: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  const clusters: ClusterGroup[] = useMemo(() => {
    const validAnimals = animals.filter((a) => a.latestReading !== null);
    const now = Date.now();
    const staleThreshold = 6 * 60 * 60 * 1000; // 6 horas

    if (zoom >= 16) {
      return validAnimals.map((a) => {
        const isStale = now - new Date(a.latestReading!.timestamp).getTime() > staleThreshold;
        return {
          id: a.id,
          lat: a.latestReading!.latitude,
          lng: a.latestReading!.longitude,
          animals: [a],
          hasAlert: !!a.hasActiveAlert,
          allStale: isStale,
        };
      });
    }

    const gridSize = zoom <= 12 ? 0.015 : zoom <= 14 ? 0.006 : 0.0025;
    const groups: Map<string, ClusterGroup> = new Map();

    validAnimals.forEach((animal) => {
      const lat = animal.latestReading!.latitude;
      const lng = animal.latestReading!.longitude;
      const key = `${Math.round(lat / gridSize)}_${Math.round(lng / gridSize)}`;
      const isStale = now - new Date(animal.latestReading!.timestamp).getTime() > staleThreshold;

      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.animals.push(animal);
        if (animal.hasActiveAlert) group.hasAlert = true;
        if (!isStale) group.allStale = false;
      } else {
        groups.set(key, {
          id: key,
          lat,
          lng,
          animals: [animal],
          hasAlert: !!animal.hasActiveAlert,
          allStale: isStale,
        });
      }
    });

    return Array.from(groups.values());
  }, [animals, zoom]);

  const staleThreshold = 6 * 60 * 60 * 1000;

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.animals.length === 1) {
          const animal = cluster.animals[0];
          const { latitude, longitude, temperature, timestamp } = animal.latestReading!;
          const isStale = Date.now() - new Date(timestamp).getTime() > staleThreshold;

          return (
            <Marker
              key={animal.id}
              position={[latitude, longitude]}
              icon={createAnimalIcon('🐄', !!animal.hasActiveAlert, isStale)}
            >
              <Popup>
                <div className="p-2 space-y-2 text-xs min-w-50 text-zinc-900">
                  {animal.hasActiveAlert && (
                    <div className="bg-red-50 border border-red-200 rounded px-2 py-1 mb-1">
                      <span className="text-red-600 font-bold text-[11px]">⚠ ALERTA: Fuera de geocerca</span>
                    </div>
                  )}

                  {isStale && !animal.hasActiveAlert && (
                    <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1">
                      <span className="text-amber-800 font-bold text-[11px]">⚠️ Ubicación desactualizada</span>
                      <p className="text-[10px] text-amber-700">Sin señal reciente (&gt; 6 horas)</p>
                    </div>
                  )}

                  <div className="border-b pb-1">
                    <h4 className="font-bold text-zinc-900 text-sm">{animal.tag || 'Animal Sin Identificador'}</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {animal.animalType?.name || 'Sin Clasificar'} &bull; {animal.breed}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Temperatura:</span>
                      <span className="font-semibold text-zinc-800">🌡️ {temperature.toFixed(1)} °C</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Zona actual:</span>
                      <span className="font-semibold text-zinc-800">{animal.zone?.name || 'Campo Abierto'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Última señal:</span>
                      <span className="font-medium text-zinc-700 text-[10px]">
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex flex-col gap-1.5">
                    {onSelectAnimalForTrajectory && (
                      <button
                        type="button"
                        onClick={() => onSelectAnimalForTrajectory(animal.id)}
                        className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-2.5 rounded-lg text-[11px] transition-colors shadow-xs"
                      >
                        📍 Ver recorrido histórico
                      </button>
                    )}
                    <a
                      href={`/animals?search=${encodeURIComponent(animal.tag || animal.id)}`}
                      className="block text-center text-green-700 dark:text-green-600 hover:underline text-[11px] font-medium"
                    >
                      Ver ficha completa &rarr;
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }

        // Render Cluster Badge
        return (
          <Marker
            key={cluster.id}
            position={[cluster.lat, cluster.lng]}
            icon={createAnimalIcon(String(cluster.animals.length), cluster.hasAlert, cluster.allStale)}
            eventHandlers={{
              click: () => {
                map.setView([cluster.lat, cluster.lng], Math.min(zoom + 2, 18));
              },
            }}
          >
            <Popup>
              <div className="p-2 space-y-2 text-xs min-w-50 text-zinc-900">
                <h4 className="font-bold text-zinc-900 border-b pb-1">
                  Grupo de Hacienda ({cluster.animals.length} animales)
                </h4>
                <div className="max-h-35 overflow-y-auto space-y-1 pr-1">
                  {cluster.animals.map((a) => (
                    <div key={a.id} className="flex justify-between text-[11px] border-b border-zinc-100 pb-1">
                      <span className="font-semibold">{a.tag || a.id.slice(0, 5)}</span>
                      <span className="text-zinc-500">{a.breed}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-green-600 font-semibold text-center pt-1 cursor-pointer">
                  Hacé clic para ampliar zona
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function HeatmapLayer({ points }: { points: HeatmapPoint[] }) {
  const data = useMemo(() => {
    if (!points || points.length === 0) return { cells: [], maxCount: 1 };
    // Spatial grid binning (~0.0005 deg ~ 50 meters)
    const binSize = 0.0005;
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    let max = 1;

    points.forEach((p) => {
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
  }, [points]);

  if (data.cells.length === 0) return null;

  return (
    <>
      {data.cells.map((cell, idx) => {
        const ratio = cell.count / data.maxCount;
        let color = '#84cc16'; // Pastoreo leve
        let intensityLabel = 'Pastoreo bajo / moderado';
        if (ratio > 0.7) {
          color = '#ef4444'; // Intensivo
          intensityLabel = 'Pastoreo intensivo (máxima permanencia)';
        } else if (ratio > 0.4) {
          color = '#f97316'; // Alto
          intensityLabel = 'Pastoreo frecuente';
        } else if (ratio > 0.2) {
          color = '#eab308'; // Medio
          intensityLabel = 'Pastoreo regular';
        }

        const radius = Math.min(35, Math.max(16, 16 + ratio * 20));

        return (
          <CircleMarker
            key={`heat-${idx}`}
            center={[cell.lat, cell.lng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.35 + ratio * 0.3,
              stroke: false,
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs text-zinc-900">
                <p className="font-bold">{intensityLabel}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Frecuencia: <b>{cell.count}</b> lecturas detectadas ({Math.round(ratio * 100)}% de intensidad)
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function TrajectoryLayer({ points, animalName }: { points: TrajectoryPoint[]; animalName?: string | null }) {
  if (!points || points.length === 0) return null;

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  // Intermediary sample points (hasta 20 hitos para no saturar el mapa)
  const step = Math.max(1, Math.floor(points.length / 20));
  const samples = points.filter((_, i) => i > 0 && i < points.length - 1 && i % step === 0);

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
        }}
      />

      {/* Start Point */}
      <Marker position={[startPoint.latitude, startPoint.longitude]} icon={createTrajectoryEndpointIcon('start')}>
        <Popup>
          <div className="p-2 text-xs space-y-1 text-zinc-900">
            <span className="inline-block bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
              🟢 Punto de Partida
            </span>
            <h4 className="font-bold">{animalName || 'Animal'}</h4>
            <p className="text-zinc-600">Fecha: {new Date(startPoint.timestamp).toLocaleString()}</p>
            <p className="text-zinc-600">Temp: {startPoint.temperature.toFixed(1)} °C</p>
          </div>
        </Popup>
      </Marker>

      {/* Waypoint markers */}
      {samples.map((pt) => (
        <CircleMarker
          key={pt.id}
          center={[pt.latitude, pt.longitude]}
          radius={4}
          pathOptions={{
            color: '#1d4ed8',
            fillColor: '#60a5fa',
            fillOpacity: 0.9,
            weight: 1.5,
          }}
        >
          <Popup>
            <div className="p-1.5 text-xs text-zinc-900">
              <p className="font-semibold text-blue-600">Punto intermedio</p>
              <p className="text-[11px] text-zinc-600">Hora: {new Date(pt.timestamp).toLocaleString()}</p>
              <p className="text-[11px] text-zinc-600">Temp: {pt.temperature.toFixed(1)} °C</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* End Point */}
      {points.length > 1 && (
        <Marker position={[endPoint.latitude, endPoint.longitude]} icon={createTrajectoryEndpointIcon('end')}>
          <Popup>
            <div className="p-2 text-xs space-y-1 text-zinc-900">
              <span className="inline-block bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                🏁 Fin / Posición más reciente
              </span>
              <h4 className="font-bold">{animalName || 'Animal'}</h4>
              <p className="text-zinc-600">Fecha: {new Date(endPoint.timestamp).toLocaleString()}</p>
              <p className="text-zinc-600">Temp: {endPoint.temperature.toFixed(1)} °C</p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default function LiveTrackingMap({
  zones,
  geofences,
  animals,
  trajectory,
  trajectoryAnimalName,
  heatmapPoints,
  showHeatmap = false,
  onSelectAnimalForTrajectory,
}: LiveTrackingMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const center: [number, number] = [-34.6037, -58.3816];

  const activeProvider = MAP_PROVIDERS[currentLayer];

  return (
    <div
      ref={containerRef}
      className="w-full h-137.5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-inner group"
    >
      <MapActionControls
        targetRef={containerRef}
        currentLayer={currentLayer}
        onChangeLayer={setCurrentLayer}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((prev) => !prev)}
        onRecenter={() => setRecenterTick((t) => t + 1)}
      />

      <MapContainer center={center} zoom={13} className="w-full h-full">
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

        {/* Límite del potrero (Zone) */}
        {zones.map((zone) => {
          const coords = parsePolygon(zone.polygonCoordinates);
          if (coords.length === 0) return null;
          return (
            <Polygon
              key={zone.id}
              positions={coords}
              pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.1, weight: 2 }}
            />
          );
        })}

        {/* Cerco virtual (Geofence) */}
        {geofences.map((geofence) => {
          if (!geofence.active) return null;
          const coords = parsePolygon(geofence.polygonCoordinates);
          if (coords.length === 0) return null;
          return (
            <Polygon
              key={geofence.id}
              positions={coords}
              pathOptions={{
                color: '#f97316',
                fillColor: '#f97316',
                fillOpacity: 0.06,
                weight: 3,
                dashArray: '10 6',
              }}
            >
              <Popup>
                <span className="text-xs font-semibold text-zinc-900">⚡ Cerco: {geofence.name}</span>
              </Popup>
            </Polygon>
          );
        })}

        {/* Capa de calor de pastoreo */}
        {showHeatmap && heatmapPoints && heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

        {/* Capa de recorrido histórico si está cargada */}
        {trajectory && trajectory.length > 0 && (
          <TrajectoryLayer points={trajectory} animalName={trajectoryAnimalName} />
        )}

        {/* Marcadores de animales (ocultos o mostrados según contexto) */}
        {(!trajectory || trajectory.length === 0) && (
          <ClusteredAnimalMarkers animals={animals} onSelectAnimalForTrajectory={onSelectAnimalForTrajectory} />
        )}

        <MapAutoBounds
          zones={zones}
          geofences={geofences}
          animals={animals}
          trajectory={trajectory}
          recenterTick={recenterTick}
        />
      </MapContainer>
    </div>
  );
}
