'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';

// Load Map with SSR disabled
const LiveTrackingMap = dynamic(() => import('@/components/LiveTrackingMap'), { ssr: false });

interface Farm {
  id: string;
  name: string;
}

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
  collar: {
    id: string;
    serialNumber: string;
    status: string;
  } | null;
  latestReading: {
    latitude: number;
    longitude: number;
    temperature: number;
    batteryLevel: number;
    timestamp: string;
  } | null;
}

export default function GeolocalizacionPage() {
  const { getToken } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [animals, setAnimals] = useState<AnimalLocation[]>([]);

  const [fetchingFarms, setFetchingFarms] = useState(true);
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load farms on mount
  useEffect(() => {
    async function loadFarms() {
      try {
        const token = await getToken();
        const res = await fetch('http://localhost:3001/farms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al obtener campos');
        const data = await res.json();
        setFarms(data);
        if (data.length > 0) {
          setSelectedFarm(data[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar los establecimientos.');
      } finally {
        setFetchingFarms(false);
      }
    }
    loadFarms();
  }, []);

  // Fetch Zones & Animals
  const loadMapData = async () => {
    if (!selectedFarm) return;
    setLoadingMapData(true);
    try {
      const token = await getToken();

      // Fetch Zones
      const zonesRes = await fetch(`http://localhost:3001/zones?farmId=${selectedFarm}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!zonesRes.ok) throw new Error('Error al obtener zonas');
      const zonesData = await zonesRes.json();
      setZones(zonesData);

      // Fetch Locations
      const locationsRes = await fetch(`http://localhost:3001/api/animals/locations?farmId=${selectedFarm}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!locationsRes.ok) throw new Error('Error al obtener geolocalizaciones');
      const locationsData = await locationsRes.json();
      setAnimals(locationsData);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar datos geográficos.');
    } finally {
      setLoadingMapData(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [selectedFarm]);

  // Set up 30 seconds polling for live locations
  useEffect(() => {
    if (!selectedFarm) return;

    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        const res = await fetch(`http://localhost:3001/api/animals/locations?farmId=${selectedFarm}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAnimals(data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedFarm]);

  // Derived statistics
  const activeAnimalsWithGps = animals.filter((a) => a.latestReading !== null);
  const offlineCollars = animals.filter((a) => a.collar && !a.latestReading);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Geolocalización en Vivo</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Monitoreo satelital en tiempo real de hacienda y límites geográficos (potreros). Actualizado cada 30
            segundos.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-16 rounded-xl text-center space-y-4 shadow-sm">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Primero debes registrar un campo para poder geolocalizar tu hacienda.
          </p>
          <Link
            href="/farms/new"
            className="inline-block bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-all shadow-sm cursor-pointer"
          >
            Registrar Mi Primer Campo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Map display */}
          <div className="lg:col-span-3 space-y-6">
            {/* Campo Selector */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex flex-col gap-1 w-full sm:max-w-xs">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Establecimiento Activo
                </label>
                <select
                  value={selectedFarm}
                  onChange={(e) => setSelectedFarm(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                <span>Rastreo activo (actualizaciones automáticas)</span>
              </div>
            </div>

            {/* Map Container */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
              {loadingMapData && zones.length === 0 && animals.length === 0 ? (
                <div className="flex justify-center items-center h-[550px]">
                  <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <LiveTrackingMap zones={zones} animals={animals} />
              )}
            </div>
          </div>

          {/* Right panel: Legend and Devices status */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Metrics */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Resumen de Dispositivos
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase font-semibold">Online</span>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {activeAnimalsWithGps.length}
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase font-semibold">Offline</span>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{offlineCollars.length}</div>
                </div>
              </div>
            </div>

            {/* Animals list with latest details */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4 max-h-[460px] flex flex-col">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                Dispositivos en Lote
              </h3>

              <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                {animals.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-6">
                    No hay animales registrados con collares en este campo.
                  </p>
                ) : (
                  animals.map((animal) => {
                    const hasGps = animal.latestReading !== null;
                    return (
                      <div
                        key={animal.id}
                        className="p-3 border border-zinc-100 dark:border-zinc-850 rounded-lg flex items-center justify-between hover:bg-zinc-55/30 dark:hover:bg-zinc-950/30 transition-all"
                      >
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-white">
                            {animal.tag || `ID: ${animal.id.slice(0, 5)}`}
                          </h4>
                          <div className="flex gap-1.5 text-[10px] text-zinc-400">
                            <span>{animal.breed}</span>
                            <span>&bull;</span>
                            <span>{animal.zone?.name || 'Campo abierto'}</span>
                          </div>
                        </div>

                        <div>
                          {hasGps ? (
                            <span className="bg-green-150/10 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              {animal.latestReading!.temperature.toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-500 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              Offline
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
