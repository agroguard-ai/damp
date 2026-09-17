import { CheckCircle2 } from 'lucide-react';

const plans = [
  {
    name: 'Pequeños productores',
    highlights: ['1 campo activo', 'Hasta 25 collares', 'Alertas de fuga y salud', 'Soporte por email'],
    featured: false,
  },
  {
    name: 'Operación ganadera',
    highlights: [
      'Campos ilimitados',
      'Collares y gateways sin límite',
      'Roles por operador y veterinario',
      'Reportes y exportaciones avanzadas',
    ],
    featured: true,
  },
  {
    name: 'Empresas ganaderas',
    highlights: [
      'Multi-tenant a nivel corporativo',
      'Integraciones IoT personalizadas',
      'SLA y soporte prioritario',
      'Onboarding asistido',
    ],
    featured: false,
  },
];

export function Plans() {
  return (
    <section id="planes" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="max-w-2xl">
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Un plan para cada escala de operación</h2>
        <p className="mt-4 text-muted text-lg">
          Pagás según la cantidad de campos y collares IoT activos. Sin sorpresas, sin contratos forzosos.
        </p>
      </div>

      <div className="mt-14 grid lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-7 border transition-all ${
              plan.featured
                ? 'border-primary-600 bg-primary-950 text-white shadow-xl lg:scale-105'
                : 'border-border bg-surface'
            }`}
          >
            {plan.featured && (
              <span className="inline-block mb-3 px-2.5 py-1 rounded-full bg-primary-600 text-xs font-semibold text-white">
                Más elegido
              </span>
            )}
            <h3 className={`text-xl font-bold ${plan.featured ? 'text-white' : 'text-foreground'}`}>{plan.name}</h3>

            <ul className="mt-6 space-y-3">
              {plan.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? 'text-secondary-300' : 'text-primary-600'}`}
                  />
                  <span className={plan.featured ? 'text-primary-50' : 'text-foreground'}>{item}</span>
                </li>
              ))}
            </ul>

            <a
              href="mailto:ventas@damp.com"
              className={`mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                plan.featured
                  ? 'bg-white text-primary-900 hover:bg-primary-50'
                  : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700'
              }`}
            >
              Hablar con ventas
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
