'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';

// Load Leaflet map with SSR disabled to prevent server compilation crash
const ZoneMap = dynamic(() => import('@/components/ZoneMap'), { ssr: false });

interface Farm {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  pastureType: string | null;
  farmId: string;
  polygonCoordinates: any;
  createdAt: string;
}

export default function ZonasPage() {
  const { getToken } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);

  const [fetchingFarms, setFetchingFarms] = useState(true);
  const [fetchingZones, setFetchingZones] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [newZoneName, setNewZoneName] = useState('');
  const [newZonePasture, setNewZonePasture] = useState('');
  const [newPoints, setNewPoints] = useState<[number, number][]>([]);

  // Load farms on mount
  useEffect(() => {
    async function loadFarms() {
      try {
        const token = await getToken();
        const res = await fetch('http://localhost:3001/farms', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error('Error al obtener campos');
        const data = await res.json();
        setFarms(data);
        if (data.length > 0) {
          setSelectedFarm(data[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar los establecimientos registrados.');
      } finally {
        setFetchingFarms(false);
      }
    }
    loadFarms();
  }, []);

  // Load zones when selectedFarm changes
  const loadZones = async () => {
    if (!selectedFarm) {
      setZones([]);
      return;
    }
    setFetchingZones(true);
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:3001/zones?farmId=${selectedFarm}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Error al obtener zonas');
      const data = await res.json();
      setZones(data);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar las zonas del campo.');
    } finally {
      setFetchingZones(false);
    }
  };

  useEffect(() => {
    loadZones();
    // Clear drawn points on farm change
    setNewPoints([]);
  }, [selectedFarm]);

  const handleAddPoint = (point: [number, number]) => {
    setNewPoints((prev) => [...prev, point]);
  };

  const handleClearPoints = () => {
    setNewPoints([]);
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarm) return;

    if (newPoints.length < 3) {
      setError('Una zona debe tener al menos 3 puntos/coordenadas dibujadas en el mapa.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch('http://localhost:3001/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newZoneName,
          pastureType: newZonePasture || undefined,
          farmId: selectedFarm,
          polygonCoordinates: newPoints,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Error al crear la zona');
      }

      setNewZoneName('');
      setNewZonePasture('');
      setNewPoints([]);
      alert('Zona registrada con éxito');
      loadZones(); // Refresh zones list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta zona?')) return;

    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:3001/zones/${zoneId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Error al eliminar la zona');
      }

      alert('Zona eliminada con éxito');
      loadZones();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Resolve dynamic map center
  const getMapCenter = (): [number, number] => {
    if (zones.length > 0 && zones[0].polygonCoordinates) {
      try {
        const coords =
          typeof zones[0].polygonCoordinates === 'string'
            ? JSON.parse(zones[0].polygonCoordinates)
            : zones[0].polygonCoordinates;
        if (Array.isArray(coords) && coords.length > 0) {
          return [coords[0][0], coords[0][1]];
        }
      } catch (e) {}
    }
    return [-34.6037, -58.3816];
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Gestión de Zonas y Potreros
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Divide tus establecimientos en potreros o parcelas haciendo clic en el mapa para delimitar su perímetro.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
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
            Primero debes registrar un campo para poder gestionar sus zonas.
          </p>
          <Link
            href="/farms/new"
            className="inline-block bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-all shadow-sm cursor-pointer"
          >
            Registrar Mi Primer Campo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Map & Zones list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selector de Campo */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider block">
                Seleccionar Campo / Establecimiento
              </label>
              <select
                value={selectedFarm}
                onChange={(e) => setSelectedFarm(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Interactive Map Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2">
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Mapa del Establecimiento</h3>
                <span className="text-[11px] text-zinc-400">
                  {newPoints.length > 0
                    ? `Trazando: ${newPoints.length} puntos colocados`
                    : 'Haz clic en el mapa para marcar el perímetro'}
                </span>
              </div>
              <ZoneMap zones={zones} newPoints={newPoints} onAddPoint={handleAddPoint} center={getMapCenter()} />
            </div>

            {/* Listado de Zonas */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
                Zonas en este Establecimiento
              </h3>

              {fetchingZones ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              ) : zones.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                  Este establecimiento no tiene zonas registradas. Creá una usando el panel lateral.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-450 dark:text-zinc-500 text-xs font-semibold uppercase">
                        <th className="pb-3">Nombre</th>
                        <th className="pb-3">Tipo de Pastura</th>
                        <th className="pb-3">Límite / Área</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {zones.map((zone) => {
                        const coords =
                          typeof zone.polygonCoordinates === 'string'
                            ? JSON.parse(zone.polygonCoordinates)
                            : zone.polygonCoordinates;
                        const count = Array.isArray(coords) ? coords.length : 0;

                        return (
                          <tr key={zone.id} className="text-zinc-800 dark:text-zinc-200">
                            <td className="py-3.5 font-semibold">{zone.name}</td>
                            <td className="py-3.5">{zone.pastureType || 'No especificado'}</td>
                            <td className="py-3.5">
                              <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-xs text-zinc-650 dark:text-zinc-450 font-mono">
                                {count > 0 ? `${count} Vértices` : 'Sin coordenadas'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteZone(zone.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Create new Zone form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Crear Nueva Zona</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Agrega una parcela de pastoreo delimitando su perímetro sobre el mapa y completando el formulario.
                </p>
              </div>

              <form onSubmit={handleCreateZone} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Nombre del Potrero / Zona
                  </label>
                  <input
                    required
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ej: Lote A, Corral de vacas"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Tipo de Pastura / Cobertura
                  </label>
                  <input
                    type="text"
                    value={newZonePasture}
                    onChange={(e) => setNewZonePasture(e.target.value)}
                    placeholder="Ej: Alfalfa, Trébol, Pasto natural"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>

                {/* Point Drawing Log */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-500">Puntos Colocados</span>
                    {newPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearPoints}
                        className="text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Limpiar Mapa
                      </button>
                    )}
                  </div>
                  {newPoints.length === 0 ? (
                    <span className="text-[11px] text-zinc-400 italic">
                      Haz clics sobre el mapa de la izquierda para marcar las esquinas del potrero.
                    </span>
                  ) : (
                    <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1 font-mono text-[10px] text-zinc-500">
                      {newPoints.map((pt, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between border-b border-zinc-100 dark:border-zinc-850 pb-0.5"
                        >
                          <span>Vértice #{idx + 1}</span>
                          <span>
                            {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Registrar Zona'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
