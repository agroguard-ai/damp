const stats = [
  { value: '<5s', label: 'Latencia objetivo de alertas' },
  { value: '24/7', label: 'Monitoreo continuo por diseño' },
  { value: '99.9%', label: 'Disponibilidad objetivo' },
  { value: '100%', label: 'Aislamiento multi-campo (multi-tenant)' },
];

export function StatsStrip() {
  return (
    <section className="border-y border-border bg-surface-raised/50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:text-left">
              <div className="text-3xl font-bold text-primary-700">{stat.value}</div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
