'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls, { type AnimalsToggleControl } from './controls/MapActionControls';
import AnimalMarkersLayer, { type MapAnimal } from './AnimalMarkersLayer';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';
import type { TrajectoryPoint, HeatmapPoint } from '@/types';

const createTrajectoryEndpointIcon = (type: 'start' | 'end', color: string) => {
  const isStart = type === 'start';
  const bg = isStart ? '#16a34a' : color;
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

interface Geofence {
  id: string;
  name: string;
  active: boolean;
  polygonCoordinates: unknown;
}

export interface MapTrajectory {
  id: string;
  name: string;
  color: string;
  points: TrajectoryPoint[];
}

export interface LiveTrackingMapProps {
  /** Perímetro del campo (se dibuja como referencia y para encuadrar el mapa). */
  farmPolygon?: [number, number][];
  geofences: Geofence[];
  /** Hacienda a dibujar (vacío si la capa de animales está apagada). */
  animals: MapAnimal[];
  /** Hora de la consulta de posiciones, para marcar señales desactualizadas. */
  animalsReferenceTime?: number;
  /** Botón "Animales" de los controles del mapa. */
  animalsToggle?: AnimalsToggleControl;
  /** Recorridos a dibujar (uno por animal, cada uno con su color). */
  trajectories?: MapTrajectory[];
  heatmapPoints?: HeatmapPoint[] | null;
  showHeatmap?: boolean;
  onSelectAnimalForTrajectory?: (animalId: string) => void;
  /** Clases de altura del contenedor (por defecto 550px). */
  heightClassName?: string;
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
  farmPolygon,
  geofences,
  animals,
  trajectories,
  recenterTick,
}: {
  farmPolygon: [number, number][];
  geofences: Geofence[];
  animals: MapAnimal[];
  trajectories: MapTrajectory[];
  recenterTick: number;
}) {
  const map = useMap();
  const didInitialFit = useRef(false);
  const lastRecenterTick = useRef(recenterTick);
  const trajectoryKey = trajectories.map((t) => `${t.id}:${t.points.length}`).join('|');
  const prevTrajectoryKey = useRef(trajectoryKey);

  useEffect(() => {
    const manualRecenter = recenterTick !== lastRecenterTick.current;
    lastRecenterTick.current = recenterTick;

    const trajectoryChanged = trajectoryKey !== prevTrajectoryKey.current;
    prevTrajectoryKey.current = trajectoryKey;

    // Si hay recorridos recién cargados o el usuario pide recentrar, se encuadran todos
    const trajectoryCoords: [number, number][] = trajectories.flatMap((t) =>
      t.points.map((p) => [p.latitude, p.longitude] as [number, number])
    );
    if (trajectoryCoords.length > 0 && (trajectoryChanged || manualRecenter)) {
      map.fitBounds(trajectoryCoords, { padding: [50, 50] });
      return;
    }

    if (didInitialFit.current && !manualRecenter) return;

    const coords: [number, number][] = [];
    coords.push(...farmPolygon);
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
  }, [farmPolygon, geofences, animals, trajectories, trajectoryKey, map, recenterTick]);

  return null;
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

function TrajectoryLayer({
  points,
  animalName,
  color,
}: {
  points: TrajectoryPoint[];
  animalName: string;
  color: string;
}) {
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
          color,
          weight: 4,
          opacity: 0.85,
        }}
      />

      {/* Start Point */}
      <Marker
        position={[startPoint.latitude, startPoint.longitude]}
        icon={createTrajectoryEndpointIcon('start', color)}
      >
        <Popup>
          <div className="p-2 text-xs space-y-1 text-zinc-900">
            <span className="inline-block bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
              🟢 Punto de Partida
            </span>
            <h4 className="font-bold">{animalName}</h4>
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
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 1.5,
          }}
        >
          <Popup>
            <div className="p-1.5 text-xs text-zinc-900">
              <p className="font-semibold" style={{ color }}>
                {animalName} · punto intermedio
              </p>
              <p className="text-[11px] text-zinc-600">Hora: {new Date(pt.timestamp).toLocaleString()}</p>
              <p className="text-[11px] text-zinc-600">Temp: {pt.temperature.toFixed(1)} °C</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* End Point */}
      {points.length > 1 && (
        <Marker position={[endPoint.latitude, endPoint.longitude]} icon={createTrajectoryEndpointIcon('end', color)}>
          <Popup>
            <div className="p-2 text-xs space-y-1 text-zinc-900">
              <span className="inline-block bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                🏁 Fin / Posición más reciente
              </span>
              <h4 className="font-bold">{animalName}</h4>
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
  farmPolygon = [],
  geofences,
  animals,
  animalsReferenceTime = 0,
  animalsToggle,
  trajectories = [],
  heatmapPoints,
  showHeatmap = false,
  onSelectAnimalForTrajectory,
  heightClassName = 'h-137.5',
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
      className={`w-full ${heightClassName} rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-inner group`}
    >
      <MapActionControls
        targetRef={containerRef}
        currentLayer={currentLayer}
        onChangeLayer={setCurrentLayer}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((prev) => !prev)}
        onRecenter={() => setRecenterTick((t) => t + 1)}
        animalsToggle={animalsToggle}
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

        {/* Perímetro del campo */}
        {farmPolygon.length >= 3 && (
          <Polygon
            positions={farmPolygon}
            pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.06, weight: 2, interactive: false }}
          />
        )}

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
                color: '#06b6d4',
                fillColor: '#22d3ee',
                fillOpacity: 0.15,
                weight: 2.5,
                dashArray: '5, 5',
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
        {trajectories.map((t) => (
          <TrajectoryLayer key={t.id} points={t.points} animalName={t.name} color={t.color} />
        ))}

        {/* Marcadores de animales (ocultos o mostrados según contexto) */}
        {trajectories.length === 0 && (
          <AnimalMarkersLayer
            animals={animals}
            referenceTime={animalsReferenceTime}
            onSelectAnimalForTrajectory={onSelectAnimalForTrajectory}
          />
        )}

        <MapAutoBounds
          farmPolygon={farmPolygon}
          geofences={geofences}
          animals={animals}
          trajectories={trajectories}
          recenterTick={recenterTick}
        />
      </MapContainer>
    </div>
  );
}
