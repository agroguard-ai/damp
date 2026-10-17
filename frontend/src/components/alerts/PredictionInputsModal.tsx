'use client';

import { useCallback } from 'react';
import { X, BrainCircuit, Thermometer, Footprints } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { alertsApi } from '@/lib/api/alerts';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import { EVENT_NAMES } from './mlEvents';

const FARM_TZ = 'America/Argentina/Buenos_Aires';

const formatHour = (t: number) =>
  new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: FARM_TZ });
const formatDateTime = (t: number) =>
  new Date(t).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FARM_TZ,
  });

interface PredictionInputsModalProps {
  predictionId: string;
  onClose: () => void;
}

/**
 * "¿En qué se basó?": muestra la ventana de 24 h (48 bloques de 30 min) que analizó el modelo
 * para una predicción — temperatura promedio y metros recorridos por bloque —, para poder
 * revisar si la predicción tiene sentido.
 */
export default function PredictionInputsModal({ predictionId, onClose }: PredictionInputsModalProps) {
  const fetchInputs = useCallback(() => alertsApi.getPredictionInputs(predictionId), [predictionId]);
  const { data, loading, error } = useApi(fetchInputs, [predictionId]);

  const temps =
    data?.blocks.map((b) => ({ t: Date.parse(b.timestamp), value: b.temperature, muted: !b.hasData })) ?? [];
  const distances =
    data?.blocks.map((b) => ({ t: Date.parse(b.timestamp), value: b.distanceMeters, muted: !b.hasData })) ?? [];

  const real = data?.blocks.filter((b) => b.hasData) ?? [];
  const maxTemp = real.length ? Math.max(...real.map((b) => b.temperature)) : null;
  const avgDistance = real.length ? Math.round(real.reduce((s, b) => s + b.distanceMeters, 0) / real.length) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prediction-inputs-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="prediction-inputs-title" className="font-bold text-base text-zinc-900 dark:text-white">
                ¿En qué se basó la predicción?
              </h2>
              {data && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {data.animal.tag || 'Animal'} · {EVENT_NAMES[data.predictedEvent] ?? data.predictedEvent}{' '}
                  {Math.round(data.probability * 100)}% (umbral {Math.round(data.threshold * 100)}%) · 24 h hasta el{' '}
                  {formatDateTime(Date.parse(data.windowEnd))}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-7 h-7 border-3 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">No se pudieron cargar los datos de la predicción.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Bloques con datos
                  </div>
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{data.blocksWithData} de 48</div>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Temp. máxima</div>
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">
                    {maxTemp !== null ? `${maxTemp.toFixed(1)} °C` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Recorrido medio
                  </div>
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">
                    {avgDistance !== null ? `${avgDistance} m / 30 min` : '—'}
                  </div>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-zinc-400" />
                  Temperatura corporal (promedio por bloque de 30 min)
                </h3>
                <TimeSeriesChart
                  kind="line"
                  points={temps}
                  ariaLabel="Temperatura corporal por bloque de 30 minutos en las 24 h analizadas"
                  formatValue={(v) => `${v.toFixed(1)} °C`}
                  formatTime={formatHour}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Footprints className="w-4 h-4 text-zinc-400" />
                  Distancia recorrida (metros por bloque de 30 min)
                </h3>
                <TimeSeriesChart
                  kind="bars"
                  points={distances}
                  yMin={0}
                  ariaLabel="Metros recorridos por bloque de 30 minutos en las 24 h analizadas"
                  formatValue={(v) => `${Math.round(v)} m`}
                  formatTime={formatHour}
                />
              </section>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                El modelo mira estas 24 h para predecir las próximas 6 h. Los bloques sin lecturas (barras claras) se
                completan con el bloque anterior, igual que en el entrenamiento. Además de esto, el modelo usa la hora
                del día y el sexo del animal.
              </p>

              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">
                  Ver los datos como tabla
                </summary>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold">Bloque</th>
                        <th className="px-3 py-1.5 font-semibold text-right">Temperatura</th>
                        <th className="px-3 py-1.5 font-semibold text-right">Distancia</th>
                        <th className="px-3 py-1.5 font-semibold">Datos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {data.blocks.map((b) => (
                        <tr key={b.timestamp}>
                          <td className="px-3 py-1">{formatDateTime(Date.parse(b.timestamp))}</td>
                          <td className="px-3 py-1 text-right font-mono">{b.temperature.toFixed(2)} °C</td>
                          <td className="px-3 py-1 text-right font-mono">{b.distanceMeters} m</td>
                          <td className="px-3 py-1 text-zinc-400">{b.hasData ? 'reales' : 'rellenado'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
