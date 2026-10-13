'use client';

import { useState, useMemo, type ComponentType, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { X, Undo2, RotateCcw, MousePointerClick, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { isPolygonInsideBoundary, type LatLngTuple } from '@/lib/geo/spatial';
import type { ZoneMapProps } from './ZoneMap';

const ZoneMap = dynamic(() => import('./ZoneMap'), { ssr: false });

const MIN_POINTS = 3;

const ACCENTS = {
  green: {
    icon: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
    input: 'focus:ring-green-500/20 focus:border-green-600',
    submit: 'bg-green-600 hover:bg-green-700 focus:ring-green-500/50',
    ok: 'text-green-600 dark:text-green-400',
  },
  cyan: {
    icon: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',
    input: 'focus:ring-cyan-500/20 focus:border-cyan-600',
    submit: 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500/50',
    ok: 'text-cyan-600 dark:text-cyan-400',
  },
} as const;

export type PolygonMapContext = Pick<
  ZoneMapProps,
  'zones' | 'geofences' | 'farmPolygon' | 'zonePolygon' | 'boundaryType' | 'boundaryLabel' | 'center' | 'selectedZoneId'
>;

export interface PolygonFormModalProps {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENTS;
  nameLabel: string;
  initialName: string;
  initialPoints?: [number, number][];
  /** Polígonos de contexto y límite que se muestran en el mapa del modal. */
  mapContext: PolygonMapContext;
  submitLabel: string;
  submitting: boolean;
  /** Campos extra del formulario (pastura, hacienda, etc.). */
  children?: ReactNode;
  onClose: () => void;
  /** Debe lanzar un Error si falla; el mensaje se muestra dentro del modal. */
  onSubmit: (data: { name: string; points: [number, number][] }) => Promise<void>;
}

/**
 * Modal de alta/edición de un polígono (zona o cerco): mapa para dibujar a la
 * izquierda y datos a la derecha. Se monta condicionalmente, así que su estado
 * arranca limpio en cada apertura.
 */
export default function PolygonFormModal({
  title,
  subtitle,
  icon: Icon,
  accent,
  nameLabel,
  initialName,
  initialPoints = [],
  mapContext,
  submitLabel,
  submitting,
  children,
  onClose,
  onSubmit,
}: PolygonFormModalProps) {
  const { toast } = useToast();
  const colors = ACCENTS[accent];

  const [name, setName] = useState(initialName);
  const [points, setPoints] = useState<[number, number][]>(initialPoints);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const areaHa = useMemo(() => calculatePolygonAreaHa(points), [points]);
  const missingPoints = Math.max(0, MIN_POINTS - points.length);

  // Mismo criterio que ZoneMap para decidir qué polígono actúa como límite.
  const { boundaryType = 'farm', zonePolygon = [], farmPolygon = [], boundaryLabel } = mapContext;
  const boundaryPolygon = boundaryType === 'zone' && zonePolygon.length >= 3 ? zonePolygon : farmPolygon;

  const handleUndo = () => {
    // ZoneMap escucha Ctrl+Z a nivel window y mantiene su propio historial.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  };

  const handleReset = () => {
    setPoints([]);
    setSelectedVertexIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || missingPoints > 0) return;

    if (boundaryPolygon.length >= 3) {
      const containment = isPolygonInsideBoundary(points as LatLngTuple[], boundaryPolygon as LatLngTuple[]);
      if (!containment.isInside) {
        setError(
          `Hay ${containment.outsideCount} punto(s) fuera de los límites ${boundaryLabel ?? ''}. Movelos hacia adentro.`
        );
        return;
      }
    }

    setError(null);
    try {
      await onSubmit({ name: name.trim(), points });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Intentá de nuevo.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="polygon-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="polygon-modal-title" className="font-bold text-base text-zinc-900 dark:text-white truncate">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{subtitle}</p>}
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

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          {/* Mapa */}
          <div className="p-3 lg:p-4">
            <ZoneMap
              {...mapContext}
              heightClassName="h-[45vh] lg:h-[64vh]"
              newPoints={points}
              onChangePoints={setPoints}
              onAddPoint={(pt, msg) => {
                setPoints((prev) => [...prev, pt]);
                if (msg) toast.info(msg);
              }}
              onPointRejected={(_pt, msg) => toast.warning(msg)}
              selectedVertexIndex={selectedVertexIndex}
              onSelectVertex={setSelectedVertexIndex}
            />
          </div>

          {/* Datos */}
          <div className="p-5 lg:border-l border-t lg:border-t-0 border-zinc-100 dark:border-zinc-800 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="polygon-name"
                className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
              >
                {nameLabel}
              </label>
              <input
                id="polygon-name"
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.target.select()}
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 ${colors.input}`}
              />
            </div>

            {children}

            {/* Estado del dibujo */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 space-y-3">
              {points.length === 0 ? (
                <div className="flex items-start gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <MousePointerClick className="w-5 h-5 shrink-0 text-zinc-400" />
                  <p>
                    Hacé clic en el mapa para marcar las esquinas.{' '}
                    <span className="text-zinc-400">Necesitás al menos {MIN_POINTS} puntos.</span>
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Puntos</div>
                      <div className="text-lg font-bold text-zinc-900 dark:text-white">{points.length}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Superficie</div>
                      <div className="text-lg font-bold text-zinc-900 dark:text-white">{areaHa} Ha</div>
                    </div>
                  </div>

                  <p className={`text-xs flex items-center gap-1.5 ${missingPoints > 0 ? 'text-zinc-500' : colors.ok}`}>
                    {missingPoints > 0 ? (
                      `Marcá ${missingPoints} punto(s) más para cerrar el área.`
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Área lista para guardar
                      </>
                    )}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Deshacer (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Deshacer
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Empezar de nuevo
                    </button>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2.5 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 px-3 py-2.5 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || missingPoints > 0 || !name.trim()}
                className={`flex-1 font-semibold py-2.5 px-4 rounded-xl shadow-sm text-white text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer ${colors.submit}`}
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  submitLabel
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
