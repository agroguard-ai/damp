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

export default function CollaresPage() {
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const { toast } = useToast();
  const confirm = useConfirm();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'collars' | 'claims' | 'requests'>('collars');

  // Filter state for collars
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'AVAILABLE' | 'DAMAGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [claimCollarTarget, setClaimCollarTarget] = useState<Collar | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [resolvingClaim, setResolvingClaim] = useState<CollarClaim | null>(null);
  const [claimResolutionNotes, setClaimResolutionNotes] = useState('');
  const [claimResolutionStatus, setClaimResolutionStatus] = useState<CollarClaimStatus>('RESOLVED');

  // API calls
  const { data: collars = [], loading, refetch } = useApi(collarsApi.getAll);
  const { data: claims = [], loading: loadingClaims, refetch: refetchClaims } = useApi(collarsApi.getClaims);
  const { data: requests = [], loading: loadingRequests, refetch: refetchRequests } = useApi(collarsApi.getRequests);

  const { mutate: createCollar, loading: submitting, error: createError } = useMutation(collarsApi.create);
  const { mutate: updateStatus } = useMutation(collarsApi.updateStatus);

  // SuperAdmin register form state
  const [identifier, setIdentifier] = useState('');
  const [targetFarmId, setTargetFarmId] = useState('');
  const [allFarms, setAllFarms] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: collarDetail, refetch: refetchDetail } = useApi(
    () => (expandedId !== null ? collarsApi.getOne(expandedId) : Promise.resolve(undefined)),
    [expandedId]
  );

  // Load farms (SuperAdmin loads platform farms; Farmer loads user farms)
  useEffect(() => {
    async function loadFarms() {
      try {
        if (isSuperAdmin) {
          const res = await fetch('/api/admin/farms?limit=100');
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            setAllFarms(
              list.map((f: { id: string; name?: string | null }) => ({
                id: f.id,
                name: f.name || 'Sin nombre',
              }))
            );
          }
        } else {
          const data = await farmsApi.getAll();
          const list = Array.isArray(data) ? data : [];
          setAllFarms(list.map((f) => ({ id: f.id, name: f.name || 'Sin nombre' })));
        }
      } catch {
        // ignore
      }
    }
    void loadFarms();
  }, [isSuperAdmin]);

  // Handle register collar
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    try {
      await createCollar({
        identifier: identifier.trim(),
        farmId: targetFarmId || undefined,
      });
      setIdentifier('');
      setTargetFarmId('');
      toast.success('Collar registrado con éxito en el catálogo de hardware');
      refetch();
    } catch {}
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

  // Handle delete collar
  const handleDelete = async (id: number, collarIdentifier: string) => {
    if (!isSuperAdmin) return;
    const ok = await confirm({
      title: `Eliminar collar ${collarIdentifier}`,
      description: 'Esta acción dará de baja el dispositivo físico y lo removerá del inventario. ¿Continuar?',
      confirmLabel: 'Eliminar Collar',
      danger: true,
    });
    if (!ok) return;

    try {
      await collarsApi.delete(id);
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

  // Submit collar request
  const handleCreateRequest = async (data: { farmId: string; requestedCount: number; notes?: string }) => {
    await collarsApi.createRequest(data);
    toast.success('Solicitud enviada a la administración para asignación de collares.');
    refetchRequests();
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

  // Resolve request (SuperAdmin)
  const handleResolveRequest = async (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    incrementMaxCollars = false
  ) => {
    try {
      await collarsApi.updateRequest(requestId, {
        status,
        incrementMaxCollars,
        responseNotes: status === 'APPROVED' ? 'Aprobado y cupo incrementado' : 'Solicitud desestimada',
      });
      toast.success(status === 'APPROVED' ? 'Solicitud aprobada y cupo incrementado' : 'Solicitud rechazada');
      refetchRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar solicitud');
    }
  };

  // Counts
  const placedCount = collars.filter((c) => c.assignedAnimal).length;
  const availableCount = collars.filter((c) => !c.assignedAnimal && c.status === 'AVAILABLE').length;
  const damagedCount = collars.filter((c) => c.status === 'DAMAGED' || c.status === 'OUT_OF_SERVICE').length;
  const pendingClaimsCount = claims.filter((c) => c.status === 'PENDING').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;

  // Filtered collars
  const filteredCollars = useMemo(() => {
    return collars.filter((c) => {
      // Status filter
      if (statusFilter === 'ASSIGNED' && !c.assignedAnimal) return false;
      if (statusFilter === 'AVAILABLE' && (c.assignedAnimal || c.status !== 'AVAILABLE')) return false;
      if (statusFilter === 'DAMAGED' && c.status === 'AVAILABLE') return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchId = c.identifier.toLowerCase().includes(query);
        const matchAnimal = c.assignedAnimal?.tag?.toLowerCase().includes(query);
        const matchFarm = c.farm?.name?.toLowerCase().includes(query);
        return matchId || matchAnimal || matchFarm;
      }
      return true;
    });
  }, [collars, statusFilter, searchQuery]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-green-600 dark:text-green-500" />
            {isSuperAdmin ? 'Inventario de Collares IoT (Flota Global)' : 'Collares IoT de tu Establecimiento'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Gestión de hardware, asignación de flota a clientes, atención de reclamos y altas con lector QR.'
              : 'Dispositivos asignados a tu hacienda. Consultá colocación en animales, última telemetría o reportá fallas.'}
          </p>
        </div>

        {!isSuperAdmin && (
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Solicitar Más Collares
          </button>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 text-xs font-semibold">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: COLLARES */}
          {activeTab === 'collars' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-5">
              {/* Search & Filter bar (optimized for operator) */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por código de collar, caravana o campo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === 'ALL'
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Todos ({collars.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('ASSIGNED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === 'ASSIGNED'
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    En uso ({placedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('AVAILABLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === 'AVAILABLE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Disponibles ({availableCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('DAMAGED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === 'DAMAGED'
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Dañados ({damagedCount})
                  </button>
                </div>
              </div>

              {/* List */}
              {loading ? (
                <SkeletonRowList count={4} />
              ) : filteredCollars.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 space-y-2">
                  <RadioOff className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm font-semibold">No se encontraron collares con los filtros seleccionados.</p>
                  <p className="text-xs text-zinc-400">
                    Intente modificar el término de búsqueda o el filtro de estado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCollars.map((c) => (
                    <div
                      key={c.id}
                      className="border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl p-4 transition-all bg-white dark:bg-zinc-900/60"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-zinc-900 dark:text-white font-mono text-sm tracking-wide">
                              {c.identifier}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[c.status]}`}
                            >
                              {STATUS_LABELS[c.status]}
                            </span>
                            {c.farm?.name && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                                <Building2 className="w-3 h-3" />
                                {c.farm.name}
                              </span>
                            )}
                            {!c.farm?.name && isSuperAdmin && (
                              <span className="text-[11px] text-zinc-400 italic">Stock libre central</span>
                            )}
                          </div>

                          {/* Assignment info */}
                          <div className="text-xs flex items-center gap-2">
                            {c.assignedAnimal ? (
                              <span className="text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                Colocado en: {c.assignedAnimal.tag || `Animal (${c.assignedAnimal.id.slice(0, 5)})`}
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                Disponible para colocar en ganado
                              </span>
                            )}
                          </div>

                          {/* Telemetry Indicator (Explicit & Clean) */}
                          <div className="pt-0.5">
                            {!c.lastTelemetryDate ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium border border-zinc-200/60 dark:border-zinc-700/40">
                                <RadioOff className="w-3 h-3 text-zinc-400" />
                                Sin lecturas de telemetría registradas
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200">
                                  <Radio className="w-3 h-3 text-green-500 animate-pulse" />
                                  Última señal: {new Date(c.lastTelemetryDate).toLocaleString('es-AR')}
                                </span>
                                {c.telemetryReadings?.[0] && (
                                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    · Temp: {c.telemetryReadings[0].temperature.toFixed(1)}°C
                                  </span>
                                )}
                                <span className="text-green-600 dark:text-green-400 font-semibold">· Batería OK</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions per role */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {/* Farmer / Operator: Report fault button */}
                          <button
                            type="button"
                            onClick={() => setClaimCollarTarget(c)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-lg hover:bg-amber-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reportar rotura o falla técnica"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reportar Falla</span>
                          </button>

                          {/* Quick status toggle for Farmer or Admin */}
                          <select
                            value={c.status}
                            onChange={(e) => void handleStatusChange(c.id, e.target.value as CollarStatus)}
                            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                          >
                            <option value="AVAILABLE">Disponible</option>
                            <option value="DAMAGED">Dañado</option>
                            {isSuperAdmin && <option value="OUT_OF_SERVICE">Fuera de servicio</option>}
                          </select>

                          {/* SuperAdmin delete button */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => void handleDelete(c.id, c.identifier)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Eliminar collar de flota"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* History toggle button */}
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Ver historial de asignación"
                          >
                            {expandedId === c.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expandable assignment history */}
                      {expandedId === c.id && collarDetail && (
                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            Historial de colocación en animales
                          </p>
                          {!collarDetail.animalCollars || collarDetail.animalCollars.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic">Este collar nunca fue asignado a un animal.</p>
                          ) : (
                            <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
                              {collarDetail.animalCollars.map((ac) => (
                                <li
                                  key={ac.id}
                                  className="flex justify-between items-center py-1 border-b border-zinc-100/50 dark:border-zinc-800/40 last:border-0"
                                >
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {ac.animal.tag || `Animal (${ac.animal.id.slice(0, 5)})`}
                                  </span>
                                  <span className="text-zinc-400 font-mono text-[11px]">
                                    {new Date(ac.startAt).toLocaleDateString('es-AR')} —{' '}
                                    {ac.endAt ? new Date(ac.endAt).toLocaleDateString('es-AR') : 'Actual'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECLAMOS */}
          {activeTab === 'claims' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Reclamos y Reportes de Avería</h3>
                  <p className="text-xs text-zinc-500">
                    Incidencias técnicas reportadas para reemplazo, reparación o baja de dispositivos.
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
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Solicitudes de Collares</h3>
                  <p className="text-xs text-zinc-500">
                    Pedidos de ampliación de collares contratados para rodeos en crecimiento.
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

                        {/* Admin actions: Approve and increment quota */}
                        {isSuperAdmin && req.status === 'PENDING' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => void handleResolveRequest(req.id, 'APPROVED', true)}
                              className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer"
                            >
                              Aprobar y Ampliar Cupo
                            </button>
                            <button
                              onClick={() => void handleResolveRequest(req.id, 'REJECTED', false)}
                              className="px-2.5 py-1 text-xs font-semibold bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-lg cursor-pointer"
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: SuperAdmin registration form vs Farmer Summary Panel */}
        <div className="lg:col-span-1">
          {isSuperAdmin ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar en Flota</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Ingresá el identificador del collar físico o escaneá su código QR.
                </p>
              </div>

              {createError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-xl text-xs">
                  {createError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Identificador único *
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

                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ej: COLLAR-0042"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Asignar a Campo (Opcional)
                  </label>
                  <select
                    value={targetFarmId}
                    onChange={(e) => setTargetFarmId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer"
                  >
                    <option value="">Sin asignar (Stock libre central)</option>
                    {allFarms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-400">
                    Al asignarlo a un establecimiento, el productor podrá visualizarlo y colocarlo a su ganado.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Registrar en Flota'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Estado de tus Collares</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Resumen de dispositivos IoT disponibles y colocados en tu hacienda.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                    Colocados en animales
                  </div>
                  <span className="font-bold text-base text-green-700 dark:text-green-300 font-mono">
                    {placedCount}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    Libres para colocar
                  </div>
                  <span className="font-bold text-base text-amber-700 dark:text-amber-300 font-mono">
                    {availableCount}
                  </span>
                </div>

                {damagedCount > 0 && (
                  <div className="p-3.5 bg-red-50/60 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-xs font-semibold">
                      <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      Dañados o para recambio
                    </div>
                    <span className="font-bold text-base text-red-700 dark:text-red-300 font-mono">{damagedCount}</span>
                  </div>
                )}
              </div>

              <div className="pt-1 space-y-2">
                <Link
                  href="/animals"
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Asignar Collares a Animales
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                  Solicitar Más Collares
                </button>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-200">
                  <Wrench className="w-3.5 h-3.5 text-zinc-500" />
                  Garantía y Servicio Técnico
                </div>
                <p className="text-[11px] leading-relaxed">
                  Si un collar presenta fallas de batería, señal o rotura de sujeción, hacé clic en &ldquo;Reportar
                  Falla&rdquo; en el collar correspondiente para recibir recambio prioritario.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScan={(code) => {
          setIdentifier(code);
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
