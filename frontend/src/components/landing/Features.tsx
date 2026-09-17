import { Satellite, ShieldAlert, HeartPulse, Radio, Users, BarChart3 } from 'lucide-react';

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
      'Administrá varios campos desde una sola cuenta con roles de administrador, operador y visor por establecimiento.',
  },
  {
    icon: BarChart3,
    title: 'Reportes y exportaciones',
    description:
      'Generá reportes de salud, movimiento y alertas por animal, zona o campo, listos para exportar cuando los necesites.',
  },
];

export function Features() {
  return (
    <section id="producto" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Plataforma</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          Todo lo que necesitás para gestionar tu ganado desde un solo lugar
        </h2>
      </div>

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group rounded-2xl border border-border bg-surface p-6 hover:border-primary-300 hover:shadow-lg transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-subtle flex items-center justify-center text-primary-700 group-hover:bg-primary-600 group-hover:text-white transition-colors">
              <feature.icon className="w-5 h-5" />
            </div>
            <h3 className="mt-5 font-semibold text-lg">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
