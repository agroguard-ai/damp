import { ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Instalá los collares GPS',
    description: 'Asociá cada collar IoT a un animal y a un campo en minutos, sin configuración compleja.',
  },
  {
    number: '02',
    title: 'Dibujá tus zonas y cercos',
    description: 'Marcá potreros, zonas de riesgo y cercos virtuales directamente sobre el mapa de tu campo.',
  },
  {
    number: '03',
    title: 'Recibí alertas automáticas',
    description: 'El sistema vigila fugas y anomalías de salud las 24 horas y te avisa apenas algo requiere atención.',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-surface-raised/50 border-y border-border scroll-mt-20">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Cómo funciona</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">De la instalación a la primera alerta</h2>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="text-5xl font-bold text-primary-200 dark:text-primary-900/60">{step.number}</div>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted leading-relaxed">{step.description}</p>
              {index < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-2 -right-8 w-5 h-5 text-subtle" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
