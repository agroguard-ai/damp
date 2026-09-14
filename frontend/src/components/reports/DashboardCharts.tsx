import type { FarmDashboard } from '@/lib/api/reports';

// Paleta categórica validada (contraste + separación CVD) para los 2 tipos de alerta.
// Rojo ya es el color de "peligro" en el resto de la app (mapa, íconos de alerta);
// azul es una identidad nueva y bien separada para no confundirse con nada existente.
const ALERT_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  ESCAPE: { label: 'Escape de cerco', color: '#e34948' },
  HEALTH: { label: 'Salud', color: '#2a78d6' },
};
const FALLBACK_STYLE = { color: '#898781' };

const SERIES_GREEN = '#16a34a';

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200/50 dark:border-zinc-850">
      <span className="text-[10px] text-zinc-450 dark:text-zinc-500 uppercase font-semibold tracking-wider">
        {label}
      </span>
      <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{value.toLocaleString('es-AR')}</div>
    </div>
  );
}

function AlertsByTypeChart({ data }: { data: FarmDashboard['alertsByType'] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Alertas por tipo</h3>
      {total === 0 ? (
        <p className="text-xs text-zinc-400 italic py-6 text-center">Todavía no hay alertas registradas.</p>
      ) : (
        <div className="space-y-3 pt-1">
          {data.map((d) => {
            const style = ALERT_TYPE_STYLE[d.type] ?? { label: d.type, color: FALLBACK_STYLE.color };
            const widthPct = Math.max(4, (d.count / max) * 100);
            return (
              <div key={d.type} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: style.color }} />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{style.label}</span>
                  <span className="ml-auto font-bold text-zinc-900 dark:text-white">{d.count}</span>
                </div>
                <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-850 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${widthPct}%`, background: style.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertsByDayChart({ data }: { data: FarmDashboard['alertsByDay'] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  const barWidth = 18;
  const gap = 6;
  const chartHeight = 90;
  const width = data.length * (barWidth + gap) - gap;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Alertas por día (últimos 14 días)</h3>
      {total === 0 ? (
        <p className="text-xs text-zinc-400 italic py-6 text-center">Todavía no hay alertas registradas.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${chartHeight + 20}`} className="w-full" style={{ height: chartHeight + 20 }}>
          {/* Línea base */}
          <line x1={0} y1={chartHeight} x2={width} y2={chartHeight} stroke="#c3c2b7" strokeWidth={1} />
          {data.map((d, i) => {
            const barHeight = d.count === 0 ? 0 : Math.max(4, (d.count / max) * (chartHeight - 8));
            const x = i * (barWidth + gap);
            const y = chartHeight - barHeight;
            const day = new Date(d.date + 'T00:00:00');
            const dayLabel = day.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            const showLabel = i === 0 || i === data.length - 1 || i % 3 === 0;
            return (
              <g key={d.date}>
                <title>
                  {dayLabel}: {d.count} {d.count === 1 ? 'alerta' : 'alertas'}
                </title>
                {barHeight > 0 && <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={SERIES_GREEN} />}
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
  );
}

export default function DashboardCharts({ data }: { data: FarmDashboard }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-3 mb-1 border-b border-zinc-100 dark:border-zinc-800">
          Resumen del establecimiento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-3">
          <KpiTile label="Animales activos" value={data.totalAnimals} />
          <KpiTile label="Collares asignados" value={data.assignedCollars} />
          <KpiTile label="Zonas" value={data.totalZones} />
          <KpiTile label="Cercos activos" value={data.activeGeofences} />
          <KpiTile label="Alertas sin resolver" value={data.unresolvedAlerts} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsByTypeChart data={data.alertsByType} />
        <AlertsByDayChart data={data.alertsByDay} />
      </div>
    </div>
  );
}
