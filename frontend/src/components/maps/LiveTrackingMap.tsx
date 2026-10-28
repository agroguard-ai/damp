'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls, { type AnimalsToggleControl } from './controls/MapActionControls';
import AnimalMarkersLayer, { type MapAnimal } from './AnimalMarkersLayer';
import HeatmapCanvasLayer from './HeatmapCanvasLayer';
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
  /** Índice hasta donde se visualiza el recorrido en animación/playback (opcional) */
  progressIndex?: number;
}

export interface LiveTrackingMapProps {
  /** Id del campo para detectar cambios de campo */
  farmId?: string;
  /** Centro sugerido del mapa (coordenada de la provincia o primer vértice) */
  center?: [number, number];
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
  /** Sensibilidad / peso de cada lectura en el mapa de calor (ej. 0.1 a 1.5). */
  heatmapIntensity?: number;
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
  farmId,
  center,
  farmPolygon,
  geofences,
  animals,
  trajectories,
  recenterTick,
}: {
  farmId?: string;
  center?: [number, number];
  farmPolygon: [number, number][];
  geofences: Geofence[];
  animals: MapAnimal[];
  trajectories: MapTrajectory[];
  recenterTick: number;
}) {
  const map = useMap();
  const lastTargetKeyRef = useRef<string>('');
  const lastRecenterTick = useRef(recenterTick);
  const trajectoryKey = trajectories.map((t) => `${t.id}:${t.points.length}`).join('|');
  const prevTrajectoryKey = useRef(trajectoryKey);

  // Clave que identifica la ubicación objetivo actual (campo, polígono o centro)
  const targetKey = useMemo(() => {
    const polySig =
      farmPolygon.length > 0
        ? `poly:${farmPolygon.length}:${farmPolygon[0]?.[0].toFixed(5)},${farmPolygon[0]?.[1].toFixed(5)}`
        : 'no-poly';
    const fenceSig = geofences.length > 0 ? `fences:${geofences.map((g) => g.id).join(',')}` : 'no-fences';
    const centerSig = center ? `center:${center[0].toFixed(5)},${center[1].toFixed(5)}` : 'no-center';
    return `${farmId || 'default'}|${polySig}|${fenceSig}|${centerSig}`;
  }, [farmId, farmPolygon, geofences, center]);

  useEffect(() => {
    const manualRecenter = recenterTick !== lastRecenterTick.current;
    lastRecenterTick.current = recenterTick;

    const trajectoryChanged = trajectoryKey !== prevTrajectoryKey.current;
    prevTrajectoryKey.current = trajectoryKey;

    const targetChanged = targetKey !== lastTargetKeyRef.current;
    lastTargetKeyRef.current = targetKey;

    // 1. Si hay recorridos de animales activos cargados y cambiaron o se pidió recentrar
    const trajectoryCoords: [number, number][] = trajectories.flatMap((t) =>
      t.points.map((p) => [p.latitude, p.longitude] as [number, number])
    );
    if (trajectoryCoords.length > 0 && (trajectoryChanged || (manualRecenter && !targetChanged))) {
      map.fitBounds(trajectoryCoords, { padding: [50, 50], animate: true });
      return;
    }

    // 2. Si no cambió el objetivo (mismo campo, mismo polígono) y no es recentrado manual, no interrumpir la navegación del usuario
    if (!targetChanged && !manualRecenter) {
      return;
    }

    // 3. Obtener coordenadas del campo y sus cercos
    const coords: [number, number][] = [];
    if (farmPolygon.length > 0) {
      coords.push(...farmPolygon);
    }
    geofences.forEach((geofence) => {
      coords.push(...parsePolygon(geofence.polygonCoordinates));
    });

    // Si aún no hay polígono ni cercos pero hay animales con señal en este campo
    if (coords.length === 0) {
      animals.forEach((animal) => {
        if (animal.latestReading) {
          coords.push([animal.latestReading.latitude, animal.latestReading.longitude]);
        }
      });
    }

    // 4. Encuadrar en el campo o centrar en su posición de provincia/coordenada
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 16, animate: true });
    } else if (center) {
      map.setView(center, 14, { animate: true });
    }
  }, [targetKey, farmPolygon, geofences, animals, trajectories, trajectoryKey, center, map, recenterTick]);

  return null;
}

function TrajectoryLayer({
  points,
  animalName,
  color,
  progressIndex,
}: {
  points: TrajectoryPoint[];
  animalName: string;
  color: string;
  progressIndex?: number;
}) {
  if (!points || points.length === 0) return null;

  const effectiveEndIdx =
    typeof progressIndex === 'number'
      ? Math.max(0, Math.min(points.length - 1, progressIndex))
      : points.length - 1;

  const visiblePoints = points.slice(0, effectiveEndIdx + 1);
  if (visiblePoints.length === 0) return null;

  const positions: [number, number][] = visiblePoints.map((p) => [p.latitude, p.longitude]);
  const startPoint = visiblePoints[0];
  const currentPoint = visiblePoints[visiblePoints.length - 1];

  // Intermediary sample points (hasta 20 hitos para no saturar el mapa)
  const step = Math.max(1, Math.floor(visiblePoints.length / 20));
  const samples = visiblePoints.filter((_, i) => i > 0 && i < visiblePoints.length - 1 && i % step === 0);

  const isAnimatedInProgress = typeof progressIndex === 'number' && progressIndex < points.length - 1;

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

      {/* End Point / Posición en Reproducción */}
      {visiblePoints.length > 1 && (
        <Marker
          position={[currentPoint.latitude, currentPoint.longitude]}
          icon={createTrajectoryEndpointIcon('end', color)}
        >
          <Popup>
            <div className="p-2 text-xs space-y-1 text-zinc-900">
              <span
                className={`inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  isAnimatedInProgress ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isAnimatedInProgress ? '⏱️ Progreso / En movimiento' : '🏁 Fin / Posición más reciente'}
              </span>
              <h4 className="font-bold">{animalName}</h4>
              <p className="text-zinc-600">Fecha: {new Date(currentPoint.timestamp).toLocaleString()}</p>
              <p className="text-zinc-600">Temp: {currentPoint.temperature.toFixed(1)} °C</p>
              <p className="text-zinc-500 text-[10px]">
                Punto {effectiveEndIdx + 1} de {points.length}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default function LiveTrackingMap({
  farmId,
  center: centerProp,
  farmPolygon = [],
  geofences,
  animals,
  animalsReferenceTime = 0,
  animalsToggle,
  trajectories = [],
  heatmapPoints,
  showHeatmap = false,
  heatmapIntensity,
  onSelectAnimalForTrajectory,
  heightClassName = 'h-137.5',
}: LiveTrackingMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultCenter: [number, number] = [-34.6037, -58.3816];
  const initialCenter: [number, number] =
    centerProp || (farmPolygon.length > 0 ? farmPolygon[0] : defaultCenter);

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

      {/* Legend Badge Bar */}
      {(farmPolygon.length > 0 || geofences.length > 0) && (
        <div className="absolute top-3 left-14 z-400 bg-zinc-900/85 backdrop-blur-md border border-white/10 text-white rounded-xl px-2.5 py-1 text-[11px] font-medium hidden sm:flex items-center gap-2.5 pointer-events-none shadow-sm">
          {farmPolygon.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-green-500 border border-green-600"></span>
              <span>Campo</span>
            </div>
          )}
          {geofences.some((g) => g.active !== false) && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-cyan-400 border border-cyan-500"></span>
              <span>Cerco Activo</span>
            </div>
          )}
          {geofences.some((g) => g.active === false) && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-slate-400 border border-slate-500"></span>
              <span>Cerco Desactivado</span>
            </div>
          )}
        </div>
      )}

      <MapContainer center={initialCenter} zoom={13} className="w-full h-full">
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

        {/* Cerco virtual (Geofence) — activos en Cyan, desactivados en Slate */}
        {geofences.map((geofence) => {
          const coords = parsePolygon(geofence.polygonCoordinates);
          if (coords.length === 0) return null;
          const isActive = geofence.active !== false;

          return (
            <Polygon
              key={geofence.id}
              positions={coords}
              pathOptions={{
                color: isActive ? '#06b6d4' : '#94a3b8',
                fillColor: isActive ? '#22d3ee' : '#64748b',
                fillOpacity: isActive ? 0.15 : 0.10,
                weight: isActive ? 2.5 : 2,
                dashArray: isActive ? '5, 5' : '4, 6',
              }}
            >
              <Popup>
                <div className="p-1.5 text-xs space-y-1 text-zinc-900">
                  <div className={`flex items-center gap-1.5 font-bold ${isActive ? 'text-cyan-700' : 'text-zinc-600'}`}>
                    <span>⚡</span>
                    <span>{geofence.name}</span>
                  </div>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isActive ? 'bg-cyan-100 text-cyan-800' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {isActive ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Capa de calor de pastoreo (nebulosa continua en Canvas) */}
        {showHeatmap && heatmapPoints && heatmapPoints.length > 0 && (
          <HeatmapCanvasLayer points={heatmapPoints} intensity={heatmapIntensity} />
        )}

        {/* Capa de recorrido histórico si está cargada */}
        {trajectories.map((t) => (
          <TrajectoryLayer
            key={t.id}
            points={t.points}
            animalName={t.name}
            color={t.color}
            progressIndex={t.progressIndex}
          />
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
          farmId={farmId}
          center={centerProp || defaultCenter}
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
