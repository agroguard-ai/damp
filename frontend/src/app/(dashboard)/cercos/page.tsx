'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { animalsApi } from '@/lib/api/animals';
import { geofencesApi } from '@/lib/api/geofences';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { Select } from '@/components/ui/Select';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { parsePolygon } from '@/lib/geo/spatial';
import { suggestNextName } from '@/lib/suggestName';
import { FEATURES } from '@/lib/features';
import { getProvinceCenter } from '@/data/argentinaLocations';
import { useAuth } from '@/context/AuthContext';
import { useFarmPermissions } from '@/hooks/useFarmPermissions';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { Zap, ArrowLeft, Radio, Tractor, Power, Plus, RotateCw, Edit3 } from 'lucide-react';
import type { Geofence } from '@/types';

const PolygonFormModal = dynamic(() => import('@/components/maps/PolygonFormModal'), { ssr: false });
const FarmMapView = dynamic(() => import('@/components/fences/FarmMapView'), { ssr: false });
const RotationView = dynamic(() => import('@/components/fences/RotationView'), { ssr: false });

type FenceModalState = { mode: 'create' } | { mode: 'edit'; fence: Geofence } | null;

export default function CercosPage() {
  return (
    <Suspense fallback={null}>
      <CercosContent />
    </Suspense>
  );
}

function CercosContent() {
  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();

  const farmIdFromUrl = searchParams?.get('farmId') ?? '';
  const [activeTab, setActiveTab] = useState<'fences' | 'rotation'>(
    FEATURES.grazingRotation && searchParams?.get('tab') === 'rotation' ? 'rotation' : 'fences'
  );

  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const activeFarmId = selectedFarmId || farmIdFromUrl || farms[0]?.id || '';
  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId), [farms, activeFarmId]);
  const farmPolygon = useMemo(() => parsePolygon(activeFarm?.polygonCoordinates), [activeFarm]);
  // ADMIN y OPERATOR crean/desactivan cercos y rotaciones; VIEWER solo consulta (CU011/CU012).
  const { canEdit } = useFarmPermissions(activeFarmId || null);

  const fetchAnimals = useCallback(
    () => (activeFarmId ? animalsApi.getAll({ farmId: activeFarmId, status: 'ACTIVE' }) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: animals = [] } = useApi(fetchAnimals, [activeFarmId]);

  const fetchGeofences = useCallback(
    () => (activeFarmId ? geofencesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const {
    data: geofences = [],
    loading: fetchingGeofences,
    refetch: refetchGeofences,
  } = useApi(fetchGeofences, [activeFarmId]);

  const { mutate: createGeofence, loading: submitting } = useMutation(geofencesApi.create);
  const { mutate: updateGeofence, loading: updating } = useMutation(geofencesApi.update);
  const { mutate: deactivateGeofence } = useMutation(geofencesApi.deactivate);
  const { mutate: activateGeofence } = useMutation(geofencesApi.activate);

  // Modal de alta / edición
  const [fenceModal, setFenceModal] = useState<FenceModalState>(null);
  const [pastureType, setPastureType] = useState('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [activateOnSave, setActivateOnSave] = useState(false);

  // Solo se pueden encerrar animales con collar activo (el backend lo exige)
  const animalsWithCollar = useMemo(() => animals.filter((a) => a.animalCollars?.length > 0), [animals]);

  const farmProvince = activeFarm?.province;
  const mapCenter = useMemo<[number, number]>(() => {
    if (farmPolygon.length > 0) return farmPolygon[0];
    if (farmProvince) {
      const provCenter = getProvinceCenter(farmProvince);
      if (provCenter) return provCenter;
    }
    return [-34.6037, -58.3816];
  }, [farmPolygon, farmProvince]);

  const toggleAnimal = (animalId: string) => {
    setSelectedAnimalIds((prev) =>
      prev.includes(animalId) ? prev.filter((id) => id !== animalId) : [...prev, animalId]
    );
  };

  const handleSelectAllAnimals = () => {
    if (selectedAnimalIds.length === animalsWithCollar.length) {
      setSelectedAnimalIds([]);
    } else {
      setSelectedAnimalIds(animalsWithCollar.map((a) => a.id));
    }
  };

  const openCreateModal = () => {
    setPastureType('');
    setSelectedAnimalIds([]);
    setActivateOnSave(false);
    setFenceModal({ mode: 'create' });
  };

  const openEditModal = (fence: Geofence) => {
    setPastureType(fence.pastureType || '');
    setActivateOnSave(!fence.active);
    setFenceModal({ mode: 'edit', fence });
  };

  const handleSaveFence = async ({ name, points }: { name: string; points: [number, number][] }) => {
    if (!activeFarmId || !fenceModal) return;

    if (fenceModal.mode === 'edit') {
      await updateGeofence({
        id: fenceModal.fence.id,
        name,
        pastureType: pastureType.trim() || null,
        polygonCoordinates: points,
      });

      if (!fenceModal.fence.active && activateOnSave) {
        await activateGeofence(fenceModal.fence.id);
        toast.success(`Cerco "${name}" actualizado y activado`);
      } else {
        toast.success(`Cerco "${name}" actualizado`);
      }
    } else {
      await createGeofence({
        farmId: activeFarmId,
        name,
        pastureType: pastureType.trim() || undefined,
        polygonCoordinates: points,
        animalIds: selectedAnimalIds,
      });
      toast.success(`Cerco "${name}" activado`);
      setSelectedAnimalIds([]);
    }
    setFenceModal(null);
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

  const handleActivate = async (id: string, fenceName: string) => {
    const ok = await confirm({
      title: `Activar "${fenceName}"`,
      description:
        'El cerco volverá a estar activo en el mapa y podrás asignarle hacienda con collar.',
      confirmLabel: 'Activar',
      danger: false,
    });
    if (!ok) return;

    try {
      await activateGeofence(id);
      toast.success(`Cerco "${fenceName}" activado.`);
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al activar el cerco');
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
      {/* Header: título a la izquierda, selector de campo compacto a la derecha */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Link
            href="/farms"
            className="inline-flex items-center gap-1.5 mb-1 text-xs font-semibold text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Campos</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-600 dark:text-cyan-500" />
            Cercos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Dibujá cercos virtuales dentro del campo para contener a la hacienda con collar.
          </p>
        </div>

        <div className="w-full sm:w-64 shrink-0">
          <Select
            size="sm"
            value={activeFarmId}
            onChange={(val) => {
              setSelectedFarmId(val);
              setFenceModal(null);
              setSelectedAnimalIds([]);
            }}
            options={farms.map((f) => ({
              value: f.id,
              label: f.name || 'Sin nombre',
              description: `${f.location || f.province || 'Argentina'}${f.totalAreaHa ? ` · ${f.totalAreaHa} Ha` : ''}`,
              icon: Tractor,
            }))}
            searchable={farms.length > 3}
            searchPlaceholder="Buscar campo..."
          />
        </div>
      </div>

      {/* Cercos vs Pastoreo rotativo (CU012) — oculto hasta habilitar FEATURES.grazingRotation */}
      {FEATURES.grazingRotation && (
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('fences')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'rotation'
                ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Pastoreo rotativo</span>
          </button>
        </div>
      )}

      {FEATURES.grazingRotation && activeTab === 'rotation' && activeFarm ? (
        <RotationView
          key={activeFarm.id}
          farm={activeFarm}
          geofences={geofences}
          animals={animals}
          onRefreshGeofences={refetchGeofences}
          readOnly={!canEdit}
        />
      ) : (
        <>
          {/* Mapa a todo el ancho (solo visualización; se dibuja dentro del modal) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs">
            {activeFarm && (
              <FarmMapView
                key={activeFarm.id}
                farm={activeFarm}
                geofences={geofences}
                center={mapCenter}
              />
            )}
          </div>

          {/* Listado de Cercos */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  Cercos en {activeFarm?.name || 'este campo'}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {geofences.length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {canEdit
                    ? 'Cada cerco tiene que quedar dentro del perímetro del campo.'
                    : 'Modo solo lectura: para crear o desactivar cercos, hablá con el administrador del campo.'}
                </p>
              </div>
              {canEdit && (
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
                  Este campo todavía no tiene cercos.
                </p>
                {canEdit && (
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
                      <th className="pb-3 px-4">Pastura</th>
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
                            <span className="flex items-center gap-2 font-semibold">
                              <Zap
                                className={`w-3.5 h-3.5 shrink-0 ${fence.active ? 'text-cyan-500' : 'text-zinc-400'}`}
                              />
                              <span
                                className={fence.active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}
                              >
                                {fence.name}
                              </span>
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                            {fence.pastureType || <span className="text-zinc-400">—</span>}
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
                            <Link
                              href={`/animals?farmId=${activeFarmId}&geofenceId=${fence.id}`}
                              className="hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
                              title="Ver la hacienda de este cerco"
                            >
                              <span className="font-semibold text-zinc-900 dark:text-white">{assignedCount}</span>{' '}
                              cabezas
                            </Link>
                          </td>

                          <td className="py-4 pl-4 text-right whitespace-nowrap space-x-1.5">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(fence)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                                  title="Editar nombre, pastura o perímetro del cerco"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Editar</span>
                                </button>
                                {fence.active ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeactivate(fence.id, fence.name)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 transition-colors cursor-pointer"
                                    title="Desactivar cerco eléctrico"
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>Desactivar</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleActivate(fence.id, fence.name)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 transition-colors cursor-pointer"
                                    title="Activar cerco eléctrico"
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>Activar</span>
                                  </button>
                                )}
                              </>
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

      {fenceModal && activeFarm && (
        <PolygonFormModal
          icon={fenceModal.mode === 'edit' ? Edit3 : Zap}
          accent="cyan"
          title={
            fenceModal.mode === 'edit'
              ? `Editar ${fenceModal.fence.name}`
              : `Nuevo cerco en ${activeFarm.name || 'el campo'}`
          }
          subtitle={
            fenceModal.mode === 'edit'
              ? 'Arrastrá los puntos para ajustar el perímetro o cambiá los datos.'
              : 'Marcá las esquinas del cerco dentro del perímetro del campo.'
          }
          nameLabel="Nombre del cerco"
          initialName={
            fenceModal.mode === 'edit'
              ? fenceModal.fence.name
              : suggestNextName(
                  'Cerco',
                  geofences.map((g) => g.name)
                )
          }
          initialPoints={fenceModal.mode === 'edit' ? parsePolygon(fenceModal.fence.polygonCoordinates) : []}
          mapContext={{
            farmId: activeFarmId,
            farmPolygon,
            // Al editar, el cerco propio se dibuja como trazado editable, no como cerco existente
            geofences: fenceModal.mode === 'edit' ? geofences.filter((g) => g.id !== fenceModal.fence.id) : geofences,
            boundaryLabel: `del campo "${activeFarm.name || ''}"`,
            center: mapCenter,
          }}
          submitLabel={
            fenceModal.mode === 'edit'
              ? !fenceModal.fence.active && activateOnSave
                ? 'Guardar y activar'
                : 'Guardar cambios'
              : 'Activar cerco'
          }
          submitting={submitting || updating}
          onClose={() => setFenceModal(null)}
          onSubmit={handleSaveFence}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fence-pasture"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
            >
              Pastura <span className="normal-case font-normal text-zinc-400">(opcional)</span>
            </label>
            <input
              id="fence-pasture"
              type="text"
              value={pastureType}
              onChange={(e) => setPastureType(e.target.value)}
              placeholder="Ej: Alfalfa, Trébol, Pasto natural"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 text-sm"
            />
          </div>

          {fenceModal.mode === 'edit' && !fenceModal.fence.active && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={activateOnSave}
                onChange={(e) => setActivateOnSave(e.target.checked)}
                className="accent-emerald-600 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
                  Activar este cerco al guardar
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  El cerco volverá a quedar activo en el mapa para contener hacienda.
                </span>
              </div>
            </label>
          )}

          {fenceModal.mode === 'create' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-500" />
                  Hacienda{' '}
                  <span className="normal-case font-normal text-zinc-400">
                    ({selectedAnimalIds.length} de {animalsWithCollar.length})
                  </span>
                </span>
                {animalsWithCollar.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllAnimals}
                    className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {selectedAnimalIds.length === animalsWithCollar.length ? 'Quitar todos' : 'Elegir todos'}
                  </button>
                )}
              </div>

              {animalsWithCollar.length === 0 ? (
                <p className="text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  No hay animales con collar en este campo. Podés crear el cerco igual y asignarlos después desde
                  Hacienda.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 p-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  {animalsWithCollar.map((a) => {
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
                        {a.animalGeofences?.[0]?.geofence && (
                          <span className="text-[10px] text-zinc-400 font-normal truncate max-w-24">
                            en {a.animalGeofences[0].geofence.name}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {animals.length > animalsWithCollar.length && (
                <p className="text-[11px] text-zinc-400">
                  {animals.length - animalsWithCollar.length} animal(es) sin collar no se pueden encerrar.
                </p>
              )}
            </div>
          )}
        </PolygonFormModal>
      )}
    </div>
  );
}
