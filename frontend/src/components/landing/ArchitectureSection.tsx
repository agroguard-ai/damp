import Link from 'next/link';
import { Cpu, ArrowRight, Maximize2, ExternalLink } from 'lucide-react';

export function ArchitectureSection() {
  return (
    <section
      id="arquitectura"
      className="relative border-y border-border bg-surface/40 py-24 overflow-hidden scroll-mt-20"
    >
      {/* Subtle tech background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Ingeniería & Hardware IoT
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Arquitectura técnica integral y verificada
            </h2>
            <p className="mt-4 text-muted text-lg leading-relaxed">
              DAMP Agro cuenta con collares LoRa ESP32-S3 en el campo, gateways Heltec V3, backend NestJS con PostGIS,
              autenticación nativa JWT y microservicio predictivo BiLSTM con DVC.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/arquitectura"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700 transition-colors shadow-md hover:shadow-lg"
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

        {/* Interactive preview box */}
        <div className="relative rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-raised/90 backdrop-blur-md text-xs text-muted">
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">Diagrama de Sistema en Vivo</span>
              <span className="hidden md:inline text-subtle">• Navegación interactiva con zoom, temas y rutas</span>
            </div>
            <Link
              href="/arquitectura"
              className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:text-primary-800 transition-colors"
            >
              <span>Ver análisis detallado</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="relative w-full h-[520px] sm:h-[620px] lg:h-[720px] bg-background">
            <iframe
              src="/architecture.html"
              title="Arquitectura de Sistema DAMP Agro"
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
