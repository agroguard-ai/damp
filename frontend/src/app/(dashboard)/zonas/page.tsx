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
import { useFarmPermissions } from '@/hooks/useFarmPermissions';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { parsePolygon } from '@/lib/geo/spatial';
import { suggestNextName } from '@/lib/suggestName';
import {
  Tractor,
  Layers,
  Zap,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Edit3,
  X,
  Plus,
  Eye,
  Activity,
  Flame,
} from 'lucide-react';
import type { Zone } from '@/types';
import { animalsApi } from '@/lib/api/animals';

// Load Leaflet map with SSR disabled to prevent server compilation crash
const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });
const PolygonFormModal = dynamic(() => import('@/components/maps/PolygonFormModal'), { ssr: false });
const HerdMapView = dynamic(() => import('@/components/zones/HerdMapView'), { ssr: false });

type MapView = 'zones' | 'live' | 'heatmap';

const MAP_VIEWS: { value: MapView; label: string; icon: typeof Layers; active: string }[] = [
  { value: 'zones', label: 'Potreros', icon: Layers, active: 'text-green-700 dark:text-green-400' },
  { value: 'live', label: 'Hacienda en vivo', icon: Activity, active: 'text-green-700 dark:text-green-400' },
  { value: 'heatmap', label: 'Mapa de calor', icon: Flame, active: 'text-orange-600 dark:text-orange-400' },
];

type ZoneModalState = { mode: 'create' } | { mode: 'edit'; zone: Zone } | null;

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

  const [mapView, setMapView] = useState<MapView>(searchParams?.get('vista') === 'hacienda' ? 'live' : 'zones');
  const [zoneModal, setZoneModal] = useState<ZoneModalState>(null);
  const [zonePasture, setZonePasture] = useState('');
  const [animalsModalZone, setAnimalsModalZone] = useState<Zone | null>(null);

  const fetchZoneAnimals = useCallback(
    () =>
      animalsModalZone && activeFarmId
        ? animalsApi.getAll({ farmId: activeFarmId, zoneId: animalsModalZone.id, status: 'ACTIVE' })
        : Promise.resolve([]),
    [animalsModalZone, activeFarmId]
  );
  const { data: zoneAnimals = [], loading: fetchingZoneAnimals } = useApi(fetchZoneAnimals, [
    animalsModalZone,
    activeFarmId,
  ]);

  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId), [farms, activeFarmId]);
  const farmPolygon = useMemo(() => parsePolygon(activeFarm?.polygonCoordinates), [activeFarm]);

  // ADMIN y OPERATOR gestionan zonas; VIEWER solo consulta (CU004).
  const { canEdit: canManageActiveFarm } = useFarmPermissions(activeFarmId || null);

  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );

  const { data: zones = [], loading: fetchingZones, refetch: refetchZones } = useApi(fetchZones, [activeFarmId]);

  const { mutate: createZone, loading: submitting } = useMutation(zonesApi.create);
  const { mutate: updateZone, loading: updating } = useMutation(zonesApi.update);
  const { mutate: deleteZone } = useMutation(zonesApi.delete);

  const openCreateModal = () => {
    setZonePasture('');
    setZoneModal({ mode: 'create' });
  };

  const openEditModal = (zone: Zone) => {
    setZonePasture(zone.pastureType || '');
    setZoneModal({ mode: 'edit', zone });
  };

  const handleSaveZone = async ({ name, points }: { name: string; points: [number, number][] }) => {
    if (!activeFarmId || !zoneModal) return;
    const payload = {
      name,
      pastureType: zonePasture.trim() || undefined,
      farmId: activeFarmId,
      polygonCoordinates: points,
    };

    if (zoneModal.mode === 'edit') {
      await updateZone({ id: zoneModal.zone.id, ...payload });
      toast.success(`Zona "${name}" actualizada`);
    } else {
      await createZone(payload);
      toast.success(`Zona "${name}" creada`);
    }
    setZoneModal(null);
    refetchZones();
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
      refetchZones();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido al eliminar la zona');
    }
  };

  // Resolve dynamic map center stably
  const farmProvince = activeFarm?.province;
  const mapCenter = useMemo<[number, number]>(() => {
    if (farmPolygon.length > 0) {
      return farmPolygon[0];
    }
    if (farmProvince) {
      const provCenter = getProvinceCenter(farmProvince);
      if (provCenter) return provCenter;
    }
    const firstZone = zones.length > 0 ? parsePolygon(zones[0].polygonCoordinates) : [];
    if (firstZone.length > 0) return firstZone[0];
    return [-34.6037, -58.3816];
  }, [farmPolygon, farmProvince, zones]);

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Zonas" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header: título a la izquierda, selector de campo compacto a la derecha */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
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
            Zonas y Potreros
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Dividí tu campo en potreros. Cada zona puede tener sus propios cercos eléctricos.
          </p>
        </div>

        {farms.length > 0 && (
          <div className="w-full sm:w-64 shrink-0">
            <Select
              size="sm"
              value={activeFarmId}
              onChange={(val) => {
                setSelectedFarm(val);
                setZoneModal(null);
              }}
              options={farms.map((farm) => ({
                value: farm.id,
                label: farm.name || 'Establecimiento sin nombre',
                description: `${farm.location || farm.province || 'Argentina'}${
                  farm.totalAreaHa ? ` · ${farm.totalAreaHa} Ha` : ''
                }`,
                icon: Tractor,
              }))}
              searchable={farms.length > 3}
              searchPlaceholder="Buscar campo..."
            />
          </div>
        )}
      </div>

      {farmsError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{farmsError}</span>
        </div>
      )}

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <>
          {/* Mapa a todo el ancho (solo visualización; se dibuja dentro del modal) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs space-y-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit max-w-full overflow-x-auto">
              {MAP_VIEWS.map(({ value, label, icon: ViewIcon, active }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMapView(value)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    mapView === value
                      ? `bg-white dark:bg-zinc-900 shadow-xs ${active}`
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <ViewIcon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {mapView === 'zones' ? (
              <ZoneMap
                zones={zones}
                newPoints={[]}
                onAddPoint={() => {}}
                interactive={false}
                center={mapCenter}
                farmPolygon={farmPolygon}
                boundaryType="farm"
                onSelectZone={canManageActiveFarm ? (z) => openEditModal(z as unknown as Zone) : undefined}
                heightClassName="h-[55vh] min-h-96"
              />
            ) : (
              <HerdMapView farmId={activeFarmId} zones={zones} mode={mapView} />
            )}
          </div>

          {/* Listado de Zonas */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  Zonas registradas
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {zones.length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {canManageActiveFarm
                    ? `Potreros de ${activeFarm?.name || 'este campo'}. Tocá una zona en el mapa para editarla.`
                    : 'Modo solo lectura: para crear o modificar zonas, hablá con el administrador del campo.'}
                </p>
              </div>
              {canManageActiveFarm && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nueva zona
                </button>
              )}
            </div>

            {fetchingZones ? (
              <SkeletonRowList count={3} />
            ) : zones.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto">
                  <Layers className="w-6 h-6" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                  Este campo todavía no tiene zonas.
                </p>
                {canManageActiveFarm && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Crear la primera zona
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Zona</th>
                      <th className="pb-3 px-4">Pastura</th>
                      <th className="pb-3 px-4">Superficie</th>
                      <th className="pb-3 px-4">Cercos</th>
                      <th className="pb-3 px-4">Animales</th>
                      <th className="pb-3 pl-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {zones.map((zone) => {
                      const zoneArea = calculatePolygonAreaHa(parsePolygon(zone.polygonCoordinates));
                      const activeFencesCount =
                        zone.geofences?.filter((g) => g.active).length ?? zone._count?.geofences ?? 0;

                      return (
                        <tr
                          key={zone.id}
                          className="text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-4 pr-4">
                            <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-500"></span>
                              {zone.name}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                            {zone.pastureType || <span className="text-zinc-400">—</span>}
                          </td>

                          <td className="py-4 px-4 text-xs">
                            {zoneArea > 0 ? (
                              <span className="font-medium text-zinc-900 dark:text-white">{zoneArea} Ha</span>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">Sin polígono</span>
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

                          <td className="py-4 px-4">
                            <button
                              type="button"
                              onClick={() => setAnimalsModalZone(zone)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200/80 dark:border-green-800/40 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors cursor-pointer"
                              title="Ver hacienda asignada a esta zona"
                            >
                              <span>{zone._count?.animals ?? 0} cabezas</span>
                              <ArrowRight className="w-3 h-3 opacity-60" />
                            </button>
                          </td>

                          <td className="py-4 pl-4 text-right whitespace-nowrap space-x-1.5">
                            {canManageActiveFarm ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(zone)}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 border border-zinc-200 dark:border-zinc-800"
                                  title="Editar zona"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteZone(zone)}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                  title="Eliminar zona"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                                <Eye className="w-3.5 h-3.5" />
                                Solo lectura
                              </span>
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
        </>
      )}

      {zoneModal && (
        <PolygonFormModal
          icon={zoneModal.mode === 'edit' ? Edit3 : Layers}
          accent="green"
          title={zoneModal.mode === 'edit' ? `Editar ${zoneModal.zone.name}` : 'Nueva zona'}
          subtitle={
            zoneModal.mode === 'edit'
              ? 'Arrastrá los puntos para ajustar el perímetro o cambiá los datos.'
              : `Marcá las esquinas del potrero dentro de ${activeFarm?.name || 'el campo'}.`
          }
          nameLabel="Nombre de la zona"
          initialName={
            zoneModal.mode === 'edit'
              ? zoneModal.zone.name
              : suggestNextName(
                  'Zona',
                  zones.map((z) => z.name)
                )
          }
          initialPoints={zoneModal.mode === 'edit' ? parsePolygon(zoneModal.zone.polygonCoordinates) : []}
          mapContext={{
            zones,
            farmPolygon,
            boundaryType: 'farm',
            boundaryLabel: 'del establecimiento',
            center: mapCenter,
            selectedZoneId: zoneModal.mode === 'edit' ? zoneModal.zone.id : null,
          }}
          submitLabel={zoneModal.mode === 'edit' ? 'Guardar cambios' : 'Crear zona'}
          submitting={submitting || updating}
          onClose={() => setZoneModal(null)}
          onSubmit={handleSaveZone}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="zone-pasture"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
            >
              Pastura <span className="normal-case font-normal text-zinc-400">(opcional)</span>
            </label>
            <input
              id="zone-pasture"
              type="text"
              value={zonePasture}
              onChange={(e) => setZonePasture(e.target.value)}
              placeholder="Ej: Alfalfa, Trébol, Pasto natural"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
            />
          </div>
        </PolygonFormModal>
      )}

      {animalsModalZone && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Hacienda en {animalsModalZone.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {animalsModalZone.pastureType ? `Pastura: ${animalsModalZone.pastureType} • ` : ''}
                  Total: {zoneAnimals.length} cabezas activas
                </p>
              </div>
              <button
                onClick={() => setAnimalsModalZone(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {fetchingZoneAnimals ? (
                <SkeletonRowList count={3} />
              ) : zoneAnimals.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-6">
                  No hay animales asignados actualmente en esta zona.
                </p>
              ) : (
                <div className="space-y-2">
                  {zoneAnimals.map((animal) => {
                    const collar = animal.animalCollars[0]?.collar;
                    const fence = animal.animalGeofences[0]?.geofence;
                    return (
                      <div
                        key={animal.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-xs"
                      >
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {animal.tag || `ID: ${animal.id.slice(0, 6)}`}
                          </span>
                          <div className="text-zinc-400 text-[11px]">
                            {animal.breed} &bull; {animal.weightKg} kg
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {collar ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                              Collar #{collar.id}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400">Sin collar</span>
                          )}
                          {fence && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/40">
                              ⚡ {fence.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex justify-between items-center">
              <span className="text-xs text-zinc-400">¿Deseás mover o reasignar animales?</span>
              <Link
                href={`/animals?farmId=${activeFarmId}&zoneId=${animalsModalZone.id}`}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>Gestión de Hacienda</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
