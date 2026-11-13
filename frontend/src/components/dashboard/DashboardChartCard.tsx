'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { reportsApi } from '@/lib/api/reports';

const ALERT_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  ESCAPE: { label: 'Escape de cerco', color: '#e34948' },
  HEALTH: { label: 'Salud', color: '#2a78d6' },
};

interface DashboardChartCardProps {
  farmId: string;
  farmName?: string;
}

export function DashboardChartCard({ farmId, farmName }: DashboardChartCardProps) {
  const fetchDashboard = useCallback(
    () => (farmId ? reportsApi.getDashboard(farmId) : Promise.resolve(null)),
    [farmId]
  );
  const { data: dashboard, loading } = useApi(fetchDashboard, [farmId]);

  if (!farmId) return null;

  const byDay = dashboard?.alertsByDay ?? [];
  const byType = dashboard?.alertsByType ?? [];
  const totalDay = byDay.reduce((sum, d) => sum + d.count, 0);
  const maxDay = Math.max(1, ...byDay.map((d) => d.count));
  const maxType = Math.max(1, ...byType.map((d) => d.count));

  const barWidth = 18;
  const gap = 6;
  const chartHeight = 100;
  const width = Math.max(1, byDay.length) * (barWidth + gap) - gap;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" />
            <span>Actividad de alertas (14 días)</span>
          </h2>
          {farmName && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{farmName}</p>
          )}
        </div>
        <Link
          href="/reportes"
          className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline shrink-0"
        >
          Ver reportes
        </Link>
      </div>

      {loading ? (
        <div className="h-52 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
      ) : (
        <div className="space-y-5">
          <div>
            {totalDay === 0 ? (
              <p className="text-xs text-zinc-400 italic py-10 text-center">
                Sin alertas registradas en los últimos 14 días.
              </p>
            ) : (
              <svg viewBox={`0 0 ${width} ${chartHeight + 20}`} className="w-full" style={{ height: chartHeight + 24 }}>
                <line x1={0} y1={chartHeight} x2={width} y2={chartHeight} stroke="#71717a" strokeOpacity={0.35} strokeWidth={1} />
                {byDay.map((d, i) => {
                  const barHeight = d.count === 0 ? 0 : Math.max(4, (d.count / maxDay) * (chartHeight - 8));
                  const x = i * (barWidth + gap);
                  const y = chartHeight - barHeight;
                  const day = new Date(d.date + 'T00:00:00');
                  const dayLabel = day.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                  const showLabel = i === 0 || i === byDay.length - 1 || i % 3 === 0;
                  return (
                    <g key={d.date}>
                      <title>
                        {dayLabel}: {d.count} {d.count === 1 ? 'alerta' : 'alertas'}
                      </title>
                      {barHeight > 0 && <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill="#16a34a" />}
                      {showLabel && (
                        <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill="#898781">
                          {dayLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Distribución por tipo
            </p>
            {byType.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Sin datos por tipo.</p>
            ) : (
              byType.map((d) => {
                const style = ALERT_TYPE_STYLE[d.type] ?? { label: d.type, color: '#898781' };
                const widthPct = Math.max(4, (d.count / maxType) * 100);
                return (
                  <div key={d.type} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: style.color }} />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{style.label}</span>
                      <span className="ml-auto font-bold text-zinc-900 dark:text-white tabular-nums">{d.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${widthPct}%`, background: style.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
