'use client';

import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { zonesApi } from '@/lib/api/zones';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { useToast } from '@/context/ToastContext';

const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });

export default function CercosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: zoneId } = use(params);
  const { toast } = useToast();

  const { data: zone, loading: fetchingZone, error: zoneError } = useApi(() => zonesApi.getOne(zoneId), [zoneId]);

  const fetchAnimals = useCallback(
    () => (zone ? animalsApi.getAll({ farmId: zone.farmId, zoneId, status: 'ACTIVE' }) : Promise.resolve([])),
    [zone, zoneId]
  );
  const { data: animals = [] } = useApi(fetchAnimals, [zone, zoneId]);

  const {
    data: geofences = [],
    loading: fetchingGeofences,
    refetch: refetchGeofences,
  } = useApi(() => geofencesApi.getByZone(zoneId), [zoneId]);

  const { mutate: createGeofence, loading: submitting } = useMutation(geofencesApi.create);
  const { mutate: deactivateGeofence } = useMutation(geofencesApi.deactivate);

  const [name, setName] = useState('');
  const [newPoints, setNewPoints] = useState<[number, number][]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleAnimal = (animalId: string) => {
    setSelectedAnimalIds((prev) =>
      prev.includes(animalId) ? prev.filter((id) => id !== animalId) : [...prev, animalId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPoints.length < 3) {
      setError('Un cerco debe tener al menos 3 puntos dibujados en el mapa.');
      return;
    }
    setError(null);
    try {
      await createGeofence({
        zoneId,
        name,
        polygonCoordinates: newPoints,
        animalIds: selectedAnimalIds,
      });
      setName('');
      setNewPoints([]);
      setSelectedAnimalIds([]);
      toast.success('Cerco virtual creado con éxito');
      refetchGeofences();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleDeactivate = async (geofenceId: string) => {
    if (!confirm('¿Desactivar este cerco? Los animales asignados quedarán sin cerco activo.')) return;
    try {
      await deactivateGeofence(geofenceId);
      toast.success('Cerco desactivado');
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const getMapCenter = (): [number, number] => {
    if (zone?.polygonCoordinates && zone.polygonCoordinates.length > 0) {
      return [zone.polygonCoordinates[0][0], zone.polygonCoordinates[0][1]];
    }
    return [-34.6037, -58.3816];
  };

  const mapZones = zone
    ? [
        { id: zone.id, name: zone.name, pastureType: zone.pastureType, polygonCoordinates: zone.polygonCoordinates },
        ...geofences
          .filter((g) => g.active && g.polygonCoordinates)
          .map((g) => ({ id: g.id, name: g.name, pastureType: null, polygonCoordinates: g.polygonCoordinates })),
      ]
    : [];

  const displayError = zoneError ?? error;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <Link href="/zonas" className="text-xs text-green-600 hover:text-green-700 font-semibold">
          &larr; Volver a Zonas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-2">
          Cercos Virtuales {zone ? `— ${zone.name}` : ''}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Delimitá el perímetro dentro de esta zona y asignale un grupo de animales. El collar recibe el cerco
          automáticamente y suena si el animal se acerca al límite.
        </p>
      </div>

      {displayError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
          {displayError}
        </div>
      )}

      {fetchingZone ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2">
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Mapa de la Zona</h3>
                <span className="text-[11px] text-zinc-400">
                  {newPoints.length > 0
                    ? `Trazando: ${newPoints.length} puntos colocados`
                    : 'Haz clic para trazar el cerco'}
                </span>
              </div>
              <ZoneMap
                zones={mapZones}
                newPoints={newPoints}
                onAddPoint={(p) => setNewPoints((prev) => [...prev, p])}
                center={getMapCenter()}
              />
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
                Cercos en esta Zona
              </h3>
              {fetchingGeofences ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              ) : geofences.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                  Todavía no hay cercos virtuales creados en esta zona.
                </p>
              ) : (
                <div className="space-y-3">
                  {geofences.map((g) => (
                    <div
                      key={g.id}
                      className="flex justify-between items-center border border-zinc-100 dark:border-zinc-800 rounded-lg p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white">{g.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              g.active
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700/30'
                            }`}
                          >
                            {g.active ? 'Activo' : 'Desactivado'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1">
                          Creado: {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '-'} &bull;{' '}
                          {g.animalGeofences?.length ?? 0} animal(es) asignado(s)
                          {g.animalGeofences && g.animalGeofences.length > 0 && (
                            <>: {g.animalGeofences.map((ag) => ag.animal?.tag || ag.animalId.slice(0, 5)).join(', ')}</>
                          )}
                        </p>
                      </div>
                      {g.active && (
                        <button
                          onClick={() => handleDeactivate(g.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Crear Nuevo Cerco</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Dibujá el polígono sobre el mapa y elegí qué animales de esta zona quedan dentro del cerco.
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Nombre del Cerco
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Cerco Norte - Grupo A"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Animales de esta zona ({selectedAnimalIds.length} seleccionados)
                  </label>
                  <div className="max-h-[160px] overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                    {animals.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 italic p-2">No hay animales activos en esta zona.</p>
                    ) : (
                      animals.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAnimalIds.includes(a.id)}
                            onChange={() => toggleAnimal(a.id)}
                            className="cursor-pointer"
                          />
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {a.tag || `Animal (${a.id.slice(0, 5)})`}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-500">Puntos Colocados</span>
                    {newPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewPoints([])}
                        className="text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Limpiar Mapa
                      </button>
                    )}
                  </div>
                  {newPoints.length === 0 ? (
                    <span className="text-[11px] text-zinc-400 italic">
                      Haz clic sobre el mapa para marcar el límite del cerco.
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500">{newPoints.length} vértices trazados</span>
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
                      'Crear Cerco Virtual'
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
