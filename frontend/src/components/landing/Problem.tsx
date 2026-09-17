import { AlertTriangle, Thermometer, ClipboardList, Layers } from 'lucide-react';

const problems = [
  {
    icon: AlertTriangle,
    title: 'Pérdidas por fugas y abigeato',
    description:
      'Sin visibilidad en tiempo real, un animal perdido en cientos de hectáreas puede tardar días en encontrarse, o no encontrarse nunca.',
  },
  {
    icon: Thermometer,
    title: 'Enfermedades que se detectan tarde',
    description:
      'Fiebre, hipotermia o inactividad anómala suelen notarse cuando el cuadro ya es grave, con más mortalidad y costo veterinario.',
  },
  {
    icon: ClipboardList,
    title: 'Recorridas manuales y planillas sueltas',
    description:
      'A caballo, en camioneta o en un Excel: el control tradicional no escala y no deja un historial confiable para decidir.',
  },
  {
    icon: Layers,
    title: 'Cero visibilidad al crecer',
    description:
      'Sumar potreros, collares o personal sin una plataforma central multiplica el error humano y hace perder trazabilidad.',
  },
];

export function Problem() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-red-600 uppercase tracking-wider">El problema</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          Gestionar un campo a la distancia todavía es un salto de fe
        </h2>
        <p className="mt-4 text-muted text-lg">
          La ganadería extensiva depende de recorridas manuales y datos que llegan tarde. Eso cuesta animales, plata y
          horas de trabajo que se podrían evitar con la información correcta a tiempo.
        </p>
      </div>

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map((problem) => (
          <div key={problem.title} className="rounded-2xl border border-border bg-surface p-6">
            <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
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
