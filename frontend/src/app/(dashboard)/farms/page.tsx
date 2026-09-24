'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { HierarchyGuideBar } from '@/components/farms/HierarchyGuideBar';
import { getProvinces, getDepartments, getProvinceCenter } from '@/data/argentinaLocations';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import type { Farm } from '@/types';
import {
  Tractor,
  Plus,
  Edit3,
  Trash2,
  Layers,
  Users,
  MapPin,
  Ruler,
  Check,
  Search,
  ArrowRight,
  ShieldCheck,
  X,
  RotateCcw,
  Save,
} from 'lucide-react';

const ZoneMap = dynamic(() => import('@/components/maps/ZoneMap'), { ssr: false });
const PolygonDrawerMap = dynamic(() => import('@/components/maps/PolygonDrawerMap'), { ssr: false });

const RENSPA_FORMAT = /^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$/;

function formatRenspa(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 13);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 6),
    digits.slice(6, 11),
    digits.slice(11, 13),
  ];
  let result = parts[0];
  if (parts[1]) result += `.${parts[1]}`;
  if (parts[2]) result += `.${parts[2]}`;
  if (parts[3]) result += `.${parts[3]}`;
  if (parts[4]) result += `/${parts[4]}`;
  return result;
}

export default function FarmsPage() {
  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  const { data: farms = [], loading: fetchingFarms, error: farmsError, refetch: refetchFarms } = useApi(farmsApi.getAll);
  const { mutate: updateFarm, loading: updatingFarm } = useMutation(farmsApi.update);
  const { mutate: deleteFarm, loading: deletingFarm } = useMutation(farmsApi.delete);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Perimeter Editing State (for editing region directly on map)
  const [isEditingPerimeter, setIsEditingPerimeter] = useState(false);
  const [editPolygonPoints, setEditPolygonPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Metadata Edit Modal State
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    renspa: '',
    province: '',
    department: '',
    address: '',
  });

  // Filtered farms list
  const filteredFarms = useMemo(() => {
    if (!searchQuery.trim()) return farms;
    const q = searchQuery.toLowerCase();
    return farms.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.province?.toLowerCase().includes(q) ||
        f.renspa?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q)
    );
  }, [farms, searchQuery]);

  // Selected Farm for preview (defaults to first farm in list)
  const activeFarm = useMemo(() => {
    if (selectedFarmId) {
      const found = farms.find((f) => f.id === selectedFarmId);
      if (found) return found;
    }
    return farms[0] || null;
  }, [farms, selectedFarmId]);

  // Update selected farm if none set and farms arrive
  useEffect(() => {
    if (!selectedFarmId && farms.length > 0) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  // Reset perimeter editing when changing selected farm
  useEffect(() => {
    setIsEditingPerimeter(false);
    setEditPolygonPoints([]);
    setSelectedVertexIndex(null);
  }, [selectedFarmId]);

  // Parse active farm polygon
  const activeFarmPolygon = useMemo<[number, number][]>(() => {
    if (!activeFarm || !(activeFarm as unknown as { polygonCoordinates?: unknown }).polygonCoordinates) return [];
    try {
      const raw = (activeFarm as unknown as { polygonCoordinates: unknown }).polygonCoordinates;
      const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(coords) ? coords : [];
    } catch {
      return [];
    }
  }, [activeFarm]);

  // Calculated polygon area using Equal-Area cartographic projection
  const polygonCalculatedHa = useMemo(() => {
    return calculatePolygonAreaHa(activeFarmPolygon);
  }, [activeFarmPolygon]);

  // Real-time calculated area during perimeter editing
  const liveEditingHa = useMemo(() => {
    return calculatePolygonAreaHa(editPolygonPoints);
  }, [editPolygonPoints]);

  // Dynamic map center stably memoized
  const mapCenter = useMemo<[number, number]>(() => {
    if (activeFarmPolygon.length > 0) {
      return activeFarmPolygon[0];
    }
    if (activeFarm?.province) {
      const provCenter = getProvinceCenter(activeFarm.province);
      if (provCenter) return provCenter;
    }
    return [-34.6037, -58.3816];
  }, [activeFarmPolygon, activeFarm?.province]);

  // Start editing perimeter
  const handleStartEditingPerimeter = () => {
    setEditPolygonPoints(activeFarmPolygon);
    setSelectedVertexIndex(null);
    setIsEditingPerimeter(true);
  };

  // Cancel perimeter editing
  const handleCancelEditingPerimeter = () => {
    setEditPolygonPoints([]);
    setSelectedVertexIndex(null);
    setIsEditingPerimeter(false);
  };

  // Save modified perimeter & auto-calculated hectares
  const handleSavePerimeter = async () => {
    if (!activeFarm) return;

    if (editPolygonPoints.length > 0 && editPolygonPoints.length < 3) {
      toast.warning('Se requieren al menos 3 vértices para formar un polígono delimitado.');
      return;
    }

    const newCalculatedHa = calculatePolygonAreaHa(editPolygonPoints);

    try {
      await updateFarm(activeFarm.id, {
        polygonCoordinates: editPolygonPoints.length >= 3 ? editPolygonPoints : undefined,
        totalAreaHa: newCalculatedHa > 0 ? newCalculatedHa : activeFarm.totalAreaHa || undefined,
      });

      toast.success(`Perímetro actualizado con éxito (${newCalculatedHa} Ha calculadas)`);
      setIsEditingPerimeter(false);
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el nuevo perímetro');
    }
  };

  // Open Metadata Edit Modal
  const handleOpenEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setEditFormData({
      name: farm.name || '',
      renspa: farm.renspa || '',
      province: farm.province || '',
      department: farm.location || '',
      address: farm.address || '',
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'renspa') {
      setEditFormData((prev) => ({ ...prev, renspa: formatRenspa(value) }));
    } else if (name === 'province') {
      setEditFormData((prev) => ({ ...prev, province: value, department: '' }));
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;

    if (!editFormData.name.trim()) {
      toast.warning('Ingresá el nombre del campo.');
      return;
    }
    if (editFormData.renspa && !RENSPA_FORMAT.test(editFormData.renspa)) {
      toast.warning('El RENSPA debe tener el formato XX.XXX.X.XXXXX/XX o dejarse vacío.');
      return;
    }

    try {
      await updateFarm(editingFarm.id, {
        name: editFormData.name.trim(),
        province: editFormData.province || undefined,
        address: editFormData.address.trim() || undefined,
        renspa: editFormData.renspa || undefined,
      });

      toast.success('Establecimiento actualizado con éxito');
      setEditingFarm(null);
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el campo');
    }
  };

  const handleDeleteFarm = async (farm: Farm) => {
    const ok = await confirm({
      title: `Eliminar campo "${farm.name}"`,
      description:
        'Esta acción eliminará el establecimiento, junto con todas sus zonas, cercos y asignaciones. No se puede deshacer.',
      confirmLabel: 'Eliminar Campo',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteFarm(farm.id);
      toast.success('Campo eliminado correctamente');
      if (selectedFarmId === farm.id) {
        setSelectedFarmId('');
      }
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el campo');
    }
  };

  const provincesList = useMemo(() => getProvinces(), []);
  const availableDepartments = useMemo(
    () => (editFormData.province ? getDepartments(editFormData.province) : []),
    [editFormData.province]
  );

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Campos y Establecimientos" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Tractor className="w-6 h-6 text-green-600 dark:text-green-500" />
            Campos y Establecimientos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Administrá tus establecimientos agropecuarios, editá su perímetro en el mapa y organizá sus potreros internos.
          </p>
        </div>

        <Button
          href="/farms/new"
          variant="success"
          size="md"
          icon={Plus}
          label="Registrar Nuevo Campo"
        />
      </div>

      {/* Visual Hierarchy Step Guide */}
      <HierarchyGuideBar
        currentLevel={1}
        farmName={activeFarm?.name || undefined}
        farmId={activeFarm?.id}
      />

      {farmsError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm text-center">
          {farmsError}
        </div>
      )}

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: LIST OF FARMS (Cards) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Tus Campos Registrados
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {farms.length}
                </span>
              </div>

              {farms.length > 2 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o RENSPA..."
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFarms.map((farm) => {
                const isSelected = activeFarm?.id === farm.id;
                const hasPolygon = Boolean(
                  farm.polygonCoordinates &&
                    (typeof farm.polygonCoordinates === 'string'
                      ? farm.polygonCoordinates.length > 2
                      : (farm.polygonCoordinates as unknown[]).length > 0)
                );

                return (
                  <div
                    key={farm.id}
                    onClick={() => setSelectedFarmId(farm.id)}
                    className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-900 border-2 border-green-600 dark:border-green-500 ring-2 ring-green-500/15 shadow-md'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-green-600 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <Tractor className="w-4 h-4" />
                          </div>
                          <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate">
                            {farm.name || 'Sin nombre'}
                          </h3>
                        </div>

                        {isSelected && (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40">
                            <Check className="w-3 h-3" />
                            Seleccionado
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {(farm.location || farm.province) && (
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                            <span className="truncate">
                              {farm.location ? `${farm.location}, ` : ''}
                              {farm.province || 'Argentina'}
                            </span>
                          </div>
                        )}

                        {farm.renspa && (
                          <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                            RENSPA: <strong className="text-zinc-700 dark:text-zinc-300">{farm.renspa}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold">
                        <Ruler className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{farm.totalAreaHa ? `${farm.totalAreaHa} Ha` : 'Sin definir'}</span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          hasPolygon
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/40'
                        }`}
                      >
                        {hasPolygon ? 'Perímetro definido' : 'Sin mapa'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: LOWER PREVIEW OF SELECTED FARM */}
          {activeFarm && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
              {/* Preview Header with Actions Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-500">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Nivel 1: Establecimiento Activo</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                    <span>{activeFarm.name}</span>
                    {activeFarm.renspa && (
                      <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {activeFarm.renspa}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {activeFarm.address || 'Ubicación rural'} &bull;{' '}
                    {activeFarm.location ? `${activeFarm.location}, ` : ''}
                    {activeFarm.province || 'Argentina'}
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {!isEditingPerimeter ? (
                    <>
                      <button
                        onClick={handleStartEditingPerimeter}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                      >
                        <Ruler className="w-3.5 h-3.5" />
                        <span>Editar Perímetro</span>
                      </button>

                      <Link
                        href={`/zonas?farmId=${activeFarm.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Ver Zonas</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                      </Link>

                      <button
                        onClick={() => handleDeleteFarm(activeFarm)}
                        disabled={deletingFarm}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Eliminar este campo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>Modo Edición de Perímetro</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Body: Map and Farm Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Map Preview or Editor */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {isEditingPerimeter
                        ? 'Trazando Perímetro del Establecimiento'
                        : 'Previsualización del Perímetro en Mapa'}
                    </span>
                    <span className="text-zinc-400">
                      {isEditingPerimeter
                        ? `${editPolygonPoints.length} vértices seleccionados`
                        : activeFarmPolygon.length > 0
                          ? `Límite cerrado (${activeFarmPolygon.length} vértices)`
                          : 'Sin polígono delimitado'}
                    </span>
                  </div>

                  {isEditingPerimeter ? (
                    <PolygonDrawerMap
                      points={editPolygonPoints}
                      onChangePoints={setEditPolygonPoints}
                      center={mapCenter}
                      zoom={14}
                      strokeColor="#f59e0b"
                      fillColor="#fbbf24"
                      selectedVertexIndex={selectedVertexIndex}
                      onSelectVertex={setSelectedVertexIndex}
                    />
                  ) : (
                    <ZoneMap
                      farmPolygon={activeFarmPolygon}
                      newPoints={[]}
                      onAddPoint={() => {}}
                      center={mapCenter}
                      interactive={false}
                    />
                  )}

                  {/* Acciones de Edición de Perímetro ubicadas ABAJO A LA DERECHA */}
                  {isEditingPerimeter && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <Ruler className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          Superficie calculada:{' '}
                          <strong className="font-mono text-sm text-zinc-900 dark:text-white">
                            {liveEditingHa} Ha
                          </strong>{' '}
                          ({editPolygonPoints.length} vértices)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 ml-auto">
                        <button
                          type="button"
                          onClick={handleCancelEditingPerimeter}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePerimeter}
                          disabled={updatingFarm || editPolygonPoints.length < 3}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{updatingFarm ? 'Guardando...' : 'Guardar Perímetro'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Technical Details & Flow Reminder */}
                <div className="lg:col-span-1 space-y-4">
                  {isEditingPerimeter ? (
                    <div className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 space-y-4 sticky top-6">
                      <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-2.5">
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          Vértices del Perímetro ({editPolygonPoints.length})
                        </span>
                        {editPolygonPoints.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditPolygonPoints([]);
                              setSelectedVertexIndex(null);
                            }}
                            className="text-red-500 hover:text-red-600 text-xs font-semibold cursor-pointer"
                          >
                            Reiniciar
                          </button>
                        )}
                      </div>

                      {editPolygonPoints.length === 0 ? (
                        <div className="text-xs text-zinc-400 italic bg-white/60 dark:bg-zinc-900/60 p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1">
                          <p className="font-medium text-zinc-600 dark:text-zinc-300">
                            Perímetro vacío
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            Hacé clics sobre el mapa para marcar los vértices del campo.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                            <span>Coordenadas exactas (Lat, Lng):</span>
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                              {liveEditingHa} Ha
                            </span>
                          </div>

                          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {editPolygonPoints.map((pt, idx) => {
                              const isSelected = selectedVertexIndex === idx;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedVertexIndex(isSelected ? null : idx)}
                                  className={`flex justify-between items-center border rounded-xl px-2.5 py-2 cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                      : 'border-zinc-200/70 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-850/60 bg-white/80 dark:bg-zinc-900/80'
                                  }`}
                                >
                                  <span className="font-sans flex items-center gap-2">
                                    <span
                                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold inline-flex items-center justify-center transition-colors ${
                                        isSelected
                                          ? 'bg-amber-500 text-white shadow-xs'
                                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                      }`}
                                    >
                                      {idx + 1}
                                    </span>
                                    <span
                                      className={
                                        isSelected
                                          ? 'font-bold text-amber-950 dark:text-amber-200'
                                          : 'font-medium text-zinc-800 dark:text-zinc-200'
                                      }
                                    >
                                      Vértice #{idx + 1}
                                    </span>
                                    {isSelected && (
                                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                        Activo
                                      </span>
                                    )}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                                      {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                                    </span>
                                    <button
                                      type="button"
                                      title="Eliminar este vértice"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = editPolygonPoints.filter((_, i) => i !== idx);
                                        setEditPolygonPoints(updated);
                                        if (selectedVertexIndex === idx) setSelectedVertexIndex(null);
                                        else if (selectedVertexIndex !== null && selectedVertexIndex > idx)
                                          setSelectedVertexIndex(selectedVertexIndex - 1);
                                      }}
                                      className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {selectedVertexIndex !== null && (
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                              <span>
                                📍 Vértice #{selectedVertexIndex + 1} activo para inserción contigua.
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedVertexIndex(null)}
                                className="underline hover:no-underline font-semibold cursor-pointer ml-1"
                              >
                                Deseleccionar
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[11px] text-zinc-400 space-y-1 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                        <p>💡 Arrastrá cualquier vértice en el mapa para corregir su posición.</p>
                        <p>💡 Clic en un vértice para insertar puntos a su lado.</p>
                        <p>💡 Presioná Ctrl+Z para deshacer.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-2.5">
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                            Detalles del Establecimiento
                          </h3>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(activeFarm)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                            title="Editar nombre, RENSPA y ubicación"
                          >
                            <Edit3 className="w-3 h-3 text-zinc-500" />
                            <span>Editar Datos</span>
                          </button>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Superficie Proyectada:</span>
                            <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                              {polygonCalculatedHa > 0
                                ? `${polygonCalculatedHa} Ha`
                                : activeFarm.totalAreaHa
                                  ? `${activeFarm.totalAreaHa} Ha`
                                  : 'Sin calcular'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Vértices del Perímetro:</span>
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {activeFarmPolygon.length > 0 ? `${activeFarmPolygon.length} puntos` : 'Sin delimitar'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Provincia:</span>
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {activeFarm.province || '-'}
                            </span>
                          </div>

                          {activeFarm.location && (
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-500">Departamento:</span>
                              <span className="font-medium text-zinc-900 dark:text-white">
                                {activeFarm.location}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Registro SENASA (RENSPA):</span>
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">
                              {activeFarm.renspa || 'Sin registrar'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Fecha de Alta:</span>
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {new Date(activeFarm.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Usuarios y Permisos reubicado de forma limpia dentro del panel de detalles */}
                        <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-zinc-500">
                            <Users className="w-4 h-4 text-zinc-400" />
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Equipo y Accesos</span>
                          </div>
                          <Link
                            href={`/farms/${activeFarm.id}/users`}
                            className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
                          >
                            <span>Gestionar Usuarios</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>

                      {/* Jerarquía Callout */}
                      <div className="bg-green-50/60 dark:bg-green-950/20 border border-green-200/80 dark:border-green-800/40 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                          <Layers className="w-4 h-4" />
                          <span>Subdivisiones del Establecimiento (Nivel 2)</span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          Este campo actúa como contenedor perimetral. Cada zona que crees quedará estrictamente contenida dentro de su perímetro.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT METADATA MODAL (Non-perimeter fields) */}
      {editingFarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-green-600" />
                Editar Establecimiento
              </h3>
              <button
                onClick={() => setEditingFarm(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Nombre del Campo *
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditChange}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  RENSPA (SENASA)
                </label>
                <input
                  type="text"
                  name="renspa"
                  value={editFormData.renspa}
                  onChange={handleEditChange}
                  placeholder="XX.XXX.X.XXXXX/XX"
                  maxLength={17}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Provincia
                  </label>
                  <select
                    name="province"
                    value={editFormData.province}
                    onChange={handleEditChange}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="">Seleccionar Provincia</option>
                    {provincesList.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Departamento
                  </label>
                  <select
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditChange}
                    disabled={!editFormData.province}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-white text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-40"
                  >
                    <option value="">Seleccionar Depto</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Dirección o Referencia
                </label>
                <input
                  type="text"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditChange}
                  placeholder="Ej: Ruta 205 Km 90"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 text-sm"
                />
              </div>

              {/* Read-only Hectares indicator (Calculated automatically from perimeter) */}
              <div className="bg-zinc-50 dark:bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Superficie en Hectáreas:</span>
                  <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                    {editingFarm.totalAreaHa ? `${editingFarm.totalAreaHa} Ha` : 'Sin calcular'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  La superficie no se escribe manualmente; se calcula automáticamente en base al perímetro proyectado en el mapa mediante el botón &quot;Editar Perímetro&quot;.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingFarm(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updatingFarm}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {updatingFarm ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
