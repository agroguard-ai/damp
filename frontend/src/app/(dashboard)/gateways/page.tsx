'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { zonesApi } from '@/lib/api/zones';
import { gatewaysApi } from '@/lib/api/gateways';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { SignalStrength } from '@/components/gateways/SignalStrength';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck, X } from 'lucide-react';
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
  const { toast } = useToast();
  const confirm = useConfirm();

  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);

  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmZones = [] } = useApi(fetchZones, [activeFarmId]);

  const fetchGateways = useCallback(
    () => (activeFarmId ? gatewaysApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: gateways = [], loading, refetch } = useApi(fetchGateways, [activeFarmId]);

  const { mutate: createGateway, loading: submitting, error: createError } = useMutation(gatewaysApi.create);
  const { mutate: deleteGateway } = useMutation(gatewaysApi.delete);

  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [createdGatewayKey, setCreatedGatewayKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Gestión de Gateways LoRa" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId || !zoneId) return;
    try {
      const created = await createGateway({ name, farmId: activeFarmId, zoneId });
      setName('');
      setZoneId('');
      toast.success('Gateway registrado con éxito');
      if (created?.apiKey) {
        setCreatedGatewayKey({ name: created.name, apiKey: created.apiKey });
      }
      refetch();
    } catch {}
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

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar gateway',
      description: 'Se pierde el historial de heartbeat de este dispositivo. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
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

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Gateways LoRa</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Gateways que retransmiten la telemetría de los collares al sistema, por granja y zona.
        </p>
      </div>

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-4">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider block">
                Seleccionar Campo / Establecimiento
              </label>
              <select
                value={activeFarmId}
                onChange={(e) => setSelectedFarm(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
                Gateways de este Campo
              </h3>
              {loading ? (
                <SkeletonRowList count={3} />
              ) : gateways.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                  Este establecimiento no tiene gateways registrados todavía.
                </p>
              ) : (
                <div className="space-y-3">
                  {gateways.map((g) => (
                    <div
                      key={g.id}
                      className="flex justify-between items-center border border-zinc-100 dark:border-zinc-800 rounded-lg p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white">{g.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLASSES[g.status]}`}
                          >
                            {STATUS_LABELS[g.status]}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1">
                          Zona: {g.zone?.name ?? '—'}
                          {' · '}
                          {g.lastSeenAt ? (
                            <>Última conexión: {new Date(g.lastSeenAt).toLocaleString()}</>
                          ) : (
                            'Nunca reportó actividad'
                          )}
                        </p>
                        <div className="mt-1.5">
                          <SignalStrength rssi={g.lastRssi} snr={g.lastSnr} />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Registrar Gateway</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Asociá el gateway a la zona donde está instalado dentro de este campo.
                </p>
              </div>
              {createError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Nombre
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Gateway Potrero Norte"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Zona
                  </label>
                  <select
                    required
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                  >
                    <option value="" disabled>
                      Seleccionar zona...
                    </option>
                    {farmZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                  {farmZones.length === 0 && (
                    <span className="text-[10px] text-zinc-400 italic mt-0.5">
                      Este campo no tiene zonas todavía. Creá una primero en la sección Zonas.
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting || farmZones.length === 0}
                  className="w-full bg-primary hover:bg-primary-hover text-on-primary font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Registrar Gateway'
                  )}
                </button>
              </form>
            </div>
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
