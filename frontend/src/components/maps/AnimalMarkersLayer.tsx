'use client';

import { useState, useMemo } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 horas sin señal = desactualizado

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

export interface MapAnimal {
  id: string;
  tag: string | null;
  breed: string;
  weightKg: number;
  status: string;
  hasActiveAlert?: boolean;
  animalType: { name: string; species: string } | null;
  geofence?: { name: string } | null;
  latestReading: {
    latitude: number;
    longitude: number;
    temperature: number;
    timestamp: string;
  } | null;
}

interface ClusterGroup {
  id: string;
  lat: number;
  lng: number;
  animals: MapAnimal[];
  hasAlert: boolean;
  allStale: boolean;
}

/**
 * Marcadores de hacienda agrupados por cercanía según el zoom. Va dentro de un
 * <MapContainer>. `referenceTime` es la hora de la consulta de posiciones y se usa
 * para marcar las señales con más de 6 horas como desactualizadas.
 */
export default function AnimalMarkersLayer({
  animals,
  referenceTime,
  onSelectAnimalForTrajectory,
}: {
  animals: MapAnimal[];
  referenceTime: number;
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

    if (zoom >= 16) {
      return validAnimals.map((a) => {
        const isStale = referenceTime - new Date(a.latestReading!.timestamp).getTime() > STALE_THRESHOLD_MS;
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
      const isStale = referenceTime - new Date(animal.latestReading!.timestamp).getTime() > STALE_THRESHOLD_MS;

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
  }, [animals, zoom, referenceTime]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.animals.length === 1) {
          const animal = cluster.animals[0];
          const { latitude, longitude, temperature, timestamp } = animal.latestReading!;
          const isStale = referenceTime - new Date(timestamp).getTime() > STALE_THRESHOLD_MS;

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
                      <span className="text-zinc-500">Cerco actual:</span>
                      <span className="font-semibold text-zinc-800">{animal.geofence?.name || 'Sin cerco'}</span>
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
                  Hacé clic para acercar
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
