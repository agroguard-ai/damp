'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  ArrowRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Radio,
  Server,
  Database,
  BrainCircuit,
} from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ARCH_STEPS = [
  {
    icon: Radio,
    tag: '1 · Nodo de Campo',
    title: 'Collar IoT (ESP32-S3)',
    detail: 'GPS NEO-6M + DS18B20 + Radio LoRa SX1262 (915 MHz)',
  },
  {
    icon: Server,
    tag: '2 · Enlace Rural',
    title: 'Gateway AgroGuard',
    detail: 'Heltec WiFi LoRa 32 V3 en el casco con reenvío HTTP',
  },
  {
    icon: Database,
    tag: '3 · Core & GIS',
    title: 'Backend NestJS + PostGIS',
    detail: 'Evaluación espacial de cercos, alertas y autenticación JWT',
  },
  {
    icon: BrainCircuit,
    tag: '4 · Inferencia IA',
    title: 'Microservicio ML',
    detail: 'Red neuronal BiLSTM para predicción temprana de salud',
  },
];

export function ArchitectureSection() {
  const previewRef = useScrollReveal<HTMLDivElement>();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section
      id="arquitectura"
      className="relative border-y border-border bg-surface/40 py-16 sm:py-20 overflow-hidden scroll-mt-20"
    >
      {/* Subtle tech background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[48px_48px] opacity-40 mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Ingeniería Hardware & Software
            </span>
            <h2 className="mt-2.5 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Diseñado para resistir la intemperie y la falta de señal
            </h2>
            <p className="mt-3 text-muted text-base sm:text-lg leading-relaxed">
              La tecnología de DAMP Agro está pensada para la realidad rural. Los collares LoRa (ESP32-S3) transmiten
              hacia el gateway del campo (Heltec V3), requiriendo conexión a internet únicamente en el casco.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/arquitectura"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-colors shadow-md hover:shadow-lg"
            >
              Explorar arquitectura interactiva
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/architecture.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised transition-colors text-muted hover:text-foreground"
              title="Abrir diagrama en pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Pantalla completa</span>
            </a>
          </div>
        </div>

        {/* Compact 4-stage summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {ARCH_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.tag}
                className="rounded-xl border border-border bg-surface/80 backdrop-blur-xs p-3.5 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block">
                    {step.tag}
                  </span>
                  <h3 className="text-xs font-bold text-foreground truncate">{step.title}</h3>
                  <p className="text-[11px] text-muted leading-snug mt-0.5">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible Interactive Preview Box (Minimized by default) */}
        <div
          ref={previewRef}
          className="relative rounded-2xl border border-border bg-surface shadow-xl overflow-hidden transition-all"
        >
          {/* Window Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border bg-surface-raised/90 backdrop-blur-md text-xs text-muted">
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">Diagrama de Sistema en Vivo</span>
              <span className="hidden md:inline text-subtle">
                • {isExpanded ? 'Navegación interactiva con zoom, temas y rutas' : 'Vista previa compacta'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary-600 transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-primary-600" />
                    <span>Minimizar diagrama</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-primary-600" />
                    <span>Desplegar diagrama aquí</span>
                  </>
                )}
              </button>

              <span className="h-3.5 w-px bg-border hidden sm:inline-block" />

              <Link
                href="/arquitectura"
                className="hidden sm:inline-flex items-center gap-1.5 font-medium text-primary-700 hover:text-primary-800 transition-colors"
              >
                <span>Ver análisis detallado</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Collapsible Diagram Container */}
          <div
            className={`relative w-full bg-background transition-all duration-500 ease-in-out overflow-hidden ${
              isExpanded ? 'h-[520px] sm:h-[620px] lg:h-[680px]' : 'h-48 sm:h-56'
            }`}
          >
            <iframe
              src="/architecture.html"
              title="Arquitectura de Sistema DAMP Agro"
              className={`w-full border-0 transition-opacity duration-300 ${
                isExpanded ? 'h-full opacity-100 pointer-events-auto' : 'h-[560px] opacity-65 pointer-events-none'
              }`}
              loading="lazy"
            />

            {/* Overlay when minimized so it doesn't hijack scroll and invites the user to expand */}
            {!isExpanded && (
              <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-transparent flex flex-col items-center justify-end pb-6 px-4 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-surface-raised/95 hover:bg-surface border border-primary-500/40 text-foreground shadow-lg hover:shadow-xl hover:border-primary-500 transition-all cursor-pointer backdrop-blur-md"
                  >
                    <ChevronDown className="w-4 h-4 text-primary-500" />
                    Desplegar diagrama interactivo
                  </button>

                  <Link
                    href="/arquitectura"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-primary/10 hover:bg-primary/20 border border-primary-500/30 text-primary-600 dark:text-primary-400 transition-all backdrop-blur-md"
                  >
                    <span>Ir a página de arquitectura</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Bottom collapse bar when expanded */}
          {isExpanded && (
            <div className="flex items-center justify-center border-t border-border bg-surface-raised/80 py-2">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors cursor-pointer px-3 py-1"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Minimizar diagrama
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
