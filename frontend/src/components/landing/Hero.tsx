import Link from 'next/link';
import { MapPin, HeartPulse, BellRing, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

export function Hero() {
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
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Monitoreá tu campo{' '}
              <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-600 bg-clip-text text-transparent">
                en tiempo real
              </span>
              , de punta a punta.
            </h1>

            <p className="mt-6 text-lg text-muted max-w-xl">
              DAMP Agro combina collares GPS, cercos virtuales e inteligencia artificial para que sepas dónde está cada
              animal, cómo está su salud, y te enterés de un problema antes de que sea tarde.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="mailto:ventas@damp.com"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700 transition-all shadow-md hover:shadow-lg"
              >
                Solicitar Demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href="/arquitectura"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised transition-colors text-foreground"
              >
                <Cpu className="w-4 h-4 text-primary-600" />
                Ver arquitectura técnica
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
          <span className="ml-3 text-xs font-medium text-subtle">Mapa en vivo</span>
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
        <p className="mt-1 text-xs text-muted">Collar #A21 cruzó el cerco virtual.</p>
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
