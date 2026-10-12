'use client';

import { CheckCircle2 } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

export function Plans() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <section id="planes" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">Planes</span>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Un plan para cada escala de operación
        </h2>
        <p className="mt-4 text-muted text-lg leading-relaxed">
          Pagás según la cantidad de campos y collares IoT activos. Sin sorpresas, sin contratos forzosos.
        </p>
      </div>

      <div ref={gridRef} className="mt-16 grid lg:grid-cols-3 gap-6 lg:gap-8 items-center">
        {/* Plan 1: Pequeños productores */}
        <div className="rounded-3xl p-8 bg-surface border border-border shadow-xs min-h-122.5 flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-bold text-foreground font-display">Pequeños productores</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Para campos pequeños o rodeos iniciales que buscan dar el primer paso a la trazabilidad GPS.
            </p>

            <ul className="mt-8 space-y-8">
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Campos activos</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  1 campo
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Collares LoRa en rodeo</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Hasta 25
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Alertas de cerco y fuga</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Inmediato
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Alertas de salud por umbral</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Incluido
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Soporte técnico por email</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Estándar
                </span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:ventas@damp.com"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised text-foreground transition-all"
          >
            Solicitar Demo
          </a>
        </div>

        {/* Plan 2: Operación ganadera (Destacado central) */}
        <div className="rounded-3xl p-8 lg:p-10 bg-surface border-2 border-primary-600/40 shadow-2xl lg:scale-105 relative z-10 min-h-140 flex flex-col justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-600/10 border border-primary-600/30 text-xs font-bold text-primary-700 dark:text-primary-300">
              El plan más elegido
            </div>

            <h3 className="text-2xl font-bold text-foreground font-display">Operación ganadera</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Para rodeos en producción que necesitan monitoreo 24/7, cercos virtuales e IA predictiva sin límites.
            </p>

            <ul className="mt-8 space-y-8">
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Establecimientos activos</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Sin límite
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Collares y gateways LoRa</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Escalable
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Predicción de salud BiLSTM</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  24/7 IA
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Roles operador y veterinario</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Multi-rol
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Reportes y exportación</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Completo
                </span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:ventas@damp.com"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-md hover:shadow-lg transition-all"
          >
            Solicitar Demo
          </a>
        </div>

        {/* Plan 3: Empresas ganaderas */}
        <div className="rounded-3xl p-8 bg-surface border border-border shadow-xs min-h-122.5 flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-bold text-foreground font-display">Empresas ganaderas</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Para grupos ganaderos y administraciones de múltiples establecimientos a nivel corporativo.
            </p>

            <ul className="mt-8 space-y-8">
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Aislamiento corporativo</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Multi-tenant
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Integraciones IoT a medida</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Personalizado
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Modelos de IA dedicados</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Dedicado
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">SLA y atención directa</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Prioritario
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 shrink-0" />
                  <span className="text-foreground font-medium truncate">Onboarding asistido en campo</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 shrink-0">
                  Incluido
                </span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:ventas@damp.com"
            className="mt-10 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised text-foreground transition-all"
          >
            Solicitar Demo
          </a>
        </div>
      </div>
    </section>
  );
}
