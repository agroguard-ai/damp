import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import {
  Hexagon,
  MapPin,
  ShieldAlert,
  HeartPulse,
  Radio,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Satellite,
  BellRing,
  Lock,
  Sprout,
  Menu,
} from 'lucide-react';

const stats = [
  { value: '<5s', label: 'Latencia de alertas' },
  { value: '24/7', label: 'Monitoreo en vivo' },
  { value: '99.9%', label: 'Disponibilidad' },
  { value: '100%', label: 'Aislamiento multi-campo' },
];

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

const plans = [
  {
    name: 'Pequeños productores',
    description: 'Para empezar a digitalizar un campo con pocos animales y un solo operador.',
    highlights: ['1 campo activo', 'Hasta 25 collares', 'Alertas de fuga y salud', 'Soporte por email'],
    featured: false,
  },
  {
    name: 'Operación ganadera',
    description: 'Para establecimientos en crecimiento con varios potreros y un equipo de trabajo.',
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
    description: 'Para grupos con múltiples establecimientos y necesidades de integración a medida.',
    highlights: [
      'Multi-tenant a nivel corporativo',
      'Integraciones IoT personalizadas',
      'SLA y soporte prioritario',
      'Onboarding asistido',
    ],
    featured: false,
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav isSignedIn={isSignedIn} />
      <Hero />
      <StatsStrip />
      <Features />
      <HowItWorks />
      <Plans />
      <CtaBanner />
      <Footer />
    </div>
  );
}

function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <Hexagon className="w-6 h-6 text-primary-600 fill-primary-600/10 shrink-0" />
      DAMP <span className="text-primary-700">Agro</span>
    </span>
  );
}

function Nav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Brand className="text-lg text-foreground" />

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <a href="#producto" className="hover:text-foreground transition-colors">
            Producto
          </a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">
            Cómo funciona
          </a>
          <a href="#planes" className="hover:text-foreground transition-colors">
            Planes
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-colors shadow-sm"
            >
              Ir al dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-foreground hover:text-primary-700 transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-colors shadow-sm"
              >
                Empezar gratis
              </Link>
            </>
          )}
          <button className="md:hidden p-2 text-muted" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Tech grid background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />
      {/* Glow blobs */}
      <div aria-hidden className="absolute -top-24 -left-32 w-96 h-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div
        aria-hidden
        className="absolute -top-10 right-0 w-[28rem] h-[28rem] rounded-full bg-secondary-400/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary-700 shadow-sm">
              <Sprout className="w-3.5 h-3.5" />
              Ganadería de precisión, potenciada por IA
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Monitoreá tu campo{' '}
              <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-600 bg-clip-text text-transparent">
                en tiempo real
              </span>
              , de punta a punta.
            </h1>

            <p className="mt-6 text-lg text-muted max-w-xl">
              DAMP Agro combina collares GPS, cercos virtuales e inteligencia artificial para que sepas dónde está cada
              animal, cómo está su salud, y te enterés de un problema antes de que sea grave.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-all shadow-md hover:shadow-lg"
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary-600" />
                Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary-600" />
                Configuración en minutos
              </span>
            </div>
          </div>

          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="relative rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface-raised">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-xs font-medium text-subtle">Campo Norte — Mapa en vivo</span>
        </div>

        <div className="relative h-72 sm:h-80 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950 dark:to-neutral-900">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:28px_28px]"
          />
          {/* geofence shape */}
          <div className="absolute inset-6 rounded-[2rem] border-2 border-dashed border-primary-400/60" />

          {/* pins */}
          <MapPin
            className="absolute top-10 left-14 w-6 h-6 text-primary-700 drop-shadow"
            fill="currentColor"
            fillOpacity={0.15}
          />
          <MapPin
            className="absolute top-24 left-1/2 w-6 h-6 text-primary-700 drop-shadow"
            fill="currentColor"
            fillOpacity={0.15}
          />
          <MapPin
            className="absolute bottom-16 left-24 w-6 h-6 text-primary-700 drop-shadow"
            fill="currentColor"
            fillOpacity={0.15}
          />
          <div className="absolute bottom-10 right-16 flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-red-500/30 animate-ping" />
            <MapPin className="relative w-6 h-6 text-red-600 drop-shadow" fill="currentColor" fillOpacity={0.2} />
          </div>
        </div>
      </div>

      {/* Floating alert card */}
      <div className="absolute -top-6 -right-6 w-56 rounded-xl border border-border bg-surface shadow-xl p-3.5 hidden sm:block">
        <div className="flex items-center gap-2 text-red-600">
          <BellRing className="w-4 h-4" />
          <span className="text-xs font-semibold">Alerta de fuga</span>
        </div>
        <p className="mt-1 text-xs text-muted">Collar #A21 cruzó el cerco virtual del Potrero 3.</p>
      </div>

      {/* Floating health card */}
      <div className="absolute -bottom-8 -left-6 w-52 rounded-xl border border-border bg-surface shadow-xl p-3.5 hidden sm:block">
        <div className="flex items-center gap-2 text-primary-700">
          <HeartPulse className="w-4 h-4" />
          <span className="text-xs font-semibold">Salud del rodeo</span>
        </div>
        <p className="mt-1 text-xs text-muted">238/240 animales en rango saludable.</p>
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <section className="border-y border-border bg-surface-raised/50">
      <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center lg:text-left">
            <div className="text-3xl font-bold text-primary-700">{stat.value}</div>
            <div className="mt-1 text-sm text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="producto" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Plataforma</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          Todo lo que necesitás para gestionar tu ganado desde un solo lugar
        </h2>
        <p className="mt-4 text-muted text-lg">
          Del collar al reporte: DAMP Agro conecta telemetría IoT, geolocalización y salud animal en una única
          plataforma pensada para el campo.
        </p>
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

function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-surface-raised/50 border-y border-border">
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

function Plans() {
  return (
    <section id="planes" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Planes</span>
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
            <p className={`mt-2 text-sm ${plan.featured ? 'text-primary-100' : 'text-muted'}`}>{plan.description}</p>

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

            <Link
              href="/sign-up"
              className={`mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                plan.featured
                  ? 'bg-white text-primary-900 hover:bg-primary-50'
                  : 'bg-primary text-on-primary hover:bg-primary-hover'
              }`}
            >
              Hablar con ventas
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-primary-950 px-8 py-16 sm:px-16 text-center">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_50%,black,transparent)]"
        />
        <div className="relative">
          <Lock className="w-8 h-8 text-secondary-300 mx-auto" />
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Empezá a monitorear tu campo hoy
          </h2>
          <p className="mt-3 text-primary-100 max-w-xl mx-auto">
            Sumate a DAMP Agro y llevá tu operación ganadera a un estándar de precisión y seguridad multi-tenant.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white text-primary-900 hover:bg-primary-50 transition-colors shadow-md"
            >
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Brand className="text-base" />
        <p className="text-sm text-subtle text-center sm:text-right">
          © {new Date().getFullYear()} DAMP Agro. Plataforma de gestión ganadera de precisión.
        </p>
      </div>
    </footer>
  );
}
