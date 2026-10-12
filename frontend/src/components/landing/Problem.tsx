'use client';

import { AlertTriangle, Thermometer, ClipboardList, Layers } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const problems = [
  {
    icon: AlertTriangle,
    title: 'Fugas y abigeato sin detectar',
    description:
      'Un alambre roto o un robo nocturno tarda días en descubrirse. Sin alertas inmediatas, recuperar la hacienda es casi imposible.',
  },
  {
    icon: Thermometer,
    title: 'Enfermedades que se notan tarde',
    description:
      'La fiebre, la hipotermia o el letargamiento se observan cuando el cuadro es grave, elevando la mortalidad y el costo veterinario.',
  },
  {
    icon: ClipboardList,
    title: 'Control manual e ineficiente',
    description:
      'A caballo, en camioneta o en planillas Excel: el esquema tradicional requiere horas de trabajo y no deja historial confiable.',
  },
  {
    icon: Layers,
    title: 'Pérdida de control al escalar',
    description:
      'Sumar potreros, collares o puesteros sin una plataforma central multiplica los errores humanos y destruye la trazabilidad.',
  },
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
          Recorrer cientos de hectáreas a caballo o en camioneta deja espacios vacíos de información. En la ganadería
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
            <p className="mt-2 text-sm text-muted leading-relaxed">{problem.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
