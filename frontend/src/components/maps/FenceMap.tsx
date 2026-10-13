'use client';

import { MapContainer, TileLayer, Polygon, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS, DraggableVertex } from './PolygonDrawerMap';
import { validatePointInBoundary } from '@/lib/geo/spatial';

// Fix Leaflet marker icons in Next.js
if (typeof window !== 'undefined') {
  // @ts-expect-error - Merging Leaflet Icon default prototype is required in NextJS environment
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const WORLD_MASK_COORDS: [number, number][] = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
];

export interface GeofenceItem {
  id: string;
  name: string;
  polygonCoordinates: unknown;
  active?: boolean;
}

export interface FenceMapProps {
  geofences?: GeofenceItem[];
  newPoints: [number, number][];
  onAddPoint: (point: [number, number], validationMessage?: string) => void;
  onPointRejected?: (point: [number, number], message: string) => void;
  onChangePoints?: (points: [number, number][]) => void;
  center?: [number, number];
  /** Perímetro del campo: límite dentro del cual se dibujan los cercos. */
  farmPolygon?: [number, number][];
  boundaryLabel?: string;
  interactive?: boolean;
  selectedVertexIndex?: number | null;
  onSelectVertex?: (idx: number | null) => void;
  /** Clases de altura del contenedor (por defecto 450px). */
  heightClassName?: string;
}

function MapAutoBounds({
  farmPolygon,
  geofences = [],
  center,
}: {
  farmPolygon?: [number, number][];
  geofences?: GeofenceItem[];
  center?: [number, number];
}) {
  const map = useMap();
  const lastTargetKeyRef = useRef<string>('');

  // Compute a stable signature representing the active boundary target
  const targetKey = useMemo(() => {
    if (farmPolygon && farmPolygon.length > 0) {
      return `farm:${farmPolygon.length}:${farmPolygon[0]?.[0]}:${farmPolygon[0]?.[1]}`;
    }
    if (geofences.length > 0) {
      return `geofences:${geofences.map((g) => g.id).join(',')}`;
    }
    if (center) {
      return `center:${center[0].toFixed(5)}:${center[1].toFixed(5)}`;
    }
    return 'empty';
  }, [farmPolygon, geofences, center]);

  useEffect(() => {
    // If the boundary target hasn't changed, NEVER re-fit or zoom out
    if (lastTargetKeyRef.current === targetKey) {
      return;
    }
    lastTargetKeyRef.current = targetKey;

    const coords: [number, number][] = [];

    if (farmPolygon && farmPolygon.length > 0) {
      farmPolygon.forEach((pt) => coords.push(pt));
    } else {
      geofences.forEach((geofence) => {
        try {
          const poly =
            typeof geofence.polygonCoordinates === 'string'
              ? JSON.parse(geofence.polygonCoordinates)
              : geofence.polygonCoordinates;
          if (Array.isArray(poly)) {
            poly.forEach((pt) => {
              if (Array.isArray(pt) && pt.length === 2) {
                coords.push([pt[0], pt[1]]);
              }
            });
          }
        } catch {}
      });
    }

    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [90, 90], maxZoom: 16, animate: true });
    } else if (center) {
      map.setView(center, 14, { animate: true });
    }
  }, [targetKey, farmPolygon, geofences, center, map]);

  return null;
}

function MapClickHandler({
  onAddPoint,
  onPointRejected,
  boundaryPolygon = [],
  boundaryLabel = 'del establecimiento',
  isDraggingRef,
}: {
  onAddPoint: (point: [number, number], message?: string) => void;
  onPointRejected?: (point: [number, number], message: string) => void;
  boundaryPolygon?: [number, number][];
  boundaryLabel?: string;
  isDraggingRef: React.RefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      if (isDraggingRef.current) return;
      const orig = e.originalEvent as MouseEvent;
      if (orig?.target && (orig.target as HTMLElement).closest?.('.custom-vertex-marker, .leaflet-marker-icon')) {
        return;
      }

      const clicked: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (boundaryPolygon && boundaryPolygon.length >= 3) {
        // Clamping is enabled: always clamp to boundary if outside
        const result = validatePointInBoundary(clicked, boundaryPolygon, boundaryLabel, 20, true);
        if (!result.isValid) {
          if (onPointRejected) {
            onPointRejected(clicked, result.message || `El punto está fuera de los límites ${boundaryLabel}.`);
          }
          return;
        }
        onAddPoint(result.point, result.message);
      } else {
        onAddPoint(clicked);
      }
    },
  });
  return null;
}

export default function FenceMap({
  geofences = [],
  newPoints,
  onAddPoint,
  onPointRejected,
  onChangePoints,
  center = [-34.6037, -58.3816],
  farmPolygon = [],
  boundaryLabel = 'del campo',
  interactive = true,
  selectedVertexIndex: controlledSelectedIndex,
  onSelectVertex: controlledOnSelectVertex,
  heightClassName = 'h-112.5',
}: FenceMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const liveCoordsRef = useRef<[number, number][]>(newPoints);
  const isDraggingRef = useRef<boolean>(false);

  // Undo/Redo history stacks
  const historyRef = useRef<[number, number][][]>([]);
  const futureRef = useRef<[number, number][][]>([]);
  const dragStartPointsRef = useRef<[number, number][] | null>(null);

  // Internal selection state if not controlled externally
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null);
  const selectedIndex = controlledSelectedIndex !== undefined ? controlledSelectedIndex : internalSelectedIndex;

  const setSelectedIndex = useCallback(
    (idx: number | null) => {
      if (controlledOnSelectVertex) {
        controlledOnSelectVertex(idx);
      } else {
        setInternalSelectedIndex(idx);
      }
    },
    [controlledOnSelectVertex]
  );

  // Keep live coordinates in sync when newPoints update externally
  useEffect(() => {
    liveCoordsRef.current = newPoints;
  }, [newPoints]);

  const pushHistory = useCallback((currentPoints: [number, number][]) => {
    historyRef.current.push([...currentPoints.map((p) => [p[0], p[1]] as [number, number])]);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    if (!onChangePoints) return;
    if (historyRef.current.length === 0) {
      if (newPoints.length > 0) {
        futureRef.current.push([...newPoints.map((p) => [p[0], p[1]] as [number, number])]);
        onChangePoints([]);
        setSelectedIndex(null);
      }
      return;
    }
    const previous = historyRef.current.pop()!;
    futureRef.current.push([...newPoints.map((p) => [p[0], p[1]] as [number, number])]);
    onChangePoints(previous);
    if (selectedIndex !== null && selectedIndex >= previous.length) {
      setSelectedIndex(null);
    }
  }, [newPoints, onChangePoints, selectedIndex, setSelectedIndex]);

  const handleRedo = useCallback(() => {
    if (!onChangePoints || futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push([...newPoints.map((p) => [p[0], p[1]] as [number, number])]);
    onChangePoints(next);
  }, [newPoints, onChangePoints]);

  // Global Ctrl+Z / Cmd+Z listener for Undo and Ctrl+Y for Redo
  useEffect(() => {
    if (!interactive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactive, handleUndo, handleRedo]);

  const activeProvider = MAP_PROVIDERS[currentLayer];

  // El perímetro del campo actúa como límite estricto para los cercos
  const activeBoundaryPolygon = farmPolygon;
  const resolvedBoundaryLabel = boundaryLabel;

  const activeStrokeColor = '#0ea5e9';
  const activeFillColor = '#38bdf8';

  const handleInsertOrAddPoint = (point: [number, number], message?: string) => {
    pushHistory(newPoints);
    if (onChangePoints && selectedIndex !== null && selectedIndex >= 0 && selectedIndex < newPoints.length) {
      // Insert immediately after the selected vertex
      const insertIndex = selectedIndex + 1;
      const updated = [...newPoints.slice(0, insertIndex), point, ...newPoints.slice(insertIndex)];
      onChangePoints(updated);
      setSelectedIndex(insertIndex);
    } else {
      onAddPoint(point, message);
    }
  };

  const handleDragStart = () => {
    dragStartPointsRef.current = [...newPoints.map((p) => [p[0], p[1]] as [number, number])];
  };

  const handleDragMove = (idx: number, pos: [number, number]) => {
    liveCoordsRef.current[idx] = pos;
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(liveCoordsRef.current);
    }
  };

  const handleDragEnd = (idx: number, pos: [number, number], marker: L.Marker) => {
    if (!onChangePoints) return;

    if (activeBoundaryPolygon && activeBoundaryPolygon.length >= 3) {
      // Clamping is enabled: always clamp to boundary if outside
      const result = validatePointInBoundary(pos, activeBoundaryPolygon, resolvedBoundaryLabel, 20, true);

      if (dragStartPointsRef.current) {
        pushHistory(dragStartPointsRef.current);
        dragStartPointsRef.current = null;
      } else {
        pushHistory(newPoints);
      }

      if (result.status === 'snapped_to_border' || result.status === 'clamped_to_border') {
        marker.setLatLng(result.point);
      }
      const updated = [...newPoints];
      updated[idx] = result.point;
      liveCoordsRef.current = updated;
      if (polygonRef.current) {
        polygonRef.current.setLatLngs(updated);
      }
      onChangePoints(updated);
    } else {
      if (dragStartPointsRef.current) {
        pushHistory(dragStartPointsRef.current);
        dragStartPointsRef.current = null;
      } else {
        pushHistory(newPoints);
      }
      const updated = [...newPoints];
      updated[idx] = pos;
      liveCoordsRef.current = updated;
      if (polygonRef.current) {
        polygonRef.current.setLatLngs(updated);
      }
      onChangePoints(updated);
    }
  };

  const handleDeleteVertex = (idx: number) => {
    if (!onChangePoints) return;
    pushHistory(newPoints);
    const updated = newPoints.filter((_, i) => i !== idx);
    onChangePoints(updated);
    if (selectedIndex === idx) {
      setSelectedIndex(null);
    } else if (selectedIndex !== null && selectedIndex > idx) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleToggleSelectVertex = (idx: number) => {
    setSelectedIndex(selectedIndex === idx ? null : idx);
  };

  return (
    <div ref={containerRef} className={`w-full ${heightClassName} rounded-2xl overflow-hidden relative z-10 group`}>
      {/* In-Map Action Controls */}
      <MapActionControls
        targetRef={containerRef}
        currentLayer={currentLayer}
        onChangeLayer={setCurrentLayer}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((prev) => !prev)}
      />

      {/* Legend Badge Bar */}
      <div className="absolute top-4 left-4 z-400 bg-zinc-900/85 backdrop-blur-md border border-white/10 text-white rounded-xl px-3 py-1.5 shadow-md flex flex-wrap items-center gap-3 text-[11px] font-medium pointer-events-none">
        {farmPolygon.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 border border-green-600"></span>
            <span>Campo</span>
          </div>
        )}
        {geofences.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 border border-cyan-500"></span>
            <span>Cerco Eléctrico</span>
          </div>
        )}
        {newPoints.length > 0 && (
          <div className="flex items-center gap-1.5 text-blue-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 border border-blue-400"></span>
            <span>Nuevo trazado ({newPoints.length} pts)</span>
          </div>
        )}
        {selectedIndex !== null && (
          <div className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-400/40">
            <span>● Vértice #{selectedIndex + 1} activo para insertar</span>
          </div>
        )}
      </div>

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
        <MapAutoBounds farmPolygon={farmPolygon} geofences={geofences} center={center} />

        {/* Exterior Red Mask: Shading the forbidden area outside the active boundary */}
        {activeBoundaryPolygon.length >= 3 && (
          <Polygon
            positions={[WORLD_MASK_COORDS, activeBoundaryPolygon]}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.22,
              weight: 2,
              dashArray: '5, 5',
              interactive: false,
            }}
          />
        )}

        {/* 1. Render Farm Boundary */}
        {farmPolygon.length > 0 && (
          <Polygon
            positions={farmPolygon}
            pathOptions={{
              color: '#16a34a',
              fillOpacity: 0,
              weight: 2.5,
              interactive: false,
            }}
          />
        )}

        {/* 2. Render Geofences (Cercos Eléctricos: Electric Cyan dashed) */}
        {geofences.map((fence) => {
          if (!fence.polygonCoordinates) return null;
          try {
            const coords =
              typeof fence.polygonCoordinates === 'string'
                ? JSON.parse(fence.polygonCoordinates as string)
                : fence.polygonCoordinates;

            if (Array.isArray(coords) && coords.length > 0) {
              return (
                <Polygon
                  key={fence.id}
                  positions={coords}
                  pathOptions={{
                    color: '#06b6d4',
                    fillColor: '#22d3ee',
                    fillOpacity: 0.22,
                    weight: 2.5,
                    dashArray: '5, 5',
                  }}
                >
                  <Tooltip sticky>
                    <div className="text-xs">
                      <div className="font-bold text-cyan-700">⚡ {fence.name}</div>
                      <div className="text-[10px] text-zinc-500">{fence.active ? 'Cerco Activo' : 'Desactivado'}</div>
                    </div>
                  </Tooltip>
                </Polygon>
              );
            }
          } catch (e) {
            console.error('Error parsing geofence coordinates:', e);
          }
          return null;
        })}

        {/* 3. Render Currently Drawing Polygon */}
        {newPoints.length > 0 && (
          <>
            <Polygon
              ref={polygonRef}
              positions={newPoints}
              pathOptions={{
                color: activeStrokeColor,
                fillColor: activeFillColor,
                fillOpacity: 0.35,
                weight: 3,
              }}
            />
            {newPoints.map((point, idx) => (
              <DraggableVertex
                key={idx}
                idx={idx}
                point={point}
                color={activeStrokeColor}
                isSelected={selectedIndex === idx}
                onSelect={handleToggleSelectVertex}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDelete={onChangePoints ? handleDeleteVertex : undefined}
                isDraggingRef={isDraggingRef}
              />
            ))}
          </>
        )}

        {interactive && (
          <MapClickHandler
            onAddPoint={handleInsertOrAddPoint}
            onPointRejected={onPointRejected}
            boundaryPolygon={activeBoundaryPolygon}
            boundaryLabel={resolvedBoundaryLabel}
            isDraggingRef={isDraggingRef}
          />
        )}
      </MapContainer>

      {/* Helper Prompt Banner */}
      {interactive && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-400 bg-zinc-900/85 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg border border-white/10 text-center max-w-[95%] truncate">
          {newPoints.length === 0 ? (
            activeBoundaryPolygon.length > 0 ? (
              'Hacé clic dentro del perímetro del campo (en verde) para trazar el cerco'
            ) : (
              'Hacé clic en el mapa para marcar los vértices'
            )
          ) : selectedIndex !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-semibold">📍 Vértice #{selectedIndex + 1} seleccionado:</span>
              <span>El próximo clic insertará un punto contiguo a este vértice.</span>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="ml-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
              >
                Deseleccionar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Clic para agregar otro punto</span>
              <span className="text-zinc-500">•</span>
              <span className="text-cyan-300 font-medium">Arrastrá un punto para corregirlo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
