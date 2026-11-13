'use client';

import { Satellite, ShieldAlert, HeartPulse, Radio, Users, BarChart3 } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const features = [
  {
    icon: Satellite,
    title: 'Geolocalización GPS en vivo',
    description:
      'Visualizá la posición de cada animal en tiempo real sobre mapas interactivos con historial de recorridos por collar.',
  },
  {
    icon: ShieldAlert,
    title: 'Cercos virtuales y alertas de fuga',
    description:
      'Definí geocercas sobre tus potreros y recibí una alerta automática apenas un animal cruza el límite seguro.',
  },
  {
    icon: HeartPulse,
    title: 'Salud animal con IA',
    description:
      'Un modelo de predicción detecta fiebre, hipotermia e inactividad anómala antes de que se convierta en un problema.',
  },
  {
    icon: Radio,
    title: 'Telemetría IoT en tiempo real',
    description:
      'Collares y gateways transmiten posición y biometría en forma continua, con simulación y validación de eventos.',
  },
  {
    icon: Users,
    title: 'Multi-campo y roles por operación',
    description:
      'Administrá varios campos desde una sola cuenta con roles de administrador, operador y lector por campo.',
  },
  {
    icon: BarChart3,
    title: 'Reportes y exportaciones',
    description:
      'Generá reportes de salud, movimiento y alertas por animal, cerco o campo, listos para exportar cuando los necesites.',
  },
];

export function Features() {
  const listRef = useScrollReveal<HTMLDivElement>({ stagger: 0.08 });

  return (
    <section id="producto" className="mx-auto max-w-7xl px-page-sm sm:px-page py-section-sm sm:py-section scroll-mt-20">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Plataforma DAMP Agro</span>
        <h2 className="mt-stack-tight font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Control total de tu hacienda desde una sola pantalla
        </h2>
      </div>

      <div ref={listRef} className="mt-group grid sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs hover:border-border-strong transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-primary-700 dark:text-primary-300">
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="mt-stack text-lg font-semibold tracking-tight">{feature.title}</h3>
            <p className="mt-stack-tight text-sm text-muted leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
