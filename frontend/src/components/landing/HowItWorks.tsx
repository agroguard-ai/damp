'use client';

import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const steps = [
  {
    number: '01',
    title: 'Equipá tus animales',
    description: 'Colocá el collar LoRa en el animal y vinculalo a tu establecimiento desde la app en segundos.',
  },
  {
    number: '02',
    title: 'Delimitá tus potreros',
    description: 'Dibujá los límites virtuales y zonas de riesgo directamente sobre el mapa satelital de tu campo.',
  },
  {
    number: '03',
    title: 'Recibí alertas en tiempo real',
    description: 'El sistema monitorea el rodeo las 24hs y te notifica de inmediato ante cualquier eventualidad.',
  },
];

export function HowItWorks() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.12 });

  return (
    <section id="como-funciona" className="bg-surface-raised/50 border-y border-border scroll-mt-20">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Paso a paso</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
            De la colocación del collar a la primera alerta en 3 pasos
          </h2>
        </div>

        <div ref={gridRef} className="mt-14 grid lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="text-5xl font-bold text-primary-200 dark:text-primary-900/60">{step.number}</div>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted leading-relaxed">{step.description}</p>
              {index < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-2 -right-8 w-5 h-5 text-subtle" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
