'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapActionControls from './controls/MapActionControls';
import { type MapLayerType } from './controls/MapLayerControl';
import { MAP_PROVIDERS } from './PolygonDrawerMap';

// Ícono redondo único para animales — tanto solos como agrupados en cluster, así no se mezclan
// dos lenguajes visuales distintos (antes: pin celeste de Leaflet para uno solo, círculo verde
// para clusters). `label` es "🐄" para un animal individual, o el conteo ("3") para un cluster.
const createAnimalIcon = (label: string, hasAlert: boolean) => {
  const bg = hasAlert ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #22c55e, #15803d)';
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
            : ''
        }
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
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

interface LiveTrackingMapProps {
  zones: Zone[];
  geofences: Geofence[];
  animals: AnimalLocation[];
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
}: {
  zones: Zone[];
  geofences: Geofence[];
  animals: AnimalLocation[];
}) {
  const map = useMap();
  useEffect(() => {
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
    }
  }, [zones, geofences, animals, map]);

  return null;
}

// Cluster component tracking zoom state to group animals
interface ClusterGroup {
  id: string;
  lat: number;
  lng: number;
  animals: AnimalLocation[];
  hasAlert: boolean;
}

function ClusteredAnimalMarkers({ animals }: { animals: AnimalLocation[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  const clusters: ClusterGroup[] = useMemo(() => {
    const validAnimals = animals.filter((a) => a.latestReading !== null);
    if (zoom >= 16) {
      // High zoom: render individual markers
      return validAnimals.map((a) => ({
        id: a.id,
        lat: a.latestReading!.latitude,
        lng: a.latestReading!.longitude,
        animals: [a],
        hasAlert: !!a.hasActiveAlert,
      }));
    }

    // Grid clustering based on zoom level
    const gridSize = zoom <= 12 ? 0.015 : zoom <= 14 ? 0.006 : 0.0025;
    const groups: Map<string, ClusterGroup> = new Map();

    validAnimals.forEach((animal) => {
      const lat = animal.latestReading!.latitude;
      const lng = animal.latestReading!.longitude;
      const key = `${Math.round(lat / gridSize)}_${Math.round(lng / gridSize)}`;

      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.animals.push(animal);
        if (animal.hasActiveAlert) group.hasAlert = true;
      } else {
        groups.set(key, {
          id: key,
          lat,
          lng,
          animals: [animal],
          hasAlert: !!animal.hasActiveAlert,
        });
      }
    });

    return Array.from(groups.values());
  }, [animals, zoom]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.animals.length === 1) {
          const animal = cluster.animals[0];
          const { latitude, longitude, temperature } = animal.latestReading!;
          return (
            <Marker
              key={animal.id}
              position={[latitude, longitude]}
              icon={createAnimalIcon('🐄', !!animal.hasActiveAlert)}
            >
              <Popup>
                <div className="p-2 space-y-2 text-xs min-w-45 text-zinc-900">
                  {animal.hasActiveAlert && (
                    <div className="bg-red-50 border border-red-200 rounded px-2 py-1 mb-1">
                      <span className="text-red-600 font-bold text-[11px]">⚠ ALERTA: Fuera de geocerca</span>
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
            icon={createAnimalIcon(String(cluster.animals.length), cluster.hasAlert)}
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

export default function LiveTrackingMap({ zones, geofences, animals }: LiveTrackingMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('satellite');
  const containerRef = useRef<HTMLDivElement>(null);
  const center: [number, number] = [-34.6037, -58.3816];

  const activeProvider = MAP_PROVIDERS[currentLayer];

  return (
    <div
      ref={containerRef}
      className="w-full h-137.5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-inner group"
    >
      <MapActionControls targetRef={containerRef} currentLayer={currentLayer} onChangeLayer={setCurrentLayer} />

      <MapContainer center={center} zoom={13} className="w-full h-full">
        <TileLayer key={currentLayer} attribution={activeProvider.attribution} url={activeProvider.url} />

        {/* Límite del potrero (Zone) — perímetro del lote, sin implicancia de alerta */}
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

        {/* Cerco virtual (Geofence) — el límite que dispara la alerta ESCAPE si un animal lo cruza */}
        {geofences.map((geofence) => {
          if (!geofence.active) return null;
          const coords = parsePolygon(geofence.polygonCoordinates);
          if (coords.length === 0) return null;
          return (
            <Polygon
              key={geofence.id}
              positions={coords}
              pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.06, weight: 3, dashArray: '10 6' }}
            >
              <Popup>
                <span className="text-xs font-semibold text-zinc-900">⚡ Cerco: {geofence.name}</span>
              </Popup>
            </Polygon>
          );
        })}

        {/* Clustered Animals */}
        <ClusteredAnimalMarkers animals={animals} />

        <MapAutoBounds zones={zones} geofences={geofences} animals={animals} />
      </MapContainer>
    </div>
  );
}
