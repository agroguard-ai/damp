'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { KeyRound, Copy, Check, AlertTriangle, Building2, MapPin, Radio, Trash2, Edit3, X, RadioOff, Search } from 'lucide-react';
import type { GatewayStatus, Gateway } from '@/types';

const STATUS_LABELS: Record<GatewayStatus, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Fuera de línea',
  NO_DATA: 'Sin datos',
};

const STATUS_CLASSES: Record<GatewayStatus, string> = {
  ONLINE:
    'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
  OFFLINE: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  NO_DATA: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/30',
};

export default function GatewaysPage() {
  const { user, emulatedUser } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;

  const { toast } = useToast();
  const confirm = useConfirm();

  // Load farms (SuperAdmin loads platform farms; Farmer loads user farms)
  const [allFarms, setAllFarms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch gateways list
  const { data: gateways = [], loading, refetch } = useApi(gatewaysApi.getAll);

  // Mutations
  const { mutate: createGateway, loading: submitting, error: createError } = useMutation(gatewaysApi.create);
  const { mutate: updateGateway, loading: updating } = useMutation(
    (params: { id: string; data: { name?: string; farmId?: string | null; zoneId?: string | null } }) =>
      gatewaysApi.update(params.id, params.data)
  );
  const { mutate: deleteGateway } = useMutation(gatewaysApi.delete);

  // Form registration state
  const [name, setName] = useState('');
  const [targetFarmId, setTargetFarmId] = useState('');
  const [targetZoneId, setTargetZoneId] = useState('');
  const [farmZones, setFarmZones] = useState<Array<{ id: string; name: string }>>([]);

  // Assignment modal / edit state
  const [assigningGateway, setAssigningGateway] = useState<Gateway | null>(null);
  const [editFarmId, setEditFarmId] = useState<string>('');
  const [editZoneId, setEditZoneId] = useState<string>('');
  const [editFarmZones, setEditFarmZones] = useState<Array<{ id: string; name: string }>>([]);

  // Modal API key state
  const [createdGatewayKey, setCreatedGatewayKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load farms list
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

  // Load zones for registration form when targetFarmId changes
  useEffect(() => {
    async function loadZones() {
      if (!targetFarmId) {
        setFarmZones([]);
        setTargetZoneId('');
        return;
      }
      try {
        const zones = await zonesApi.getByFarm(targetFarmId);
        setFarmZones(zones.map((z) => ({ id: z.id, name: z.name })));
      } catch {
        setFarmZones([]);
      }
    }
    void loadZones();
  }, [targetFarmId]);

  // Load zones for edit/assignment modal when editFarmId changes
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await createGateway({
        name: name.trim(),
        farmId: targetFarmId || undefined,
        zoneId: targetZoneId || undefined,
      });
      setName('');
      setTargetFarmId('');
      setTargetZoneId('');
      toast.success('Gateway registrado con éxito');
      if (created?.apiKey) {
        setCreatedGatewayKey({ name: created.name, apiKey: created.apiKey });
      }
      refetch();
    } catch {}
  };

  const handleOpenAssignModal = (g: Gateway) => {
    setAssigningGateway(g);
    setEditFarmId(g.farmId || '');
    setEditZoneId(g.zoneId || '');
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningGateway) return;

    try {
      await updateGateway({
        id: assigningGateway.id,
        data: {
          farmId: editFarmId || null,
          zoneId: editZoneId || null,
        },
      });
      toast.success('Asignación del gateway actualizada');
      setAssigningGateway(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al reasignar gateway');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      toast.success('API Key copiada al portapapeles');
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      toast.error('No se pudo copiar la clave');
    }
  };

  const handleDelete = async (id: string, gatewayName: string) => {
    const ok = await confirm({
      title: `Eliminar gateway ${gatewayName}`,
      description: 'Se perderá el vínculo y el historial de heartbeat de este dispositivo físico. ¿Continuar?',
      confirmLabel: 'Eliminar Gateway',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGateway(id);
      toast.success('Gateway eliminado');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const filteredGateways = useMemo(() => {
    return gateways.filter((g) => {
      if (selectedFarmFilter === 'UNASSIGNED' && g.farmId) return false;
      if (selectedFarmFilter !== 'ALL' && selectedFarmFilter !== 'UNASSIGNED' && g.farmId !== selectedFarmFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.name.toLowerCase().includes(q);
        const matchFarm = g.farm?.name?.toLowerCase().includes(q);
        const matchZone = g.zone?.name?.toLowerCase().includes(q);
        return matchName || matchFarm || matchZone;
      }
      return true;
    });
  }, [gateways, selectedFarmFilter, searchQuery]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-green-600 dark:text-green-500" />
            {isSuperAdmin ? 'Inventario de Gateways LoRa (Flota Global)' : 'Gateways LoRa de tu Establecimiento'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Alta de hardware, provisión de API Keys y asignación de gateways a establecimientos y zonas.'
              : 'Gateways que retransmiten la telemetría LoRa al sistema en tus potreros y zonas.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-5">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de gateway, campo o zona..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {allFarms.length > 0 && (
                <select
                  value={selectedFarmFilter}
                  onChange={(e) => setSelectedFarmFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                >
                  <option value="ALL">Todos los campos ({gateways.length})</option>
                  {isSuperAdmin && (
                    <option value="UNASSIGNED">Stock libre sin asignar ({gateways.filter((g) => !g.farmId).length})</option>
                  )}
                  {allFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* List */}
            {loading ? (
              <SkeletonRowList count={3} />
            ) : filteredGateways.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 space-y-2">
                <RadioOff className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm font-semibold">No se encontraron gateways con los filtros actuales.</p>
                <p className="text-xs text-zinc-400">
                  {isSuperAdmin
                    ? 'Podés dar de alta un nuevo gateway físico en el formulario de la derecha.'
                    : 'Contactate con administración para la asignación de hardware a tu campo.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGateways.map((g) => (
                  <div
                    key={g.id}
                    className="border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl p-4 transition-all bg-white dark:bg-zinc-900/60"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-white text-sm tracking-wide">
                            {g.name}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[g.status]}`}
                          >
                            {STATUS_LABELS[g.status]}
                          </span>

                          {g.farm?.name ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                              <Building2 className="w-3 h-3" />
                              {g.farm.name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                              Stock libre central
                            </span>
                          )}

                          {g.zone?.name && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              <MapPin className="w-3 h-3" />
                              Zona: {g.zone.name}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-450 dark:text-zinc-500">
                          {g.lastSeenAt ? (
                            <>Última telemetría / heartbeat: {new Date(g.lastSeenAt).toLocaleString('es-AR')}</>
                          ) : (
                            'Nunca reportó actividad'
                          )}
                        </p>

                        <div className="pt-1">
                          <SignalStrength rssi={g.lastRssi} snr={g.lastSnr} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleOpenAssignModal(g)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            title="Reasignar campo o zona"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Asignar
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            onClick={() => void handleDelete(g.id, g.name)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Eliminar gateway"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: SuperAdmin registration form vs Info Panel */}
        <div className="lg:col-span-1">
          {isSuperAdmin ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar en Flota</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Alta de hardware gateway interno de la empresa. La asignación a campo y zona es opcional.
                </p>
              </div>

              {createError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-xl text-xs">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Nombre del Gateway *
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Gateway Potrero Norte"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
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
                </div>

                {targetFarmId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Zona dentro del Campo (Opcional)
                    </label>
                    <select
                      value={targetZoneId}
                      onChange={(e) => setTargetZoneId(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer"
                    >
                      <option value="">Sin zona asignada</option>
                      {farmZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Registrar Gateway'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4 sticky top-6">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Estado de Recepción LoRa</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Los gateways reciben la señal de los collares de tu ganado en un radio de varios kilómetros y la suben a AgroGuard mediante WiFi o enlace celular.
              </p>
              <div className="p-3.5 rounded-xl bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 text-xs text-green-800 dark:text-green-300">
                Gateways instalados: <strong>{gateways.length}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA REASIGNAR CAMPO Y ZONA AL GATEWAY (SUPERADMIN) */}
      {assigningGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Asignar Gateway</h3>
                <p className="text-xs text-zinc-500">
                  Dispositivo: <strong>{assigningGateway.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setAssigningGateway(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Campo / Establecimiento
                </label>
                <select
                  value={editFarmId}
                  onChange={(e) => {
                    setEditFarmId(e.target.value);
                    setEditZoneId('');
                  }}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Sin asignar (Stock libre central)</option>
                  {allFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {editFarmId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Zona del Campo
                  </label>
                  <select
                    value={editZoneId}
                    onChange={(e) => setEditZoneId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer"
                  >
                    <option value="">Sin zona asignada</option>
                    {editFarmZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningGateway(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                >
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CREDENCIALES DEL GATEWAY */}
      {createdGatewayKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                    API Key del Gateway
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Dispositivo: <strong>{createdGatewayKey.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreatedGatewayKey(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                ¡Copiá esta clave ahora!
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-450">
                Por seguridad, esta es la única vez que el sistema mostrará la API Key completa. Deberás pegarla en el campo <strong>API Key del Gateway</strong> al conectarte a la red WiFi <code>AgroGuard-Setup</code> (192.168.4.1) del ESP32.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                API Key Generada (X-API-Key)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  type="text"
                  value={createdGatewayKey.apiKey}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono select-all focus:outline-none"
                />
                <button
                  onClick={() => void copyToClipboard(createdGatewayKey.apiKey)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900'
                  }`}
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setCreatedGatewayKey(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Entendido y guardado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
