'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { alertsApi } from '@/lib/api/alerts';
import type { HealthPrediction, MlHealthMetrics } from '@/types';

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

  const loadData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        alertsApi.getMlMetrics(farmId).catch(() => null),
        alertsApi
          .getPredictions({
            farmId,
            ...(selectedAnimal ? { animalId: selectedAnimal } : {}),
            limit: 100,
          })
          .catch(() => []),
      ]);
      setMetrics(m);
      setPredictions(p || []);
    } catch (err) {
      console.error('Error fetching ML predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [farmId, selectedAnimal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPredictions = predictions.filter((pred) => {
    if (selectedEvent && pred.predictedEvent !== selectedEvent) return false;
    if (filterDetected === 'detected' && !pred.detected) return false;
    if (filterDetected === 'subthreshold' && pred.detected) return false;
    return true;
  });

  return (
    <div className="space-y-6">
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
            <select
              value={selectedAnimal}
              onChange={(e) => setSelectedAnimal(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="">Todos los animales</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag || `Animal ${a.id.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Selector Evento */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-semibold">Evento:</span>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="">Todos los eventos</option>
              <option value="fiebre">Fiebre</option>
              <option value="celo">Celo</option>
              <option value="inactividad">Inactividad</option>
              <option value="anomalia">Anomalía</option>
            </select>
          </div>

          {/* Selector Tipo de Certeza */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-semibold">Certeza:</span>
            <select
              value={filterDetected}
              onChange={(e) => setFilterDetected(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="all">Todas las predicciones</option>
              <option value="detected">🚨 Alta certeza (Alerta disparada)</option>
              <option value="subthreshold">📋 Baja certeza (Guardadas para revisión)</option>
            </select>
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
                      Raza: {pred.animal?.breed || 'N/A'} · Sexo: {pred.animal?.sex || 'N/A'} · Ventana:{' '}
                      {pred.windowReadingsCount} lecturas analizadas (24hs)
                    </p>

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

                    <div className="text-right text-[11px] text-zinc-400 shrink-0">
                      <p>{new Date(pred.createdAt).toLocaleDateString()}</p>
                      <p>{new Date(pred.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
