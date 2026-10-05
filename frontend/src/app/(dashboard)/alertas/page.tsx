'use client';

import { useState, useCallback, useMemo } from 'react';
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
import FalsePositiveModal from '@/components/alerts/FalsePositiveModal';
import PredictiveHealthMonitoring from '@/components/alerts/PredictiveHealthMonitoring';
import { Bell, BrainCircuit, AlertTriangle, CheckCircle2, SlidersHorizontal, Clock, Zap } from 'lucide-react';
import type { Alert, AlertType } from '@/types';

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

  const [activeTab, setActiveTab] = useState<'alerts' | 'predictive'>('alerts');
  const [selectedAlertForFalsePositive, setSelectedAlertForFalsePositive] = useState<Alert | null>(null);

  const fetchAnimals = useCallback(
    () => (activeFarmId ? animalsApi.getAll({ farmId: activeFarmId, status: 'ACTIVE' }) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmAnimals = [] } = useApi(fetchAnimals, [activeFarmId]);

  const [filters, setFilters] = useState({
    animalId: '',
    type: '',
    resolved: '',
    source: '',
  });

  const fetchAlerts = useCallback(
    () =>
      activeFarmId
        ? alertsApi.getAll({
            farmId: activeFarmId,
            ...(filters.animalId && { animalId: filters.animalId }),
            ...(filters.type && { type: filters.type as AlertType }),
            ...(filters.resolved === 'fp'
              ? { isFalsePositive: true }
              : filters.resolved !== ''
                ? { resolved: filters.resolved === 'true', isFalsePositive: false }
                : {}),
            ...(filters.source ? { source: filters.source as any } : {}),
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

  const activeAlertsCount = useMemo(() => alerts.filter((a) => !a.isResolved).length, [alerts]);

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="las Alertas de Campo" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header y Selector de Granja */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span>Centro de Notificaciones y Salud Predictiva</span>
            {activeAlertsCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                {activeAlertsCount} activa{activeAlertsCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Detección preventiva por Inteligencia Artificial (CU014), alertas de cerco y umbrales biométricos.
          </p>
        </div>

        {farms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campo:</span>
            <select
              value={activeFarmId}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white text-sm font-semibold cursor-pointer shadow-xs focus:ring-2 focus:ring-green-500/20"
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <>
          {/* Navegación por Pestañas */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'alerts'
                  ? 'border-green-600 text-green-700 dark:text-green-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Historial de Alertas</span>
              {activeAlertsCount > 0 && (
                <span className="bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('predictive')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'predictive'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <BrainCircuit className="w-4 h-4 text-purple-600" />
              <span>Salud Predictiva (Machine Learning)</span>
              <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold">
                CU014
              </span>
            </button>
          </div>

          {activeTab === 'predictive' ? (
            <PredictiveHealthMonitoring farmId={activeFarmId} animals={farmAnimals} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Barra de Filtros */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Origen de Alerta */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Origen / Fuente
                    </label>
                    <select
                      value={filters.source}
                      onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="ML">🤖 Modelo Predictivo (IA)</option>
                      <option value="THRESHOLD">⚡ Sensor / Umbral Físico</option>
                      <option value="ESCAPE">🏃 Escape de Cerco</option>
                    </select>
                  </div>

                  {/* Animal */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Animal</label>
                    <select
                      value={filters.animalId}
                      onChange={(e) => setFilters({ ...filters, animalId: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value="">Todos los animales</option>
                      {farmAnimals.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.tag || `Animal (${a.id.slice(0, 5)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Tipo de Evento
                    </label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value="">Todos los tipos</option>
                      <option value="HEALTH">Salud</option>
                      <option value="ESCAPE">Escape de cerco</option>
                      <option value="SYSTEM">Sistema</option>
                    </select>
                  </div>

                  {/* Estado */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Estado de Resolución
                    </label>
                    <select
                      value={filters.resolved}
                      onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value="">Todas las alertas</option>
                      <option value="false">🚨 Solo activas (Sin resolver)</option>
                      <option value="true">✓ Resueltas / Validadas</option>
                      <option value="fp">⚠️ Falsos Positivos</option>
                    </select>
                  </div>
                </div>

                {/* Lista de Alertas */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-5 space-y-4">
                  {loading ? (
                    <SkeletonRowList count={4} />
                  ) : alerts.length === 0 ? (
                    <div className="py-12 text-center text-sm text-zinc-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-green-500" />
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        No hay alertas que coincidan con los filtros seleccionados.
                      </p>
                      <p className="text-xs text-zinc-500">
                        El rodeo se encuentra dentro de los perímetros asignados y con parámetros de salud normales.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.map((a) => {
                        const isMl = a.message.includes('[IA:');
                        const isThreshold = a.message.includes('[UMBRAL:');
                        const isEscape = a.type === 'ESCAPE';

                        // Extraer porcentaje si existe
                        const confidenceMatch = a.message.match(/confianza\s*(\d+)%/i);
                        const confidencePct = confidenceMatch ? confidenceMatch[1] : null;

                        return (
                          <div
                            key={a.id}
                            className={`border rounded-xl p-4 transition-all ${
                              a.isFalsePositive
                                ? 'border-amber-200 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10'
                                : a.isResolved
                                  ? 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/20'
                                  : isMl
                                    ? 'border-purple-200 dark:border-purple-900/50 bg-purple-50/20 dark:bg-purple-950/10'
                                    : isEscape
                                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10'
                                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Badge de Origen */}
                                  {isMl ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      <BrainCircuit className="w-3 h-3" />
                                      <span>IA PREDICTIVA</span>
                                    </span>
                                  ) : isThreshold ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      <Zap className="w-3 h-3" />
                                      <span>UMBRAL FÍSICO</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                        TYPE_CLASSES[a.type]
                                      }`}
                                    >
                                      {TYPE_LABELS[a.type]}
                                    </span>
                                  )}

                                  {/* Certeza de Predicción */}
                                  {confidencePct && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      {confidencePct}% certeza
                                    </span>
                                  )}

                                  {/* Horizonte futuro */}
                                  {isMl && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded text-zinc-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>Próximas 6hs</span>
                                    </span>
                                  )}

                                  {/* Estado de Resolución */}
                                  {a.isFalsePositive ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>Falso Positivo</span>
                                    </span>
                                  ) : a.isResolved ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Resuelta</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                                      Activa
                                    </span>
                                  )}
                                </div>

                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                                  {a.message}
                                </p>

                                {a.isFalsePositive && a.feedbackNote && (
                                  <p className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                    <b>Feedback operario:</b> {a.feedbackNote}
                                  </p>
                                )}

                                <p className="text-[11px] text-zinc-400 pt-0.5">
                                  Animal: <b>{a.animal?.tag || `ID: ${a.animalId.slice(0, 8)}`}</b>
                                  {a.animal?.animalType && ` (${a.animal.animalType.name})`} · Emitida el{' '}
                                  {new Date(a.createdAt).toLocaleString()}
                                </p>
                              </div>

                              {/* Acciones */}
                              {!a.isResolved && (
                                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                                  <button
                                    onClick={() => handleResolve(a.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                                  >
                                    Marcar resuelta
                                  </button>

                                  {/* Botón Marcar Falso Positivo (CU014) */}
                                  <button
                                    onClick={() => setSelectedAlertForFalsePositive(a)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1"
                                    title="Marca la alerta como falso positivo para incorporar feedback en el reentrenamiento"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Falso positivo</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Configuración de Umbrales */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-6 sticky top-6">
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-green-600" />
                      <span>Configuración de Umbrales</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Umbrales heurísticos instantáneos que complementan las predicciones del modelo IA.
                    </p>
                  </div>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Umbral de fiebre (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={effectiveSettingsForm.feverThreshold}
                        onChange={(e) => setSettingsForm({ ...effectiveSettingsForm, feverThreshold: e.target.value })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Umbral de hipotermia (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={effectiveSettingsForm.hypothermiaThreshold}
                        onChange={(e) =>
                          setSettingsForm({ ...effectiveSettingsForm, hypothermiaThreshold: e.target.value })
                        }
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Inactividad (minutos)
                      </label>
                      <input
                        type="number"
                        value={effectiveSettingsForm.inactivityMinutes}
                        onChange={(e) =>
                          setSettingsForm({ ...effectiveSettingsForm, inactivityMinutes: e.target.value })
                        }
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={effectiveSettingsForm.emailOnEscape}
                          onChange={(e) =>
                            setSettingsForm({ ...effectiveSettingsForm, emailOnEscape: e.target.checked })
                          }
                        />
                        Enviar correo en escapes de cerco
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={effectiveSettingsForm.emailOnHealth}
                          onChange={(e) =>
                            setSettingsForm({ ...effectiveSettingsForm, emailOnHealth: e.target.checked })
                          }
                        />
                        Enviar correo en alertas de salud
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all focus:outline-none disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                    >
                      {savingSettings ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Guardar Configuración'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal para Marcar Falso Positivo y Guardar Feedback (CU014) */}
      <FalsePositiveModal
        alert={selectedAlertForFalsePositive}
        isOpen={Boolean(selectedAlertForFalsePositive)}
        onClose={() => setSelectedAlertForFalsePositive(null)}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
