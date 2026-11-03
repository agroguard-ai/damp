'use client';

import { AlertTriangle, Thermometer, ClipboardList, Layers } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const problems = [
  { icon: AlertTriangle, title: 'Fugas y abigeato sin detectar' },
  { icon: Thermometer, title: 'Enfermedades que se notan tarde' },
  { icon: ClipboardList, title: 'Control manual e ineficiente' },
  { icon: Layers, title: 'Pérdida de control al escalar' },
];

export function Problem() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
          El problema en el campo
        </span>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
          La ganadería extensiva no puede depender de la suerte o de un aviso tardío
        </h2>
        <p className="mt-4 text-muted text-lg leading-relaxed">
          Recorrer cientos de hectáreas deja espacios vacíos de información. En la ganadería
          tradicional, cuando te enterás de un problema, generalmente ya costó plata.
        </p>
      </div>

      <div ref={gridRef} className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map((problem) => (
          <div
            key={problem.title}
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs hover:border-red-500/30 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
              <problem.icon className="w-5 h-5" />
            </div>
            <h3 className="mt-5 font-semibold text-lg">{problem.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
