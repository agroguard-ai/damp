'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { gatewaysApi } from '@/lib/api/gateways';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { SignalStrength } from '@/components/gateways/SignalStrength';
import {
  Radio,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  MapPin,
  Trash2,
  Edit3,
  X,
  RadioOff,
  Search,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  User as UserIcon,
  Cpu,
  Wifi,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { GatewayStatus, Gateway } from '@/types';

const STATUS_LABELS: Record<GatewayStatus, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Fuera de línea',
  NO_DATA: 'Sin datos',
};

const STATUS_CLASSES: Record<GatewayStatus, string> = {
  ONLINE:
    'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
  OFFLINE:
    'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',
  NO_DATA:
    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/40',
};

function generateRandomApiKey(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

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

export default function GatewaysPage() {
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const { toast } = useToast();
  const confirm = useConfirm();

  // Users & Farms state
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [allFarms, setAllFarms] = useState<FarmOption[]>([]);

  // Filter toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Gateways data
  const { data: gateways = [], loading, refetch } = useApi(gatewaysApi.getAll);

  // Mutations
  const { mutate: createGateway, loading: creating } = useMutation(gatewaysApi.create);
  const { mutate: updateGateway, loading: updating } = useMutation(
    (params: { id: string; data: { name?: string; apiKey?: string; farmId?: string | null; zoneId?: string | null } }) =>
      gatewaysApi.update(params.id, params.data)
  );
  const { mutate: deleteGateway } = useMutation(gatewaysApi.delete);

  // Modal: Create Gateway state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createApiKey, setCreateApiKey] = useState('');
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [createAssignMode, setCreateAssignMode] = useState<'STOCK' | 'ASSIGN'>('STOCK');
  const [createUserId, setCreateUserId] = useState('');
  const [createFarmId, setCreateFarmId] = useState('');
  const [createZoneId, setCreateZoneId] = useState('');
  const [createFarmZones, setCreateFarmZones] = useState<Array<{ id: string; name: string }>>([]);

  // Modal: Edit / Reassign Gateway state
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [editName, setEditName] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [showEditApiKey, setShowEditApiKey] = useState(false);
  const [editAssignMode, setEditAssignMode] = useState<'STOCK' | 'ASSIGN'>('STOCK');
  const [editUserId, setEditUserId] = useState('');
  const [editFarmId, setEditFarmId] = useState('');
  const [editZoneId, setEditZoneId] = useState('');
  const [editFarmZones, setEditFarmZones] = useState<Array<{ id: string; name: string }>>([]);

  // Modal: Hardware Setup & Credentials guide
  const [setupModalGateway, setSetupModalGateway] = useState<{
    id: string;
    name: string;
    apiKey: string;
    farmName?: string | null;
    userName?: string | null;
  } | null>(null);

  // Key revelation & clipboard state
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Initial load of users and farms
  useEffect(() => {
    async function loadData() {
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
        // ignore error loading metadata
      }
    }
    void loadData();
  }, [isSuperAdmin]);

  // Load zones for Create Modal when createFarmId changes
  useEffect(() => {
    async function loadCreateZones() {
      if (!createFarmId) {
        setCreateFarmZones([]);
        setCreateZoneId('');
        return;
      }
      try {
        const zones = await zonesApi.getByFarm(createFarmId);
        setCreateFarmZones(zones.map((z) => ({ id: z.id, name: z.name })));
      } catch {
        setCreateFarmZones([]);
      }
    }
    void loadCreateZones();
  }, [createFarmId]);

  // Load zones for Edit Modal when editFarmId changes
  useEffect(() => {
    async function loadEditZones() {
      if (!editFarmId) {
        setEditFarmZones([]);
        setEditZoneId('');
        return;
      }
      try {
        const zones = await zonesApi.getByFarm(editFarmId);
        setEditFarmZones(zones.map((z) => ({ id: z.id, name: z.name })));
      } catch {
        setEditFarmZones([]);
      }
    }
    void loadEditZones();
  }, [editFarmId]);

  // Open Create Modal handler
  const handleOpenCreateModal = () => {
    setCreateName('');
    setCreateApiKey(generateRandomApiKey());
    setShowCreateApiKey(false);
    setCreateAssignMode('STOCK');
    setCreateUserId('');
    setCreateFarmId('');
    setCreateZoneId('');
    setIsCreateModalOpen(true);
  };

  // Open Edit / Reassign Modal handler
  const handleOpenEditModal = async (g: Gateway) => {
    setEditingGateway(g);
    setEditName(g.name);
    setEditApiKey(g.apiKey || revealedKeys[g.id] || '');
    setShowEditApiKey(false);

    if (g.farmId) {
      setEditAssignMode('ASSIGN');
      const farm = allFarms.find((f) => f.id === g.farmId);
      const ownerId = farm?.userId || g.farm?.userId || farm?.user?.id || '';
      setEditUserId(ownerId);
      setEditFarmId(g.farmId);
      setEditZoneId(g.zoneId || '');
    } else {
      setEditAssignMode('STOCK');
      setEditUserId('');
      setEditFarmId('');
      setEditZoneId('');
    }

    // If apiKey wasn't loaded in g, fetch it in background
    if (!g.apiKey && !revealedKeys[g.id]) {
      try {
        const res = await gatewaysApi.getApiKey(g.id);
        if (res?.apiKey) {
          setEditApiKey(res.apiKey);
          setRevealedKeys((prev) => ({ ...prev, [g.id]: res.apiKey }));
        }
      } catch {
        // ignore
      }
    }
  };

  // Submit Create Gateway
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error('Ingresá un nombre para el gateway');
      return;
    }

    const farmIdToAssign = createAssignMode === 'ASSIGN' && createFarmId ? createFarmId : undefined;
    const zoneIdToAssign = createAssignMode === 'ASSIGN' && createZoneId ? createZoneId : undefined;

    try {
      const created = await createGateway({
        name: createName.trim(),
        apiKey: createApiKey.trim() || undefined,
        farmId: farmIdToAssign,
        zoneId: zoneIdToAssign,
      });

      if (!created) return;

      toast.success('Gateway registrado correctamente');
      setIsCreateModalOpen(false);

      // Open setup credentials guide immediately
      const farmObj = allFarms.find((f) => f.id === farmIdToAssign);
      setSetupModalGateway({
        id: created.id,
        name: created.name,
        apiKey: created.apiKey || createApiKey.trim(),
        farmName: farmObj?.name || created.farm?.name || null,
        userName: farmObj?.user?.name || farmObj?.user?.email || null,
      });

      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar gateway');
    }
  };

  // Submit Edit Gateway
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGateway) return;
    if (!editName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    const farmIdToAssign = editAssignMode === 'ASSIGN' && editFarmId ? editFarmId : null;
    const zoneIdToAssign = editAssignMode === 'ASSIGN' && editZoneId ? editZoneId : null;

    try {
      const updated = await updateGateway({
        id: editingGateway.id,
        data: {
          name: editName.trim(),
          apiKey: editApiKey.trim() || undefined,
          farmId: farmIdToAssign,
          zoneId: zoneIdToAssign,
        },
      });

      if (editApiKey.trim()) {
        setRevealedKeys((prev) => ({ ...prev, [editingGateway.id]: editApiKey.trim() }));
      }

      toast.success('Gateway actualizado con éxito');
      setEditingGateway(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar gateway');
    }
  };

  // Toggle Reveal API Key for a card
  const handleToggleRevealKey = async (g: Gateway) => {
    const isCurrentlyVisible = !!visibleKeyIds[g.id];
    if (isCurrentlyVisible) {
      setVisibleKeyIds((prev) => ({ ...prev, [g.id]: false }));
      return;
    }

    // If key not loaded yet, fetch it
    let key = g.apiKey || revealedKeys[g.id];
    if (!key) {
      try {
        const res = await gatewaysApi.getApiKey(g.id);
        key = res.apiKey;
        setRevealedKeys((prev) => ({ ...prev, [g.id]: key }));
      } catch {
        toast.error('No se pudo obtener la API Key');
        return;
      }
    }

    setVisibleKeyIds((prev) => ({ ...prev, [g.id]: true }));
  };

  // Copy API Key to clipboard
  const handleCopyKey = async (text: string, identifierId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(identifierId);
      toast.success('API Key copiada al portapapeles');
      setTimeout(() => setCopiedKeyId(null), 2500);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  // Open Hardware Setup Modal for any gateway
  const handleOpenSetupModal = async (g: Gateway) => {
    let key = g.apiKey || revealedKeys[g.id];
    if (!key) {
      try {
        const res = await gatewaysApi.getApiKey(g.id);
        key = res.apiKey;
        setRevealedKeys((prev) => ({ ...prev, [g.id]: key }));
      } catch {
        toast.error('No se pudo obtener la clave del gateway');
        return;
      }
    }

    const farmObj = allFarms.find((f) => f.id === g.farmId);
    setSetupModalGateway({
      id: g.id,
      name: g.name,
      apiKey: key,
      farmName: g.farm?.name || farmObj?.name || null,
      userName: g.farm?.user?.name || farmObj?.user?.name || farmObj?.user?.email || null,
    });
  };

  // Delete gateway
  const handleDelete = async (id: string, gatewayName: string) => {
    const ok = await confirm({
      title: `Eliminar gateway ${gatewayName}`,
      description:
        'Se perderá el registro de conexión y telemetría de este dispositivo físico. Para reconectarlo se deberá registrar de nuevo.',
      confirmLabel: 'Eliminar Gateway',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteGateway(id);
      toast.success('Gateway eliminado');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido al eliminar');
    }
  };

  // Filtered fields available based on user selection in Filter Toolbar
  const farmsForFilterToolbar = useMemo(() => {
    if (selectedUserFilter === 'ALL' || selectedUserFilter === 'UNASSIGNED') {
      return allFarms;
    }
    return allFarms.filter((f) => f.userId === selectedUserFilter);
  }, [allFarms, selectedUserFilter]);

  // Filtered fields available in Create Modal based on selected user
  const farmsForCreateModal = useMemo(() => {
    if (!createUserId) return [];
    return allFarms.filter((f) => f.userId === createUserId);
  }, [allFarms, createUserId]);

  // Filtered fields available in Edit Modal based on selected user
  const farmsForEditModal = useMemo(() => {
    if (!editUserId) return [];
    return allFarms.filter((f) => f.userId === editUserId);
  }, [allFarms, editUserId]);

  // Gateways filtered for display
  const filteredGateways = useMemo(() => {
    return gateways.filter((g) => {
      // 1. User Filter
      if (selectedUserFilter === 'UNASSIGNED') {
        if (g.farmId) return false;
      } else if (selectedUserFilter !== 'ALL') {
        const farmObj = allFarms.find((f) => f.id === g.farmId);
        const ownerId = farmObj?.userId || g.farm?.userId || farmObj?.user?.id;
        if (ownerId !== selectedUserFilter) return false;
      }

      // 2. Farm Filter
      if (selectedFarmFilter === 'UNASSIGNED') {
        if (g.farmId) return false;
      } else if (selectedFarmFilter !== 'ALL') {
        if (g.farmId !== selectedFarmFilter) return false;
      }

      // 3. Status Filter
      if (selectedStatusFilter !== 'ALL' && g.status !== selectedStatusFilter) {
        return false;
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.name.toLowerCase().includes(q);
        const matchFarm = g.farm?.name?.toLowerCase().includes(q);
        const matchZone = g.zone?.name?.toLowerCase().includes(q);
        const farmObj = allFarms.find((f) => f.id === g.farmId);
        const matchOwnerName = (g.farm?.user?.name || farmObj?.user?.name || '').toLowerCase().includes(q);
        const matchOwnerEmail = (g.farm?.user?.email || farmObj?.user?.email || '').toLowerCase().includes(q);
        const matchApiKey = (g.apiKey || revealedKeys[g.id] || '').toLowerCase().includes(q);

        return matchName || matchFarm || matchZone || matchOwnerName || matchOwnerEmail || matchApiKey;
      }

      return true;
    });
  }, [gateways, selectedUserFilter, selectedFarmFilter, selectedStatusFilter, searchQuery, allFarms, revealedKeys]);

  // Metrics
  const onlineCount = useMemo(() => gateways.filter((g) => g.status === 'ONLINE').length, [gateways]);
  const offlineCount = useMemo(() => gateways.filter((g) => g.status === 'OFFLINE').length, [gateways]);
  const unassignedCount = useMemo(() => gateways.filter((g) => !g.farmId).length, [gateways]);

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-green-600 dark:text-green-500" />
            {isSuperAdmin ? 'Inventario de Gateways LoRa' : 'Gateways de tu Establecimiento'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Alta de hardware receptor, provisión de API Keys y asignación organizada a productores y campos.'
              : 'Dispositivos receptores que capturan la telemetría LoRa en tus potreros y la envían a la nube.'}
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Registrar Gateway
          </button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Gateways</span>
            <Cpu className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">{gateways.length}</div>
          <p className="text-[11px] text-zinc-400">Hardware registrado en plataforma</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>En Línea</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineCount}</div>
          <p className="text-[11px] text-zinc-400">Transmitiendo telemetría reciente</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
            <span>Fuera de Línea</span>
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block"></span>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{offlineCount}</div>
          <p className="text-[11px] text-zinc-400">Sin señal en los últimos 15 min</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wider">
            <span>Stock Libre</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{unassignedCount}</div>
          <p className="text-[11px] text-zinc-400">Listos para asignar a clientes</p>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros de Búsqueda y Asignación
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, clave, campo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 2. Filter by User / Productor (SuperAdmin only) */}
          {isSuperAdmin && (
            <div>
              <select
                value={selectedUserFilter}
                onChange={(e) => {
                  setSelectedUserFilter(e.target.value);
                  setSelectedFarmFilter('ALL'); // Reset farm filter when changing user
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

          {/* 3. Filter by Field / Campo (Filtered by selected user) */}
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

          {/* 4. Filter by Status */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
            >
              <option value="ALL">📡 Todos los Estados</option>
              <option value="ONLINE">🟢 En línea ({onlineCount})</option>
              <option value="OFFLINE">🔴 Fuera de línea ({offlineCount})</option>
              <option value="NO_DATA">⚪ Sin datos</option>
            </select>
          </div>
        </div>

        {/* Clear filters pill if any is applied */}
        {(searchQuery || selectedUserFilter !== 'ALL' || selectedFarmFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-500">
              Mostrando <strong>{filteredGateways.length}</strong> de <strong>{gateways.length}</strong> gateways
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedUserFilter('ALL');
                setSelectedFarmFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
              className="text-xs text-green-600 dark:text-green-400 hover:underline cursor-pointer font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Gateways Grid / Cards */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
          <SkeletonRowList count={4} />
        </div>
      ) : filteredGateways.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <RadioOff className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600" />
          <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">
            No se encontraron gateways con los filtros seleccionados
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {isSuperAdmin
              ? 'Podés ajustar los filtros o dar de alta un nuevo dispositivo usando el botón "Registrar Gateway".'
              : 'No hay gateways asociados a tus campos actualmente. Contactate con soporte para solicitar equipamiento.'}
          </p>
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4" />
              Dar de alta nuevo gateway
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGateways.map((g) => {
            const isKeyVisible = !!visibleKeyIds[g.id];
            const currentKey = g.apiKey || revealedKeys[g.id] || '';
            const farmObj = allFarms.find((f) => f.id === g.farmId);
            const ownerName = g.farm?.user?.name || farmObj?.user?.name;
            const ownerEmail = g.farm?.user?.email || farmObj?.user?.email;

            return (
              <div
                key={g.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between"
              >
                {/* Header & Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 dark:text-white text-base">
                          {g.name}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[g.status]}`}
                        >
                          {STATUS_LABELS[g.status]}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {g.lastSeenAt
                          ? `Última telemetría: ${new Date(g.lastSeenAt).toLocaleString('es-AR')}`
                          : 'Nunca reportó telemetría todavía'}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <SignalStrength rssi={g.lastRssi} snr={g.lastSnr} />
                    </div>
                  </div>

                  {/* Assignment Pill Details */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {g.farm?.name ? (
                      <>
                        {ownerName && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                            <UserIcon className="w-3 h-3 text-zinc-500" />
                            {ownerName}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 font-medium">
                          <Building2 className="w-3 h-3" />
                          Campo: {g.farm.name}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-medium">
                        <Layers className="w-3 h-3" />
                        Stock Libre Central (Sin asignar)
                      </span>
                    )}

                    {g.zone?.name && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 font-medium">
                        <MapPin className="w-3 h-3" />
                        Zona: {g.zone.name}
                      </span>
                    )}
                  </div>

                  {/* API Key Box */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-green-600 dark:text-green-500" />
                        API Key (Header X-API-Key)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleToggleRevealKey(g)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                          title={isKeyVisible ? 'Ocultar clave' : 'Mostrar clave'}
                        >
                          {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            const keyToCopy = currentKey || g.apiKey;
                            if (keyToCopy) {
                              void handleCopyKey(keyToCopy, g.id);
                            } else {
                              void handleToggleRevealKey(g).then(() => {
                                const fetched = revealedKeys[g.id];
                                if (fetched) void handleCopyKey(fetched, g.id);
                              });
                            }
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                          title="Copiar API Key"
                        >
                          {copiedKeyId === g.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all select-all">
                      {isKeyVisible && currentKey
                        ? currentKey
                        : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => void handleOpenSetupModal(g)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors cursor-pointer"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    Setup ESP32
                  </button>

                  <div className="flex items-center gap-1">
                    {isSuperAdmin && (
                      <button
                        onClick={() => void handleOpenEditModal(g)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        title="Editar nombre, clave o reasignar campo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar / Asignar
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        onClick={() => void handleDelete(g.id, g.name)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar gateway"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR NUEVO GATEWAY (SUPERADMIN)             */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar Gateway en Flota</h3>
                  <p className="text-xs text-zinc-500">
                    Definí el nombre, la clave de telemetría y asígnalo fácilmente a un productor o a stock.
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

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* 1. Nombre del Gateway */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Nombre del Gateway *
                </label>
                <input
                  required
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ej: Gateway Receptor Potrero Norte"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              {/* 2. API Key personalizable / autogenerada */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                    API Key del Dispositivo (X-API-Key) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateApiKey(generateRandomApiKey())}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Generar Aleatoria
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    required
                    type={showCreateApiKey ? 'text' : 'password'}
                    value={createApiKey}
                    onChange={(e) => setCreateApiKey(e.target.value)}
                    placeholder="Clave hex de 64 caracteres o clave secreta..."
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-20 py-2.5 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateApiKey(!showCreateApiKey)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                      title={showCreateApiKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showCreateApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyKey(createApiKey, 'create-modal')}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                      title="Copiar"
                    >
                      {copiedKeyId === 'create-modal' ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Esta clave será requerida en el portal WiFi <code>AgroGuard-Setup</code> (192.168.4.1) del ESP32.
                </p>
              </div>

              {/* 3. Modo de Asignación */}
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
                      setCreateZoneId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      createAssignMode === 'STOCK'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      Stock Libre Central
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Hardware listo en la empresa para asignar más adelante.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateAssignMode('ASSIGN')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      createAssignMode === 'ASSIGN'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-emerald-500" />
                      Asignar a Productor
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Vincular directamente a un cliente y a uno de sus campos.
                    </div>
                  </button>
                </div>

                {/* Si elige asignar a productor */}
                {createAssignMode === 'ASSIGN' && (
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
                    {/* Selector de Usuario / Productor */}
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
                          setCreateZoneId('');
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

                    {/* Selector de Campo del Productor */}
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

                    {/* Selector de Zona del Campo (Opcional) */}
                    {createFarmId && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                          3. Zona del Campo (Opcional)
                        </label>
                        <select
                          value={createZoneId}
                          onChange={(e) => setCreateZoneId(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                        >
                          <option value="">Sin zona asignada (Todo el campo)</option>
                          {createFarmZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || (createAssignMode === 'ASSIGN' && (!createUserId || !createFarmId))}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Dar de Alta Gateway'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDITAR Y REASIGNAR GATEWAY (SUPERADMIN)           */}
      {/* ========================================================= */}
      {editingGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  Editar / Reasignar Gateway
                </h3>
                <p className="text-xs text-zinc-500">
                  Modificá el nombre, la API Key o transferí este dispositivo a otro productor o campo.
                </p>
              </div>
              <button
                onClick={() => setEditingGateway(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Nombre del Gateway *
                </label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                    API Key del Dispositivo (X-API-Key)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditApiKey(generateRandomApiKey())}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerar Clave
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showEditApiKey ? 'text' : 'password'}
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-20 py-2.5 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowEditApiKey(!showEditApiKey)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                    >
                      {showEditApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyKey(editApiKey, 'edit-modal')}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                    >
                      {copiedKeyId === 'edit-modal' ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
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
                      setEditZoneId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editAssignMode === 'STOCK'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      Stock Libre Central
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5">Desvincular de cualquier campo.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAssignMode('ASSIGN')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editAssignMode === 'ASSIGN'
                        ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-300 ring-2 ring-green-600/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
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
                          setEditZoneId('');
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

                    {editFarmId && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                          3. Zona del Campo (Opcional)
                        </label>
                        <select
                          value={editZoneId}
                          onChange={(e) => setEditZoneId(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                        >
                          <option value="">Sin zona asignada (Todo el campo)</option>
                          {editFarmZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingGateway(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating || (editAssignMode === 'ASSIGN' && (!editUserId || !editFarmId))}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CREDENCIALES Y GUÍA DE SETUP ESP32               */}
      {/* ========================================================= */}
      {setupModalGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    Credenciales & Setup ESP32
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Dispositivo: <strong>{setupModalGateway.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSetupModalGateway(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Asignación Actual */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs flex items-center justify-between">
              <span className="text-zinc-500">Campo asignado:</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {setupModalGateway.farmName ? (
                  <>
                    {setupModalGateway.farmName}
                    {setupModalGateway.userName ? ` (${setupModalGateway.userName})` : ''}
                  </>
                ) : (
                  'Stock Libre Central'
                )}
              </span>
            </div>

            {/* API Key Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                API Key para el Header X-API-Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  type="text"
                  value={setupModalGateway.apiKey}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono select-all focus:outline-none"
                />
                <button
                  onClick={() => void handleCopyKey(setupModalGateway.apiKey, 'setup-modal')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKeyId === 'setup-modal'
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900'
                  }`}
                >
                  {copiedKeyId === 'setup-modal' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKeyId === 'setup-modal' ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Instrucciones Técnicas para ESP32 */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-4 space-y-2 text-xs text-emerald-900 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Pasos para configurar el Gateway ESP32:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                <li>
                  Encendé el receptor ESP32. Creará la red WiFi <code>AgroGuard-Setup</code>.
                </li>
                <li>
                  Conectate con tu celular o computadora y abrí <code>http://192.168.4.1</code>.
                </li>
                <li>
                  Pegá esta <strong>API Key</strong> en el campo del portal y configurá la red WiFi o 4G del campo.
                </li>
                <li>
                  El gateway comenzará a emitir telemetría al endpoint <code>POST /api/iot/telemetry</code> y se pondrá en línea automáticamente.
                </li>
              </ol>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSetupModalGateway(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
