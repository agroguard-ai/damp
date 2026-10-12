const stats = [
  { value: '<5s', label: 'Latencia objetivo de alertas' },
  { value: '24/7', label: 'Monitoreo continuo por diseño' },
  { value: '99.9%', label: 'Disponibilidad objetivo' },
  { value: '100%', label: 'Aislamiento de datos multi-tenant' },
  { value: '6hs', label: 'Anticipación en alertas de salud por IA' },
];

export function StatsStrip() {
  const items = [...stats, ...stats];

  return (
    <section className="relative py-10 overflow-hidden">
      {/* Screen-reader only: real content, not duplicated for the marquee */}
      <ul className="sr-only">
        {stats.map((stat) => (
          <li key={stat.label}>
            {stat.value} — {stat.label}
          </li>
        ))}
      </ul>

      <div aria-hidden className="[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee gap-16 hover:[animation-play-state:paused]">
          {items.map((stat, index) => (
            <div key={index} className="flex items-center gap-4 shrink-0 whitespace-nowrap">
              <span className="text-3xl font-bold text-primary-700">{stat.value}</span>
              <span className="text-sm text-muted">{stat.label}</span>
              <span className="text-border">•</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
