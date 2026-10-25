'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFarmPermissions } from '@/hooks/useFarmPermissions';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { collarsApi } from '@/lib/api/collars';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { QrScannerModal } from '@/components/collars/QrScannerModal';
import type { Collar, CollarStatus } from '@/types';
import {
  Radio,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Building2,
  QrCode,
  Search,
  PlusCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RadioOff,
  CheckCheck,
  Plus,
  Edit3,
  User as UserIcon,
  Layers,
  SlidersHorizontal,
  Cpu,
  Layers as LayersIcon,
  Archive,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

const STATUS_LABELS: Record<CollarStatus, string> = {
  AVAILABLE: 'Disponible',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const STATUS_CLASSES: Record<CollarStatus, string> = {
  AVAILABLE:
    'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
  OUT_OF_SERVICE: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/30',
};

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface FarmOption {
  id: string;
  name: string;
  userId: string | null;
  user?: { id: string; name: string | null; email: string } | null;
  farmUsers?: Array<{
    userId: string;
    role?: { name: string } | null;
    user?: { id: string; name: string | null; email: string } | null;
  }>;
}

export default function CollaresPage() {
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;
  // VIEWER: no cambia estado ni sincroniza cercos (el backend exige ADMIN/OPERATOR del campo del collar).
  const { canEditIn } = useFarmPermissions();

  const { toast } = useToast();
  const confirm = useConfirm();

  // Filters for collars tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'AVAILABLE' | 'ARCHIVED'>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');

  // Metadata: Users & Farms
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [allFarms, setAllFarms] = useState<FarmOption[]>([]);

  // Modals state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Create Modal State (Alta en Stock Central)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCollarId, setCreateCollarId] = useState('');
  const [createIdentifier, setCreateIdentifier] = useState('');

  // Assign to Producer Modal State (Dedicado)
  const [assigningCollar, setAssigningCollar] = useState<Collar | null>(null);
  const [assignProducerId, setAssignProducerId] = useState('');
  const [assignFarmId, setAssignFarmId] = useState('');

  // Edit Collar ID / Hardware Modal State
  const [editingCollar, setEditingCollar] = useState<Collar | null>(null);
  const [editCollarId, setEditCollarId] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');

  // API calls
  const { data: collars = [], loading, refetch } = useApi(collarsApi.getAll);

  const { mutate: createCollar, loading: submitting } = useMutation(collarsApi.create);
  const { mutate: updateCollar, loading: updating } = useMutation(
    (params: { id: number; data: { id?: number; identifier?: string; farmId?: string | null } }) =>
      collarsApi.update(params.id, params.data)
  );
  const { mutate: updateStatus } = useMutation(collarsApi.updateStatus);
  const { mutate: archiveCollar } = useMutation(collarsApi.archive);
  const { mutate: restoreCollar } = useMutation(collarsApi.restore);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: collarDetail, refetch: refetchDetail } = useApi(
    () => (expandedId !== null ? collarsApi.getOne(expandedId) : Promise.resolve(undefined)),
    [expandedId]
  );

  // Load farms & users
  useEffect(() => {
    async function loadMetadata() {
      try {
        if (isSuperAdmin) {
          const [farmsRes, usersRes] = await Promise.all([
            fetch('/api/admin/farms?limit=1000'),
            fetch('/api/admin/users?limit=1000'),
          ]);

          if (farmsRes.ok) {
            const data = await farmsRes.json();
            const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            setAllFarms(
              list.map(
                (f: {
                  id: string;
                  name?: string | null;
                  userId?: string | null;
                  user?: { id: string; name: string | null; email: string } | null;
                  farmUsers?: Array<{
                    userId: string;
                    role?: { name: string } | null;
                    user?: { id: string; name: string | null; email: string } | null;
                  }>;
                }) => ({
                  id: f.id,
                  name: f.name || 'Sin nombre',
                  userId: f.userId || null,
                  user: f.user || null,
                  farmUsers: f.farmUsers || [],
                })
              )
            );
          }

          if (usersRes.ok) {
            const data = await usersRes.json();
            const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            setUsersList(
              list.map((u: { id: string; name?: string | null; email: string }) => ({
                id: u.id,
                name: u.name || null,
                email: u.email,
              }))
            );
          }
        } else {
          const data = await farmsApi.getAll();
          const list = Array.isArray(data) ? data : [];
          setAllFarms(
            list.map((f) => ({
              id: f.id,
              name: f.name || 'Sin nombre',
              userId: null,
              user: null,
            }))
          );
        }
      } catch {
        // ignore
      }
    }
    void loadMetadata();
  }, [isSuperAdmin]);

  // Derived unique farm admins / producers list
  const farmAdminsList = useMemo(() => {
    const map = new Map<string, UserOption>();

    // 1. All users from usersList (USER role)
    usersList.forEach((u) => {
      map.set(u.id, u);
    });

    // 2. Direct farm owners
    allFarms.forEach((f) => {
      if (f.userId) {
        if (!map.has(f.userId)) {
          map.set(f.userId, {
            id: f.userId,
            name: f.user?.name || null,
            email: f.user?.email || 'admin@campo.com',
          });
        }
      }

      // 3. Admin users in farmUsers
      if (f.farmUsers && Array.isArray(f.farmUsers)) {
        f.farmUsers.forEach((fu) => {
          if (fu.user && !map.has(fu.user.id)) {
            map.set(fu.user.id, {
              id: fu.user.id,
              name: fu.user.name || null,
              email: fu.user.email,
            });
          }
        });
      }
    });

    return Array.from(map.values());
  }, [usersList, allFarms]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    // Suggest next available numeric ID
    const maxExistingId = collars.reduce((max, c) => (c.id > max ? c.id : max), 0);
    const nextId = (maxExistingId + 1).toString();
    setCreateCollarId(nextId);
    setCreateIdentifier(`COLLAR-${nextId}`);
    setIsCreateModalOpen(true);
  };

  // Submit Create Collar (Siempre entra a Stock Libre de Reserva, sin asignar a productor)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = createCollarId ? parseInt(createCollarId, 10) : undefined;
    if (parsedId === undefined || isNaN(parsedId) || parsedId < 1) {
      toast.error('El ID del collar debe ser un número entero mayor a 0');
      return;
    }

    if (collars.some((c) => c.id === parsedId)) {
      toast.error(`Ya existe un collar con el ID #${parsedId} registrado en la plataforma.`);
      return;
    }

    try {
      await createCollar({
        id: parsedId,
        identifier: `COLLAR-${parsedId}`,
        farmId: undefined, // Siempre entra en stock libre de reserva
      });

      toast.success(`Collar #${parsedId} dado de alta con éxito en el stock central de reserva`);
      setIsCreateModalOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar collar');
    }
  };

  // Open Assign to Producer Modal (Literal y Dedicado)
  const handleOpenAssignModal = (c: Collar) => {
    setAssigningCollar(c);
    if (c.farmId) {
      const farmObj = allFarms.find((f) => f.id === c.farmId);
      const ownerId = farmObj?.userId || c.farm?.userId || farmObj?.user?.id || '';
      setAssignProducerId(ownerId);
      setAssignFarmId(c.farmId);
    } else {
      setAssignProducerId('');
      setAssignFarmId('');
    }
  };

  // Submit Assign to Producer
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningCollar) return;

    if (!assignFarmId) {
      toast.error('Por favor seleccioná el establecimiento/campo a asignar');
      return;
    }

    try {
      await updateCollar({
        id: assigningCollar.id,
        data: {
          farmId: assignFarmId,
        },
      });

      toast.success(`Collar #${assigningCollar.id} asignado con éxito al administrador`);
      setAssigningCollar(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar collar');
    }
  };

  // Unassign Collar to Free Central Stock
  const handleUnassignToStock = async (c: Collar) => {
    const ok = await confirm({
      title: `Desvincular collar #${c.id} a Stock Central`,
      description: `¿Estás seguro de desvincular el collar del campo actual? Pasará a estar disponible en el inventario general sin productor asignado.`,
      confirmLabel: 'Desvincular a Stock',
    });
    if (!ok) return;

    try {
      await updateCollar({
        id: c.id,
        data: {
          farmId: null,
        },
      });
      toast.success(`Collar #${c.id} desvinculado y devuelto a Stock Central`);
      setAssigningCollar(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al desvincular collar');
    }
  };

  // Open Edit ID / Hardware Modal (Solo para corrección de ID del collar)
  const handleOpenEditModal = (c: Collar) => {
    setEditingCollar(c);
    setEditCollarId(c.id.toString());
    setEditIdentifier(c.identifier);
  };

  // Submit Edit Collar ID / Identifier
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollar) return;

    const parsedId = parseInt(editCollarId, 10);
    if (isNaN(parsedId) || parsedId < 1) {
      toast.error('El ID numérico del hardware debe ser un número entero mayor a 0');
      return;
    }

    // Check conflict if ID changed
    if (parsedId !== editingCollar.id && collars.some((c) => c.id === parsedId)) {
      toast.error(`Ya existe un collar registrado con el ID #${parsedId}. Elegí otro número.`);
      return;
    }

    try {
      await updateCollar({
        id: editingCollar.id,
        data: {
          id: parsedId,
          identifier: editIdentifier.trim() || `COLLAR-${parsedId}`,
        },
      });

      toast.success(`ID del collar #${parsedId} actualizado correctamente`);
      setEditingCollar(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar collar');
    }
  };


  // Handle archive collar
  const handleArchive = async (collar: Collar) => {
    if (!isSuperAdmin) return;
    const ok = await confirm({
      title: `Archivar collar ${collar.identifier}`,
      description:
        'El collar pasará a estado fuera de servicio, liberará cualquier animal vinculado y el cupo en el establecimiento, conservando intacto su historial de telemetría y trazabilidad. ¿Deseas archivar este dispositivo?',
      confirmLabel: 'Archivar Collar',
      danger: true,
    });
    if (!ok) return;

    try {
      await archiveCollar(collar.id);
      toast.success(`Collar ${collar.identifier} archivado correctamente`);
      refetch();
      if (expandedId === collar.id) refetchDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al archivar el collar');
    }
  };

  // Handle restore collar
  const handleRestore = async (collar: Collar) => {
    if (!isSuperAdmin) return;
    const ok = await confirm({
      title: `Reactivar collar ${collar.identifier}`,
      description:
        'El collar volverá a estar disponible en el inventario como disponible para ser asignado a un campo o colocado en ganado.',
      confirmLabel: 'Reactivar Collar',
    });
    if (!ok) return;

    try {
      await restoreCollar(collar.id);
      toast.success(`Collar ${collar.identifier} reactivado en el inventario`);
      refetch();
      if (expandedId === collar.id) refetchDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al reactivar el collar');
    }
  };

  // Handle delete collar
  const handleDelete = async (collar: Collar) => {
    if (!isSuperAdmin) return;

    const hasHistory =
      (collar.animalCollars && collar.animalCollars.length > 0) ||
      !!collar.assignedAnimal ||
      !!collar.lastTelemetryDate;

    if (hasHistory) {
      const ok = await confirm({
        title: `El collar ${collar.identifier} tiene historial`,
        description:
          'Este dispositivo contiene historial de asignación a animales o telemetría registrada, por lo que no puede eliminarse físicamente de la base de datos. ¿Deseas darlo de baja y archivarlo en su lugar?',
        confirmLabel: 'Dar de baja y archivar',
        danger: true,
      });
      if (!ok) return;

      try {
        await archiveCollar(collar.id);
        toast.success(`Collar ${collar.identifier} dado de baja y archivado correctamente`);
        refetch();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error al archivar el collar');
      }
      return;
    }

    const ok = await confirm({
      title: `Eliminar collar ${collar.identifier}`,
      description: 'El collar no posee historial registrado y se eliminará definitivamente del catálogo. ¿Continuar?',
      confirmLabel: 'Eliminar Collar',
      danger: true,
    });
    if (!ok) return;

    try {
      await collarsApi.delete(collar.id);
      toast.success('Collar eliminado del inventario');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el collar');
    }
  };

  // Sync fence notification for collar
  const [syncingCollarId, setSyncingCollarId] = useState<number | null>(null);

  const handleSyncFence = async (collar: Collar) => {
    try {
      setSyncingCollarId(collar.id);
      await collarsApi.syncFence(collar.id);
      toast.success(
        `Actualización de cerco encolada para el collar #${collar.id}. Se transmitirá en su próximo reporte.`
      );
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al solicitar sincronización de cerco');
    } finally {
      setSyncingCollarId(null);
    }
  };

  // Filtered farms for Assign Modal (campos donde el usuario es dueño o administrador)
  const farmsForAssignModal = useMemo(() => {
    if (!assignProducerId) return [];
    return allFarms.filter((f) => {
      if (f.userId === assignProducerId) return true;
      if (f.farmUsers && f.farmUsers.some((fu) => fu.userId === assignProducerId)) return true;
      return false;
    });
  }, [allFarms, assignProducerId]);

  const farmsForFilterToolbar = useMemo(() => {
    if (selectedUserFilter === 'ALL' || selectedUserFilter === 'UNASSIGNED') {
      return allFarms;
    }
    return allFarms.filter((f) => {
      if (f.userId === selectedUserFilter) return true;
      if (f.farmUsers && f.farmUsers.some((fu) => fu.userId === selectedUserFilter)) return true;
      return false;
    });
  }, [allFarms, selectedUserFilter]);

  // Filtered collars for display
  const filteredCollars = useMemo(() => {
    return collars.filter((c) => {
      // 1. User Filter
      if (selectedUserFilter === 'UNASSIGNED') {
        if (c.farmId) return false;
      } else if (selectedUserFilter !== 'ALL') {
        const farmObj = allFarms.find((f) => f.id === c.farmId);
        const isOwner = (farmObj?.userId || c.farm?.userId || farmObj?.user?.id) === selectedUserFilter;
        const isFarmAdmin = farmObj?.farmUsers?.some((fu) => fu.userId === selectedUserFilter);
        if (!isOwner && !isFarmAdmin) return false;
      }

      // 2. Farm Filter
      if (selectedFarmFilter === 'UNASSIGNED') {
        if (c.farmId) return false;
      } else if (selectedFarmFilter !== 'ALL') {
        if (c.farmId !== selectedFarmFilter) return false;
      }

      // 3. Status Filter
      if (statusFilter === 'ARCHIVED') {
        if (!c.isArchived && c.status !== 'OUT_OF_SERVICE') return false;
      } else {
        if (c.isArchived && statusFilter !== 'ALL') return false;
        if (statusFilter === 'ASSIGNED' && !c.assignedAnimal) return false;
        if (statusFilter === 'AVAILABLE' && (c.assignedAnimal || c.status !== 'AVAILABLE')) return false;
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = c.id.toString().includes(q);
        const matchIdentifier = c.identifier.toLowerCase().includes(q);
        const matchFarm = (c.farm?.name || '').toLowerCase().includes(q);
        const farmObj = allFarms.find((f) => f.id === c.farmId);
        const matchOwnerName = (c.farm?.user?.name || farmObj?.user?.name || '').toLowerCase().includes(q);
        const matchOwnerEmail = (c.farm?.user?.email || farmObj?.user?.email || '').toLowerCase().includes(q);
        const matchTag = (c.assignedAnimal?.tag || '').toLowerCase().includes(q);

        return matchId || matchIdentifier || matchFarm || matchOwnerName || matchOwnerEmail || matchTag;
      }

      return true;
    });
  }, [collars, selectedUserFilter, selectedFarmFilter, statusFilter, searchQuery, allFarms]);

  // Counts
  const placedCount = collars.filter((c) => !c.isArchived && c.assignedAnimal).length;
  const availableCount = collars.filter(
    (c) => !c.isArchived && !c.assignedAnimal && c.status === 'AVAILABLE' && c.farmId
  ).length;
  const freeStockCount = collars.filter((c) => !c.isArchived && !c.farmId).length;
  const archivedCount = collars.filter((c) => c.isArchived || c.status === 'OUT_OF_SERVICE').length;

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-green-600 dark:text-green-500" />
            {isSuperAdmin ? 'Gestión e Inventario de Collares LoRa' : 'Collares LoRa de tu Establecimiento'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Administración centralizada de hardware, alta por QR o ID manual y asignación directa a productores.'
              : 'Dispositivos IoT colocados en tu ganado con telemetría GPS y sensores de salud en tiempo real.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Collar
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards - 3 Estados Únicos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Collares Totales */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Collares Totales</span>
            <Cpu className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-white">{collars.length}</div>
          <p className="text-xs text-zinc-400">Total de collares físicos registrados en el sistema</p>
        </div>

        {/* 2. Collares en Uso */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Collares en Uso</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {collars.filter((c) => !c.isArchived && Boolean(c.farmId)).length}
          </div>
          <p className="text-xs text-zinc-400">Asignados activamente a un establecimiento/productor</p>
        </div>

        {/* 3. Collares Disponibles */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wider">
            <span>Disponibles para Asignar</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {collars.filter((c) => !c.isArchived && !c.farmId).length}
          </div>
          <p className="text-xs text-zinc-400">En stock central de reserva, listos para transferir a un campo</p>
        </div>
      </div>

      {/* Collars Grid View */}
      <div className="space-y-5">
        {/* Filter Toolbar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros de Búsqueda y Administrador de Campo
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Text Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por ID, código, caravana..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* 2. Admin de Campo Filter (SuperAdmin only) */}
            {isSuperAdmin && (
              <div>
                <Select
                  value={selectedUserFilter}
                  onChange={(v) => {
                    setSelectedUserFilter(v);
                    setSelectedFarmFilter('ALL');
                  }}
                  size="sm"
                  searchable={farmAdminsList.length > 5}
                  searchPlaceholder="Buscar administrador..."
                  options={[
                    { value: 'ALL', label: `👤 Todos los Administradores de Campo (${farmAdminsList.length})` },
                    { value: 'UNASSIGNED', label: '📦 Stock Libre (Sin asignar)' },
                    ...farmAdminsList.map((u) => {
                      const userFarmsCount = allFarms.filter(
                        (f) => f.userId === u.id || f.farmUsers?.some((fu) => fu.userId === u.id)
                      ).length;
                      return {
                        value: u.id,
                        label: u.name || u.email,
                        description: `${userFarmsCount} ${userFarmsCount === 1 ? 'campo' : 'campos'}`,
                      };
                    }),
                  ]}
                />
              </div>
            )}

            {/* 3. Farm Filter */}
            <div>
              <Select
                disabled={selectedUserFilter === 'UNASSIGNED'}
                value={selectedFarmFilter}
                onChange={(v) => setSelectedFarmFilter(v)}
                size="sm"
                searchable={farmsForFilterToolbar.length > 5}
                searchPlaceholder="Buscar campo..."
                options={[
                  {
                    value: 'ALL',
                    label: `🏢 ${
                      selectedUserFilter !== 'ALL' && selectedUserFilter !== 'UNASSIGNED'
                        ? 'Todos los campos del productor'
                        : 'Todos los Campos'
                    } (${farmsForFilterToolbar.length})`,
                  },
                  ...(isSuperAdmin && selectedUserFilter === 'ALL'
                    ? [{ value: 'UNASSIGNED', label: '📦 Sin campo asignado' }]
                    : []),
                  ...farmsForFilterToolbar.map((f) => ({
                    value: f.id,
                    label: f.name || 'Sin nombre',
                    description: f.user?.name ?? undefined,
                  })),
                ]}
              />
            </div>

            {/* 4. Status Filter */}
            <div>
              <Select
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as 'ALL' | 'ASSIGNED' | 'AVAILABLE' | 'ARCHIVED')}
                options={[
                  { value: 'ALL', label: '📡 Todos los Estados' },
                  { value: 'ASSIGNED', label: `🟢 En uso (${placedCount})` },
                  { value: 'AVAILABLE', label: `🟡 Disponibles (${availableCount})` },
                  { value: 'ARCHIVED', label: `⚪ Archivados / Fuera de servicio (${archivedCount})` },
                ]}
                size="sm"
              />
            </div>
          </div>

          {(searchQuery || selectedUserFilter !== 'ALL' || selectedFarmFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-500">
                Mostrando <strong>{filteredCollars.length}</strong> de <strong>{collars.length}</strong> collares
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedUserFilter('ALL');
                  setSelectedFarmFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-xs text-green-600 dark:text-green-400 hover:underline cursor-pointer font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* List of Collars */}
        {loading ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
            <SkeletonRowList count={4} />
          </div>
        ) : filteredCollars.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-3 shadow-xs">
            <RadioOff className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600" />
            <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">
              No se encontraron collares con los filtros seleccionados
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {isSuperAdmin
                ? 'Podés registrar un nuevo collar usando el botón "Registrar Collar".'
                : 'Comunícate con el administrador para que te asigne nuevos collares a tus establecimientos.'}
            </p>
            {isSuperAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                Registrar nuevo collar
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCollars.map((c) => {
              const farmObj = allFarms.find((f) => f.id === c.farmId);
              const ownerName = c.farm?.user?.name || farmObj?.user?.name;

              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono">
                            ID #{c.id}
                          </span>
                          <span className="font-bold text-zinc-900 dark:text-white font-mono text-sm tracking-wide">
                            {c.identifier}
                          </span>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                              c.isArchived
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                                : c.farmId
                                ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                            }`}
                          >
                            {c.isArchived
                              ? 'Archivado'
                              : c.farmId
                              ? 'Asignado a Campo'
                              : 'Disponible (Stock Central)'}
                          </span>
                        </div>

                        {/* Assigned Animal Pill */}
                        <div className="text-xs pt-1">
                          {c.isArchived ? (
                            <span className="text-zinc-500 dark:text-zinc-400 font-medium inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/40">
                              <RadioOff className="w-3.5 h-3.5 text-zinc-400" />
                              Dado de baja / Fuera de servicio
                            </span>
                          ) : !c.farmId ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                              <Layers className="w-3.5 h-3.5 text-amber-500" />
                              Stock Central: disponible para asignación a un campo (Superadministrador)
                            </span>
                          ) : c.assignedAnimal ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-green-700 dark:text-green-400 font-semibold inline-flex items-center gap-1.5 bg-green-50/60 dark:bg-green-950/20 px-2.5 py-1 rounded-lg border border-green-200/50 dark:border-green-800/40">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                Colocado en: {c.assignedAnimal.tag || `Animal (${c.assignedAnimal.id.slice(0, 5)})`}
                              </span>
                              {c.fenceNotificationPending ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-medium"
                                  title="Las coordenadas del cerco se enviarán en el próximo reporte de telemetría"
                                >
                                  <RefreshCw className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                  Cerco pendiente de envío
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 font-medium"
                                  title={
                                    c.lastFenceSyncedAt
                                      ? `Sincronizado: ${new Date(c.lastFenceSyncedAt).toLocaleString('es-AR')}`
                                      : 'Cerco sincronizado'
                                  }
                                >
                                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                                  Cerco sincronizado
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              Libre para colocar en ganado del campo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Location and Farm Pill */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {c.farm?.name ? (
                        <>
                          {ownerName && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                              <UserIcon className="w-3 h-3 text-zinc-500" />
                              {ownerName}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 font-medium">
                            <Building2 className="w-3 h-3" />
                            Campo: {c.farm.name}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-medium">
                          <Layers className="w-3 h-3" />
                          Stock Libre Central (Sin asignar a campo)
                        </span>
                      )}
                    </div>

                    {/* Telemetry info */}
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {!c.lastTelemetryDate ? (
                        <span className="text-zinc-400 italic">Sin lecturas de telemetría registradas aún</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200">
                            <Radio className="w-3 h-3 text-green-500 animate-pulse" />
                            Señal: {new Date(c.lastTelemetryDate).toLocaleString('es-AR')}
                          </span>
                          {c.telemetryReadings?.[0] && (
                            <span className="font-mono text-zinc-600 dark:text-zinc-300">
                              · Temp: {c.telemetryReadings[0].temperature.toFixed(1)}°C
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Sync fence button */}
                      {canEditIn(c.farmId) && c.assignedAnimal && !c.isArchived && (
                        <button
                          type="button"
                          onClick={() => void handleSyncFence(c)}
                          disabled={syncingCollarId === c.id}
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 rounded-lg hover:bg-indigo-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          title={
                            c.lastFenceSyncedAt
                              ? `Forzar reenvío del cerco (Última sincronización confirmada: ${new Date(c.lastFenceSyncedAt).toLocaleString('es-AR')})`
                              : 'Forzar retransmisión de las coordenadas del cerco en el próximo reporte del collar'
                          }
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingCollarId === c.id ? 'animate-spin' : ''}`} />
                          Sincronizar Cerco
                        </button>
                      )}

                      {/* Expand history */}
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {expandedId === c.id ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        Historial
                      </button>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        {c.isArchived ? (
                          <button
                            onClick={() => void handleRestore(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200/60 dark:border-green-800/40 transition-colors cursor-pointer"
                            title="Reactivar collar y habilitarlo para uso"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reactivar
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenAssignModal(c)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200/60 dark:border-green-800/40 transition-colors cursor-pointer"
                              title="Asignar collar a un administrador de campo"
                            >
                              <UserIcon className="w-3.5 h-3.5" />
                              {c.farmId ? 'Reasignar Campo' : 'Asignar a Campo'}
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Editar ID numérico del hardware (#define COLLAR_ID)"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => void handleArchive(c)}
                              className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Archivar / Dar de baja collar (conserva historial)"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => void handleDelete(c)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Eliminar o dar de baja collar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expandable History Drawer */}
                  {expandedId === c.id && collarDetail && (
                    <div className="mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 animate-in fade-in duration-150">
                      <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        Historial de colocación en animales
                      </p>
                      {!collarDetail.animalCollars || collarDetail.animalCollars.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">Este collar nunca fue asignado a un animal.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {collarDetail.animalCollars.map((ac) => (
                            <div
                              key={ac.id}
                              className="text-[11px] flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800"
                            >
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                Animal: {ac.animal.tag || ac.animal.id.slice(0, 8)}
                              </span>
                              <span className="text-zinc-400">
                                {new Date(ac.startAt).toLocaleDateString('es-AR')}{' '}
                                {ac.endAt ? `→ ${new Date(ac.endAt).toLocaleDateString('es-AR')}` : '(Actual)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: REGISTRAR NUEVO COLLAR EN STOCK (SUPERADMIN)        */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Alta de Collar en Stock</h3>
                  <p className="text-xs text-zinc-500">
                    Ingresá o escaneá el número de collar para agregarlo al stock central de reserva.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* ID Numérico del Collar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                    ID del Collar *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline cursor-pointer bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-lg border border-green-200/60 dark:border-green-800/40"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Escanear QR
                  </button>
                </div>
                <input
                  required
                  autoFocus
                  type="number"
                  min="1"
                  value={createCollarId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreateCollarId(val);
                    setCreateIdentifier(val ? `COLLAR-${val}` : '');
                  }}
                  placeholder="Ej: 2, 3, 4"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-[11px] text-zinc-400">
                  Número identificador del hardware impreso en el collar (emite{' '}
                  <code>ID:{createCollarId || '...'}</code> por LoRa).
                </p>
              </div>

              {/* Aviso de ingreso en reserva */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                <Layers className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Ingreso a Stock Libre Central</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    El collar se registrará en estado disponible (+1 en stock) para ser asignado posteriormente a un
                    productor.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !createCollarId}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Dar de Alta Collar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ASIGNAR COLLAR A PRODUCTOR (DEDICADO Y LITERAL)      */}
      {/* ========================================================= */}
      {assigningCollar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    Asignar Collar a Administrador de Campo
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Dispositivo:{' '}
                    <strong className="font-mono text-zinc-900 dark:text-white">
                      ID #{assigningCollar.id} ({assigningCollar.identifier})
                    </strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningCollar(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Assignment Status Pill */}
            {assigningCollar.farm ? (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="text-purple-900 dark:text-purple-300">
                  <p className="font-semibold">Actualmente asignado a:</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Campo: <strong>{assigningCollar.farm.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleUnassignToStock(assigningCollar)}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-semibold text-[11px] hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer transition-colors"
                >
                  Desvincular a Stock Libre
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <Layers className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Collar en Stock Central Libre</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Al seleccionar el administrador y establecimiento, este dispositivo quedará inmediatamente
                    habilitado en su cuenta.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Paso 1: Administrador de Campo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  1. Administrador de Campo *
                </label>
                <Select
                  required
                  value={assignProducerId}
                  onChange={(nextUserId) => {
                    setAssignProducerId(nextUserId);
                    const matchingFarms = allFarms.filter(
                      (f) => f.userId === nextUserId || f.farmUsers?.some((fu) => fu.userId === nextUserId)
                    );
                    setAssignFarmId(matchingFarms.length === 1 ? matchingFarms[0].id : '');
                  }}
                  size="sm"
                  searchable={farmAdminsList.length > 5}
                  searchPlaceholder="Buscar administrador..."
                  placeholder={
                    farmAdminsList.length === 0
                      ? 'No hay administradores de campo registrados...'
                      : `Seleccionar administrador de campo (${farmAdminsList.length})...`
                  }
                  options={farmAdminsList.map((u) => {
                    const farmCount = allFarms.filter(
                      (f) => f.userId === u.id || f.farmUsers?.some((fu) => fu.userId === u.id)
                    ).length;
                    return {
                      value: u.id,
                      label: u.name || u.email,
                      description: `${u.name ? `${u.email} · ` : ''}${farmCount} ${farmCount === 1 ? 'campo' : 'campos'}`,
                    };
                  })}
                />
              </div>

              {/* Paso 2: Establecimiento / Campo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  2. Establecimiento / Campo Asignado *
                </label>
                {!assignProducerId ? (
                  <div className="text-xs text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5">
                    Seleccioná primero un administrador de campo en el paso 1
                  </div>
                ) : farmsForAssignModal.length === 0 ? (
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5">
                    Este administrador no tiene campos o establecimientos registrados actualmente.
                  </div>
                ) : (
                  <Select
                    value={String(assignFarmId)}
                    onChange={(v) => setAssignFarmId(v)}
                    options={[
                      { value: '', label: `Seleccionar campo (${farmsForAssignModal.length})...` },
                      ...farmsForAssignModal.map((f) => ({ value: String(f.id), label: String(f.name) })),
                    ]}
                    size="sm"
                    required
                  />
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningCollar(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating || !assignProducerId || !assignFarmId}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Confirmar Asignación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDITAR ID NUMÉRICO DEL HARDWARE                     */}
      {/* ========================================================= */}
      {editingCollar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Editar Hardware del Collar</h3>
                <p className="text-xs text-zinc-500">
                  Modificá el ID numérico del hardware físico o su alias identificador.
                </p>
              </div>
              <button
                onClick={() => setEditingCollar(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* ID Numérico del Hardware */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  ID Numérico del Hardware (#define COLLAR_ID) *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={editCollarId}
                  onChange={(e) => setEditCollarId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {parseInt(editCollarId, 10) !== editingCollar.id &&
                  collars.some((c) => c.id === parseInt(editCollarId, 10)) && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                      ¡Atención! El ID #{editCollarId} ya está en uso por otro collar.
                    </p>
                  )}
                <p className="text-[11px] text-zinc-400">
                  Debe coincidir con la constante en el código C++ del firmware del collar físico.
                </p>
              </div>

              {/* Identificador / Alias */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Identificador / Alias
                </label>
                <input
                  type="text"
                  value={editIdentifier}
                  onChange={(e) => setEditIdentifier(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCollar(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {updating ? (
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

      {/* QR Scanner Modal (Sólo Cámara) */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScan={(code) => {
          // Extraer número entero del collar (soporta "2", "COLLAR-2", etc.)
          const match = code.match(/(\d+)/);
          const numericId = match ? match[1] : code;
          setCreateCollarId(numericId);
          setCreateIdentifier(`COLLAR-${numericId}`);
          toast.success(`ID de Collar #${numericId} detectado y cargado`);
        }}
      />
    </div>
  );
}
