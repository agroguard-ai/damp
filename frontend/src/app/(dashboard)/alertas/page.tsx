'use client';

import { useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { animalsApi } from '@/lib/api/animals';
import { alertsApi } from '@/lib/api/alerts';
import { alertSettingsApi } from '@/lib/api/alert-settings';
import { useToast } from '@/context/ToastContext';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import type { AlertType } from '@/types';

const TYPE_LABELS: Record<AlertType, string> = {
  ESCAPE: 'Escape de cerco',
  HEALTH: 'Salud',
  SYSTEM: 'Sistema',
};

const TYPE_CLASSES: Record<AlertType, string> = {
  ESCAPE: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  HEALTH:
    'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
  SYSTEM: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700/30',
};

export default function AlertasPage() {
  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  const fetchAnimals = useCallback(
    () => (activeFarmId ? animalsApi.getAll({ farmId: activeFarmId, status: 'ACTIVE' }) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmAnimals = [] } = useApi(fetchAnimals, [activeFarmId]);

  const [filters, setFilters] = useState({ animalId: '', type: '', resolved: '' });

  const fetchAlerts = useCallback(
    () =>
      activeFarmId
        ? alertsApi.getAll({
            farmId: activeFarmId,
            ...(filters.animalId && { animalId: filters.animalId }),
            ...(filters.type && { type: filters.type as AlertType }),
            ...(filters.resolved !== '' && { resolved: filters.resolved === 'true' }),
          })
        : Promise.resolve([]),
    [activeFarmId, filters]
  );
  const { data: alerts = [], loading, refetch } = useApi(fetchAlerts, [activeFarmId, filters]);
  const { mutate: resolveAlert } = useMutation(alertsApi.resolve);

  const { data: settings, refetch: refetchSettings } = useApi(
    () => (activeFarmId ? alertSettingsApi.getByFarm(activeFarmId) : Promise.resolve(undefined)),
    [activeFarmId]
  );
  const { mutate: updateSettings, loading: savingSettings } = useMutation(alertSettingsApi.update);
  const [settingsForm, setSettingsForm] = useState<{
    feverThreshold: string;
    hypothermiaThreshold: string;
    inactivityMinutes: string;
    emailOnEscape: boolean;
    emailOnHealth: boolean;
  } | null>(null);

  const effectiveSettingsForm = settingsForm ?? {
    feverThreshold: settings ? String(settings.feverThreshold) : '',
    hypothermiaThreshold: settings ? String(settings.hypothermiaThreshold) : '',
    inactivityMinutes: settings ? String(settings.inactivityMinutes) : '',
    emailOnEscape: settings?.emailOnEscape ?? false,
    emailOnHealth: settings?.emailOnHealth ?? false,
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      toast.success('Alerta marcada como resuelta');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;
    try {
      await updateSettings(activeFarmId, {
        feverThreshold: Number(effectiveSettingsForm.feverThreshold),
        hypothermiaThreshold: Number(effectiveSettingsForm.hypothermiaThreshold),
        inactivityMinutes: Number(effectiveSettingsForm.inactivityMinutes),
        emailOnEscape: effectiveSettingsForm.emailOnEscape,
        emailOnHealth: effectiveSettingsForm.emailOnHealth,
      });
      setSettingsForm(null);
      toast.success('Configuración de alertas guardada');
      refetchSettings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="las Alertas de Campo" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Centro de Notificaciones y Alertas
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Historial de alertas del establecimiento y configuración de los umbrales que las disparan.
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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5 lg:col-span-1">
                <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Establecimiento</label>
                <select
                  value={activeFarmId}
                  onChange={(e) => setSelectedFarm(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Animal</label>
                <select
                  value={filters.animalId}
                  onChange={(e) => setFilters({ ...filters, animalId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Todos</option>
                  {farmAnimals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tag || `Animal (${a.id.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Tipo</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Todos</option>
                  <option value="ESCAPE">Escape de cerco</option>
                  <option value="HEALTH">Salud</option>
                  <option value="SYSTEM">Sistema</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Estado</label>
                <select
                  value={filters.resolved}
                  onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Todas</option>
                  <option value="false">Activas</option>
                  <option value="true">Resueltas</option>
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              {loading ? (
                <SkeletonRowList count={4} />
              ) : alerts.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                  No hay alertas que coincidan con los filtros seleccionados.
                </p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-start border border-zinc-100 dark:border-zinc-800 rounded-lg p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${TYPE_CLASSES[a.type]}`}
                          >
                            {TYPE_LABELS[a.type]}
                          </span>
                          {a.isResolved && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700/30">
                              Resuelta
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 mt-1.5">{a.message}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {a.animal?.tag || 'Animal'} · {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!a.isResolved && (
                        <button
                          onClick={() => handleResolve(a.id)}
                          className="text-xs font-semibold text-green-600 hover:text-green-700 cursor-pointer whitespace-nowrap ml-3"
                        >
                          Marcar resuelta
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Configuración de Umbrales</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                  Se aplican a las lecturas de telemetría de este establecimiento.
                </p>
              </div>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Umbral de fiebre (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={effectiveSettingsForm.feverThreshold}
                    onChange={(e) => setSettingsForm({ ...effectiveSettingsForm, feverThreshold: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Umbral de hipotermia (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={effectiveSettingsForm.hypothermiaThreshold}
                    onChange={(e) =>
                      setSettingsForm({ ...effectiveSettingsForm, hypothermiaThreshold: e.target.value })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Inactividad (minutos)
                  </label>
                  <input
                    type="number"
                    value={effectiveSettingsForm.inactivityMinutes}
                    onChange={(e) => setSettingsForm({ ...effectiveSettingsForm, inactivityMinutes: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effectiveSettingsForm.emailOnEscape}
                      onChange={(e) => setSettingsForm({ ...effectiveSettingsForm, emailOnEscape: e.target.checked })}
                    />
                    Enviar correo en escapes de cerco
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effectiveSettingsForm.emailOnHealth}
                      onChange={(e) => setSettingsForm({ ...effectiveSettingsForm, emailOnHealth: e.target.checked })}
                    />
                    Enviar correo en alertas de salud
                  </label>
                  <p className="text-[10px] text-zinc-400 italic">
                    El envío de correo todavía no está conectado a un proveedor real; por ahora esta preferencia solo
                    queda guardada.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {savingSettings ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Guardar Configuración'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
