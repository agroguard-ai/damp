'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { alertsApi } from '@/lib/api/alerts';
import { useToast } from '@/context/ToastContext';
import type { HealthPrediction, MlHealthMetrics } from '@/types';
import { Select } from '@/components/ui/Select';
import TimeSeriesChart, { type TimeSeriesPoint } from '@/components/charts/TimeSeriesChart';
import { EVENT_NAMES, EVENT_ORDER } from './mlEvents';

const PredictionInputsModal = dynamic(() => import('./PredictionInputsModal'), { ssr: false });

const FARM_TZ = 'America/Argentina/Buenos_Aires';
const formatShortDateTime = (t: number) =>
  new Date(t)
    .toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: FARM_TZ,
    })
    .replace(',', '');

/** Momento al que corresponde la predicción: fin de su ventana (o, en las viejas, cuándo se creó). */
const predictionTime = (p: HealthPrediction) => Date.parse(p.windowEndAt ?? p.createdAt);

interface PredictiveHealthMonitoringProps {
  farmId: string;
  animals: Array<{ id: string; tag: string | null }>;
  initialAnimalId?: string;
  canPredict?: boolean;
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

export default function PredictiveHealthMonitoring({
  farmId,
  animals,
  initialAnimalId = '',
  canPredict = true,
}: PredictiveHealthMonitoringProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [runningPrediction, setRunningPrediction] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<MlHealthMetrics | null>(null);
  const [predictions, setPredictions] = useState<HealthPrediction[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<string>(initialAnimalId);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [inputsPredictionId, setInputsPredictionId] = useState<string | null>(null);
  const [trajectory48h, setTrajectory48h] = useState<{
    available: boolean;
    reason?: string;
    generatedAt?: string;
    stages: Array<{ stage: string; probabilities: Record<string, number> }>;
    summary: Record<string, { max_probability: number; peak_stage: string }>;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const [m, p, traj] = await Promise.all([
        alertsApi.getMlMetrics(farmId).catch(() => null),
        alertsApi
          .getPredictions({
            farmId,
            ...(selectedAnimal ? { animalId: selectedAnimal } : {}),
            limit: selectedAnimal ? 200 : 100,
          })
          .catch(() => []),
        selectedAnimal ? alertsApi.getTrajectory48h(selectedAnimal).catch(() => null) : Promise.resolve(null),
      ]);
      setMetrics(m);
      setPredictions(p || []);
      setTrajectory48h(traj);
    } catch (err) {
      console.error('Error fetching ML predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [farmId, selectedAnimal]);

  useEffect(() => {
    if (initialAnimalId) {
      setSelectedAnimal(initialAnimalId);
    }
  }, [initialAnimalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleForcePrediction = async () => {
    if (!selectedAnimal || runningPrediction) return;
    setRunningPrediction(true);
    try {
      const res = await alertsApi.runPrediction(selectedAnimal);
      const detectedCount = res.predictions.filter((p) => p.detected).length;
      toast.success(
        detectedCount > 0
          ? `Predicción ejecutada: ${detectedCount} evento(s) detectado(s) sobre ${res.blocksWithData} bloques.`
          : `Predicción ejecutada sin eventos críticos (${res.blocksWithData} bloques analizados).`
      );
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo ejecutar la predicción de IA');
    } finally {
      setRunningPrediction(false);
    }
  };

  // Evolución histórica (azul) + proyección futura +6h / +48h (violeta) para el animal elegido
  const evolution = useMemo(() => {
    if (!selectedAnimal) return [];
    const trajBaseT = trajectory48h?.generatedAt ? Date.parse(trajectory48h.generatedAt) : null;

    return EVENT_ORDER.map((event) => {
      const series = predictions
        .filter((p) => p.predictedEvent === event)
        .sort((a, b) => predictionTime(a) - predictionTime(b));

      const latest = series.at(-1) ?? null;
      const historySeries = series.length >= 2 ? series.slice(0, -1) : series;
      const points: TimeSeriesPoint[] = historySeries.map((p) => ({
        t: predictionTime(p),
        value: p.probability,
        projected: false,
      }));

      // Punto proyectado a +6h con el resultado de la última evaluación del modelo de 6h
      if (latest) {
        const lastT = predictionTime(latest);
        points.push({
          t: lastT + 6 * 3_600_000,
          value: latest.probability,
          projected: true,
          tag: '+6h',
        });
      }

      // Tramos futuros de 48h (0-12h, 12-24h, 24-36h, 36-48h) si están disponibles
      if (trajectory48h?.available && trajectory48h.stages.length > 0) {
        const baseT = trajBaseT ?? (latest ? predictionTime(latest) : Date.now());
        trajectory48h.stages.forEach((st, idx) => {
          const val = st.probabilities[event];
          if (typeof val === 'number') {
            points.push({
              t: baseT + (idx + 1) * 12 * 3_600_000,
              value: val,
              projected: true,
              tag: st.stage,
            });
          }
        });
      }

      points.sort((a, b) => a.t - b.t);

      return {
        event,
        points,
        threshold: latest?.threshold ?? null,
        latest,
        peak48h: trajectory48h?.available ? trajectory48h.summary?.[event] ?? null : null,
      };
    }).filter((e) => e.points.length > 0);
  }, [predictions, selectedAnimal, trajectory48h]);

  const latestWindowAnchor = useMemo(() => {
    if (evolution.length === 0) return null;
    let maxT = 0;
    for (const item of evolution) {
      if (item.latest) {
        const t = predictionTime(item.latest);
        if (t > maxT) maxT = t;
      }
    }
    return maxT > 0 ? maxT : null;
  }, [evolution]);

  const filteredPredictions = predictions.filter((pred) => {
    if (!pred.detected) return false;
    if (selectedEvent && pred.predictedEvent !== selectedEvent) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Alertas IA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Alertas IA Disparadas</span>
            <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{metrics?.totalMlAlerts ?? 0}</p>
          <p className="text-[11px] text-zinc-500">Eventos que superaron el umbral de detección</p>
        </div>

        {/* Evaluaciones Realizadas */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Evaluaciones de IA</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics?.totalPredictions ?? 0}
          </p>
          <p className="text-[11px] text-zinc-500">Análisis predictivos con horizonte de 6 horas</p>
        </div>
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
        </div>

        <div className="flex items-center gap-2">
          {selectedAnimal && canPredict && (
            <button
              type="button"
              onClick={handleForcePrediction}
              disabled={runningPrediction || loading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <BrainCircuit className={`w-3.5 h-3.5 ${runningPrediction ? 'animate-pulse' : ''}`} />
              <span>{runningPrediction ? 'Evaluando...' : 'Forzar predicción'}</span>
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Evolución histórica + proyección futura del animal elegido */}
      {selectedAnimal ? (
        evolution.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Pronóstico vigente y evolución por evento
                </h4>
                {latestWindowAnchor && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Última evaluación: <b className="text-zinc-700 dark:text-zinc-200">{formatShortDateTime(latestWindowAnchor)}</b>
                    {' · '}Pronóstico a 6h válido hasta{' '}
                    <b className="text-purple-700 dark:text-purple-300">
                      {formatShortDateTime(latestWindowAnchor + 6 * 3_600_000)}
                    </b>
                    {trajectory48h?.available && ' · Proyección extendida a +48h activa'}
                  </p>
                )}
              </div>

              {/* Leyenda de colores */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 bg-[#2a78d6] dark:bg-[#3987e5] inline-block rounded" />
                  Historial evaluado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 border-t-2 border-dashed border-purple-600 dark:border-purple-400 inline-block" />
                  Proyección futura (+6h{trajectory48h?.available ? ' / +48h' : ''})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 border-t border-dashed border-zinc-500 dark:border-zinc-400 inline-block" />
                  Umbral de alerta
                </span>
              </div>
            </div>

            {/* Resumen del pronóstico vigente para las próximas 6 horas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {evolution.map(({ event, latest, threshold, peak48h }) => {
                if (!latest) return null;
                const pct = Math.round(latest.probability * 100);
                const threshPct = threshold !== null ? Math.round(threshold * 100) : null;
                const isAlert = latest.detected;
                return (
                  <div
                    key={`summary-${event}`}
                    className={`rounded-lg border p-2.5 space-y-1.5 ${
                      isAlert
                        ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                        : 'bg-purple-50/40 dark:bg-purple-950/15 border-purple-200/70 dark:border-purple-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{EVENT_NAMES[event]}</span>
                      <span
                        className={`font-mono font-bold ${
                          isAlert ? 'text-red-600 dark:text-red-400' : 'text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isAlert ? 'bg-red-500' : 'bg-purple-600 dark:bg-purple-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>{isAlert ? 'Supera umbral (+6h)' : `Próx. 6h${threshPct !== null ? ` (umbral ${threshPct}%)` : ''}`}</span>
                      {peak48h && (
                        <span className="text-purple-700 dark:text-purple-300 font-medium">
                          48h máx: {Math.round(peak48h.max_probability * 100)}% ({peak48h.peak_stage})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evolution.map(({ event, points, threshold, latest }) => (
                <div key={event} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{EVENT_NAMES[event]}</span>
                    {latest && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        próx. 6h:{' '}
                        <b className={latest.detected ? 'text-red-600 dark:text-red-400' : 'text-purple-700 dark:text-purple-300'}>
                          {Math.round(latest.probability * 100)}%
                        </b>
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
                    ariaLabel={`Probabilidad de ${EVENT_NAMES[event]} en el tiempo y proyección`}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    formatTime={formatShortDateTime}
                    height={140}
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
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Predicciones con Alerta</span>
            <span className="text-xs text-zinc-400 font-normal">({filteredPredictions.length} registros)</span>
          </h4>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Cada predicción evalúa las últimas 24 horas de telemetría hacia atrás.
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="w-7 h-7 border-3 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
            <BrainCircuit className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p>No se encontraron predicciones que hayan generado alertas con los filtros seleccionados.</p>
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

              const evalEnd = predictionTime(pred);
              const evalStart = evalEnd - 24 * 3_600_000;
              const horizonHours = pred.horizonHours || 6;
              const predEnd = evalEnd + horizonHours * 3_600_000;
              const clampedThresh = Math.min(100, Math.max(0, threshPct));

              return (
                <div
                  key={pred.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-white">
                        {pred.animal?.tag || `Animal ${pred.animalId.slice(0, 5)}`}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eventConfig.badgeBg}`}>
                        {eventConfig.label}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {pred.animal?.breed || 'N/A'} ·{' '}
                        {pred.animal?.sex === 'FEMALE' ? 'Hembra' : pred.animal?.sex === 'MALE' ? 'Macho' : 'N/A'}
                      </span>
                    </div>

                    <div className="w-full max-w-xl space-y-1">
                      <div className="flex items-center text-[10.5px] font-mono tabular-nums text-zinc-400">
                        <div className="flex justify-between pr-2 min-w-0" style={{ flex: '24 1 0%' }}>
                          <span title="Inicio ventana evaluada (24 h)">{formatShortDateTime(evalStart)}</span>
                          <span
                            className="text-zinc-600 dark:text-zinc-300 font-medium"
                            title="Fin evaluación / Inicio pronóstico"
                          >
                            {formatShortDateTime(evalEnd)}
                          </span>
                        </div>
                        <div className="flex justify-end min-w-0" style={{ flex: `${horizonHours} 1 0%` }}>
                          <span
                            className={`font-medium ${
                              pred.detected
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-purple-600 dark:text-purple-400'
                            }`}
                            title={`Fin pronóstico (+${horizonHours} h)`}
                          >
                            {formatShortDateTime(predEnd)}
                          </span>
                        </div>
                      </div>
                      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full bg-sky-500/75 dark:bg-sky-400/75"
                          style={{ flex: '24 1 0%' }}
                          title={`Evaluado (24 h): ${formatShortDateTime(evalStart)} – ${formatShortDateTime(evalEnd)}`}
                        />
                        <div
                          className={`h-full ${pred.detected ? 'bg-red-500' : 'bg-purple-500'}`}
                          style={{ flex: `${horizonHours} 1 0%` }}
                          title={`Pronóstico (+${horizonHours} h): ${formatShortDateTime(evalEnd)} – ${formatShortDateTime(predEnd)}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-4 shrink-0">
                    <div className="w-48 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">Certeza</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            pred.detected ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {pct}% / {threshPct}%
                        </span>
                      </div>
                      <div className="relative w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            pred.detected ? 'bg-red-500' : pct >= threshPct * 0.7 ? 'bg-amber-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                        <div
                          className="absolute -top-0.5 h-2.5 w-0.5 bg-zinc-900 dark:bg-white rounded-full"
                          style={{ left: `${clampedThresh}%` }}
                          title={`Umbral: ${threshPct}%`}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInputsPredictionId(pred.id)}
                      title="¿En qué se basó?"
                      aria-label="¿En qué se basó?"
                      className="p-1.5 -mb-0.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                    >
                      <Search className="w-4 h-4" />
                    </button>
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
