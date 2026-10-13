'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  BrainCircuit,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  TrendingUp,
  SearchCode,
  CircleCheck,
  CircleAlert,
} from 'lucide-react';
import { alertsApi } from '@/lib/api/alerts';
import type { HealthPrediction, MlHealthMetrics, MlServiceStatus } from '@/types';
import { Select } from '@/components/ui/Select';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import { EVENT_NAMES, EVENT_ORDER } from './mlEvents';

const PredictionInputsModal = dynamic(() => import('./PredictionInputsModal'), { ssr: false });

const FARM_TZ = 'America/Argentina/Buenos_Aires';
const formatShortDateTime = (t: number) =>
  new Date(t).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FARM_TZ,
  });

/** Momento al que corresponde la predicción: fin de su ventana (o, en las viejas, cuándo se creó). */
const predictionTime = (p: HealthPrediction) => Date.parse(p.windowEndAt ?? p.createdAt);

interface PredictiveHealthMonitoringProps {
  farmId: string;
  animals: Array<{ id: string; tag: string | null }>;
}

const EVENT_LABELS: Record<string, { label: string; color: string; badgeBg: string }> = {
  fiebre: {
    label: 'Fiebre',
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300',
  },
  celo: {
    label: 'Celo',
    color: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/40 text-pink-700 dark:text-pink-300',
  },
  inactividad: {
    label: 'Inactividad Anómala',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg:
      'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300',
  },
  anomalia: {
    label: 'Comportamiento Anómalo',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg:
      'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300',
  },
};

export default function PredictiveHealthMonitoring({ farmId, animals }: PredictiveHealthMonitoringProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<MlHealthMetrics | null>(null);
  const [predictions, setPredictions] = useState<HealthPrediction[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [filterDetected, setFilterDetected] = useState<string>('all'); // 'all' | 'detected' | 'subthreshold'
  const [mlStatus, setMlStatus] = useState<MlServiceStatus | null>(null);
  const [inputsPredictionId, setInputsPredictionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const [m, p, status] = await Promise.all([
        alertsApi.getMlMetrics(farmId).catch(() => null),
        alertsApi
          .getPredictions({
            farmId,
            ...(selectedAnimal ? { animalId: selectedAnimal } : {}),
            limit: selectedAnimal ? 200 : 100,
          })
          .catch(() => []),
        alertsApi.getMlStatus().catch(() => null),
      ]);
      setMetrics(m);
      setPredictions(p || []);
      setMlStatus(status);
    } catch (err) {
      console.error('Error fetching ML predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [farmId, selectedAnimal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Evolución de la probabilidad de cada evento para el animal elegido (una serie por evento)
  const evolution = useMemo(() => {
    if (!selectedAnimal) return [];
    return EVENT_ORDER.map((event) => {
      const series = predictions
        .filter((p) => p.predictedEvent === event)
        .sort((a, b) => predictionTime(a) - predictionTime(b));
      return {
        event,
        points: series.map((p) => ({ t: predictionTime(p), value: p.probability })),
        threshold: series.at(-1)?.threshold ?? null,
        latest: series.at(-1) ?? null,
      };
    }).filter((e) => e.points.length > 0);
  }, [predictions, selectedAnimal]);

  const filteredPredictions = predictions.filter((pred) => {
    if (selectedEvent && pred.predictedEvent !== selectedEvent) return false;
    if (filterDetected === 'detected' && !pred.detected) return false;
    if (filterDetected === 'subthreshold' && pred.detected) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Estado del servicio de IA */}
      {mlStatus &&
        (mlStatus.online && mlStatus.modelLoaded ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="w-4 h-4" />
            <span>
              Modelo de IA activo · analiza ventanas de 24 h ({mlStatus.requiredWindowBlocks ?? 48} bloques de 30 min)
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/25 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                {mlStatus.online
                  ? 'El servicio de IA está corriendo pero no pudo cargar el modelo.'
                  : 'El servicio de IA no responde: no se están generando predicciones nuevas.'}
              </p>
              <p className="text-amber-800/80 dark:text-amber-300/80">
                {mlStatus.online
                  ? mlStatus.error
                  : 'En local se levanta con start.bat (o docker-compose up -d ml-service).'}
              </p>
            </div>
          </div>
        ))}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Alertas IA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Alertas IA Disparadas</span>
            <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{metrics?.totalMlAlerts ?? 0}</p>
          <p className="text-[11px] text-zinc-500">Certeza alta &gt; umbral de detección</p>
        </div>

        {/* Precisión en Campo */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Precisión en Campo</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics?.fieldPrecision !== undefined ? `${metrics.fieldPrecision}%` : '100%'}
          </p>
          <p className="text-[11px] text-zinc-500">Aciertos confirmados vs. falsos positivos</p>
        </div>

        {/* Falsos Positivos Reportados */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Falsos Positivos</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-500">{metrics?.falsePositives ?? 0}</p>
          <p className="text-[11px] text-zinc-500">Feedback registrado para reentrenar</p>
        </div>

        {/* Total Predicciones Evaluadas */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Predicciones Guardadas</span>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{metrics?.totalPredictions ?? 0}</p>
          <p className="text-[11px] text-zinc-500">Horizonte predictivo hacia las próximas 6hs</p>
        </div>
      </div>

      {/* Explicación del Camino Alternativo 1 (CU014) */}
      <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl text-xs space-y-1 text-blue-900 dark:text-blue-300">
        <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-200">
          <TrendingUp className="w-4 h-4" />
          <span>Detección Preventiva de Salud (CU014 — Modelo LSTM Multitarea)</span>
        </div>
        <p className="text-zinc-600 dark:text-zinc-300">
          El sistema evalúa periódicamente ventanas de telemetría de 24 horas y predice si el animal presentará un
          evento de salud en las próximas 6 horas. Cuando la probabilidad supera el umbral, se dispara una alerta
          automática; <b>cuando la certeza es menor (sub-umbral), la predicción se almacena aquí sin alertar</b> para
          permitir la auditoría veterinaria preventiva y el reentrenamiento futuro.
        </p>
      </div>

      {/* Filtros de la Tabla de Predicciones */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector Animal */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-semibold">Animal:</span>
            <Select
              value={String(selectedAnimal)}
              onChange={(v) => setSelectedAnimal(v)}
              options={[
                { value: '', label: 'Todos los animales' },
                ...animals.map((a) => ({ value: String(a.id), label: String(a.tag || `Animal ${a.id.slice(0, 5)}`) })),
              ]}
              size="sm"
            />
          </div>

          {/* Selector Evento */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-semibold">Evento:</span>
            <Select
              value={selectedEvent}
              onChange={(v) => setSelectedEvent(v)}
              options={[
                { value: '', label: 'Todos los eventos' },
                { value: 'fiebre', label: 'Fiebre' },
                { value: 'celo', label: 'Celo' },
                { value: 'inactividad', label: 'Inactividad' },
                { value: 'anomalia', label: 'Anomalía' },
              ]}
              size="sm"
            />
          </div>

          {/* Selector Tipo de Certeza */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-semibold">Certeza:</span>
            <Select
              value={filterDetected}
              onChange={(v) => setFilterDetected(v)}
              options={[
                { value: 'all', label: 'Todas las predicciones' },
                { value: 'detected', label: '🚨 Alta certeza (Alerta disparada)' },
                { value: 'subthreshold', label: '📋 Baja certeza (Guardadas para revisión)' },
              ]}
              size="sm"
            />
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Evolución de las probabilidades del animal elegido */}
      {selectedAnimal ? (
        evolution.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-4 space-y-3">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Evolución de la probabilidad por evento</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evolution.map(({ event, points, threshold, latest }) => (
                <div key={event} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{EVENT_NAMES[event]}</span>
                    {latest && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        última: <b className="text-zinc-900 dark:text-white">{Math.round(latest.probability * 100)}%</b>
                        {latest.detected && ' · alerta'}
                      </span>
                    )}
                  </div>
                  <TimeSeriesChart
                    kind="line"
                    points={points}
                    yMin={0}
                    yMax={1}
                    reference={
                      threshold !== null
                        ? { value: threshold, label: `umbral ${Math.round(threshold * 100)}%` }
                        : undefined
                    }
                    ariaLabel={`Probabilidad de ${EVENT_NAMES[event]} en el tiempo`}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    formatTime={formatShortDateTime}
                    height={130}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Elegí un animal en el filtro para ver cómo evolucionó la probabilidad de cada evento.
        </p>
      )}

      {/* Lista / Tabla de Predicciones */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Historial de Predicciones Guardadas</span>
            <span className="text-xs text-zinc-400 font-normal">({filteredPredictions.length} registros)</span>
          </h4>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="w-7 h-7 border-3 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
            <BrainCircuit className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p>No se encontraron predicciones con los filtros seleccionados.</p>
            <p className="text-[11px] text-zinc-500">
              Las predicciones se generan y guardan automáticamente cada vez que los collares transmiten telemetría con
              al menos 24hs de lecturas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {filteredPredictions.map((pred) => {
              const eventConfig = EVENT_LABELS[pred.predictedEvent] || {
                label: pred.predictedEvent,
                color: 'text-zinc-600',
                badgeBg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
              };
              const pct = Math.round(pred.probability * 100);
              const threshPct = Math.round(pred.threshold * 100);

              return (
                <div
                  key={pred.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">
                        {pred.animal?.tag || `Animal ${pred.animalId.slice(0, 5)}`}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${eventConfig.badgeBg}`}>
                        {eventConfig.label}
                      </span>
                      {pred.detected ? (
                        <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 font-bold px-1.5 py-0.2 rounded">
                          🚨 Alerta Disparada
                        </span>
                      ) : (
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium px-1.5 py-0.2 rounded">
                          📋 Guardada sin alertar (Preventiva)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Raza: {pred.animal?.breed || 'N/A'} · Sexo: {pred.animal?.sex || 'N/A'} · Ventana de 24 h:{' '}
                      {pred.windowReadingsCount} de 48 bloques con datos
                    </p>
                    <button
                      type="button"
                      onClick={() => setInputsPredictionId(pred.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      <SearchCode className="w-3.5 h-3.5" />
                      ¿En qué se basó?
                    </button>

                    {pred.alert?.isFalsePositive && (
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Marcada como falso positivo: {pred.alert.feedbackNote}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 min-w-[220px]">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Certeza:</span>
                        <span
                          className={`font-mono font-bold ${pred.detected ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                        >
                          {pct}% (Umbral: {threshPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            pred.detected ? 'bg-red-500' : pct >= threshPct * 0.7 ? 'bg-amber-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-zinc-400 shrink-0" title="Fin de la ventana analizada">
                      <p>{formatShortDateTime(predictionTime(pred))}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {inputsPredictionId && (
        <PredictionInputsModal predictionId={inputsPredictionId} onClose={() => setInputsPredictionId(null)} />
      )}
    </div>
  );
}
