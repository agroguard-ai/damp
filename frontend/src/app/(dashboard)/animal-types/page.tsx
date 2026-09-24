'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { animalTypesApi } from '@/lib/api/animal-types';
import type { AnimalType } from '@/types';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import {
  Tag,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  X,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export default function AnimalTypesPage() {
  const { user, emulatedUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!authLoading && (user?.globalRole !== 'SUPER_ADMIN' || emulatedUser)) {
      router.replace('/dashboard');
    }
  }, [user, emulatedUser, authLoading, router]);

  const isAuthorized = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const fetchTypes = useCallback(
    () => (isAuthorized ? animalTypesApi.getAll({ includeInactive: true }) : Promise.resolve([])),
    [isAuthorized]
  );

  const { data: types = [], loading, error: loadError, refetch } = useApi(fetchTypes);

  const { mutate: createType, loading: creating, error: createError, reset: resetCreate } = useMutation(animalTypesApi.create);
  const { mutate: updateType, loading: updating, error: updateError, reset: resetUpdate } = useMutation(animalTypesApi.update);
  const { mutate: deleteType, loading: deleting } = useMutation(animalTypesApi.delete);
  const { mutate: reactivateType, loading: reactivating } = useMutation(animalTypesApi.reactivate);

  // Form State
  const [editingType, setEditingType] = useState<AnimalType | null>(null);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Bovino');
  const [description, setDescription] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, ARCHIVED

  // Populate form when editing
  useEffect(() => {
    if (editingType) {
      setName(editingType.name);
      setSpecies(editingType.species);
      setDescription(editingType.description || '');
      resetCreate();
      resetUpdate();
    } else {
      setName('');
      setSpecies('Bovino');
      setDescription('');
    }
  }, [editingType, resetCreate, resetUpdate]);

  const handleCancelEdit = () => {
    setEditingType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingType) {
        await updateType(editingType.id, {
          name: name.trim(),
          species,
          description: description.trim() || undefined,
        });
        toast.success(`Tipo de animal "${name.trim()}" actualizado con éxito`);
        setEditingType(null);
      } else {
        await createType({
          name: name.trim(),
          species,
          description: description.trim() || undefined,
        });
        toast.success(`Tipo de animal "${name.trim()}" registrado con éxito`);
        setName('');
        setDescription('');
      }
      refetch();
    } catch {
      // Error is caught in mutation hook state
    }
  };

  const handleDelete = async (type: AnimalType) => {
    const assignedCount = type._count?.animals ?? 0;

    let desc = `¿Estás seguro de dar de baja el tipo "${type.name}"?`;
    if (assignedCount > 0) {
      desc = `El tipo "${type.name}" está asignado a ${assignedCount} cabeza(s) de ganado. Al darlo de baja, se aplicará una baja lógica: nuevos animales no podrán utilizarlo, pero los animales existentes conservarán su clasificación histórica intacta.`;
    }

    const ok = await confirm({
      title: assignedCount > 0 ? `Baja lógica de "${type.name}"` : `Eliminar tipo "${type.name}"`,
      description: desc,
      confirmLabel: assignedCount > 0 ? 'Confirmar Baja Lógica' : 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await deleteType(type.id);
      toast.success(res?.message || 'Tipo de animal dado de baja con éxito');
      if (editingType?.id === type.id) setEditingType(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la baja');
    }
  };

  const handleReactivate = async (type: AnimalType) => {
    try {
      const res = await reactivateType(type.id);
      toast.success(res?.message || `Tipo "${type.name}" reactivado correctamente`);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al reactivar');
    }
  };

  const filteredTypes = useMemo(() => {
    return types.filter((type) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        type.name.toLowerCase().includes(term) ||
        (type.description && type.description.toLowerCase().includes(term)) ||
        type.species.toLowerCase().includes(term);

      const matchesSpecies = !speciesFilter || type.species === speciesFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && type.isActive) ||
        (statusFilter === 'ARCHIVED' && !type.isActive);

      return matchesSearch && matchesSpecies && matchesStatus;
    });
  }, [types, searchTerm, speciesFilter, statusFilter]);

  const activeCount = useMemo(() => types.filter((t) => t.isActive).length, [types]);
  const archivedCount = useMemo(() => types.filter((t) => !t.isActive).length, [types]);

  const getSpeciesBadge = (s: string) => {
    switch (s) {
      case 'Bovino':
        return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
      case 'Equino':
        return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
      case 'Ovino':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
      case 'Porcino':
        return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
      case 'Caprino':
        return 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/40';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/40';
    }
  };

  const formError = editingType ? updateError : createError;

  if (authLoading) return null;

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Los tipos de animal son administrados centralmente por la plataforma.
        </div>
        <p className="text-xs text-zinc-500">Redirigiendo al panel...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Catálogo de Tipos y Razas de Animal
            </h1>
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40">
              Super-Admin
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Administra el catálogo maestro de razas y especies ganaderas disponibles en la plataforma.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-xs">
            Total: <strong>{types.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-300 shadow-xs">
            Activos: <strong>{activeCount}</strong>
          </span>
          {archivedCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/40 text-zinc-600 dark:text-zinc-400 shadow-xs">
              Archivados: <strong>{archivedCount}</strong>
            </span>
          )}
        </div>
      </div>

      {(loadError || formError) && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 px-4 py-3 rounded-xl text-xs text-center font-medium">
          {loadError ?? formError}
        </div>
      )}

      {/* Main Grid: List on Left (2 cols), Form on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filter Bar & Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filters Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por raza, especie o aptitud..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Species Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={speciesFilter}
                  onChange={(e) => setSpeciesFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="">Todas las especies</option>
                  <option value="Bovino">Bovinos</option>
                  <option value="Equino">Equinos</option>
                  <option value="Ovino">Ovinos</option>
                  <option value="Porcino">Porcinos</option>
                  <option value="Caprino">Caprinos</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Solo Activos</option>
                  <option value="ARCHIVED">Solo Archivados</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-6">
                <SkeletonRowList count={6} />
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                  <Tag className="w-6 h-6" />
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 font-semibold text-sm">
                  No se encontraron tipos de animal con los filtros actuales.
                </p>
                <p className="text-zinc-400 text-xs">
                  Modificá el término de búsqueda o utilizá el panel lateral para registrar una nueva raza.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Nombre / Raza</th>
                      <th className="py-3 px-3">Especie</th>
                      <th className="py-3 px-3">Aptitud / Descripción</th>
                      <th className="py-3 px-3">Hacienda</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 pr-4 pl-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredTypes.map((type) => {
                      const isEditing = editingType?.id === type.id;
                      const assignedCount = type._count?.animals ?? 0;

                      return (
                        <tr
                          key={type.id}
                          className={`transition-colors ${
                            isEditing
                              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-l-4 border-l-amber-500'
                              : !type.isActive
                              ? 'bg-zinc-50/40 dark:bg-zinc-950/40 opacity-75 hover:opacity-100'
                              : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'
                          }`}
                        >
                          {/* Name */}
                          <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{type.name}</span>
                              {isEditing && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                  Editando
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Species */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getSpeciesBadge(
                                type.species
                              )}`}
                            >
                              {type.species}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="py-3.5 px-3 text-zinc-500 dark:text-zinc-400 max-w-[220px] truncate" title={type.description || ''}>
                            {type.description || <span className="italic text-zinc-400">Sin descripción</span>}
                          </td>

                          {/* Animals Count */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {assignedCount > 0 ? (
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {assignedCount} cabezas
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">0 cabezas</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {type.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-150 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                                Archivado
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 pr-4 pl-2 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditingType(type)}
                              className={`p-1.5 rounded-lg text-xs font-semibold inline-flex items-center transition-colors cursor-pointer ${
                                isEditing
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-zinc-500 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 border border-zinc-200 dark:border-zinc-800'
                              }`}
                              title="Editar datos de esta raza"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {type.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(type)}
                                disabled={deleting}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                                title="Dar de baja este tipo de animal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(type)}
                                disabled={reactivating}
                                className="p-1.5 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 border border-green-200 dark:border-green-800/40 transition-colors cursor-pointer"
                                title="Reactivar tipo de animal para nuevos registros"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
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

        {/* Right Column: Form (Create or Edit Mode) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-5 sticky top-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  {editingType ? 'Modificar Raza / Tipo' : 'Agregar Tipo de Animal'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {editingType
                    ? `Editando categoría: ${editingType.name}`
                    : 'Registrá una nueva categoría ganadera para la plataforma.'}
                </p>
              </div>
              {editingType && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Nombre de la Raza / Categoría
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Aberdeen Angus, Holando Argentino"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Especie Ganadera
                </label>
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="Bovino">Bovino (Vacas, Toros, Terneros)</option>
                  <option value="Equino">Equino (Caballos, Yeguas)</option>
                  <option value="Ovino">Ovino (Ovejas, Carneros, Corderos)</option>
                  <option value="Porcino">Porcino (Cerdos, Lechones)</option>
                  <option value="Caprino">Caprino (Cabras, Chivos)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Descripción / Aptitud Productiva (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas sobre aptitud carnicera, lechera, rusticidad o zona recomendada..."
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm resize-none"
                />
              </div>

              {editingType && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Las modificaciones de nombre y especie se reflejarán de inmediato en todos los animales que ya utilicen este tipo.
                  </span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                {editingType && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-1/3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold py-2.5 px-3 rounded-xl transition-all text-xs"
                  >
                    Descartar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={creating || updating}
                  className={`font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm ${
                    editingType
                      ? 'w-2/3 bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500/50'
                      : 'w-full bg-green-600 hover:bg-green-700 text-white focus:ring-green-500/50'
                  }`}
                >
                  {creating || updating ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : editingType ? (
                    'Guardar Cambios'
                  ) : (
                    'Registrar Tipo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
