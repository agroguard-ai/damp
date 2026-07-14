'use client';

import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  onAddPoint: (point: [number, number]) => void;
  center?: [number, number];
}

function MapClickHandler({ onAddPoint }: { onAddPoint: (point: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function ZoneMap({ zones, newPoints, onAddPoint, center = [-34.6037, -58.3816] }: ZoneMapProps) {
  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10">
      <MapContainer center={center} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
                  pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.15 }}
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
            <Polygon positions={newPoints} pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.3 }} />
            {newPoints.map((point, idx) => (
              <Marker key={idx} position={point} />
            ))}
          </>
        )}

        <MapClickHandler onAddPoint={onAddPoint} />
      </MapContainer>
    </div>
  );
}
