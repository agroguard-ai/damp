'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
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
  Search,
  X,
  RotateCcw,
  Save,
  AlertTriangle,
  Check,
  Map as MapIcon,
} from 'lucide-react';

const PolygonDrawerMap = dynamic(() => import('@/components/maps/PolygonDrawerMap'), { ssr: false });

const RENSPA_FORMAT = /^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$/;

function formatRenspa(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 13);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 6), digits.slice(6, 11), digits.slice(11, 13)];
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

  const {
    data: farms = [],
    loading: fetchingFarms,
    error: farmsError,
    refetch: refetchFarms,
  } = useApi(farmsApi.getAll);
  const { mutate: updateFarm, loading: updatingFarm } = useMutation(farmsApi.update);
  const { mutate: deleteFarm, loading: deletingFarm } = useMutation(farmsApi.delete);

  const [searchQuery, setSearchQuery] = useState('');

  // Rigid Perimeter Map Modal State
  const [perimeterModalFarm, setPerimeterModalFarm] = useState<Farm | null>(null);
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

  // Delete Confirmation Modal State
  const [deletingTargetFarm, setDeletingTargetFarm] = useState<Farm | null>(null);

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
    return true;
  }, [user, emulatedUser]);

  // Filtered farms list
  const filteredFarms = useMemo(() => {
    if (!searchQuery.trim()) return farms;
    const q = searchQuery.toLowerCase();
    return farms.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.province?.toLowerCase().includes(q) ||
        f.renspa?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q)
    );
  }, [farms, searchQuery]);

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
  }, [editPolygonPoints, perimeterModalFarm?.province]);

  // Real-time calculated area during perimeter editing
  const liveEditingHa = useMemo(() => {
    return calculatePolygonAreaHa(editPolygonPoints);
  }, [editPolygonPoints]);

  // Open rigid perimeter map modal
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
  };

  // Close rigid perimeter map modal explicitly
  const handleClosePerimeterModal = () => {
    setPerimeterModalFarm(null);
    setEditPolygonPoints([]);
    setSelectedVertexIndex(null);
  };

  // Save modified perimeter & auto-calculated hectares
  const handleSavePerimeter = async () => {
    if (!perimeterModalFarm) return;

    if (editPolygonPoints.length > 0 && editPolygonPoints.length < 3) {
      toast.warning('Se requieren al menos 3 vértices para formar un polígono delimitado.');
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

  const handleConfirmDeleteFarm = async () => {
    if (!deletingTargetFarm) return;
    try {
      await deleteFarm(deletingTargetFarm.id);
      toast.success('Campo y recursos derivados dados de baja correctamente');
      setDeletingTargetFarm(null);
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
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Tractor className="w-6 h-6 text-green-600 dark:text-green-500" />
            Campos y Establecimientos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Gestión centralizada de establecimientos agropecuarios, delimitación perimetral y administración de
            recursos.
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
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, RENSPA o ubicación..."
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 self-end sm:self-center font-medium">
            Total de campos: <strong className="text-zinc-900 dark:text-white">{filteredFarms.length}</strong>
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
              No se encontraron campos que coincidan con la búsqueda.
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Establecimiento</th>
                  <th className="px-5 py-3.5">RENSPA</th>
                  <th className="px-5 py-3.5">Ubicación</th>
                  <th className="px-5 py-3.5">Superficie</th>
                  <th className="px-5 py-3.5">Perímetro</th>
                  <th className="px-5 py-3.5">Recursos</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredFarms.map((farm) => {
                  const hasCoordinates = Boolean(
                    farm.polygonCoordinates &&
                    (typeof farm.polygonCoordinates === 'string'
                      ? farm.polygonCoordinates.length > 2
                      : (farm.polygonCoordinates as unknown[]).length > 0)
                  );

                  let pointsCount = 0;
                  if (hasCoordinates) {
                    try {
                      const pts =
                        typeof farm.polygonCoordinates === 'string'
                          ? JSON.parse(farm.polygonCoordinates)
                          : farm.polygonCoordinates;
                      if (Array.isArray(pts)) pointsCount = pts.length;
                    } catch {
                      pointsCount = 0;
                    }
                  }

                  const isAdmin = canManageFarm(farm);
                  const animalsCount = farm._count?.animals ?? 0;
                  const zonesCount = farm._count?.zones ?? 0;
                  const usersCount = farm._count?.farmUsers ?? 0;

                  return (
                    <tr key={farm.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-850/40 transition-colors">
                      {/* Establecimiento */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0 border border-green-200 dark:border-green-800/40">
                            <Tractor className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-white text-sm">{farm.name}</div>
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                              {farm.address ? farm.address : 'Sin dirección especificada'} &bull; Alta:{' '}
                              {new Date(farm.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* RENSPA */}
                      <td className="px-5 py-4 font-mono">
                        {farm.renspa ? (
                          <span className="inline-block px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">
                            {farm.renspa}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">Sin registrar</span>
                        )}
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

                      {/* Perímetro */}
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleOpenPerimeterModal(farm)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            hasCoordinates
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                          }`}
                          title="Abrir mapa de delimitación perimetral"
                        >
                          <MapIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{hasCoordinates ? `Delimitado (${pointsCount} pts)` : 'Sin trazar'}</span>
                        </button>
                      </td>

                      {/* Recursos */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 text-[11px] font-semibold"
                            title={`${animalsCount} animales registrados en este campo`}
                          >
                            🐾 {animalsCount}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[11px] font-semibold"
                            title={`${zonesCount} zonas o potreros delimitados`}
                          >
                            ▦ {zonesCount}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-[11px] font-semibold"
                            title={`${usersCount} usuarios con acceso asignado`}
                          >
                            👥 {usersCount}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botón Mapa Perímetro */}
                          <button
                            type="button"
                            onClick={() => handleOpenPerimeterModal(farm)}
                            className="p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                            title={isAdmin ? 'Editar perímetro en el mapa' : 'Ver perímetro en el mapa'}
                          >
                            <Ruler className="w-4 h-4" />
                          </button>

                          {/* Botón Zonas */}
                          <Link
                            href={`/zonas?farmId=${farm.id}`}
                            className="p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Gestionar potreros y zonas internas"
                          >
                            <Layers className="w-4 h-4" />
                          </Link>

                          {/* Botón Usuarios / Equipo */}
                          <Link
                            href={`/farms/${farm.id}/users`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                            title="Gestionar personal y accesos a este campo"
                          >
                            <Users className="w-4 h-4" />
                            <span className="hidden lg:inline">Personal</span>
                          </Link>

                          {/* Acciones exclusivas de Administrador / Productor */}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(farm)}
                                className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Editar datos del establecimiento"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingTargetFarm(farm)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar / Dar de baja este campo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
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
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Trazado de Perímetro del Establecimiento
                </h3>
              </div>

              {/* Status metrics in header */}
              <div className="flex items-center gap-4">
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

            {/* Modal Body: Map Drawer */}
            <div className="flex-1 relative min-h-[420px] h-[55vh] w-full bg-zinc-100 dark:bg-zinc-950">
              <PolygonDrawerMap
                points={editPolygonPoints}
                onChangePoints={setEditPolygonPoints}
                center={perimeterMapCenter}
                zoom={14}
                strokeColor="#f59e0b"
                fillColor="#fbbf24"
                selectedVertexIndex={selectedVertexIndex}
                onSelectVertex={setSelectedVertexIndex}
              />
            </div>

            {/* Modal Footer & Actions */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 w-full sm:w-auto">
                {editPolygonPoints.length > 0 && canManageFarm(perimeterModalFarm) && (
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
                  💡 Hacé clic en el mapa para marcar vértices y arrastralos para ajustar el límite.
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

                {canManageFarm(perimeterModalFarm) && (
                  <button
                    type="button"
                    onClick={handleSavePerimeter}
                    disabled={updatingFarm || (editPolygonPoints.length > 0 && editPolygonPoints.length < 3)}
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
      {/* MODAL 2: EDITAR METADATOS DEL ESTABLECIMIENTO                             */}
      {/* ========================================================================= */}
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
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Dar de baja establecimiento</h3>
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
                <p>Este establecimiento cuenta actualmente con:</p>
                <div className="grid grid-cols-2 gap-2 my-2">
                  <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-red-200 dark:border-red-900 text-center">
                    <span className="text-[11px] text-zinc-500 block">Animales activos</span>
                    <strong className="text-lg font-bold text-red-600 dark:text-red-400">
                      {deletingTargetFarm._count?.animals ?? 0}
                    </strong>
                  </div>
                  <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-red-200 dark:border-red-900 text-center">
                    <span className="text-[11px] text-zinc-500 block">Zonas y potreros</span>
                    <strong className="text-lg font-bold text-red-600 dark:text-red-400">
                      {deletingTargetFarm._count?.zones ?? 0}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-700 dark:text-zinc-300">Al confirmar la baja:</p>
                <ul className="list-disc list-inside text-[11px] space-y-1 text-zinc-700 dark:text-zinc-300">
                  <li>
                    Se eliminarán todas las <strong>zonas y cercos virtuales</strong> del campo.
                  </li>
                  <li>
                    Los collares asignados al campo serán <strong>liberados</strong> para su reutilización.
                  </li>
                  <li>
                    Los animales <strong>NO se perderán</strong>: se conservará su historial médico y métricas, pero
                    quedarán archivados y desvinculados de este campo.
                  </li>
                  <li>
                    El establecimiento quedará en estado <strong>archivado</strong>.
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
                    <span>Eliminando en cascada...</span>
                  </>
                ) : (
                  <span>Sí, dar de baja y desasignar recursos</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
