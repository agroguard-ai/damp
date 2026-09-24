'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { Select } from '@/components/ui/Select';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { isPolygonInsideBoundary, type LatLngTuple } from '@/lib/geo/spatial';
import { getProvinceCenter } from '@/data/argentinaLocations';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import {
  Zap,
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Radio,
  Trash2,
  Tractor,
  Layers,
  Power,
  Plus,
} from 'lucide-react';

const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });

export default function CercosHubPage() {
  return (
    <Suspense fallback={null}>
      <CercosHubContent />
    </Suspense>
  );
}

function CercosHubContent() {
  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();

  const farmIdFromUrl = searchParams?.get('farmId') ?? '';
  const zoneIdFromUrl = searchParams?.get('zoneId') ?? '';

  // 1. Fetch all Farms
  const { data: farms = [], loading: fetchingFarms, error: farmsError } = useApi(farmsApi.getAll);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const activeFarmId = selectedFarmId || farmIdFromUrl || farms[0]?.id || '';
  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId), [farms, activeFarmId]);

  // 2. Fetch Zones of active farm
  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: zones = [], loading: fetchingZones } = useApi(fetchZones, [activeFarmId]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const activeZoneId = selectedZoneId || zoneIdFromUrl || zones[0]?.id || '';
  const activeZone = useMemo(() => zones.find((z) => z.id === activeZoneId), [zones, activeZoneId]);

  // 3. Fetch animals in active zone
  const fetchAnimals = useCallback(
    () =>
      activeFarmId && activeZoneId
        ? animalsApi.getAll({ farmId: activeFarmId, zoneId: activeZoneId, status: 'ACTIVE' })
        : Promise.resolve([]),
    [activeFarmId, activeZoneId]
  );
  const { data: animals = [] } = useApi(fetchAnimals, [activeFarmId, activeZoneId]);

  // 4. Fetch Geofences of active zone
  const fetchGeofences = useCallback(
    () => (activeZoneId ? geofencesApi.getByZone(activeZoneId) : Promise.resolve([])),
    [activeZoneId]
  );
  const {
    data: geofences = [],
    loading: fetchingGeofences,
    refetch: refetchGeofences,
  } = useApi(fetchGeofences, [activeZoneId]);

  const { mutate: createGeofence, loading: submitting } = useMutation(geofencesApi.create);
  const { mutate: deactivateGeofence } = useMutation(geofencesApi.deactivate);

  // Form State
  const [name, setName] = useState('');
  const [newPoints, setNewPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Extract Zone Polygon (Parent boundary)
  const zonePolygon = useMemo<[number, number][]>(() => {
    if (!activeZone?.polygonCoordinates) return [];
    try {
      const raw = activeZone.polygonCoordinates;
      const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(coords) ? coords : [];
    } catch {
      return [];
    }
  }, [activeZone]);

  // Extract Farm Polygon (Grandparent boundary for background context)
  const farmPolygon = useMemo<[number, number][]>(() => {
    if (!activeFarm || !(activeFarm as unknown as { polygonCoordinates?: unknown }).polygonCoordinates) return [];
    try {
      const raw = (activeFarm as unknown as { polygonCoordinates: unknown }).polygonCoordinates;
      const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(coords) ? coords : [];
    } catch {
      return [];
    }
  }, [activeFarm]);

  // Map center calculation
  const mapCenter = useMemo<[number, number]>(() => {
    if (zonePolygon.length > 0) return zonePolygon[0];
    if (farmPolygon.length > 0) return farmPolygon[0];
    if (activeFarm?.province) {
      const provCenter = getProvinceCenter(activeFarm.province);
      if (provCenter) return provCenter;
    }
    return [-34.6037, -58.3816];
  }, [zonePolygon, farmPolygon, activeFarm?.province]);

  const drawnFenceAreaHa = useMemo(() => calculatePolygonAreaHa(newPoints), [newPoints]);

  const toggleAnimal = (animalId: string) => {
    setSelectedAnimalIds((prev) =>
      prev.includes(animalId) ? prev.filter((id) => id !== animalId) : [...prev, animalId]
    );
  };

  const handleSelectAllAnimals = () => {
    if (selectedAnimalIds.length === animals.length) {
      setSelectedAnimalIds([]);
    } else {
      setSelectedAnimalIds(animals.map((a) => a.id));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZoneId) {
      toast.warning('Seleccioná una zona antes de trazar un cerco.');
      return;
    }
    if (!name.trim()) {
      toast.warning('Ingresá un nombre para el cerco eléctrico.');
      return;
    }
    if (newPoints.length < 3) {
      setError('Un cerco eléctrico debe tener al menos 3 vértices dibujados en el mapa.');
      return;
    }

    // Strict containment validation: fence must be 100% inside the zone polygon
    if (zonePolygon.length >= 3) {
      const containment = isPolygonInsideBoundary(newPoints as LatLngTuple[], zonePolygon as LatLngTuple[]);
      if (!containment.isInside) {
        const msg = `El cerco contiene ${containment.outsideCount} punto(s) fuera de los límites de la zona "${activeZone?.name}". Debe ubicarse dentro del área verde.`;
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setError(null);
    try {
      await createGeofence({
        zoneId: activeZoneId,
        name: name.trim(),
        polygonCoordinates: newPoints,
        animalIds: selectedAnimalIds,
      });

      toast.success(`Cerco eléctrico "${name}" activado exitosamente.`);
      setName('');
      setNewPoints([]);
      setSelectedVertexIndex(null);
      setSelectedAnimalIds([]);
      refetchGeofences();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el cerco eléctrico';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeactivate = async (id: string, fenceName: string) => {
    const ok = await confirm({
      title: `Desactivar "${fenceName}"`,
      description:
        'Al desactivar el cerco, los animales asignados dejarán de recibir estímulos de contención pero conservarán su collar.',
      confirmLabel: 'Desactivar',
      danger: true,
    });
    if (!ok) return;

    try {
      await deactivateGeofence(id);
      toast.success(`Cerco "${fenceName}" desactivado.`);
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar el cerco');
    }
  };

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Cercos Eléctricos" />;
  }

  if (fetchingFarms) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (farms.length === 0) {
    return <EmptyFarmState />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header with Navigation Links */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={activeFarmId ? `/zonas?farmId=${activeFarmId}` : '/zonas'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Zonas</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
            <Link
              href="/farms"
              className="text-xs font-semibold text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Ver Campos
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-600 dark:text-cyan-500" />
            Gestión de Cercos Eléctricos Virtuales
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Nivel 3: Delimitá subdivisiones de contención virtual sobre la zona activa y asigná hacienda con collares LoRa.
          </p>
        </div>
      </div>

      {/* Cascading Selectors: 1. Campo -> 2. Zona */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
            <Tractor className="w-3.5 h-3.5" />
            <span>1. Establecimiento (Campo)</span>
          </label>
          <Select
            value={activeFarmId}
            onChange={(val) => {
              setSelectedFarmId(val);
              setSelectedZoneId('');
              setNewPoints([]);
              setSelectedAnimalIds([]);
            }}
            options={farms.map((f) => ({
              value: f.id,
              label: f.name || 'Sin nombre',
              description: f.location || f.province || 'Argentina',
              icon: Tractor,
            }))}
            searchPlaceholder="Buscar campo..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>2. Zona Activa (Potrero)</span>
          </label>
          <Select
            value={activeZoneId}
            onChange={(val) => {
              setSelectedZoneId(val);
              setNewPoints([]);
              setSelectedAnimalIds([]);
            }}
            options={zones.map((z) => {
              const hasPoly = Boolean(
                z.polygonCoordinates &&
                  (typeof z.polygonCoordinates === 'string'
                    ? (z.polygonCoordinates as string).length > 2
                    : Array.isArray(z.polygonCoordinates) && (z.polygonCoordinates as unknown[]).length > 0)
              );
              return {
                value: z.id,
                label: z.name,
                description: z.pastureType ? `Pastura: ${z.pastureType}` : 'Sin pastura definida',
                badge: hasPoly ? 'Perímetro definido' : 'Sin mapa',
                icon: Layers,
              };
            })}
            disabled={zones.length === 0}
            placeholder={zones.length === 0 ? 'Este campo no tiene zonas' : 'Seleccioná una zona...'}
            searchPlaceholder="Buscar zona..."
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace */}
      {zones.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">
              Este campo no tiene zonas registradas
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Para trazar un cerco eléctrico virtual (Nivel 3), primero debés registrar y delimitar al menos una zona o potrero (Nivel 2).
            </p>
          </div>
          <Link
            href={`/zonas?farmId=${activeFarmId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Zona en este Campo</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left / Center: Interactive Map */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Mapa del Cerco</span>
                    {activeZone && (
                      <span className="text-xs font-normal text-zinc-500">
                        — Zona: {activeZone.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {zonePolygon.length > 0
                      ? 'Límites de la zona en verde. El cerco debe estar 100% contenido en este potrero.'
                      : 'La zona no tiene límites dibujados; podés trazar el cerco sobre el mapa.'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                      newPoints.length > 0
                        ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {newPoints.length > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                        Trazando cerco: {newPoints.length} pts ({drawnFenceAreaHa} Ha)
                      </>
                    ) : (
                      'Listo para trazar cerco'
                    )}
                  </span>
                </div>
              </div>

              <ZoneMap
                zonePolygon={zonePolygon}
                farmPolygon={farmPolygon}
                geofences={geofences}
                newPoints={newPoints}
                onChangePoints={setNewPoints}
                onAddPoint={(p, msg) => {
                  setNewPoints((prev) => [...prev, p]);
                  if (msg) toast.info(msg);
                }}
                onPointRejected={(_pt, msg) => {
                  toast.warning(msg);
                }}
                center={mapCenter}
                boundaryType="zone"
                boundaryLabel={`de la zona "${activeZone?.name || ''}"`}
                selectedVertexIndex={selectedVertexIndex}
                onSelectVertex={setSelectedVertexIndex}
              />
            </div>

            {/* Listado de Cercos Eléctricos Registrados */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    Cercos Eléctricos en esta Zona
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Subdivisiones de contención activas en {activeZone?.name || 'esta zona'}.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {geofences.length} cerco(s)
                </span>
              </div>

              {fetchingGeofences ? (
                <div className="py-10 text-center text-xs text-zinc-400">Cargando cercos...</div>
              ) : geofences.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                    No hay cercos eléctricos configurados en esta zona.
                  </p>
                  <p className="text-zinc-400 dark:text-zinc-500 text-xs">
                    Trazá los vértices sobre el mapa y asigná animales en el panel lateral para activar el primer cerco.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="pb-3 pr-4">Estado</th>
                        <th className="pb-3 px-4">Nombre del Cerco</th>
                        <th className="pb-3 px-4">Superficie</th>
                        <th className="pb-3 px-4">Animales Asignados</th>
                        <th className="pb-3 pl-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {geofences.map((fence) => {
                        let coords: [number, number][] = [];
                        try {
                          coords =
                            typeof fence.polygonCoordinates === 'string'
                              ? JSON.parse(fence.polygonCoordinates as string)
                              : (fence.polygonCoordinates as [number, number][]) || [];
                        } catch {
                          coords = [];
                        }
                        const fenceArea = calculatePolygonAreaHa(coords);
                        const assignedCount = fence.animalGeofences?.length || 0;

                        return (
                          <tr
                            key={fence.id}
                            className="text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="py-4 pr-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  fence.active
                                    ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    fence.active ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-400'
                                  }`}
                                ></span>
                                {fence.active ? 'Activo' : 'Desactivado'}
                              </span>
                            </td>

                            <td className="py-4 px-4 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-cyan-500" />
                              <span>{fence.name}</span>
                            </td>

                            <td className="py-4 px-4 text-xs">
                              {fenceArea > 0 ? (
                                <span className="font-medium text-zinc-900 dark:text-white">
                                  {fenceArea} Ha{' '}
                                  <span className="text-[11px] text-zinc-400">
                                    ({coords.length} pts)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic text-[11px]">
                                  Sin polígono
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {assignedCount}
                              </span>{' '}
                              animal(es)
                            </td>

                            <td className="py-4 pl-4 text-right">
                              {fence.active && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivate(fence.id, fence.name)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 transition-colors cursor-pointer"
                                  title="Desactivar cerco eléctrico"
                                >
                                  <Power className="w-3 h-3" />
                                  <span>Desactivar</span>
                                </button>
                              )}
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

          {/* Right Panel: Creation Form */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-5 sticky top-6">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  <Zap className="w-4 h-4" />
                  <span>Nuevo Cerco Virtual</span>
                </div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white mt-1">
                  Crear Cerco en {activeZone?.name}
                </h3>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nombre del Cerco *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Parcela A - Pastoreo Rotativo"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                {/* Drawn Vertices Preview Card */}
                <div className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-600" />
                      Vértices ({newPoints.length})
                    </span>
                    {newPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewPoints([]);
                          setSelectedVertexIndex(null);
                        }}
                        className="text-red-500 hover:text-red-600 text-xs font-semibold cursor-pointer"
                      >
                        Reiniciar
                      </button>
                    )}
                  </div>

                  {newPoints.length === 0 ? (
                    <div className="text-xs text-zinc-400 italic bg-white/60 dark:bg-zinc-900/60 p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                      Hacé clics sobre el mapa dentro del área verde para trazar los vértices del cerco.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Superficie estimada:</span>
                        <strong className="font-mono text-cyan-600 dark:text-cyan-400 text-sm">
                          {drawnFenceAreaHa} Ha
                        </strong>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {newPoints.map((pt, idx) => (
                          <div
                            key={idx}
                            className={`flex justify-between items-center text-[11px] p-1.5 rounded border transition-colors ${
                              selectedVertexIndex === idx
                                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 font-bold text-amber-900 dark:text-amber-200'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-500'
                            }`}
                          >
                            <span>
                              #{idx + 1}: [{pt[0].toFixed(5)}, {pt[1].toFixed(5)}]
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewPoints((prev) => prev.filter((_, i) => i !== idx));
                                if (selectedVertexIndex === idx) setSelectedVertexIndex(null);
                              }}
                              className="text-zinc-400 hover:text-red-500 ml-2 cursor-pointer"
                              title="Eliminar este vértice"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Animal Assignment Selector */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Asignar Hacienda ({selectedAnimalIds.length})</span>
                    </label>
                    {animals.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllAnimals}
                        className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        {selectedAnimalIds.length === animals.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>

                  {animals.length === 0 ? (
                    <div className="text-xs text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                      No hay animales registrados en esta zona. Podés crear el cerco ahora y asignar animales después.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      {animals.map((a) => {
                        const isSelected = selectedAnimalIds.includes(a.id);
                        return (
                          <div
                            key={a.id}
                            onClick={() => toggleAnimal(a.id)}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-900 dark:text-cyan-200 font-semibold'
                                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                              <span className="truncate">{a.tag ? `Caravana ${a.tag}` : `Animal #${a.id.slice(0, 8)}`}</span>
                              {a.breed && (
                                <span className="text-[10px] text-zinc-400">({a.breed})</span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {a.collarId ? '⚡ Collar vinculado' : 'Sin collar'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || newPoints.length < 3 || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>{submitting ? 'Activando cerco...' : 'Activar Cerco Virtual'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
