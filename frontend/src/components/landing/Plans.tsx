'use client';

import { CheckCircle2, Radio, Map, ShieldCheck, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const INCLUDED_FEATURES = [
  {
    title: 'Campos y cercos sin límite',
    description: 'Creá, modificá o eliminá todos los campos y geocercas virtuales que necesites.',
    badge: 'Ilimitado',
  },
  {
    title: 'Gestión libre de todo tu rodeo',
    description: 'Registrá animales, asigná o reasigná collares entre caravanas y llevá el historial completo.',
    badge: 'Flexible',
  },
  {
    title: 'Monitoreo GPS y alertas de fuga 24/7',
    description: 'Posición en vivo, recorridos históricos, mapas de calor de pastoreo y aviso inmediato de escape.',
    badge: 'Tiempo real',
  },
  {
    title: 'Predicción de salud con IA (BiLSTM)',
    description: 'Detección temprana de anomalías térmicas e inactividad incluida para cada collar activo.',
    badge: 'IA incluida',
  },
  {
    title: 'Usuarios y roles para todo tu equipo',
    description: 'Sumá operadores, veterinarios y administradores con permisos por campo.',
    badge: 'Multi-rol',
  },
];

export function Plans() {
  const sectionRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <section id="contratacion" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div ref={sectionRef}>
        <div className="max-w-3xl">
          <span
            data-reveal-item
            className="text-sm font-semibold text-primary-700 uppercase tracking-wider flex items-center gap-1.5"
          >
            <Radio className="w-4 h-4" />
            Modalidad de contratación
          </span>
          <h2
            data-reveal-item
            className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight"
          >
            Sin planes ni funciones bloqueadas: contratás por collar
          </h2>
          <p data-reveal-item className="mt-4 text-muted text-lg leading-relaxed">
            No trabajamos con planes escalonados que limiten tu operación. Con la habilitación inicial y{' '}
            <strong className="text-foreground font-semibold">al menos un collar activo</strong>, tenés acceso total a
            la plataforma para gestionar todos los campos y el rodeo que quieras.
          </p>
        </div>

        {/* Main Unified Contracting Card */}
        <div
          data-reveal-item
          className="mt-12 rounded-3xl border border-primary-600/30 bg-surface shadow-2xl overflow-hidden grid lg:grid-cols-12"
        >
          {/* Left Column: How Contracting Works */}
          <div className="lg:col-span-5 p-5 sm:p-8 lg:p-10 bg-linear-to-br from-primary-950/40 via-surface-raised to-surface border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-600/15 border border-primary-500/30 text-xs font-bold text-primary-600 dark:text-primary-400">
                <Sparkles className="w-3.5 h-3.5" />
                Acceso completo desde 1 collar
              </div>

              <h3 className="mt-5 text-2xl sm:text-3xl font-bold text-foreground font-display leading-tight">
                Habilitación única + collares a tu medida
              </h3>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Empezás con el tamaño de rodeo que quieras monitorear hoy y sumás nuevos collares a medida que tu
                operación crezca.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-border bg-surface/90 p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 mt-0.5">
                    <Layers className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">1. Habilitación del campo</h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      Dejamos operativo el enlace LoRa en el casco y tu cuenta lista para crear o dar de baja campos y
                      cercos con total libertad.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/90 p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 mt-0.5">
                    <Radio className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">2. Contratación por collar activo</h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      Con contratar al menos un collar ya operás sin restricciones. Podés reasignar collares entre
                      animales o sumar unidades cuando quieras.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/90 p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 mt-0.5">
                    <Map className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">3. Control total de campos y lotes</h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      Administrá múltiples campos, redibujá cercos virtuales y borrá o creá los que necesites en
                      cualquier momento sin cargos adicionales.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href="mailto:ventas@damp.com"
                className="inline-flex flex-1 items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-md hover:shadow-lg transition-all text-center"
              >
                Consultar habilitación y collares
                <ArrowRight className="w-4 h-4 shrink-0" />
              </a>
            </div>
          </div>

          {/* Right Column: Everything Included */}
          <div className="lg:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h4 className="text-lg font-bold text-foreground">Todo incluido con tu habilitación</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Todas las herramientas del sistema están activas para todos los productores por igual.
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  100% Desbloqueado
                </span>
              </div>

              <ul className="mt-6 divide-y divide-border">
                {INCLUDED_FEATURES.map((item) => (
                  <li key={item.title} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                      {item.badge}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 rounded-2xl bg-surface-raised border border-border p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
              <span>
                ¿Querés probar el sistema en tu campo? Estamos sumando campos para nuestra prueba piloto.
              </span>
              <a
                href="mailto:ventas@damp.com"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:underline shrink-0"
              >
                Coordinar piloto &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
