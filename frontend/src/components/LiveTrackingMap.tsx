"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons in Next.js
if (typeof window !== "undefined") {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Custom cow icon or marker icon for animals
const animalIcon = (status: string) => {
  return new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

interface Zone {
  id: string;
  name: string;
  polygonCoordinates: any;
}

interface AnimalLocation {
  id: string;
  tag: string | null;
  breed: string;
  weightKg: number;
  status: string;
  animalType: { name: string; species: string } | null;
  zone: { name: string } | null;
  latestReading: {
    latitude: number;
    longitude: number;
    temperature: number;
    batteryLevel: number;
    timestamp: string;
  } | null;
}

interface LiveTrackingMapProps {
  zones: Zone[];
  animals: AnimalLocation[];
}

function MapAutoBounds({ zones, animals }: { zones: Zone[]; animals: AnimalLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    zones.forEach((zone) => {
      try {
        const poly = typeof zone.polygonCoordinates === "string"
          ? JSON.parse(zone.polygonCoordinates)
          : zone.polygonCoordinates;
        if (Array.isArray(poly)) {
          poly.forEach((pt) => {
            if (Array.isArray(pt) && pt.length === 2) {
              coords.push([pt[0], pt[1]]);
            }
          });
        }
      } catch (e) {}
    });

    animals.forEach((animal) => {
      if (animal.latestReading) {
        coords.push([animal.latestReading.latitude, animal.latestReading.longitude]);
      }
    });

    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40] });
    }
  }, [zones, animals, map]);

  return null;
}

export default function LiveTrackingMap({ zones, animals }: LiveTrackingMapProps) {
  const center: [number, number] = [-34.6037, -58.3816];

  return (
    <div className="w-full h-[550px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-10 shadow-inner">
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render Zones background */}
        {zones.map((zone) => {
          if (!zone.polygonCoordinates) return null;
          try {
            const coords = typeof zone.polygonCoordinates === "string"
              ? JSON.parse(zone.polygonCoordinates)
              : zone.polygonCoordinates;
            
            if (Array.isArray(coords) && coords.length > 0) {
              return (
                <Polygon
                  key={zone.id}
                  positions={coords}
                  pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.1 }}
                />
              );
            }
          } catch (e) {}
          return null;
        })}

        {/* Render Animals pins */}
        {animals.map((animal) => {
          if (!animal.latestReading) return null;
          const { latitude, longitude, temperature, batteryLevel } = animal.latestReading;

          return (
            <Marker
              key={animal.id}
              position={[latitude, longitude]}
              icon={animalIcon(animal.status)}
            >
              <Popup>
                <div className="p-2 space-y-2 text-xs min-w-[160px] text-zinc-900">
                  <div className="border-b pb-1">
                    <h4 className="font-bold text-zinc-900 text-sm">
                      {animal.tag || "Animal Sin Identificador"}
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {animal.animalType?.name || "Sin Clasificar"} &bull; {animal.breed}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Temperatura:</span>
                      <span className="font-semibold text-zinc-800">🌡️ {temperature.toFixed(1)} °C</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Batería:</span>
                      <span className="font-semibold text-zinc-800">🔋 {batteryLevel.toFixed(0)} %</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Zona actual:</span>
                      <span className="font-semibold text-zinc-800">{animal.zone?.name || "Campo Abierto"}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapAutoBounds zones={zones} animals={animals} />
      </MapContainer>
    </div>
  );
}
