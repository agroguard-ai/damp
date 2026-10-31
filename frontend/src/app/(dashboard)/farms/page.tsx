'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useFarmPermissions } from '@/hooks/useFarmPermissions';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { getProvinces, getDepartments, getProvinceCenter } from '@/data/argentinaLocations';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import type { Farm, Geofence } from '@/types';
import { geofencesApi } from '@/lib/api/geofences';
import { parsePolygon, isPointInPolygon } from '@/lib/geo/spatial';
import type { ExistingPolygon } from '@/components/maps/PolygonDrawerMap';
import {
  Tractor,
  Plus,
  Edit3,
  Trash2,
  Zap,
  Users,
  MapPin,
  Ruler,
  Search,
  X,
  RotateCcw,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
  Archive,
  Flame,
  Route,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

const PolygonDrawerMap = dynamic(() => import('@/components/maps/PolygonDrawerMap'), { ssr: false });
const HeatmapModal = dynamic(() => import('@/components/farms/HeatmapModal'), { ssr: false });
const TrajectoriesModal = dynamic(() => import('@/components/farms/TrajectoriesModal'), { ssr: false });

export default function FarmsPage() {
  const { user, emulatedUser } = useAuth();
  const { isFarmAdmin } = useFarmPermissions();
  const { toast } = useToast();

  const {
    data: farms = [],
    loading: fetchingFarms,
    error: farmsError,
    refetch: refetchFarms,
  } = useApi(() => farmsApi.getAll(true));
  const { mutate: updateFarm, loading: updatingFarm } = useMutation(farmsApi.update);
  const { mutate: deleteFarm, loading: deletingFarm } = useMutation(farmsApi.delete);
  const { mutate: purgeFarm, loading: purgingFarm } = useMutation(farmsApi.deletePermanent);

  const [searchQuery, setSearchQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Mapas de análisis: calor de uso y recorridos de la hacienda
  const [heatmapFarm, setHeatmapFarm] = useState<Farm | null>(null);
  const [trajectoriesFarm, setTrajectoriesFarm] = useState<Farm | null>(null);

  // Rigid Perimeter Map Modal State
  const [perimeterModalFarm, setPerimeterModalFarm] = useState<Farm | null>(null);
  const [farmFences, setFarmFences] = useState<Geofence[]>([]);
  const [loadingFences, setLoadingFences] = useState<boolean>(false);
  const [showFences, setShowFences] = useState<boolean>(true);
  const [editPolygonPoints, setEditPolygonPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Metadata Edit Modal State
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    province: '',
    department: '',
    address: '',
  });

  // Delete Confirmation Modal State
  const [deletingTargetFarm, setDeletingTargetFarm] = useState<Farm | null>(null);
  const [purgingTargetFarm, setPurgingTargetFarm] = useState<Farm | null>(null);

  const currentUserId = emulatedUser?.id || user?.id;

  // Determine if the current user has admin/producer rights on a specific farm
  const canManageFarm = (farm: Farm) => {
    if (!currentUserId) return false;
    if (farm.userId === currentUserId) return true;
    const membership = farm.farmUsers?.find((fu) => fu.userId === currentUserId);
    return membership?.role?.name === 'ADMIN';
  };

  // Determine if the user has rights to create a farm
  const canCreateFarm = useMemo(() => {
    if (!user) return false;
    // SuperAdmin without emulation has no tenant farm creation capability
    if (user.globalRole === 'SUPER_ADMIN' && !emulatedUser) return false;
    // Operadores y lectores no crean campos (el backend también lo rechaza):
    // solo los administradores de campos.
    return isFarmAdmin;
  }, [user, emulatedUser, isFarmAdmin]);

  // Los campos inactivos se listan únicamente como registro histórico/estadístico.
  const activeFarms = useMemo(() => farms.filter((farm) => farm.isActive !== false), [farms]);
  const archivedFarms = useMemo(() => farms.filter((farm) => farm.isActive === false), [farms]);

  // Filtered farms list
  const filteredFarms = useMemo(() => {
    const visibleFarms = includeArchived ? farms : activeFarms;
    if (!searchQuery.trim()) return visibleFarms;
    const q = searchQuery.toLowerCase();
    return visibleFarms.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.province?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q)
    );
  }, [farms, activeFarms, includeArchived, searchQuery]);

  // Dynamic map center stably memoized for modal
  const perimeterMapCenter = useMemo<[number, number]>(() => {
    if (editPolygonPoints.length > 0) {
      return editPolygonPoints[0];
    }
    if (perimeterModalFarm?.province) {
      const provCenter = getProvinceCenter(perimeterModalFarm.province);
      if (provCenter) return provCenter;
    }
    return [-34.6037, -58.3816];
  }, [editPolygonPoints, perimeterModalFarm]);

  // Real-time calculated area during perimeter editing
  const liveEditingHa = useMemo(() => {
    return calculatePolygonAreaHa(editPolygonPoints);
  }, [editPolygonPoints]);

  // Cercos mapeados para visualización dentro del mapa de perímetro
  const existingFencePolygons = useMemo<ExistingPolygon[]>(() => {
    return farmFences
      .map((f) => {
        const pts = parsePolygon(f.polygonCoordinates);
        if (pts.length < 3) return null;
        const isConflicting =
          editPolygonPoints.length >= 3 && f.active && pts.some((pt) => !isPointInPolygon(pt, editPolygonPoints));
        return {
          id: f.id,
          name: f.name,
          points: pts,
          active: f.active,
          isConflicting,
        };
      })
      .filter(Boolean) as ExistingPolygon[];
  }, [farmFences, editPolygonPoints]);

  // Detección preventiva de cercos activos que quedarían fuera del nuevo perímetro
  const conflictingFences = useMemo(() => {
    if (editPolygonPoints.length < 3) return [];
    return farmFences.filter((f) => {
      if (!f.active) return false;
      const pts = parsePolygon(f.polygonCoordinates);
      if (pts.length < 3) return false;
      return pts.some((pt) => !isPointInPolygon(pt, editPolygonPoints));
    });
  }, [farmFences, editPolygonPoints]);

  // Open rigid perimeter map modal & fetch existing fences for preview
  const handleOpenPerimeterModal = (farm: Farm) => {
    let initialPoints: [number, number][] = [];
    if (farm.polygonCoordinates) {
      try {
        const raw = farm.polygonCoordinates;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) initialPoints = parsed;
      } catch {
        initialPoints = [];
      }
    }
    setEditPolygonPoints(initialPoints);
    setSelectedVertexIndex(null);
    setPerimeterModalFarm(farm);
    setShowFences(true);

    // Un campo archivado ya no tiene cercos virtuales: solo se muestra su perímetro histórico.
    if (farm.isActive === false) {
      setFarmFences([]);
      setLoadingFences(false);
      return;
    }

    // Cargar cercos virtuales del campo para previsualización preventiva
    setLoadingFences(true);
    geofencesApi
      .getByFarm(farm.id)
      .then((fences) => {
        setFarmFences(fences || []);
      })
      .catch((err) => {
        console.error('Error al cargar cercos para previsualización:', err);
        setFarmFences([]);
      })
      .finally(() => {
        setLoadingFences(false);
      });
  };

  // Close rigid perimeter map modal explicitly
  const handleClosePerimeterModal = () => {
    setPerimeterModalFarm(null);
    setEditPolygonPoints([]);
    setSelectedVertexIndex(null);
    setFarmFences([]);
  };

  // Save modified perimeter & auto-calculated hectares
  const handleSavePerimeter = async () => {
    if (!perimeterModalFarm) return;

    if (editPolygonPoints.length > 0 && editPolygonPoints.length < 3) {
      toast.warning('Se requieren al menos 3 vértices para formar un polígono delimitado.');
      return;
    }

    if (conflictingFences.length > 0) {
      const fenceNames = conflictingFences.map((f) => `"${f.name}"`).join(', ');
      toast.error(
        `No se puede reducir el perímetro del campo: los siguientes cercos quedarían fuera de sus nuevos límites: ${fenceNames}. Modificá o desactivá los cercos en conflicto antes de achicar el campo.`
      );
      return;
    }

    const newCalculatedHa = calculatePolygonAreaHa(editPolygonPoints);

    try {
      await updateFarm(perimeterModalFarm.id, {
        polygonCoordinates: editPolygonPoints.length >= 3 ? editPolygonPoints : undefined,
        totalAreaHa: newCalculatedHa > 0 ? newCalculatedHa : perimeterModalFarm.totalAreaHa || undefined,
      });

      toast.success(`Perímetro actualizado con éxito (${newCalculatedHa} Ha calculadas)`);
      handleClosePerimeterModal();
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
      province: farm.province || '',
      department: farm.location || '',
      address: farm.address || '',
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    handleEditFieldChange(e.target.name, e.target.value);

  function handleEditFieldChange(name: string, value: string) {
    if (name === 'province') {
      setEditFormData((prev) => ({ ...prev, province: value, department: '' }));
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;

    if (!editFormData.name.trim()) {
      toast.warning('Ingresá el nombre del campo.');
      return;
    }

    try {
      await updateFarm(editingFarm.id, {
        name: editFormData.name.trim(),
        province: editFormData.province || undefined,
        address: editFormData.address.trim() || undefined,
      });

      toast.success('Campo actualizado con éxito');
      setEditingFarm(null);
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el campo');
    }
  };

  const handleConfirmDeleteFarm = async () => {
    if (!deletingTargetFarm) return;
    try {
      await deleteFarm(deletingTargetFarm.id);
      toast.success('Campo archivado correctamente. Los animales conservan su estado y su collar.');
      setDeletingTargetFarm(null);
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al archivar el campo');
    }
  };

  const handleConfirmPurgeFarm = async () => {
    if (!purgingTargetFarm) return;
    try {
      await purgeFarm(purgingTargetFarm.id);
      toast.success('Campo eliminado definitivamente junto con todos sus registros');
      setPurgingTargetFarm(null);
      refetchFarms();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar definitivamente el campo');
    }
  };

  const provincesList = useMemo(() => getProvinces(), []);
  const availableDepartments = useMemo(
    () => (editFormData.province ? getDepartments(editFormData.province) : []),
    [editFormData.province]
  );

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Campos" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Tractor className="w-6 h-6 text-green-600 dark:text-green-500" />
            Campos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Gestión centralizada de campos, delimitación perimetral y administración de recursos.
          </p>
        </div>

        {canCreateFarm && (
          <Button href="/farms/new" variant="success" size="md" icon={Plus} label="Registrar Nuevo Campo" />
        )}
      </div>

      {farmsError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm text-center">
          {farmsError}
        </div>
      )}

      {/* Main ABM Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Search & Toolbar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o ubicación..."
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <label
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer select-none transition-colors ${
                includeArchived
                  ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-zinc-300 text-green-600 focus:ring-green-500 cursor-pointer"
              />
              <Archive className="w-3.5 h-3.5" />
              <span>Incluir archivados</span>
              {archivedFarms.length > 0 && (
                <span className="rounded-full bg-zinc-300/70 dark:bg-zinc-600 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-200">
                  {archivedFarms.length}
                </span>
              )}
            </label>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 self-end sm:self-center font-medium">
            Campos activos: <strong className="text-zinc-900 dark:text-white">{activeFarms.length}</strong>
            {archivedFarms.length > 0 && (
              <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                · Archivados: <strong className="text-zinc-600 dark:text-zinc-300">{archivedFarms.length}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Table Content */}
        {fetchingFarms ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredFarms.length === 0 ? (
          farms.length === 0 ? (
            <div className="p-8">
              <EmptyFarmState />
            </div>
          ) : (
            <div className="py-16 text-center text-zinc-500 dark:text-zinc-400 text-sm">
              {!includeArchived && archivedFarms.length > 0
                ? 'No hay campos activos. Activá "Incluir archivados" para ver los campos dados de baja.'
                : 'No se encontraron campos que coincidan con la búsqueda.'}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Campo</th>
                  <th className="px-5 py-3.5">Ubicación</th>
                  <th className="px-5 py-3.5">Superficie</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredFarms.map((farm) => {
                  const isAdmin = canManageFarm(farm);
                  const isArchived = farm.isActive === false;

                  return (
                    <tr
                      key={farm.id}
                      className={`transition-colors ${
                        isArchived
                          ? 'bg-zinc-50/70 dark:bg-zinc-950/40 opacity-75'
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      {/* Campo */}
                      <td className="px-5 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">{farm.name}</span>
                            {isArchived && (
                              <span className="inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-200/70 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                Archivado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {farm.address ? farm.address : 'Sin dirección especificada'} &bull; Alta:{' '}
                            {new Date(farm.createdAt).toLocaleDateString()}
                            {isArchived && farm.archivedAt && (
                              <> &bull; Baja: {new Date(farm.archivedAt).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ubicación */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>
                            {farm.location ? `${farm.location}, ` : ''}
                            {farm.province || 'Argentina'}
                          </span>
                        </div>
                      </td>

                      {/* Superficie */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                          <Ruler className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{farm.totalAreaHa ? `${farm.totalAreaHa} Ha` : 'Sin definir'}</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        {isArchived ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenPerimeterModal(farm)}
                              className="p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 dark:hover:text-green-400 rounded-lg transition-colors cursor-pointer"
                              title="Ver perímetro archivado (solo lectura)"
                            >
                              <Ruler className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setHeatmapFarm(farm)}
                              className="p-1.5 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Ver mapa de calor histórico"
                            >
                              <Flame className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setTrajectoriesFarm(farm)}
                              className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Ver recorridos históricos"
                            >
                              <Route className="w-4 h-4" />
                            </button>

                            <span className="px-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                              Solo lectura
                            </span>

                            <button
                              type="button"
                              onClick={() => setPurgingTargetFarm(farm)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar definitivamente este campo y todos sus registros"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {/* Botón Mapa Perímetro */}
                            <button
                              type="button"
                              onClick={() => handleOpenPerimeterModal(farm)}
                              className="p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 dark:hover:text-green-400 rounded-lg transition-colors cursor-pointer"
                              title={isAdmin ? 'Editar perímetro en el mapa' : 'Ver perímetro en el mapa'}
                            >
                              <Ruler className="w-4 h-4" />
                            </button>

                            {/* Botón Cercos */}
                            <Link
                              href={`/cercos?farmId=${farm.id}`}
                              className="p-1.5 text-zinc-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Gestionar los cercos del campo"
                            >
                              <Zap className="w-4 h-4" />
                            </Link>

                            {/* Botón Mapa de calor */}
                            <button
                              type="button"
                              onClick={() => setHeatmapFarm(farm)}
                              className="p-1.5 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Ver mapa de calor: dónde pasó más tiempo la hacienda"
                            >
                              <Flame className="w-4 h-4" />
                            </button>

                            {/* Botón Recorridos */}
                            <button
                              type="button"
                              onClick={() => setTrajectoriesFarm(farm)}
                              className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Ver recorridos de los animales"
                            >
                              <Route className="w-4 h-4" />
                            </button>

                            {/* Botón Usuarios / Equipo: solo el administrador del campo gestiona el personal */}
                            {isAdmin && (
                              <Link
                                href="/personal"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                                title="Gestionar personal y accesos a este campo"
                              >
                                <Users className="w-4 h-4" />
                                <span className="hidden lg:inline">Personal</span>
                              </Link>
                            )}

                            {/* Acciones exclusivas de Administrador / Productor */}
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(farm)}
                                  className="p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 dark:hover:text-green-400 rounded-lg transition-colors cursor-pointer"
                                  title="Editar datos del campo"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeletingTargetFarm(farm)}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                  title="Archivar / Dar de baja este campo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
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

      {/* ========================================================================= */}
      {/* MODAL 1: PERÍMETRO EN MAPA (MODAL RÍGIDO: NO CIERRA POR CLICK EXTERNO)  */}
      {/* ========================================================================= */}
      {perimeterModalFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Container — clicking inside does not bubble */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5" />
                    Delimitación Perimetral
                  </span>
                  <span className="text-xs text-zinc-400">&bull;</span>
                  <span className="font-semibold text-xs text-zinc-600 dark:text-zinc-300">
                    {perimeterModalFarm.name}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Trazado de Perímetro del Campo</h3>
              </div>

              {/* Status metrics in header */}
              <div className="flex items-center gap-3">
                {farmFences.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFences((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      showFences
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                    title={showFences ? 'Ocultar cercos virtuales' : 'Mostrar cercos virtuales'}
                  >
                    {showFences ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>Cercos ({farmFences.length})</span>
                  </button>
                )}

                <div className="hidden sm:flex items-center gap-3 text-xs bg-white dark:bg-zinc-950 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                  <div>
                    <span className="text-zinc-400">Vértices:</span>{' '}
                    <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{editPolygonPoints.length}</strong>
                  </div>
                  <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800" />
                  <div>
                    <span className="text-zinc-400">Superficie:</span>{' '}
                    <strong className="text-green-600 dark:text-green-400 font-mono font-bold">
                      {liveEditingHa} Ha
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClosePerimeterModal}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conflict warning banner if fences are outside perimeter */}
            {conflictingFences.length > 0 && (
              <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Atención:</strong> {conflictingFences.length === 1 ? 'El cerco' : 'Los cercos'}{' '}
                    <strong>{conflictingFences.map((f) => `"${f.name}"`).join(', ')}</strong>{' '}
                    {conflictingFences.length === 1 ? 'quedaría fuera' : 'quedarían fuera'} de los nuevos límites del
                    campo. Ajustá el perímetro para contenerlos antes de guardar.
                  </span>
                </div>
                {!showFences && (
                  <button
                    type="button"
                    onClick={() => setShowFences(true)}
                    className="underline font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 shrink-0 cursor-pointer"
                  >
                    Mostrar cercos
                  </button>
                )}
              </div>
            )}

            {/* Modal Body: Map Drawer */}
            <div className="flex-1 relative min-h-[420px] h-[55vh] w-full bg-zinc-100 dark:bg-zinc-950">
              <PolygonDrawerMap
                points={editPolygonPoints}
                onChangePoints={setEditPolygonPoints}
                center={perimeterMapCenter}
                zoom={14}
                strokeColor={conflictingFences.length > 0 ? '#ea580c' : '#f59e0b'}
                fillColor={conflictingFences.length > 0 ? '#f97316' : '#fbbf24'}
                selectedVertexIndex={selectedVertexIndex}
                onSelectVertex={setSelectedVertexIndex}
                farmId={perimeterModalFarm?.id}
                existingPolygons={existingFencePolygons}
                showExistingPolygons={showFences}
                onToggleExistingPolygons={() => setShowFences((prev) => !prev)}
                readOnly={perimeterModalFarm?.isActive === false}
              />
            </div>

            {/* Modal Footer & Actions */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 w-full sm:w-auto">
                {editPolygonPoints.length > 0 &&
                  canManageFarm(perimeterModalFarm) &&
                  perimeterModalFarm.isActive !== false && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditPolygonPoints([]);
                        setSelectedVertexIndex(null);
                      }}
                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reiniciar trazo</span>
                    </button>
                  )}
                <span className="hidden md:inline text-[11px] text-zinc-400">
                  {perimeterModalFarm.isActive === false
                    ? 'Vista de solo lectura del perímetro archivado.'
                    : '💡 Hacé clic en el mapa para marcar vértices y arrastralos para ajustar el límite.'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleClosePerimeterModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs"
                >
                  Cancelar
                </button>

                {canManageFarm(perimeterModalFarm) && perimeterModalFarm.isActive !== false && (
                  <button
                    type="button"
                    onClick={handleSavePerimeter}
                    disabled={
                      updatingFarm ||
                      (editPolygonPoints.length > 0 && editPolygonPoints.length < 3) ||
                      conflictingFences.length > 0
                    }
                    title={
                      conflictingFences.length > 0
                        ? 'No se puede guardar: hay cercos virtuales fuera de los nuevos límites'
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{updatingFarm ? 'Guardando...' : 'Guardar Perímetro'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR METADATOS DEL CAMPO                                       */}
      {/* ========================================================================= */}
      {editingFarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-green-600" />
                Editar Campo
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Provincia
                  </label>
                  <Select
                    name="province"
                    value={editFormData.province}
                    onChange={(v) => handleEditFieldChange('province', v)}
                    placeholder="Seleccionar Provincia"
                    size="sm"
                    searchable
                    searchPlaceholder="Buscar..."
                    options={provincesList.map((x) => ({ value: x, label: x }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Departamento
                  </label>
                  <Select
                    name="department"
                    value={editFormData.department}
                    onChange={(v) => handleEditFieldChange('department', v)}
                    disabled={!editFormData.province}
                    placeholder="Seleccionar Depto"
                    size="sm"
                    searchable
                    searchPlaceholder="Buscar..."
                    options={availableDepartments.map((x) => ({ value: x, label: x }))}
                  />
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

              {/* Superficie informativa */}
              <div className="bg-zinc-50 dark:bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Superficie Actual:</span>
                  <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                    {editingFarm.totalAreaHa ? `${editingFarm.totalAreaHa} Ha` : 'Sin calcular'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  La superficie se actualiza calculando el área proyectada en el mapa desde el botón
                  &quot;Perímetro&quot;.
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

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN DESTRUIDA CON AVISO ROJO PROMINENTE                 */}
      {/* ========================================================================= */}
      {deletingTargetFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-150"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Archivar campo</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Campo: <strong className="text-zinc-800 dark:text-zinc-200">{deletingTargetFarm.name}</strong>
                </p>
              </div>
            </div>

            {/* Big Red Prominent Warning Box */}
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800/80 text-red-900 dark:text-red-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Atención: Impacto sobre recursos asignados</span>
              </div>

              <div className="text-xs space-y-1.5 leading-relaxed">
                <p>Este campo cuenta actualmente con:</p>
                <div className="grid grid-cols-2 gap-2 my-2">
                  <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-red-200 dark:border-red-900 text-center">
                    <span className="text-[11px] text-zinc-500 block">Animales activos</span>
                    <strong className="text-lg font-bold text-red-600 dark:text-red-400">
                      {deletingTargetFarm._count?.animals ?? 0}
                    </strong>
                  </div>
                  <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-red-200 dark:border-red-900 text-center">
                    <span className="text-[11px] text-zinc-500 block">Cercos</span>
                    <strong className="text-lg font-bold text-red-600 dark:text-red-400">
                      {deletingTargetFarm._count?.geofences ?? 0}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-700 dark:text-zinc-300">Al confirmar la baja:</p>
                <ul className="list-disc list-inside text-[11px] space-y-1 text-zinc-700 dark:text-zinc-300">
                  <li>
                    Se eliminarán todos los <strong>cercos virtuales</strong> del campo.
                  </li>
                  <li>
                    Los animales <strong>conservan su estado actual</strong> y su historial médico. No se archivan.
                  </li>
                  <li>
                    Los animales <strong>conservan su collar vinculado</strong>: no se devuelven al stock ni se
                    desvinculan del animal.
                  </li>
                  <li>
                    Los animales dejan de formar parte de este campo y quedan disponibles para{' '}
                    <strong>reasignarlos a otro campo</strong>.
                  </li>
                  <li>
                    El campo queda <strong>archivado y en solo lectura</strong>. Podés eliminarlo definitivamente
                    después desde el listado.
                  </li>
                </ul>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingFarm}
                onClick={() => setDeletingTargetFarm(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingFarm}
                onClick={handleConfirmDeleteFarm}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {deletingFarm ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Archivando...</span>
                  </>
                ) : (
                  <span>Sí, archivar campo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ELIMINACIÓN DEFINITIVA DE UN CAMPO ARCHIVADO                     */}
      {/* ========================================================================= */}
      {purgingTargetFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-150"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Eliminar definitivamente el campo</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Campo: <strong className="text-zinc-800 dark:text-zinc-200">{purgingTargetFarm.name}</strong>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800/80 text-red-900 dark:text-red-200 space-y-2 text-xs leading-relaxed">
              <p className="font-bold uppercase tracking-wider text-red-700 dark:text-red-400 text-[11px]">
                Esta acción es irreversible
              </p>
              <p>
                Se eliminarán físicamente el campo y todos sus registros asociados: animales, historial médico, alertas,
                cercos, planes de rotación, gateways y membresías de personal.
              </p>
              <p>Los collares quedarán liberados del campo para su reutilización.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={purgingFarm}
                onClick={() => setPurgingTargetFarm(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={purgingFarm}
                onClick={handleConfirmPurgeFarm}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {purgingFarm ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, eliminar definitivamente</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {heatmapFarm && <HeatmapModal farm={heatmapFarm} onClose={() => setHeatmapFarm(null)} />}
      {trajectoriesFarm && <TrajectoriesModal farm={trajectoriesFarm} onClose={() => setTrajectoriesFarm(null)} />}
    </div>
  );
}
