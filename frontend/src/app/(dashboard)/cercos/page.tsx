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
import { parsePolygon } from '@/lib/geo/spatial';
import { suggestNextName } from '@/lib/suggestName';
import { getProvinceCenter } from '@/data/argentinaLocations';
import { useAuth } from '@/context/AuthContext';
import { useFarmPermissions } from '@/hooks/useFarmPermissions';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { Zap, ArrowLeft, Radio, Tractor, Layers, Power, Plus, RotateCw } from 'lucide-react';

const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });
const PolygonFormModal = dynamic(() => import('@/components/maps/PolygonFormModal'), { ssr: false });
const ZoneRotationView = dynamic(() => import('@/components/zones/ZoneRotationView'), {
  ssr: false,
});

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
  const tabFromUrl = searchParams?.get('tab') ?? '';

  const [activeTab, setActiveTab] = useState<'fences' | 'rotation'>(tabFromUrl === 'rotation' ? 'rotation' : 'fences');

  // 1. Fetch all Farms
  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const activeFarmId = selectedFarmId || farmIdFromUrl || farms[0]?.id || '';
  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId), [farms, activeFarmId]);
  // ADMIN y OPERATOR crean/desactivan cercos y rotaciones; VIEWER solo consulta (CU011/CU012).
  const { canEdit } = useFarmPermissions(activeFarmId || null);

  // 2. Fetch Zones of active farm
  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: zones = [] } = useApi(fetchZones, [activeFarmId]);

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

  // Modal de alta
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);

  const zonePolygon = useMemo(() => parsePolygon(activeZone?.polygonCoordinates), [activeZone]);
  const farmPolygon = useMemo(() => parsePolygon(activeFarm?.polygonCoordinates), [activeFarm]);

  // Map center calculation
  const farmProvince = activeFarm?.province;
  const mapCenter = useMemo<[number, number]>(() => {
    if (zonePolygon.length > 0) return zonePolygon[0];
    if (farmPolygon.length > 0) return farmPolygon[0];
    if (farmProvince) {
      const provCenter = getProvinceCenter(farmProvince);
      if (provCenter) return provCenter;
    }
    return [-34.6037, -58.3816];
  }, [zonePolygon, farmPolygon, farmProvince]);

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

  const openCreateModal = () => {
    setSelectedAnimalIds([]);
    setCreateModalOpen(true);
  };

  const handleCreate = async ({ name, points }: { name: string; points: [number, number][] }) => {
    if (!activeZoneId) return;
    await createGeofence({
      zoneId: activeZoneId,
      name,
      polygonCoordinates: points,
      animalIds: selectedAnimalIds,
    });
    toast.success(`Cerco "${name}" activado`);
    setCreateModalOpen(false);
    setSelectedAnimalIds([]);
    refetchGeofences();
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
      {/* Header: título a la izquierda, selectores compactos Campo → Zona a la derecha */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
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
            Cercos Eléctricos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Cercos virtuales dentro de cada zona para contener a la hacienda con collar.
          </p>
        </div>

        <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
          <Select
            size="sm"
            className="lg:w-52"
            value={activeFarmId}
            onChange={(val) => {
              setSelectedFarmId(val);
              setSelectedZoneId('');
              setCreateModalOpen(false);
              setSelectedAnimalIds([]);
            }}
            options={farms.map((f) => ({
              value: f.id,
              label: f.name || 'Sin nombre',
              description: f.location || f.province || 'Argentina',
              icon: Tractor,
            }))}
            searchable={farms.length > 3}
            searchPlaceholder="Buscar campo..."
          />
          <Select
            size="sm"
            className="lg:w-52"
            value={activeZoneId}
            onChange={(val) => {
              setSelectedZoneId(val);
              setCreateModalOpen(false);
              setSelectedAnimalIds([]);
            }}
            options={zones.map((z) => ({
              value: z.id,
              label: z.name,
              description: z.pastureType ? `Pastura: ${z.pastureType}` : undefined,
              icon: Layers,
            }))}
            disabled={zones.length === 0}
            placeholder={zones.length === 0 ? 'Sin zonas' : 'Elegí una zona'}
            searchable={zones.length > 5}
            searchPlaceholder="Buscar zona..."
          />
        </div>
      </div>

      {/* View Tabs: Cercos Eléctricos vs Rotación de Pastoreo (CU012) */}
      {zones.length > 0 && activeZone && (
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('fences')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'fences'
                ? 'bg-white dark:bg-zinc-900 text-cyan-700 dark:text-cyan-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Cercos ({geofences.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rotation')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'rotation'
                ? 'bg-white dark:bg-zinc-900 text-orange-650 dark:text-orange-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Pastoreo rotativo</span>
          </button>
        </div>
      )}

      {/* Main Workspace */}
      {zones.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">Este campo no tiene zonas registradas</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Los cercos se dibujan dentro de una zona. Primero creá al menos una zona en este campo.
            </p>
          </div>
          {canEdit && (
            <Link
              href={`/zonas?farmId=${activeFarmId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Zona en este Campo</span>
            </Link>
          )}
        </div>
      ) : activeTab === 'rotation' && activeZone ? (
        <ZoneRotationView
          zone={activeZone}
          geofences={geofences}
          animals={animals}
          onRefreshGeofences={refetchGeofences}
          readOnly={!canEdit}
        />
      ) : (
        <>
          {/* Mapa a todo el ancho (solo visualización; se dibuja dentro del modal) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs">
            <ZoneMap
              zonePolygon={zonePolygon}
              farmPolygon={farmPolygon}
              geofences={geofences}
              newPoints={[]}
              onAddPoint={() => {}}
              interactive={false}
              center={mapCenter}
              boundaryType="zone"
              heightClassName="h-[55vh] min-h-96"
            />
          </div>

          {/* Listado de Cercos */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  Cercos en {activeZone?.name || 'esta zona'}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {geofences.length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {canEdit
                    ? 'Cada cerco tiene que quedar dentro de la zona.'
                    : 'Modo solo lectura: para crear o desactivar cercos, hablá con el administrador del campo.'}
                </p>
              </div>
              {canEdit && activeZone && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo cerco
                </button>
              )}
            </div>

            {fetchingGeofences ? (
              <div className="py-10 text-center text-xs text-zinc-400">Cargando cercos...</div>
            ) : geofences.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                  Esta zona todavía no tiene cercos.
                </p>
                {canEdit && activeZone && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Crear el primer cerco
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Cerco</th>
                      <th className="pb-3 px-4">Estado</th>
                      <th className="pb-3 px-4">Superficie</th>
                      <th className="pb-3 px-4">Animales</th>
                      <th className="pb-3 pl-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {geofences.map((fence) => {
                      const fenceArea = calculatePolygonAreaHa(parsePolygon(fence.polygonCoordinates));
                      const assignedCount = fence.animalGeofences?.length || 0;

                      return (
                        <tr
                          key={fence.id}
                          className="text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-4 pr-4">
                            <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                              <Zap className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                              {fence.name}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                fence.active
                                  ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${fence.active ? 'bg-cyan-500' : 'bg-zinc-400'}`}
                              ></span>
                              {fence.active ? 'Activo' : 'Desactivado'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs">
                            {fenceArea > 0 ? (
                              <span className="font-medium text-zinc-900 dark:text-white">{fenceArea} Ha</span>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">Sin polígono</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="font-semibold text-zinc-900 dark:text-white">{assignedCount}</span> cabezas
                          </td>

                          <td className="py-4 pl-4 text-right">
                            {canEdit && fence.active && (
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
        </>
      )}

      {createModalOpen && activeZone && (
        <PolygonFormModal
          icon={Zap}
          accent="cyan"
          title={`Nuevo cerco en ${activeZone.name}`}
          subtitle="Marcá las esquinas del cerco dentro de la zona."
          nameLabel="Nombre del cerco"
          initialName={suggestNextName(
            'Cerco',
            geofences.map((g) => g.name)
          )}
          mapContext={{
            zonePolygon,
            farmPolygon,
            geofences,
            boundaryType: 'zone',
            boundaryLabel: `de la zona "${activeZone.name}"`,
            center: mapCenter,
          }}
          submitLabel="Activar cerco"
          submitting={submitting}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreate}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-500" />
                Hacienda{' '}
                <span className="normal-case font-normal text-zinc-400">
                  ({selectedAnimalIds.length} de {animals.length})
                </span>
              </span>
              {animals.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllAnimals}
                  className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  {selectedAnimalIds.length === animals.length ? 'Quitar todos' : 'Elegir todos'}
                </button>
              )}
            </div>

            {animals.length === 0 ? (
              <p className="text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                No hay animales en esta zona. Podés crear el cerco igual y asignarlos después.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 p-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                {animals.map((a) => {
                  const isSelected = selectedAnimalIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 text-cyan-900 dark:text-cyan-200 font-semibold'
                          : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAnimal(a.id)}
                        className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="truncate flex-1">
                        {a.tag ? `Caravana ${a.tag}` : `Animal #${a.id.slice(0, 8)}`}
                        {a.breed && <span className="text-[10px] text-zinc-400 font-normal"> · {a.breed}</span>}
                      </span>
                      {!a.collarId && <span className="text-[10px] text-zinc-400 font-normal">Sin collar</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </PolygonFormModal>
      )}
    </div>
  );
}
