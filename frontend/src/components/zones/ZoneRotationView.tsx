'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  RotateCw,
  Clock,
  FastForward,
  Pause,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Calendar,
  Trash2,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { zoneRotationsApi } from '@/lib/api/zone-rotations';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import type { Zone, Geofence, Animal, ZoneRotationResponse } from '@/types';

// Load map dynamically to prevent SSR errors
const ZoneRotationMap = dynamic(() => import('@/components/maps/ZoneRotationMap'), {
  ssr: false,
});

interface ZoneRotationViewProps {
  zone: Zone;
  geofences: Geofence[];
  animals: Animal[];
  onRefreshGeofences?: () => void;
}

export default function ZoneRotationView({
  zone,
  geofences,
  animals,
  onRefreshGeofences,
}: ZoneRotationViewProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState<boolean>(true);
  const [rotationData, setRotationData] = useState<ZoneRotationResponse | null>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // Form State for creating a new rotation plan
  const [planName, setPlanName] = useState<string>('');
  const [frequencyHours, setFrequencyHours] = useState<number>(24);
  const [selectedGeofenceIds, setSelectedGeofenceIds] = useState<string[]>([]);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Postpone state
  const [showPostponeModal, setShowPostponeModal] = useState<boolean>(false);
  const [postponeHours, setPostponeHours] = useState<number>(1);

  // Load rotation status for this zone
  const loadRotation = useCallback(async () => {
    if (!zone?.id) return;
    setLoading(true);
    try {
      const data = await zoneRotationsApi.getRotation(zone.id);
      setRotationData(data);
    } catch (err) {
      console.error('Error fetching zone rotation:', err);
      setRotationData(null);
    } finally {
      setLoading(false);
    }
  }, [zone?.id]);

  useEffect(() => {
    loadRotation();
  }, [loadRotation]);

  // Derived preconditions
  const hasAnimals = animals.length > 0;
  const animalsWithCollar = useMemo(
    () => animals.filter((a) => a.animalCollars && a.animalCollars.some((ac) => !ac.endAt)),
    [animals]
  );
  const hasEnoughGeofences = geofences.length >= 2;

  // Toggle geofence selection for rotation sequence
  const toggleGeofenceSelection = (geofenceId: string) => {
    setSelectedGeofenceIds((prev) => {
      if (prev.includes(geofenceId)) {
        return prev.filter((id) => id !== geofenceId);
      } else {
        return [...prev, geofenceId];
      }
    });
  };

  // Move geofence up/down in sequence
  const moveGeofenceOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedGeofenceIds.length) return;

    setSelectedGeofenceIds((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Handler for creating a rotation plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    // Precondición 1: Animales asignados
    if (!hasAnimals) {
      const msg = 'La zona no posee animales asignados. Asigne hacienda antes de iniciar la rotación.';
      setFormError(msg);
      toast.warning(msg);
      return;
    }

    // Precondición 2 / Camino Alternativo 1: Mínimo dos perímetros
    if (selectedGeofenceIds.length < 2) {
      const msg =
        'Se necesitan al menos dos perímetros dentro de la zona para poder configurar una rotación de pastoreo.';
      setFormError(msg);
      toast.warning(msg);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await zoneRotationsApi.createRotation(zone.id, {
        name: planName.trim() || `Rotación de Pastoreo - ${zone.name}`,
        frequencyHours,
        geofenceIds: selectedGeofenceIds,
        autoRotate,
      });

      toast.success('¡Plan de rotación de pastoreo iniciado con éxito!');
      setPlanName('');
      setSelectedGeofenceIds([]);
      await loadRotation();
      onRefreshGeofences?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar la rotación';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Camino Alternativo 2: Adelantar rotación manualmente
  const handleAdvanceRotation = async () => {
    const nextName = rotationData?.nextGeofence?.name || 'siguiente cerco';
    const ok = await confirm({
      title: 'Adelantar Rotación al Siguiente Perímetro',
      description: `¿Estás seguro de que deseás avanzar el pastoreo hacia "${nextName}" ahora mismo? Los animales serán trasladados al nuevo cerco y el calendario de rotación se mantendrá coordinado.`,
      confirmLabel: 'Adelantar ahora',
      danger: false,
    });
    if (!ok) return;

    try {
      const res = await zoneRotationsApi.advanceRotation(zone.id);
      toast.success(res.message || 'Rotación avanzada exitosamente.');
      await loadRotation();
      onRefreshGeofences?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al adelantar la rotación');
    }
  };

  // Camino Alternativo 2: Posponer rotación manualmente
  const handlePostponeRotation = async () => {
    try {
      const res = await zoneRotationsApi.postponeRotation(zone.id, {
        hours: postponeHours,
      });
      toast.success(res.message);
      setShowPostponeModal(false);
      await loadRotation();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al posponer la rotación');
    }
  };

  // Pausar / Reanudar
  const handleTogglePause = async () => {
    const isPaused = rotationData?.plan?.status === 'PAUSED';
    try {
      if (isPaused) {
        await zoneRotationsApi.resumeRotation(zone.id);
        toast.success('Rotación de pastoreo reanudada.');
      } else {
        await zoneRotationsApi.pauseRotation(zone.id);
        toast.info('Rotación de pastoreo pausada.');
      }
      await loadRotation();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado de rotación');
    }
  };

  // Finalizar / Cancelar
  const handleCancelRotation = async () => {
    const ok = await confirm({
      title: 'Finalizar Plan de Rotación',
      description:
        '¿Deseás dar por terminado el ciclo de rotación actual en este potrero? Los animales conservarán su cerco actual pero no rotarán automáticamente.',
      confirmLabel: 'Finalizar ciclo',
      danger: true,
    });
    if (!ok) return;

    try {
      await zoneRotationsApi.cancelRotation(zone.id);
      toast.success('Plan de rotación finalizado.');
      await loadRotation();
      onRefreshGeofences?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al finalizar la rotación');
    }
  };

  const plan = rotationData?.plan;
  const isPlanActiveOrPaused = plan && (plan.status === 'ACTIVE' || plan.status === 'PAUSED');

  // Convert raw animals into AnimalLocation shape for map
  const mapAnimals = useMemo(() => {
    return animals.map((a) => ({
      id: a.id,
      tag: a.tag,
      breed: a.breed,
      weightKg: a.weightKg,
      status: a.status,
      animalType: a.animalType ? { name: a.animalType.name, species: a.animalType.species } : null,
      zone: a.zone ? { name: a.zone.name } : null,
      latestReading: null, // Will render collar icon based on zone
    }));
  }, [animals]);

  return (
    <div className="space-y-6">
      {/* Precondition verification banners */}
      {!hasAnimals && (
        <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Precondición no cumplida: Sin hacienda en la zona</p>
            <p>
              El potrero <b>{zone.name}</b> no posee animales asignados. Para implementar pastoreo rotativo, es
              necesario que la hacienda esté asignada a este potrero.
            </p>
            <Link
              href={`/animals`}
              className="text-amber-700 dark:text-amber-400 font-semibold underline inline-flex items-center gap-1 mt-1"
            >
              <span>Ir a gestión de animales para asignar a esta zona</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {!hasEnoughGeofences && (
        <div className="bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 flex items-start gap-3 text-blue-900 dark:text-blue-200 text-xs">
          <Layers className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Se necesitan al menos dos cercos virtuales</p>
            <p>
              Actualmente este potrero tiene <b>{geofences.length}</b> cerco(s) delimitado(s). Para establecer una
              secuencia de rotación incremental, necesitás dibujar al menos dos cercos eléctricos en la pestaña
              &ldquo;Cercos Eléctricos&rdquo;.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-3 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
          <span>Consultando estado de rotación del potrero...</span>
        </div>
      ) : isPlanActiveOrPaused ? (
        /* ============================================================ */
        /* PLAN DE ROTACIÓN ACTIVO / EN EJECUCIÓN (CU012 Requerimiento) */
        /* ============================================================ */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Columna Izquierda: Mapa de Rotación con Perímetros Diferenciados */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <RotateCw className="w-5 h-5 text-orange-500 animate-spin-slow" />
                    <span>{plan.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        plan.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {plan.status === 'ACTIVE' ? 'ROTACIÓN EN CURSO' : 'ROTACIÓN PAUSADA'}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Frecuencia: cada <b>{plan.frequencyHours} horas</b> &bull; Paso actual:{' '}
                    <b>
                      {plan.currentStepIndex + 1} de {plan.totalSteps}
                    </b>
                  </p>
                </div>

                {/* Heatmap Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHeatmap((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      showHeatmap
                        ? 'bg-red-500 text-white border-red-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{showHeatmap ? 'Ocultar Puntos Calientes' : 'Ver Puntos Calientes (Pastoreo)'}</span>
                  </button>
                </div>
              </div>

              {/* Map displaying From, Current, Next geofences & Hotspots */}
              <ZoneRotationMap
                zone={zone}
                fromGeofence={rotationData?.fromGeofence}
                currentGeofence={rotationData?.currentGeofence}
                nextGeofence={rotationData?.nextGeofence}
                activeTransitionPolygon={rotationData?.activeTransitionPolygon}
                transitionInfo={rotationData?.transition}
                allGeofences={geofences}
                animals={mapAnimals}
                heatmapPoints={rotationData?.heatmapPoints}
                showHeatmap={showHeatmap}
              />

              {/* Map Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-500/20"></span>
                    <span>1. Partida / Paso previo</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-orange-600 dark:text-orange-400">
                    <span className="w-3 h-3 rounded-full border-2 border-orange-500 bg-orange-500/40 animate-pulse"></span>
                    <span>2. Activo ahora</span>
                  </span>
                  {rotationData?.transition?.isTransitioning && (
                    <span className="flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400">
                      <span className="w-3 h-3 rounded-full border-2 border-dashed border-cyan-500 bg-cyan-500/30"></span>
                      <span>Transición gradual collares (~5 min)</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                    <span className="w-3 h-3 rounded-full border-2 border-dashed border-blue-500 bg-blue-500/20"></span>
                    <span>3. Próximo destino</span>
                  </span>
                </div>

                <div className="text-zinc-400">
                  Total lecturas satelitales analizadas: <b>{rotationData?.heatmapPoints?.length || 0}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Estado de la Rotación, Temporizador y Acciones Manuales (Camino Alternativo 2) */}
          <div className="space-y-4">
            {/* Tarjeta: Dónde partió, Dónde está y A dónde va */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center justify-between">
                <span>Secuencia de Pastoreo</span>
                <span className="text-[10px] text-zinc-400 lowercase font-normal">
                  paso {plan.currentStepIndex + 1}/{plan.totalSteps}
                </span>
              </h4>

              {/* Stepper visual */}
              <div className="space-y-3">
                {/* 1. Desde dónde partió */}
                <div className="p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Desde dónde partió</span>
                    </span>
                    <span>Paso inicial</span>
                  </div>
                  <h5 className="font-bold text-sm text-zinc-900 dark:text-white">
                    {rotationData?.fromGeofence?.name || 'Cerco de Partida (Inicio)'}
                  </h5>
                  <p className="text-[11px] text-zinc-500">
                    Inició el pastoreo el {new Date(plan.startedAt).toLocaleDateString()} a las{' '}
                    {new Date(plan.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* 2. Dónde está ahora */}
                <div className="p-3 rounded-xl border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                      <span>Dónde está ahora</span>
                    </span>
                    <span className="bg-orange-200 dark:bg-orange-900 px-1.5 py-0.2 rounded font-mono">
                      VIGENTE
                    </span>
                  </div>
                  <h5 className="font-bold text-base text-zinc-900 dark:text-white">
                    {rotationData?.currentGeofence?.name || 'Cerco Activo'}
                  </h5>
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 pt-1 border-t border-orange-200/60 dark:border-orange-800/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-orange-600" />
                      <span>Próxima rotación en:</span>
                    </span>
                    <span className="font-bold font-mono text-zinc-900 dark:text-white">
                      {rotationData?.timeRemainingMinutes !== undefined
                        ? `${Math.floor(rotationData.timeRemainingMinutes / 60)}h ${
                            rotationData.timeRemainingMinutes % 60
                          }m`
                        : '--'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Programada para:{' '}
                    {new Date(plan.nextRotationAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* 2.5 Transición gradual LoRa (~5 min) */}
                {rotationData?.transition?.isTransitioning && (
                  <div className="p-3 rounded-xl border border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-950/20 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                      <span className="flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                        <span>Transición gradual de perímetro</span>
                      </span>
                      <span className="bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 px-1.5 py-0.2 rounded font-mono">
                        Paso {rotationData.transition.current5MinStep}/{rotationData.transition.total5MinSteps}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                        <span>Avance hacia {rotationData?.nextGeofence?.name || 'siguiente cerco'}</span>
                        <span className="font-mono">{rotationData.transition.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-cyan-200/80 dark:bg-cyan-900/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-cyan-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${rotationData.transition.progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      📡 Transición gradual activa: los collares reciben las coordenadas intermedias actualizadas en cada reporte telemétrico (~cada 5 min).
                    </p>
                  </div>
                )}

                {/* 3. A dónde va */}
                <div className="p-3 rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    <span>A dónde va</span>
                    <span>Próximo</span>
                  </div>
                  <h5 className="font-bold text-sm text-zinc-900 dark:text-white">
                    {rotationData?.nextGeofence?.name || 'Fin de ciclo de rotación'}
                  </h5>
                  <p className="text-[11px] text-zinc-500">
                    {rotationData?.nextGeofence
                      ? 'Se activará automáticamente al cumplirse la frecuencia horaria.'
                      : 'Último perímetro configurado en este ciclo de rotación.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones de Control Manual (Camino Alternativo 2) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
                Control Operativo de Rotación
              </h4>

              <div className="space-y-2">
                {/* Adelantar Rotación */}
                <button
                  type="button"
                  onClick={handleAdvanceRotation}
                  disabled={!rotationData?.nextGeofence}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Adelantar rotación ahora</span>
                </button>

                {/* Posponer Rotación */}
                <button
                  type="button"
                  onClick={() => setShowPostponeModal(true)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Posponer próximo cambio (+X horas)</span>
                </button>

                {/* Pausar / Reanudar */}
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {plan.status === 'PAUSED' ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-green-600" />
                      <span>Reanudar rotación automática</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pausar rotación temporalmente</span>
                    </>
                  )}
                </button>

                {/* Finalizar / Cancelar Plan */}
                <button
                  type="button"
                  onClick={handleCancelRotation}
                  className="w-full border border-red-200 dark:border-red-800/40 text-red-650 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Finalizar / Cancelar rotación</span>
                </button>
              </div>
            </div>

            {/* Modal / Diálogo para Posponer */}
            {showPostponeModal && (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                  Posponer Rotación de Pastoreo
                </h5>
                <p className="text-[11px] text-zinc-500">
                  Seleccioná cuántas horas deseás extender el pastoreo en el cerco actual sin alterar el resto del
                  calendario:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 4, 24].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setPostponeHours(h)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        postponeHours === h
                          ? 'bg-orange-500 text-white border-orange-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                      }`}
                    >
                      +{h} hs
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePostponeRotation}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors"
                  >
                    Confirmar +{postponeHours}h
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPostponeModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* CONFIGURADOR DE NUEVA ROTACIÓN DE PERÍMETROS (CU012 Flujo 1)  */
        /* ============================================================ */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs p-6 space-y-6">
          <div className="max-w-2xl space-y-1">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-orange-500" />
              <span>Configurar Rotación de Perímetros en {zone.name}</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Definí una secuencia de cercos virtuales que roten automáticamente según una frecuencia establecida,
              acompañando el pastoreo rotativo sin tener que activar manualmente un cerco cada vez.
            </p>
          </div>

          {formError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreatePlan} className="space-y-6 max-w-3xl">
            {/* Nombre y Frecuencia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Nombre del Plan de Rotación
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder={`Ej: Rotación Invierno - ${zone.name}`}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Frecuencia de Rotación (Horas por Cerco)
                </label>
                <select
                  value={frequencyHours}
                  onChange={(e) => setFrequencyHours(parseInt(e.target.value, 10))}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer font-medium"
                >
                  <option value={1}>Cada 1 hora (Rotación rápida / prueba)</option>
                  <option value={4}>Cada 4 horas</option>
                  <option value={8}>Cada 8 horas</option>
                  <option value={12}>Cada 12 horas (Medio día)</option>
                  <option value={24}>Cada 24 horas (1 día completo)</option>
                  <option value={48}>Cada 48 horas (2 días)</option>
                  <option value={72}>Cada 72 horas (3 días)</option>
                  <option value={168}>Cada 7 días (1 semana)</option>
                </select>
              </div>
            </div>

            {/* Selección y Ordenamiento de Cercos (Mínimo 2) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Seleccionar Perímetros para la Secuencia (Mínimo 2)
                </label>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                  {selectedGeofenceIds.length} seleccionado(s)
                </span>
              </div>

              {geofences.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No hay cercos creados en esta zona.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {geofences.map((gf) => {
                    const isSelected = selectedGeofenceIds.includes(gf.id);
                    const orderIndex = selectedGeofenceIds.indexOf(gf.id);

                    return (
                      <div
                        key={gf.id}
                        onClick={() => toggleGeofenceSelection(gf.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-400 dark:border-orange-700 shadow-xs'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by container onClick
                            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                          />
                          <div>
                            <h5 className="font-bold text-xs text-zinc-900 dark:text-white">{gf.name}</h5>
                            <span className="text-[10px] text-zinc-400">
                              {isSelected ? `Paso ${orderIndex + 1} de la secuencia` : 'Hacé clic para agregar'}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()} // Prevent deselecting when clicking reorder arrows
                          >
                            <button
                              type="button"
                              onClick={() => moveGeofenceOrder(orderIndex, 'up')}
                              disabled={orderIndex === 0}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-30"
                              title="Mover antes en la rotación"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGeofenceOrder(orderIndex, 'down')}
                              disabled={orderIndex === selectedGeofenceIds.length - 1}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-30"
                              title="Mover después en la rotación"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Validación instantánea si selecciona 1 solo cerco (Camino Alternativo 1) */}
              {selectedGeofenceIds.length === 1 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Se necesitan al menos dos perímetros para poder rotar. Seleccioná otro cerco.</span>
                </p>
              )}
            </div>

            {/* Checkbox de Rotación Automática */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoRotate"
                checked={autoRotate}
                onChange={(e) => setAutoRotate(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="autoRotate" className="text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                Activar rotación automática periódica según el calendario (el sistema cambia el cerco y asigna los animales automáticamente)
              </label>
            </div>

            {/* Botón de Enviar */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || selectedGeofenceIds.length < 2 || !hasAnimals}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                <span>Iniciar Rotación Programada</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
