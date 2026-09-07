'use client';

import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef } from 'react';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';
import { validateAndSnapZonePoint, type ZonePointValidationResult } from '@/lib/geo/spatial';

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

interface Zone {
  id: string;
  name: string;
  pastureType: string | null;
  polygonCoordinates: unknown;
}

interface ZoneMapProps {
  zones: Zone[];
  newPoints: [number, number][];
  onAddPoint: (point: [number, number], validationMessage?: string) => void;
  center?: [number, number];
  farmPolygon?: [number, number][];
}

function MapAutoBounds({
  farmPolygon,
  zones,
  center,
}: {
  farmPolygon?: [number, number][];
  zones?: Zone[];
  center?: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    const coords: [number, number][] = [];

    if (farmPolygon && farmPolygon.length > 0) {
      farmPolygon.forEach((pt) => coords.push(pt));
    }

    if (zones && zones.length > 0) {
      zones.forEach((zone) => {
        try {
          const poly =
            typeof zone.polygonCoordinates === 'string' ? JSON.parse(zone.polygonCoordinates) : zone.polygonCoordinates;
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
      map.fitBounds(coords, { padding: [45, 45], maxZoom: 16, animate: true });
    } else if (center) {
      map.setView(center, 14, { animate: true });
    }
  }, [farmPolygon, zones, center, map]);

  return null;
}

function MapClickHandler({
  onAddPoint,
  farmPolygon = [],
}: {
  onAddPoint: (point: [number, number], message?: string) => void;
  farmPolygon?: [number, number][];
}) {
  useMapEvents({
    click(e) {
      const clicked: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (farmPolygon && farmPolygon.length >= 3) {
        const result: ZonePointValidationResult = validateAndSnapZonePoint(clicked, farmPolygon, 30);
        onAddPoint(result.point, result.message);
      } else {
        onAddPoint(clicked);
      }
    },
  });
  return null;
}

export default function ZoneMap({
  zones,
  newPoints,
  onAddPoint,
  center = [-34.6037, -58.3816],
  farmPolygon = [],
}: ZoneMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProvider = MAP_PROVIDERS[currentLayer];

  return (
    <div
      ref={containerRef}
      className="w-full h-112.5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-sm group"
    >
      {/* In-Map Action Controls */}
      <MapActionControls targetRef={containerRef} currentLayer={currentLayer} onChangeLayer={setCurrentLayer} />

      <MapContainer center={center} zoom={14} className="w-full h-full">
        <TileLayer key={currentLayer} attribution={activeProvider.attribution} url={activeProvider.url} />
        <MapAutoBounds farmPolygon={farmPolygon} zones={zones} center={center} />

        {/* Render Parent Farm Boundary if present */}
        {farmPolygon.length > 0 && (
          <Polygon
            positions={farmPolygon}
            pathOptions={{
              color: '#eab308',
              fillColor: '#fef08a',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* Render existing zones */}
        {zones.map((zone) => {
          if (!zone.polygonCoordinates) return null;
          try {
            const coords =
              typeof zone.polygonCoordinates === 'string'
                ? JSON.parse(zone.polygonCoordinates)
                : zone.polygonCoordinates;

            if (Array.isArray(coords) && coords.length > 0) {
              return (
                <Polygon
                  key={zone.id}
                  positions={coords}
                  pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 }}
                />
              );
            }
          } catch (e) {
            console.error('Error parsing zone coordinates:', e);
          }
          return null;
        })}

        {/* Render currently drawing new zone */}
        {newPoints.length > 0 && (
          <>
            <Polygon
              positions={newPoints}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.35, weight: 3 }}
            />
            {newPoints.map((point, idx) => (
              <Marker key={idx} position={point} />
            ))}
          </>
        )}

        <MapClickHandler onAddPoint={onAddPoint} farmPolygon={farmPolygon} />
      </MapContainer>

      {newPoints.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-400 bg-zinc-900/80 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg border border-white/10 pointer-events-none text-center">
          {farmPolygon.length > 0
            ? 'Hacé clic dentro del perímetro (delimitado en amarillo) para trazar el potrero'
            : 'Hacé clic en el mapa para delimitar el potrero'}
        </div>
      )}
    </div>
  );
}
