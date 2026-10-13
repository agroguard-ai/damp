'use client';

import { useEffect, useRef, useState } from 'react';

export interface TimeSeriesPoint {
  /** Instante (ms) del punto. */
  t: number;
  value: number;
  /** Punto atenuado (p. ej. un bloque sin datos reales que se rellenó). */
  muted?: boolean;
}

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  kind: 'line' | 'bars';
  /** Nombre accesible del gráfico. */
  ariaLabel: string;
  yMin?: number;
  yMax?: number;
  /** Línea de referencia horizontal (p. ej. el umbral de detección). */
  reference?: { value: number; label: string };
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  height?: number;
}

const MARGIN = { top: 10, right: 10, bottom: 22, left: 38 };

/**
 * Gráfico de una sola serie en el tiempo (línea o barras), en SVG y sin librerías.
 * Sigue el estilo de los gráficos del sistema: trazo de 2 px, grilla tenue, barras con la
 * punta redondeada apoyadas en la base, línea de referencia punteada y tooltip al pasar el
 * mouse. El color de la serie es el slot 1 de la paleta validada (azul), con su paso propio
 * para modo oscuro; los textos usan colores de texto, nunca el de la serie.
 */
export default function TimeSeriesChart({
  points,
  kind,
  ariaLabel,
  yMin,
  yMax,
  reference,
  formatValue,
  formatTime,
  height = 150,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const values = points.map((p) => p.value);
  const lo = yMin ?? Math.min(...values, reference?.value ?? Infinity);
  const hi = yMax ?? Math.max(...values, reference?.value ?? -Infinity);
  const span = hi - lo || 1;
  const yOf = (v: number) => MARGIN.top + innerH - ((v - lo) / span) * innerH;

  const n = points.length;
  const band = n > 0 ? innerW / n : 0;
  const xOf = (i: number) =>
    MARGIN.left + (kind === 'bars' ? band * i + band / 2 : n > 1 ? (innerW * i) / (n - 1) : innerW / 2);

  const yTicks = [lo, lo + span / 2, hi];
  const xTickCount = Math.min(n, width < 360 ? 3 : 5);
  const xTicks = Array.from({ length: xTickCount }, (_, k) =>
    xTickCount > 1 ? Math.round((k * (n - 1)) / (xTickCount - 1)) : 0
  );

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = kind === 'bars' ? Math.floor(x / band) : Math.round((x / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div ref={containerRef} className="relative w-full text-[#2a78d6] dark:text-[#3987e5]" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible">
          {/* Grilla y eje Y (recesivos) */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={yOf(v)}
                y2={yOf(v)}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 6}
                y={yOf(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-500 dark:fill-zinc-400 text-[10px]"
              >
                {formatValue(v)}
              </text>
            </g>
          ))}

          {/* Eje X */}
          {xTicks.map((i) => (
            <text
              key={i}
              x={xOf(i)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="fill-zinc-500 dark:fill-zinc-400 text-[10px]"
            >
              {formatTime(points[i].t)}
            </text>
          ))}

          {/* Serie */}
          {kind === 'line' ? (
            <path
              d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(p.value)}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            points.map((p, i) => {
              const barW = Math.max(1, band - 2); // 2 px de separación entre barras
              const x = MARGIN.left + band * i + 1;
              const yTop = yOf(Math.max(p.value, lo));
              const yBase = yOf(lo);
              const h = Math.max(0, yBase - yTop);
              const r = Math.min(4, barW / 2, h);
              return (
                <path
                  key={p.t}
                  d={`M${x},${yBase} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yBase} Z`}
                  fill="currentColor"
                  opacity={p.muted ? 0.3 : hover === i ? 1 : 0.85}
                />
              );
            })
          )}

          {/* Línea de referencia */}
          {reference && (
            <g>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={yOf(reference.value)}
                y2={yOf(reference.value)}
                className="stroke-zinc-500 dark:stroke-zinc-400"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={width - MARGIN.right}
                y={yOf(reference.value) - 4}
                textAnchor="end"
                className="fill-zinc-600 dark:fill-zinc-300 text-[10px] font-semibold"
              >
                {reference.label}
              </text>
            </g>
          )}

          {/* Crosshair + marcador */}
          {hovered && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={xOf(hover)}
                x2={xOf(hover)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerH}
                className="stroke-zinc-400 dark:stroke-zinc-500"
                strokeWidth={1}
              />
              {kind === 'line' && (
                <circle
                  cx={xOf(hover)}
                  cy={yOf(hovered.value)}
                  r={4.5}
                  fill="currentColor"
                  className="stroke-white dark:stroke-zinc-900"
                  strokeWidth={2}
                />
              )}
            </g>
          )}

          {/* Área de captura del mouse (más grande que las marcas) */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 shadow-md text-[11px] whitespace-nowrap"
          style={{ left: Math.min(Math.max(xOf(hover), 60), width - 60), top: 0 }}
        >
          <div className="text-zinc-500 dark:text-zinc-400">{formatTime(hovered.t)}</div>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {formatValue(hovered.value)}
            {hovered.muted && <span className="font-normal text-zinc-400"> (sin datos, rellenado)</span>}
          </div>
        </div>
      )}
    </div>
  );
}
