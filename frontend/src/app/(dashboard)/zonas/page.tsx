'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Select';
import { getProvinceCenter } from '@/data/argentinaLocations';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { isPolygonInsideBoundary, type LatLngTuple } from '@/lib/geo/spatial';
import { Tractor, Layers, Zap, Trash2, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, Edit3, Save, X } from 'lucide-react';
import type { Zone } from '@/types';

// Load Leaflet map with SSR disabled to prevent server compilation crash
const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });

export default function ZonasPage() {
  return (
    <Suspense fallback={null}>
      <ZonasPageContent />
    </Suspense>
  );
}

function ZonasPageContent() {
  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: farms = [], loading: fetchingFarms, error: farmsError } = useApi(farmsApi.getAll);

  const searchParams = useSearchParams();
  const farmIdFromUrl = searchParams?.get('farmId') ?? '';
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farmIdFromUrl || farms[0]?.id || '';
  const [error, setError] = useState<string | null>(null);

  // Form & Editing State
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZonePasture, setNewZonePasture] = useState('');
  const [newPoints, setNewPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId), [farms, activeFarmId]);

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

  const currentUserId = emulatedUser?.id || user?.id;
  const canManageActiveFarm = useMemo(() => {
    if (!activeFarm || !currentUserId) return false;
    if (activeFarm.userId === currentUserId) return true;
    const membership = activeFarm.farmUsers?.find((fu) => fu.userId === currentUserId);
    return membership?.role?.name === 'ADMIN';
  }, [activeFarm, currentUserId]);

  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );

  const { data: zones = [], loading: fetchingZones, refetch: refetchZones } = useApi(fetchZones, [activeFarmId]);

  const { mutate: createZone, loading: submitting } = useMutation(zonesApi.create);
  const { mutate: updateZone, loading: updating } = useMutation(zonesApi.update);
  const { mutate: deleteZone } = useMutation(zonesApi.delete);

  const handleAddPoint = (point: [number, number], message?: string) => {
    setNewPoints((prev) => [...prev, point]);
    if (message) {
      toast.info(message);
    }
  };

  const handleClearPoints = () => {
    setNewPoints([]);
    setSelectedVertexIndex(null);
  };

  const handleSelectZone = (zone: Zone) => {
    setEditingZone(zone);
    setNewZoneName(zone.name);
    setNewZonePasture(zone.pastureType || '');

    let coords: [number, number][] = [];
    try {
      coords =
        typeof zone.polygonCoordinates === 'string'
          ? JSON.parse(zone.polygonCoordinates as string)
          : zone.polygonCoordinates || [];
    } catch {
      coords = [];
    }

    setNewPoints(coords);
    setSelectedVertexIndex(null);
    setError(null);
    toast.info(`Editando zona "${zone.name}". Modificá los vértices sobre el mapa o los datos en el panel.`);
  };

  const handleCancelEdit = () => {
    setEditingZone(null);
    setNewZoneName('');
    setNewZonePasture('');
    setNewPoints([]);
    setSelectedVertexIndex(null);
    setError(null);
  };

  // Pre-validate that all points are inside farm polygon before creating/updating
  const handleCreateOrUpdateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;

    if (newPoints.length < 3) {
      setError('Una zona debe tener al menos 3 puntos/coordenadas dibujadas en el mapa.');
      return;
    }

    // Check containment if farm has a defined perimeter
    if (farmPolygon.length >= 3) {
      const containment = isPolygonInsideBoundary(newPoints as LatLngTuple[], farmPolygon as LatLngTuple[]);
      if (!containment.isInside) {
        const msg = `La zona contiene ${containment.outsideCount} punto(s) fuera de los límites del establecimiento. Cada punto debe estar dentro del perímetro verde.`;
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setError(null);
    try {
      if (editingZone) {
        await updateZone({
          id: editingZone.id,
          name: newZoneName,
          pastureType: newZonePasture || undefined,
          farmId: activeFarmId,
          polygonCoordinates: newPoints,
        });
        toast.success(`Zona "${newZoneName}" actualizada con éxito`);
        setEditingZone(null);
      } else {
        await createZone({
          name: newZoneName,
          pastureType: newZonePasture || undefined,
          farmId: activeFarmId,
          polygonCoordinates: newPoints,
        });
        toast.success('Zona registrada con éxito dentro del establecimiento');
      }

      setNewZoneName('');
      setNewZonePasture('');
      setNewPoints([]);
      setSelectedVertexIndex(null);
      refetchZones();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar la zona';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteZone = async (zone: Zone) => {
    const animalsCount = zone._count?.animals ?? 0;
    const fencesCount = zone.geofences?.length ?? zone._count?.geofences ?? 0;

    let desc = `¿Estás seguro de que deseas eliminar la zona "${zone.name}"? Esta acción no se puede deshacer.`;
    if (animalsCount > 0 || fencesCount > 0) {
      desc += `\n\nImpacto en recursos:`;
      if (animalsCount > 0) {
        desc += `\n• ${animalsCount} animal(es) asignados quedarán desvinculados de este potrero (sin perderse ni archivarse).`;
      }
      if (fencesCount > 0) {
        desc += `\n• Se eliminarán ${fencesCount} cerco(s) virtual(es) de la zona.`;
      }
    }

    const ok = await confirm({
      title: `Eliminar zona "${zone.name}"`,
      description: desc,
      confirmLabel: 'Sí, eliminar zona',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteZone(zone.id);
      toast.success('Zona eliminada con éxito');
      if (editingZone?.id === zone.id) {
        handleCancelEdit();
      }
      refetchZones();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido al eliminar la zona');
    }
  };

  // Resolve dynamic map center stably
  const mapCenter = useMemo<[number, number]>(() => {
    if (farmPolygon.length > 0) {
      return farmPolygon[0];
    }
    if (activeFarm?.province) {
      const provCenter = getProvinceCenter(activeFarm.province);
      if (provCenter) return provCenter;
    }
    if (zones.length > 0 && zones[0].polygonCoordinates) {
      try {
        const coords =
          typeof zones[0].polygonCoordinates === 'string'
            ? JSON.parse(zones[0].polygonCoordinates as string)
            : zones[0].polygonCoordinates;
        if (Array.isArray(coords) && coords.length > 0) {
          return [coords[0][0], coords[0][1]];
        }
      } catch {}
    }
    return [-34.6037, -58.3816];
  }, [farmPolygon, activeFarm?.province, zones]);

  const displayError = farmsError ?? error;

  // Real-time calculated area of new zone being drawn
  const drawnAreaHa = useMemo(() => calculatePolygonAreaHa(newPoints), [newPoints]);

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Zonas" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header with Navigation Links */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/farms"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Campos</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
            <Link
              href={activeFarmId ? `/cercos?farmId=${activeFarmId}` : '/cercos'}
              className="text-xs font-semibold text-zinc-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Gestionar Cercos
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-green-600 dark:text-green-500" />
            Gestión de Zonas y Potreros
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Nivel 2: Subdivide tu campo en potreros delimitando su perímetro sobre el mapa. Cada zona albergará sus propios cercos eléctricos.
          </p>
        </div>
      </div>

      {displayError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Map & Zones list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Custom Modern Selector for Farm */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs">
              <Select
                label="Seleccionar Campo / Establecimiento (Nivel 1)"
                value={activeFarmId}
                onChange={(val) => {
                  setSelectedFarm(val);
                  handleCancelEdit();
                }}
                options={farms.map((farm) => {
                  const hasPoly = Boolean(
                    farm.polygonCoordinates &&
                      (typeof farm.polygonCoordinates === 'string'
                        ? farm.polygonCoordinates.length > 2
                        : (farm.polygonCoordinates as unknown[]).length > 0)
                  );
                  return {
                    value: farm.id,
                    label: farm.name || 'Establecimiento sin nombre',
                    description: `${farm.location || farm.province || 'Argentina'}${
                      farm.totalAreaHa ? ` · ${farm.totalAreaHa} Ha` : ''
                    }`,
                    badge: hasPoly ? 'Perímetro definido' : 'Sin perímetro',
                    icon: Tractor,
                  };
                })}
                searchable={farms.length > 3}
                searchPlaceholder="Buscar establecimiento..."
              />
            </div>

            {/* Interactive Map Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Mapa del Establecimiento</span>
                    {activeFarm && (
                      <span className="text-xs font-normal text-zinc-500">
                        — {activeFarm.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {farmPolygon.length > 0
                      ? 'Zona exterior bloqueada en rojo. Al hacer clic o arrastrar fuera, los vértices se adhieren automáticamente al límite del campo.'
                      : 'El campo no tiene perímetro delimitado; delimitá la zona haciendo clics sucesivos.'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                      editingZone
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                        : newPoints.length > 0
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {editingZone ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Editando zona &ldquo;{editingZone.name}&rdquo; ({newPoints.length} pts &bull; {drawnAreaHa} Ha)
                      </>
                    ) : newPoints.length > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Trazando: {newPoints.length} puntos ({drawnAreaHa} Ha)
                      </>
                    ) : (
                      'Listo para trazar'
                    )}
                  </span>
                </div>
              </div>

              <ZoneMap
                zones={zones}
                newPoints={newPoints}
                onChangePoints={setNewPoints}
                onAddPoint={handleAddPoint}
                onPointRejected={(_pt, msg) => {
                  toast.warning(msg);
                }}
                center={mapCenter}
                farmPolygon={farmPolygon}
                boundaryType="farm"
                selectedVertexIndex={selectedVertexIndex}
                onSelectVertex={setSelectedVertexIndex}
                onSelectZone={(z) => handleSelectZone(z as unknown as Zone)}
                selectedZoneId={editingZone?.id ?? null}
              />
            </div>

            {/* Listado de Zonas con Jerarquía y Acceso a Cercos Eléctricos */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    Zonas Registradas
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Subdivisiones creadas en {activeFarm?.name || 'este campo'} y sus cercos eléctricos internos.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {zones.length} zona(s)
                </span>
              </div>

              {fetchingZones ? (
                <SkeletonRowList count={3} />
              ) : zones.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6" />
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                    Este establecimiento no tiene zonas registradas todavía.
                  </p>
                  <p className="text-zinc-400 dark:text-zinc-500 text-xs">
                    Creá tu primera zona haciendo clics sobre el mapa dentro del perímetro del campo.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="pb-3 pr-4">Zona</th>
                        <th className="pb-3 px-4">Pastura</th>
                        <th className="pb-3 px-4">Superficie (Ha)</th>
                        <th className="pb-3 px-4">Cercos Eléctricos (Nivel 3)</th>
                        <th className="pb-3 px-4">Animales</th>
                        <th className="pb-3 pl-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {zones.map((zone) => {
                        let coords: [number, number][] = [];
                        try {
                          coords =
                            typeof zone.polygonCoordinates === 'string'
                              ? JSON.parse(zone.polygonCoordinates as string)
                              : zone.polygonCoordinates || [];
                        } catch {
                          coords = [];
                        }
                        const zoneArea = calculatePolygonAreaHa(coords);
                        const activeFencesCount =
                          zone.geofences?.filter((g) => g.active).length ??
                          zone._count?.geofences ??
                          0;

                        return (
                          <tr
                            key={zone.id}
                            className={`text-zinc-800 dark:text-zinc-200 transition-colors ${
                              editingZone?.id === zone.id
                                ? 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                                : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                            }`}
                          >
                            <td className="py-4 pr-4 font-semibold">
                              <button
                                type="button"
                                onClick={() => handleSelectZone(zone)}
                                className="flex items-center gap-2 text-left group cursor-pointer"
                                title="Clic para seleccionar y editar esta zona"
                              >
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  editingZone?.id === zone.id ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
                                }`}></span>
                                <span className="font-semibold text-zinc-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                  {zone.name}
                                </span>
                                {editingZone?.id === zone.id && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                    Editando
                                  </span>
                                )}
                              </button>
                            </td>

                            <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                              {zone.pastureType || 'No especificado'}
                            </td>

                            <td className="py-4 px-4 text-xs">
                              {zoneArea > 0 ? (
                                <span className="font-medium text-zinc-900 dark:text-white">
                                  {zoneArea} Ha{' '}
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

                            <td className="py-4 px-4">
                              <Link
                                href={`/cercos?farmId=${activeFarmId}&zoneId=${zone.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>{activeFencesCount} cerco(s)</span>
                                <ArrowRight className="w-3 h-3 ml-0.5 opacity-60" />
                              </Link>
                            </td>

                            <td className="py-4 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                              {zone._count?.animals ?? '-'} cabezas
                            </td>

                            <td className="py-4 pl-4 text-right whitespace-nowrap space-x-1.5">
                              {canManageActiveFarm ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectZone(zone)}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                      editingZone?.id === zone.id
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-zinc-600 dark:text-zinc-300 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 border border-zinc-200 dark:border-zinc-800'
                                    }`}
                                    title="Seleccionar y editar zona"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>

                                  <button
                                    onClick={() => handleDeleteZone(zone)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                    title="Eliminar zona"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectZone(zone)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="Ver límites en el mapa"
                                >
                                  Ver en mapa
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

          {/* Right panel: Create new Zone form OR Employee Read-only info */}
          <div className="lg:col-span-1">
            {!canManageActiveFarm ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4 sticky top-6">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  <span>Modo Lectura (Empleado)</span>
                </div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  Potreros y Subdivisiones
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Tenés permisos de consulta para este establecimiento. Podés navegar por las zonas en el mapa y consultar sus cercos eléctricos. Para dar de alta o modificar potreros, comunicate con el administrador del campo.
                </p>
                {editingZone && (
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 block text-sm">
                      {editingZone.name}
                    </span>
                    <span className="text-zinc-500 block">
                      Pastura: {editingZone.pastureType || 'No especificada'}
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-mono font-semibold block">
                      Superficie: {drawnAreaHa} Ha
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-6 sticky top-6">
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                    editingZone ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-500'
                  }`}>
                    {editingZone ? (
                      <>
                        <Edit3 className="w-4 h-4" />
                        <span>Modo Edición de Zona</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4" />
                        <span>Nivel 2: Nueva Zona</span>
                      </>
                    )}
                  </div>

                  {editingZone && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Cancelar edición y volver a crear nueva zona"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  )}
                </div>

                <h3 className="font-bold text-lg text-zinc-900 dark:text-white mt-1">
                  {editingZone ? `Editar: ${editingZone.name}` : 'Registrar Zona'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {editingZone ? (
                    'Modificá el nombre, pastura o arrastrá los vértices directamente sobre el mapa para ajustar su perímetro.'
                  ) : (
                    <>
                      Delimitá las esquinas sobre el mapa. La zona debe estar contenida dentro del establecimiento{' '}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {activeFarm?.name || ''}
                      </strong>.
                    </>
                  )}
                </p>
              </div>

              <form onSubmit={handleCreateOrUpdateZone} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Nombre de la Zona
                  </label>
                  <input
                    required
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ej: Zona Norte, Lote 1, Parcela Este"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Tipo de Pastura / Cobertura
                  </label>
                  <input
                    type="text"
                    value={newZonePasture}
                    onChange={(e) => setNewZonePasture(e.target.value)}
                    placeholder="Ej: Alfalfa, Trébol, Pasto natural"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
                  />
                </div>

                {/* Point Drawing Log & Validation status */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      Vértices Colocados ({newPoints.length})
                    </span>
                    {newPoints.length > 0 && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(
                                new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
                              );
                            }
                          }}
                          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold cursor-pointer text-xs flex items-center gap-1"
                          title="Deshacer última acción (Ctrl + Z)"
                        >
                          <span>Deshacer</span>
                          <kbd className="px-1 py-0.2 bg-zinc-200 dark:bg-zinc-800 text-[10px] rounded text-zinc-500">
                            Ctrl+Z
                          </kbd>
                        </button>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <button
                          type="button"
                          onClick={handleClearPoints}
                          className="text-red-500 hover:text-red-600 font-semibold cursor-pointer text-xs"
                        >
                          Reiniciar
                        </button>
                      </div>
                    )}
                  </div>

                  {newPoints.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 italic bg-white/60 dark:bg-zinc-900/60 p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                      Hacé clics sobre el mapa dentro del área amarilla para marcar el perímetro de la zona.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs px-1 text-zinc-500">
                        <span>Área estimada:</span>
                        <span className="font-bold text-zinc-900 dark:text-white font-mono">
                          {drawnAreaHa} Ha
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[10px] text-zinc-500">
                        {newPoints.map((pt, idx) => {
                          const isSelected = selectedVertexIndex === idx;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedVertexIndex(isSelected ? null : idx)}
                              className={`flex justify-between items-center border rounded-lg px-2 py-1.5 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                  : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-850/60 border-b-zinc-100 dark:border-b-zinc-850'
                              }`}
                            >
                              <span className="text-zinc-600 dark:text-zinc-400 font-sans flex items-center gap-1.5">
                                <span
                                  className={`w-4.5 h-4.5 rounded-full text-[9px] font-bold inline-flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className={isSelected ? 'font-bold text-amber-900 dark:text-amber-200' : ''}>
                                  Vértice #{idx + 1}
                                </span>
                                {isSelected && (
                                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                    Activo
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>
                                  {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                                </span>
                                <button
                                  type="button"
                                  title="Eliminar vértice"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNewPoints((prev) => prev.filter((_, i) => i !== idx));
                                    if (selectedVertexIndex === idx) setSelectedVertexIndex(null);
                                    else if (selectedVertexIndex !== null && selectedVertexIndex > idx)
                                      setSelectedVertexIndex(selectedVertexIndex - 1);
                                  }}
                                  className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    {editingZone && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="w-1/3 px-3 py-3 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer text-center"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitting || updating || newPoints.length < 3}
                      className={`font-semibold py-3 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm ${
                        editingZone
                          ? 'w-2/3 bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500/50'
                          : 'w-full bg-green-600 hover:bg-green-700 text-white focus:ring-green-500/50'
                      }`}
                    >
                      {submitting || updating ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : editingZone ? (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Guardar Cambios</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-4 h-4" />
                          <span>Registrar Zona en Campo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {newPoints.length < 3 && (
                    <p className="text-[11px] text-zinc-400 text-center mt-2">
                      Se requieren al menos 3 puntos en el mapa para formar un polígono.
                    </p>
                  )}
                </div>
              </form>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
