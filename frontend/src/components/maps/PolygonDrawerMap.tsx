'use client';

import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Undo2, Trash2, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';

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
}

function MapClickHandler({ onAddPoint }: { onAddPoint: (point: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

export default function PolygonDrawerMap({
  points,
  onChangePoints,
  center = [-34.6037, -58.3816],
  zoom = 14,
  existingPolygons = [],
  strokeColor = '#16a34a',
  fillColor = '#22c55e',
}: PolygonDrawerMapProps) {
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');

  const handleAddPoint = (point: [number, number]) => {
    onChangePoints([...points, point]);
  };

  const handleUndo = () => {
    if (points.length === 0) return;
    onChangePoints(points.slice(0, -1));
  };

  const handleClear = () => {
    onChangePoints([]);
  };

  const tileUrl =
    mapType === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution =
    mapType === 'satellite'
      ? '&copy; <a href="https://www.esri.com/">Esri</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className="w-full space-y-3">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMapType((prev) => (prev === 'satellite' ? 'street' : 'satellite'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            {mapType === 'satellite' ? 'Vista Callejero' : 'Vista Satelital'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors font-medium cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Deshacer punto
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

      {/* Map Container */}
      <div className="w-full h-[420px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-sm">
        <MapContainer center={center} zoom={zoom} className="w-full h-full">
          <TileLayer key={mapType} attribution={tileAttribution} url={tileUrl} />
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
              }}
            />
          ))}

          {/* Render active polygon being drawn */}
          {points.length > 0 && (
            <>
              <Polygon
                positions={points}
                pathOptions={{
                  color: strokeColor,
                  fillColor: fillColor,
                  fillOpacity: 0.35,
                  weight: 3,
                }}
              />
              {points.map((pt, idx) => (
                <Marker key={idx} position={pt} />
              ))}
            </>
          )}

          <MapClickHandler onAddPoint={handleAddPoint} />
        </MapContainer>

        {points.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-zinc-900/80 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg border border-white/10 pointer-events-none">
            Hacé clic en el mapa para marcar los vértices del perímetro
          </div>
        )}
      </div>
    </div>
  );
}
