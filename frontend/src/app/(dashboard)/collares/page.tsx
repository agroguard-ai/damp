'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { collarsApi } from '@/lib/api/collars';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { QrScannerModal } from '@/components/collars/QrScannerModal';
import { ClaimModal } from '@/components/collars/ClaimModal';
import { RequestCollarsModal } from '@/components/collars/RequestCollarsModal';
import type { Collar, CollarStatus, CollarClaim, CollarClaimStatus, CollarRequest } from '@/types';
import {
  Radio,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Building2,
  ArrowRight,
  QrCode,
  Search,
  PlusCircle,
  Check,
  X,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RadioOff,
  CheckCheck,
  Plus,
  Edit3,
  User as UserIcon,
  Layers,
  SlidersHorizontal,
  Package,
  Cpu,
  Layers as LayersIcon,
  Archive,
  RotateCcw,
} from 'lucide-react';

const STATUS_LABELS: Record<CollarStatus, string> = {
  AVAILABLE: 'Disponible',
  DAMAGED: 'Dañado',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const STATUS_CLASSES: Record<CollarStatus, string> = {
  AVAILABLE:
    'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
  DAMAGED: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  OUT_OF_SERVICE: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/30',
};

const CLAIM_STATUS_BADGES: Record<CollarClaimStatus, { label: string; class: string }> = {
  PENDING: {
    label: 'Pendiente',
    class:
      'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  },
  IN_REVIEW: {
    label: 'En Revisión',
    class: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  },
  RESOLVED: {
    label: 'Resuelto',
    class:
      'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',
  },
  REJECTED: {
    label: 'Desestimado',
    class: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/40',
  },
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
}

export default function CollaresPage() {
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const { toast } = useToast();
  const confirm = useConfirm();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'collars' | 'claims' | 'requests'>('collars');

  // Filters for collars tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'AVAILABLE' | 'DAMAGED' | 'ARCHIVED'>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');

  // Metadata: Users & Farms
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [allFarms, setAllFarms] = useState<FarmOption[]>([]);

  // Modals state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [claimCollarTarget, setClaimCollarTarget] = useState<Collar | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [resolvingClaim, setResolvingClaim] = useState<CollarClaim | null>(null);
  const [claimResolutionNotes, setClaimResolutionNotes] = useState('');
  const [claimResolutionStatus, setClaimResolutionStatus] = useState<CollarClaimStatus>('RESOLVED');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCollarId, setCreateCollarId] = useState('');
  const [createIdentifier, setCreateIdentifier] = useState('');
  const [createAssignMode, setCreateAssignMode] = useState<'STOCK' | 'ASSIGN'>('STOCK');
  const [createUserId, setCreateUserId] = useState('');
  const [createFarmId, setCreateFarmId] = useState('');

  // Edit / Reassign Collar State
  const [editingCollar, setEditingCollar] = useState<Collar | null>(null);
  const [editCollarId, setEditCollarId] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editAssignMode, setEditAssignMode] = useState<'STOCK' | 'ASSIGN'>('STOCK');
  const [editUserId, setEditUserId] = useState('');
  const [editFarmId, setEditFarmId] = useState('');

  // Approve Request & Assign Collars Modal State
  const [approvingRequest, setApprovingRequest] = useState<CollarRequest | null>(null);
  const [approvalIncrementQuota, setApprovalIncrementQuota] = useState(true);
  const [approvalSelectedCollarIds, setApprovalSelectedCollarIds] = useState<number[]>([]);
  const [approvalResponseNotes, setApprovalResponseNotes] = useState('');

  // API calls
  const { data: collars = [], loading, refetch } = useApi(collarsApi.getAll);
  const { data: claims = [], loading: loadingClaims, refetch: refetchClaims } = useApi(collarsApi.getClaims);
  const { data: requests = [], loading: loadingRequests, refetch: refetchRequests } = useApi(collarsApi.getRequests);

  const { mutate: createCollar, loading: submitting, error: createError } = useMutation(collarsApi.create);
  const { mutate: updateCollar, loading: updating } = useMutation(
    (params: { id: number; data: { id?: number; identifier?: string; farmId?: string | null } }) =>
      collarsApi.update(params.id, params.data)
  );
  const { mutate: updateStatus } = useMutation(collarsApi.updateStatus);
  const { mutate: archiveCollar } = useMutation(collarsApi.archive);
  const { mutate: restoreCollar } = useMutation(collarsApi.restore);
  const { mutate: updateRequestMutation, loading: resolvingRequest } = useMutation(
    (params: { requestId: string; data: { status: 'APPROVED' | 'REJECTED'; incrementMaxCollars?: boolean; assignedCollarIds?: number[]; responseNotes?: string } }) =>
      collarsApi.updateRequest(params.requestId, params.data)
  );

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
            fetch('/api/admin/farms?limit=500'),
            fetch('/api/admin/users?limit=500'),
          ]);

          if (farmsRes.ok) {
            const data = await farmsRes.json();
            const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            setAllFarms(
              list.map((f: { id: string; name?: string | null; userId?: string | null; user?: { id: string; name: string | null; email: string } | null }) => ({
                id: f.id,
                name: f.name || 'Sin nombre',
                userId: f.userId || null,
                user: f.user || null,
              }))
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

  // Open Create Modal
  const handleOpenCreateModal = () => {
    // Suggest next available numeric ID
    const maxExistingId = collars.reduce((max, c) => (c.id > max ? c.id : max), 0);
    const nextId = (maxExistingId + 1).toString();
    setCreateCollarId(nextId);
    setCreateIdentifier(`COLLAR-${nextId}`);
    setCreateAssignMode('STOCK');
    setCreateUserId('');
    setCreateFarmId('');
    setIsCreateModalOpen(true);
  };

  // Submit Create Collar
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = createCollarId ? parseInt(createCollarId, 10) : undefined;
    if (parsedId !== undefined && (isNaN(parsedId) || parsedId < 1)) {
      toast.error('El ID numérico debe ser un número entero mayor a 0');
      return;
    }

    if (parsedId !== undefined && collars.some((c) => c.id === parsedId)) {
      toast.error(`Ya existe un collar con el ID #${parsedId} registrado en la plataforma.`);
      return;
    }

    const farmIdToAssign = createAssignMode === 'ASSIGN' && createFarmId ? createFarmId : undefined;

    try {
      await createCollar({
        id: parsedId,
        identifier: createIdentifier.trim() || (parsedId ? `COLLAR-${parsedId}` : undefined),
        farmId: farmIdToAssign,
      });

      toast.success('Collar registrado con éxito en el catálogo de hardware');
      setIsCreateModalOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar collar');
    }
  };

  // Open Edit / Reassign Modal
  const handleOpenEditModal = (c: Collar) => {
    setEditingCollar(c);
    setEditCollarId(c.id.toString());
    setEditIdentifier(c.identifier);

    if (c.farmId) {
      setEditAssignMode('ASSIGN');
      const farmObj = allFarms.find((f) => f.id === c.farmId);
      const ownerId = farmObj?.userId || c.farm?.userId || farmObj?.user?.id || '';
      setEditUserId(ownerId);
      setEditFarmId(c.farmId);
    } else {
      setEditAssignMode('STOCK');
      setEditUserId('');
      setEditFarmId('');
    }
  };

  // Submit Edit Collar
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

    const farmIdToAssign = editAssignMode === 'ASSIGN' && editFarmId ? editFarmId : null;

    try {
      await updateCollar({
        id: editingCollar.id,
        data: {
          id: parsedId,
          identifier: editIdentifier.trim() || `COLLAR-${parsedId}`,
          farmId: farmIdToAssign,
        },
      });

      toast.success(`Collar #${parsedId} actualizado correctamente`);
      setEditingCollar(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar collar');
    }
  };

  // Handle status change
  const handleStatusChange = async (id: number, status: CollarStatus) => {
    if (status !== 'AVAILABLE') {
      const ok = await confirm({
        title: `Marcar collar como ${STATUS_LABELS[status]}`,
        description:
          'Si este collar está asignado a un animal, se liberará automáticamente para que puedas colocarle otro dispositivo inmediatamente.',
        confirmLabel: 'Confirmar Cambio de Estado',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await updateStatus(id, status);
      toast.success('Estado del collar actualizado correctamente');
      refetch();
      if (expandedId === id) refetchDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar estado');
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
      description:
        'El collar no posee historial registrado y se eliminará definitivamente del catálogo. ¿Continuar?',
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

  // Submit claim
  const handleCreateClaim = async (data: { reason: string; description?: string; markAsDamaged: boolean }) => {
    if (!claimCollarTarget) return;
    await collarsApi.createClaim(claimCollarTarget.id, data);
    toast.success('Reclamo registrado con éxito. Se notificará a soporte.');
    refetch();
    refetchClaims();
  };

  // Submit collar request (from farmer)
  const handleCreateRequest = async (data: { farmId: string; requestedCount: number; notes?: string }) => {
    await collarsApi.createRequest(data);
    toast.success('Solicitud enviada a la administración para asignación de collares.');
    refetchRequests();
  };

  // Open Approve Request Modal
  const handleOpenApproveRequest = (req: CollarRequest) => {
    setApprovingRequest(req);
    setApprovalIncrementQuota(true);
    setApprovalResponseNotes('Collares habilitados y asignados al establecimiento.');

    // Auto-select available free collars up to requestedCount
    const freeCollars = collars.filter((c) => !c.farmId && c.status === 'AVAILABLE');
    const autoIds = freeCollars.slice(0, req.requestedCount).map((c) => c.id);
    setApprovalSelectedCollarIds(autoIds);
  };

  // Submit Approve Request
  const handleConfirmApproval = async () => {
    if (!approvingRequest) return;
    try {
      await updateRequestMutation({
        requestId: approvingRequest.id,
        data: {
          status: 'APPROVED',
          incrementMaxCollars: approvalIncrementQuota,
          assignedCollarIds: approvalSelectedCollarIds,
          responseNotes: approvalResponseNotes.trim() || undefined,
        },
      });

      toast.success(
        `Solicitud aprobada: ${approvalSelectedCollarIds.length} collares asignados al establecimiento.`
      );
      setApprovingRequest(null);
      refetchRequests();
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la aprobación');
    }
  };

  // Reject Request
  const handleRejectRequest = async (req: CollarRequest) => {
    const ok = await confirm({
      title: 'Rechazar solicitud de collares',
      description: `¿Estás seguro de desestimar el pedido de ${req.requestedCount} collares para ${req.farm?.name || req.farmId}?`,
      confirmLabel: 'Rechazar Solicitud',
      danger: true,
    });
    if (!ok) return;

    try {
      await updateRequestMutation({
        requestId: req.id,
        data: {
          status: 'REJECTED',
          responseNotes: 'Solicitud desestimada por la administración.',
        },
      });
      toast.success('Solicitud rechazada.');
      refetchRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar');
    }
  };

  // Resolve claim (SuperAdmin)
  const handleSaveClaimResolution = async () => {
    if (!resolvingClaim) return;
    try {
      await collarsApi.updateClaim(resolvingClaim.id, {
        status: claimResolutionStatus,
        resolutionNotes: claimResolutionNotes.trim() || undefined,
      });
      toast.success('Reclamo actualizado');
      setResolvingClaim(null);
      refetchClaims();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar reclamo');
    }
  };

  // Filtered lists for modal dropdowns
  const farmsForCreateModal = useMemo(() => {
    if (!createUserId) return [];
    return allFarms.filter((f) => f.userId === createUserId);
  }, [allFarms, createUserId]);

  const farmsForEditModal = useMemo(() => {
    if (!editUserId) return [];
    return allFarms.filter((f) => f.userId === editUserId);
  }, [allFarms, editUserId]);

  const farmsForFilterToolbar = useMemo(() => {
    if (selectedUserFilter === 'ALL' || selectedUserFilter === 'UNASSIGNED') {
      return allFarms;
    }
    return allFarms.filter((f) => f.userId === selectedUserFilter);
  }, [allFarms, selectedUserFilter]);

  // Collars available in free stock for request approval
  const availableStockCollars = useMemo(() => {
    return collars.filter((c) => !c.isArchived && !c.farmId && c.status === 'AVAILABLE');
  }, [collars]);

  // Filtered collars for display
  const filteredCollars = useMemo(() => {
    return collars.filter((c) => {
      // 1. User Filter
      if (selectedUserFilter === 'UNASSIGNED') {
        if (c.farmId) return false;
      } else if (selectedUserFilter !== 'ALL') {
        const farmObj = allFarms.find((f) => f.id === c.farmId);
        const ownerId = farmObj?.userId || c.farm?.userId || farmObj?.user?.id;
        if (ownerId !== selectedUserFilter) return false;
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
        if (statusFilter === 'DAMAGED' && c.status !== 'DAMAGED') return false;
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
  const availableCount = collars.filter((c) => !c.isArchived && !c.assignedAnimal && c.status === 'AVAILABLE' && c.farmId).length;
  const freeStockCount = collars.filter((c) => !c.isArchived && !c.farmId).length;
  const damagedCount = collars.filter((c) => !c.isArchived && c.status === 'DAMAGED').length;
  const archivedCount = collars.filter((c) => c.isArchived || c.status === 'OUT_OF_SERVICE').length;
  const pendingClaimsCount = claims.filter((c) => c.status === 'PENDING').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;

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
              ? 'Administración de hardware, ajuste de IDs, asignación de flota a productores y gestión de solicitudes.'
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

          {!isSuperAdmin && (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Solicitar Más Collares
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Collares</span>
            <Cpu className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">{collars.length}</div>
          <p className="text-[11px] text-zinc-400">Hardware registrado en plataforma</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>En Uso (Animales)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{placedCount}</div>
          <p className="text-[11px] text-zinc-400">Colocados y reportando datos</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Disponibles</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{availableCount}</div>
          <p className="text-[11px] text-zinc-400">Listos en campo para colocar</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wider">
            <span>{isSuperAdmin ? 'Stock Libre Central' : 'Dañados / Recambio'}</span>
            <LayersIcon className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {isSuperAdmin ? freeStockCount : damagedCount}
          </div>
          <p className="text-[11px] text-zinc-400">
            {isSuperAdmin ? 'Listos para asignar a solicitudes' : 'Requieren servicio técnico'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('collars')}
          className={`py-3 px-1 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'collars'
              ? 'border-green-600 text-green-700 dark:text-green-400 font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Radio className="w-4 h-4" />
          Collares ({collars.length})
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`py-3 px-1 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'claims'
              ? 'border-green-600 text-green-700 dark:text-green-400 font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Reclamos y Averías ({claims.length})
          {pendingClaimsCount > 0 && (
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {pendingClaimsCount} pendientes
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`py-3 px-1 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'requests'
              ? 'border-green-600 text-green-700 dark:text-green-400 font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Solicitudes de Flota ({requests.length})
          {pendingRequestsCount > 0 && (
            <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {pendingRequestsCount} nuevas
            </span>
          )}
        </button>
      </div>

      {/* Main Tab Views */}
      <div>
        {/* TAB 1: COLLARES */}
        {activeTab === 'collars' && (
          <div className="space-y-5">
            {/* Filter Toolbar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros de Búsqueda y Productor
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

                {/* 2. Productor Filter (SuperAdmin only) */}
                {isSuperAdmin && (
                  <div>
                    <select
                      value={selectedUserFilter}
                      onChange={(e) => {
                        setSelectedUserFilter(e.target.value);
                        setSelectedFarmFilter('ALL');
                      }}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                    >
                      <option value="ALL">👤 Todos los Productores ({usersList.length})</option>
                      <option value="UNASSIGNED">📦 Stock Libre (Sin asignar)</option>
                      {usersList.map((u) => {
                        const userFarmsCount = allFarms.filter((f) => f.userId === u.id).length;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email} ({userFarmsCount} {userFarmsCount === 1 ? 'campo' : 'campos'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* 3. Farm Filter */}
                <div>
                  <select
                    disabled={selectedUserFilter === 'UNASSIGNED'}
                    value={selectedFarmFilter}
                    onChange={(e) => setSelectedFarmFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="ALL">
                      🏢 {selectedUserFilter !== 'ALL' && selectedUserFilter !== 'UNASSIGNED' ? 'Todos los campos del productor' : 'Todos los Campos'} (
                      {farmsForFilterToolbar.length})
                    </option>
                    {isSuperAdmin && selectedUserFilter === 'ALL' && (
                      <option value="UNASSIGNED">📦 Sin campo asignado</option>
                    )}
                    {farmsForFilterToolbar.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.user?.name ? `(${f.user.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Status Filter */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                  >
                    <option value="ALL">📡 Todos los Estados</option>
                    <option value="ASSIGNED">🟢 En uso ({placedCount})</option>
                    <option value="AVAILABLE">🟡 Disponibles ({availableCount})</option>
                    <option value="DAMAGED">🔴 Dañados / Averías ({damagedCount})</option>
                    <option value="ARCHIVED">⚪ Archivados / Fuera de servicio ({archivedCount})</option>
                  </select>
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
                    : 'Podés solicitar nuevos collares desde el botón "Solicitar Más Collares".'}
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
                                    : STATUS_CLASSES[c.status]
                                }`}
                              >
                                {c.isArchived ? 'Archivado' : STATUS_LABELS[c.status]}
                              </span>
                            </div>

                            {/* Assigned Animal Pill */}
                            <div className="text-xs pt-1">
                              {c.isArchived ? (
                                <span className="text-zinc-500 dark:text-zinc-400 font-medium inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/40">
                                  <RadioOff className="w-3.5 h-3.5 text-zinc-400" />
                                  Dado de baja / Fuera de servicio
                                </span>
                              ) : c.assignedAnimal ? (
                                <span className="text-green-700 dark:text-green-400 font-semibold inline-flex items-center gap-1.5 bg-green-50/60 dark:bg-green-950/20 px-2.5 py-1 rounded-lg border border-green-200/50 dark:border-green-800/40">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  Colocado en: {c.assignedAnimal.tag || `Animal (${c.assignedAnimal.id.slice(0, 5)})`}
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                  Libre para colocar en ganado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Role action quick toggle */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            <select
                              value={c.status}
                              onChange={(e) => void handleStatusChange(c.id, e.target.value as CollarStatus)}
                              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                            >
                              <option value="AVAILABLE">Disponible</option>
                              <option value="DAMAGED">Dañado</option>
                              {isSuperAdmin && <option value="OUT_OF_SERVICE">Fuera de servicio</option>}
                            </select>
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
                          {/* Report fault button */}
                          <button
                            type="button"
                            onClick={() => setClaimCollarTarget(c)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-lg hover:bg-amber-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reportar avería o falla técnica"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Reportar Falla
                          </button>

                          {/* Expand history */}
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {expandedId === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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
                                  onClick={() => handleOpenEditModal(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                  title="Modificar ID de hardware o reasignar a otro campo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Editar ID
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
        )}

        {/* TAB 2: RECLAMOS */}
        {activeTab === 'claims' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Reclamos y Averías de Collares</h3>
                <p className="text-xs text-zinc-500">
                  Incidentes reportados por productores para recambio o reparación de hardware defectuoso.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Total: {claims.length}
              </span>
            </div>

            {loadingClaims ? (
              <SkeletonRowList count={3} />
            ) : claims.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 space-y-1">
                <CheckCheck className="w-10 h-10 mx-auto text-green-500" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No hay reclamos activos en este momento.
                </p>
                <p className="text-xs">Todos los collares asignados operan con normalidad.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">
                            {claim.collar?.identifier || `Collar #${claim.collarId}`}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${CLAIM_STATUS_BADGES[claim.status]?.class}`}
                          >
                            {CLAIM_STATUS_BADGES[claim.status]?.label || claim.status}
                          </span>
                          {claim.farm?.name && (
                            <span className="text-xs text-zinc-500 font-medium">({claim.farm.name})</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mt-1">
                          {claim.reason}
                        </p>
                        {claim.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{claim.description}</p>
                        )}
                      </div>

                      {/* Admin resolve button */}
                      {isSuperAdmin && claim.status !== 'RESOLVED' && claim.status !== 'REJECTED' && (
                        <button
                          onClick={() => {
                            setResolvingClaim(claim);
                            setClaimResolutionStatus('RESOLVED');
                            setClaimResolutionNotes(claim.resolutionNotes || '');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer shrink-0"
                        >
                          Gestionar Reclamo
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <span>Reportado por: {claim.user?.name || claim.user?.email || 'Usuario'}</span>
                      <span>{new Date(claim.createdAt).toLocaleString('es-AR')}</span>
                    </div>

                    {claim.resolutionNotes && (
                      <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 text-xs text-green-800 dark:text-green-300">
                        <span className="font-bold">Resolución soporte:</span> {claim.resolutionNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SOLICITUDES DE FLOTA */}
        {activeTab === 'requests' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Solicitudes de Collares de Productores</h3>
                <p className="text-xs text-zinc-500">
                  Pedidos de ampliación de flota para rodeos. Al aprobar, podés asignar collares de stock libre directamente a la granja.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Total: {requests.length}
              </span>
            </div>

            {loadingRequests ? (
              <SkeletonRowList count={3} />
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 space-y-1">
                <Building2 className="w-10 h-10 mx-auto text-zinc-300" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No hay solicitudes registradas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-white text-sm">
                            +{req.requestedCount} Collares requeridos
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              req.status === 'APPROVED'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : req.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {req.status === 'APPROVED'
                              ? 'Aprobada'
                              : req.status === 'REJECTED'
                                ? 'Rechazada'
                                : 'Pendiente de Aprobación'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                          Establecimiento: <strong>{req.farm?.name || req.farmId}</strong>
                        </p>
                        {req.notes && (
                          <p className="text-xs text-zinc-500 italic mt-0.5">&ldquo;{req.notes}&rdquo;</p>
                        )}
                      </div>

                      {/* SuperAdmin Approve / Reject Buttons */}
                      {isSuperAdmin && req.status === 'PENDING' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenApproveRequest(req)}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprobar y Asignar Collares
                          </button>
                          <button
                            onClick={() => void handleRejectRequest(req)}
                            className="px-3 py-1.5 text-xs font-semibold bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-lg cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <span>Solicitante: {req.user?.name || req.user?.email || 'Usuario'}</span>
                      <span>{new Date(req.createdAt).toLocaleString('es-AR')}</span>
                    </div>

                    {req.responseNotes && (
                      <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 text-xs text-green-800 dark:text-green-300">
                        <span className="font-bold">Respuesta administración:</span> {req.responseNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: REGISTRAR NUEVO COLLAR (SUPERADMIN)                 */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar Collar en Flota</h3>
                  <p className="text-xs text-zinc-500">
                    Definí el ID numérico del hardware y asignalo a un campo o a stock libre.
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
              {/* ID Numérico del Hardware */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  ID Numérico del Hardware (#define COLLAR_ID) *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={createCollarId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreateCollarId(val);
                    if (val) {
                      setCreateIdentifier(`COLLAR-${val}`);
                    }
                  }}
                  placeholder="Ej: 2, 3, 4"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-[11px] text-zinc-400">
                  Es el número entero que emite el emisor LoRa en el mensaje <code>ID:2,...</code>.
                </p>
              </div>

              {/* Identificador / Alias */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                    Identificador / Alias (Opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400 hover:underline cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Escanear QR
                  </button>
                </div>
                <input
                  type="text"
                  value={createIdentifier}
                  onChange={(e) => setCreateIdentifier(e.target.value)}
                  placeholder="Ej: COLLAR-2"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Asignación */}
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Asignación de Hardware
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateAssignMode('STOCK');
                      setCreateUserId('');
                      setCreateFarmId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      createAssignMode === 'STOCK'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      Stock Libre Central
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">Hardware en empresa para asignar luego.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateAssignMode('ASSIGN')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      createAssignMode === 'ASSIGN'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-emerald-500" />
                      Asignar a Productor
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">Vincular directamente a un campo.</div>
                  </button>
                </div>

                {createAssignMode === 'ASSIGN' && (
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                        1. Seleccionar Productor *
                      </label>
                      <select
                        required
                        value={createUserId}
                        onChange={(e) => {
                          setCreateUserId(e.target.value);
                          setCreateFarmId('');
                        }}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                      >
                        <option value="">Seleccioná un productor ({usersList.length} disponibles)...</option>
                        {usersList.map((u) => {
                          const farmCount = allFarms.filter((f) => f.userId === u.id).length;
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name ? `${u.name} (${u.email})` : u.email} — {farmCount} {farmCount === 1 ? 'campo' : 'campos'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                        2. Campo del Productor *
                      </label>
                      {!createUserId ? (
                        <div className="text-xs text-zinc-400 italic bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
                          Seleccioná primero un productor en el paso 1
                        </div>
                      ) : farmsForCreateModal.length === 0 ? (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                          Este productor no tiene ningún campo registrado aún.
                        </div>
                      ) : (
                        <select
                          required
                          value={createFarmId}
                          onChange={(e) => setCreateFarmId(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                        >
                          <option value="">Seleccioná el campo ({farmsForCreateModal.length} de este usuario)...</option>
                          {farmsForCreateModal.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
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
                  disabled={submitting || (createAssignMode === 'ASSIGN' && (!createUserId || !createFarmId))}
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
      {/* MODAL: EDITAR / MODIFICAR ID / ASIGNAR COLLAR              */}
      {/* ========================================================= */}
      {editingCollar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  Editar ID / Asignación del Collar
                </h3>
                <p className="text-xs text-zinc-500">
                  Modificá el ID numérico del hardware o transferí este collar a otro productor/campo.
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
                  Si creaste este collar con un ID erróneo respecto al firmware físico, podés corregirlo acá.
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

              {/* Asignación */}
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Asignación y Destino
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssignMode('STOCK');
                      setEditUserId('');
                      setEditFarmId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editAssignMode === 'STOCK'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      Stock Libre Central
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">Desvincular del campo actual.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAssignMode('ASSIGN')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editAssignMode === 'ASSIGN'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-emerald-500" />
                      Asignar a Productor
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">Asignar a un productor y campo.</div>
                  </button>
                </div>

                {editAssignMode === 'ASSIGN' && (
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                        1. Productor / Dueño *
                      </label>
                      <select
                        required
                        value={editUserId}
                        onChange={(e) => {
                          setEditUserId(e.target.value);
                          setEditFarmId('');
                        }}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                      >
                        <option value="">Seleccionar productor ({usersList.length})...</option>
                        {usersList.map((u) => {
                          const farmCount = allFarms.filter((f) => f.userId === u.id).length;
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name ? `${u.name} (${u.email})` : u.email} — {farmCount} {farmCount === 1 ? 'campo' : 'campos'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                        2. Campo del Productor *
                      </label>
                      {!editUserId ? (
                        <div className="text-xs text-zinc-400 italic bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
                          Seleccioná primero un productor en el paso 1
                        </div>
                      ) : farmsForEditModal.length === 0 ? (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                          Este productor no tiene campos registrados.
                        </div>
                      ) : (
                        <select
                          required
                          value={editFarmId}
                          onChange={(e) => setEditFarmId(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                        >
                          <option value="">Seleccionar campo ({farmsForEditModal.length})...</option>
                          {farmsForEditModal.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
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
                  disabled={updating || (editAssignMode === 'ASSIGN' && (!editUserId || !editFarmId))}
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

      {/* ========================================================= */}
      {/* MODAL: APROBAR SOLICITUD Y ASIGNAR COLLARES               */}
      {/* ========================================================= */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  Aprobar Solicitud y Asignar Flota
                </h3>
                <p className="text-xs text-zinc-500">
                  Establecimiento: <strong>{approvingRequest.farm?.name || approvingRequest.farmId}</strong>
                </p>
              </div>
              <button
                onClick={() => setApprovingRequest(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>Cantidad Solicitada:</span>
                <span className="text-base text-blue-700 dark:text-blue-400">+{approvingRequest.requestedCount} Collares</span>
              </div>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80">
                Solicitado por: {approvingRequest.user?.name || approvingRequest.user?.email || 'Usuario'}
              </p>
            </div>

            {/* Quota Increment Checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer">
              <input
                type="checkbox"
                checked={approvalIncrementQuota}
                onChange={(e) => setApprovalIncrementQuota(e.target.checked)}
                className="rounded text-green-600 focus:ring-green-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  Incrementar cupo contratado del productor (+{approvingRequest.requestedCount})
                </span>
                <span className="text-[11px] text-zinc-500">
                  Permitirá que el usuario mantenga estos collares permanentemente en su cuenta.
                </span>
              </div>
            </label>

            {/* Free Stock Collars Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Collares a Asignar desde Stock Libre ({approvalSelectedCollarIds.length} de {approvingRequest.requestedCount})
                </label>
                {availableStockCollars.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = availableStockCollars.slice(0, approvingRequest.requestedCount).map((c) => c.id);
                      setApprovalSelectedCollarIds(ids);
                    }}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline cursor-pointer font-medium"
                  >
                    Auto-seleccionar {approvingRequest.requestedCount}
                  </button>
                )}
              </div>

              {availableStockCollars.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                  No hay collares en Stock Libre Central disponibles en este momento. Podés registrar nuevos collares en flota y asignarlos luego.
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-1.5 bg-zinc-50/50 dark:bg-zinc-950/40">
                  {availableStockCollars.map((c) => {
                    const isSelected = approvalSelectedCollarIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            setApprovalSelectedCollarIds((prev) => prev.filter((id) => id !== c.id));
                          } else {
                            setApprovalSelectedCollarIds((prev) => [...prev, c.id]);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-green-100 dark:bg-green-950/60 text-green-900 dark:text-green-300 font-semibold'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-green-600 focus:ring-green-500 pointer-events-none"
                          />
                          <span className="font-mono">ID #{c.id}</span>
                          <span className="font-mono text-[11px] opacity-75">({c.identifier})</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          Stock Central
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Response Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                Notas de Respuesta / Despacho
              </label>
              <textarea
                rows={2}
                value={approvalResponseNotes}
                onChange={(e) => setApprovalResponseNotes(e.target.value)}
                placeholder="Ej: Collares habilitados y despachados por correo..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setApprovingRequest(null)}
                className="px-4 py-2 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resolvingRequest}
                onClick={() => void handleConfirmApproval()}
                className="px-5 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {resolvingRequest ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar y Asignar ({approvalSelectedCollarIds.length} collares)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScan={(code) => {
          setCreateIdentifier(code);
          toast.success(`Código QR escaneado: ${code}`);
        }}
      />

      {/* Claim / Fault Report Modal */}
      <ClaimModal
        isOpen={claimCollarTarget !== null}
        collar={claimCollarTarget}
        onClose={() => setClaimCollarTarget(null)}
        onSubmit={handleCreateClaim}
      />

      {/* Request More Collars Modal */}
      <RequestCollarsModal
        isOpen={isRequestModalOpen}
        farms={allFarms}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={handleCreateRequest}
      />

      {/* SuperAdmin Resolve Claim Modal */}
      {resolvingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Gestionar Reclamo</h3>
              <button
                onClick={() => setResolvingClaim(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p>
                Collar:{' '}
                <strong className="font-mono">{resolvingClaim.collar?.identifier || resolvingClaim.collarId}</strong>
              </p>
              <p>
                Motivo: <strong>{resolvingClaim.reason}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Estado de resolución</label>
              <select
                value={claimResolutionStatus}
                onChange={(e) => setClaimResolutionStatus(e.target.value as CollarClaimStatus)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white"
              >
                <option value="RESOLVED">Resuelto (Se reparó o envió reemplazo)</option>
                <option value="IN_REVIEW">En Revisión técnica</option>
                <option value="REJECTED">Desestimado (Sin falla o mal uso)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Notas de respuesta al productor
              </label>
              <textarea
                rows={3}
                value={claimResolutionNotes}
                onChange={(e) => setClaimResolutionNotes(e.target.value)}
                placeholder="Indique la acción tomada o código de seguimiento..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingClaim(null)}
                className="px-3 py-1.5 text-xs text-zinc-500 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveClaimResolution()}
                className="px-4 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Guardar Resolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
