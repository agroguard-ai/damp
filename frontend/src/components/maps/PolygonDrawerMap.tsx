'use client';

import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Undo2, Redo2, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';

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

export interface ExistingPolygon {
  id: string;
  name?: string;
  points: [number, number][];
  color?: string;
}

export interface PolygonDrawerMapProps {
  points: [number, number][];
  onChangePoints: (points: [number, number][]) => void;
  center?: [number, number];
  zoom?: number;
  existingPolygons?: ExistingPolygon[];
  strokeColor?: string;
  fillColor?: string;
  selectedVertexIndex?: number | null;
  onSelectVertex?: (idx: number | null) => void;
}

/**
 * Creates an interactive circular vertex handle icon with sequence number and selection state
 */
export function createVertexIcon(index: number, color: string, isSelected: boolean = false) {
  const border = isSelected ? '3px solid #ffffff' : '2.5px solid #ffffff';
  const ring = isSelected
    ? 'box-shadow: 0 0 0 4px #f59e0b, 0 0 16px rgba(245, 158, 11, 0.85), 0 3px 8px rgba(0,0,0,0.5);'
    : 'box-shadow: 0 2px 6px rgba(0,0,0,0.45);';
  const transform = isSelected ? 'transform: scale(1.3);' : '';
  const bg = isSelected ? '#d97706' : color;

  return L.divIcon({
    className: `custom-vertex-marker ${isSelected ? 'vertex-selected' : ''}`,
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${bg};
        border: ${border};
        border-radius: 50%;
        ${ring}
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        user-select: none;
        ${transform}
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      "
      onmouseover="if(!${isSelected}) { this.style.transform='scale(1.35)'; this.style.boxShadow='0 0 0 4px rgba(255,255,255,0.7), 0 3px 8px rgba(0,0,0,0.5)'; }"
      onmouseout="if(!${isSelected}) { this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.45)'; }"
      onmousedown="this.style.cursor='grabbing';"
      onmouseup="this.style.cursor='grab';"
      >
        ${index + 1}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface DraggableVertexProps {
  idx: number;
  point: [number, number];
  color: string;
  isSelected?: boolean;
  onSelect?: (idx: number) => void;
  onDragStart?: (idx: number) => void;
  onDragMove: (idx: number, pos: [number, number]) => void;
  onDragEnd: (idx: number, pos: [number, number], marker: L.Marker) => void;
  onDelete?: (idx: number) => void;
  isDraggingRef: React.RefObject<boolean>;
}

export function DraggableVertex({
  idx,
  point,
  color,
  isSelected = false,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDelete,
  isDraggingRef,
}: DraggableVertexProps) {
  const icon = useMemo(() => createVertexIcon(idx, color, isSelected), [idx, color, isSelected]);

  return (
    <Marker
      position={point}
      draggable={true}
      icon={icon}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelect) {
            onSelect(idx);
          }
        },
        dragstart: (e) => {
          L.DomEvent.stopPropagation(e);
          if (isDraggingRef.current !== undefined) {
            isDraggingRef.current = true;
          }
          if (onDragStart) {
            onDragStart(idx);
          }
        },
        drag: (e) => {
          L.DomEvent.stopPropagation(e);
          const marker = e.target as L.Marker;
          const { lat, lng } = marker.getLatLng();
          onDragMove(idx, [lat, lng]);
        },
        dragend: (e) => {
          L.DomEvent.stopPropagation(e);
          const marker = e.target as L.Marker;
          const { lat, lng } = marker.getLatLng();
          onDragEnd(idx, [lat, lng], marker);
          setTimeout(() => {
            if (isDraggingRef.current !== undefined) {
              isDraggingRef.current = false;
            }
          }, 150);
        },
        contextmenu: (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.preventDefault();
          }
          if (onDelete) {
            onDelete(idx);
          }
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
        <div className="text-center font-sans text-xs">
          <div className="font-bold text-zinc-900 flex items-center justify-center gap-1">
            {isSelected && <span className="text-amber-600 font-bold">● ACTIVO:</span>}
            <span>Vértice #{idx + 1}</span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">
            {isSelected
              ? 'Próximo clic insertará a su lado • Clic para deseleccionar'
              : 'Clic para seleccionar • Arrastrá para mover • Clic derecho para borrar'}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}

function MapClickHandler({
  onAddPoint,
  isDraggingRef,
}: {
  onAddPoint: (point: [number, number]) => void;
  isDraggingRef: React.RefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      if (isDraggingRef.current) return;
      const orig = e.originalEvent as MouseEvent;
      if (orig?.target && (orig.target as HTMLElement).closest?.('.custom-vertex-marker, .leaflet-marker-icon')) {
        return;
      }
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const lastCenterKeyRef = useRef<string>('');

  useEffect(() => {
    if (!center || !map) return;
    const centerKey = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    if (lastCenterKeyRef.current === centerKey) {
      return;
    }
    lastCenterKeyRef.current = centerKey;
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export interface MapProviderConfig {
  url: string;
  attribution: string;
  roadsUrl?: string;
  labelsUrl?: string;
  maxZoom?: number;
}

export const MAP_PROVIDERS: Record<MapLayerType, MapProviderConfig> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    roadsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Fuentes: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
};

export default function PolygonDrawerMap({
  points,
  onChangePoints,
  center = [-34.6037, -58.3816],
  zoom = 14,
  existingPolygons = [],
  strokeColor = '#16a34a',
  fillColor = '#22c55e',
  selectedVertexIndex: controlledSelectedIndex,
  onSelectVertex: controlledOnSelectVertex,
}: PolygonDrawerMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const liveCoordsRef = useRef<[number, number][]>(points);
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

  // Keep live coordinates in sync when points update externally
  useEffect(() => {
    liveCoordsRef.current = points;
  }, [points]);

  const pushHistory = useCallback((currentPoints: [number, number][]) => {
    historyRef.current.push([...currentPoints.map((p) => [p[0], p[1]] as [number, number])]);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) {
      if (points.length > 0) {
        futureRef.current.push([...points.map((p) => [p[0], p[1]] as [number, number])]);
        onChangePoints([]);
        setSelectedIndex(null);
      }
      return;
    }
    const previous = historyRef.current.pop()!;
    futureRef.current.push([...points.map((p) => [p[0], p[1]] as [number, number])]);
    onChangePoints(previous);
    if (selectedIndex !== null && selectedIndex >= previous.length) {
      setSelectedIndex(null);
    }
  }, [points, onChangePoints, selectedIndex, setSelectedIndex]);

  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push([...points.map((p) => [p[0], p[1]] as [number, number])]);
    onChangePoints(next);
  }, [onChangePoints, points]);

  // Global Ctrl+Z / Cmd+Z (Undo) and Ctrl+Y / Cmd+Shift+Z (Redo) listener
  useEffect(() => {
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

      // Ctrl+Z or Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Shift+Z or Ctrl+Shift+Z (Redo)
      else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleAddPoint = (point: [number, number]) => {
    pushHistory(points);
    if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < points.length) {
      // Insert immediately after the selected vertex
      const insertIndex = selectedIndex + 1;
      const updated = [...points.slice(0, insertIndex), point, ...points.slice(insertIndex)];
      onChangePoints(updated);
      // Advance selection to newly inserted point so user can chain insertions
      setSelectedIndex(insertIndex);
    } else {
      // Append to the end
      onChangePoints([...points, point]);
    }
  };

  const handleDragStart = () => {
    dragStartPointsRef.current = [...points.map((p) => [p[0], p[1]] as [number, number])];
  };

  const handleDragMove = (idx: number, pos: [number, number]) => {
    liveCoordsRef.current[idx] = pos;
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(liveCoordsRef.current);
    }
  };

  const handleDragEnd = (idx: number, pos: [number, number]) => {
    if (dragStartPointsRef.current) {
      pushHistory(dragStartPointsRef.current);
      dragStartPointsRef.current = null;
    } else {
      pushHistory(points);
    }
    const updated = [...points];
    updated[idx] = pos;
    onChangePoints(updated);
  };

  const handleDeleteVertex = (idx: number) => {
    pushHistory(points);
    const updated = points.filter((_, i) => i !== idx);
    onChangePoints(updated);
    if (selectedIndex === idx) {
      setSelectedIndex(null);
    } else if (selectedIndex !== null && selectedIndex > idx) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleClear = () => {
    if (points.length === 0) return;
    pushHistory(points);
    setSelectedIndex(null);
    onChangePoints([]);
  };

  const handleToggleSelectVertex = (idx: number) => {
    setSelectedIndex(selectedIndex === idx ? null : idx);
  };

  const activeProvider = MAP_PROVIDERS[currentLayer];

  return (
    <div className="w-full space-y-3">
      {/* Control Bar for Drawing Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-500 font-medium">
          <span>
            {points.length} {points.length === 1 ? 'vértice' : 'vértices'} trazados
          </span>
          {selectedIndex !== null && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-300 dark:border-amber-800/60">
              Vértice #{selectedIndex + 1} activo para inserción
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="text-amber-800 dark:text-amber-200 hover:text-red-500 ml-0.5 cursor-pointer"
                title="Deseleccionar"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={points.length === 0 && historyRef.current.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors font-medium cursor-pointer"
            title="Deshacer última acción (Ctrl + Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Deshacer</span>
            <kbd className="hidden sm:inline-block ml-1 px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-[10px] rounded text-zinc-400">
              Ctrl+Z
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={futureRef.current.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors font-medium cursor-pointer"
            title="Rehacer acción (Ctrl + Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar polígono
          </button>
        </div>
      </div>

      {/* Map Container Canvas */}
      <div
        ref={containerRef}
        className="w-full h-105 rounded-xl overflow-hidden relative z-10 group"
      >
        {/* Floating Round Action Controls inside the map */}
        <MapActionControls
          targetRef={containerRef}
          currentLayer={currentLayer}
          onChangeLayer={setCurrentLayer}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels((prev) => !prev)}
        />

        <MapContainer center={center} zoom={zoom} className="w-full h-full">
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
          <MapRecenter center={center} zoom={zoom} />

          {/* Render existing polygons (e.g. established farm boundary or surrounding zones) */}
          {existingPolygons.map((poly) => (
            <Polygon
              key={poly.id}
              positions={poly.points}
              pathOptions={{
                color: poly.color || '#3b82f6',
                fillColor: poly.color || '#60a5fa',
                fillOpacity: 0.2,
                interactive: false,
              }}
            />
          ))}

          {/* Render active polygon being drawn */}
          {points.length > 0 && (
            <>
              <Polygon
                ref={polygonRef}
                positions={points}
                pathOptions={{
                  color: strokeColor,
                  fillColor: fillColor,
                  fillOpacity: 0.35,
                  weight: 3,
                }}
              />
              {points.map((pt, idx) => (
                <DraggableVertex
                  key={idx}
                  idx={idx}
                  point={pt}
                  color={strokeColor}
                  isSelected={selectedIndex === idx}
                  onSelect={handleToggleSelectVertex}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onDelete={handleDeleteVertex}
                  isDraggingRef={isDraggingRef}
                />
              ))}
            </>
          )}

          <MapClickHandler onAddPoint={handleAddPoint} isDraggingRef={isDraggingRef} />
        </MapContainer>

        {points.length === 0 ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-400 bg-zinc-900/80 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg border border-white/10 pointer-events-none">
            Hacé clic en el mapa para marcar los vértices del perímetro
          </div>
        ) : selectedIndex !== null ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-400 bg-amber-500/95 backdrop-blur-md text-zinc-950 text-xs px-4 py-2 rounded-full shadow-xl font-medium border border-amber-300 flex items-center gap-2 animate-in fade-in zoom-in-95">
            <span>
              📍 <strong>Vértice #{selectedIndex + 1} seleccionado:</strong> El próximo clic insertará un punto a su
              lado.
            </span>
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="ml-1 px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Deseleccionar
            </button>
          </div>
        ) : (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-400 bg-zinc-900/85 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg border border-white/10 pointer-events-none flex items-center gap-2">
            <span>Hacé clic para añadir al final</span>
            <span className="text-zinc-500">•</span>
            <span className="text-amber-300 font-medium">Clic en un punto para insertar al lado</span>
            <span className="text-zinc-500">•</span>
            <span className="text-emerald-300 font-medium">Arrastrá para corregir</span>
          </div>
        )}
      </div>
    </div>
  );
}
