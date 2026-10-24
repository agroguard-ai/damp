'use client';

import Link from 'next/link';
import {
  HeartPulse,
  BellRing,
  Cpu,
  CheckCircle2,
  Maximize2,
  PawPrint,
  LocateFixed,
  Layers,
  RotateCcw,
  Zap,
  Navigation,
} from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

export function Hero() {
  const contentRef = useScrollReveal<HTMLDivElement>({ stagger: 0.15 });
  const mockupRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="relative overflow-hidden">
      {/* Tech grid background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />
      {/* Glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-32 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -top-10 right-0 w-72 sm:w-md h-80 sm:h-112 rounded-full bg-secondary-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div ref={contentRef}>
            <h1
              data-reveal-item
              className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]"
            >
              Monitoreá tu ganado{' '}
              <span className="bg-linear-to-r from-primary-700 via-primary-600 to-secondary-600 bg-clip-text text-transparent">
                en tiempo real
              </span>
              , esté donde esté.
            </h1>

            <p data-reveal-item className="mt-6 text-lg text-muted max-w-xl leading-relaxed">
              DAMP Agro combina collares GPS, cercos virtuales e inteligencia artificial para que sepas dónde está cada
              animal, cómo está su salud y te enterés de un problema antes de que sea grave.
            </p>

            <div data-reveal-item className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="mailto:ventas@damp.com"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-all shadow-md hover:shadow-lg"
              >
                Solicitar Demo
              </a>
              <Link
                href="/arquitectura"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-raised transition-colors text-foreground"
              >
                <Cpu className="w-4 h-4 text-primary-600" />
                Ver arquitectura técnica
              </Link>
            </div>

            <div data-reveal-item className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
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

          <div ref={mockupRef}>
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      {/* Main Application Window */}
      <div className="relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-surface shadow-2xl overflow-hidden">
        {/* Window Header + Herd Status Bar (mirrors FarmMapView.tsx) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-surface-raised">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="ml-2.5 text-xs font-semibold text-foreground/90">Mapa en vivo</span>
            <span className="hidden sm:inline-block text-[11px] text-subtle">· Estancia La Primitiva</span>
          </div>

          {/* Status pills from FarmMapView */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              239 con señal
            </span>
            <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-muted">
              <RotateCcw className="w-2.5 h-2.5" />
              recién
            </span>
          </div>
        </div>

        {/* Satellite Hybrid Map Canvas (mirrors LiveTrackingMap.tsx) */}
        <div className="relative h-80 sm:h-92 overflow-hidden bg-[#112217] select-none">
          {/* Procedural Satellite / Agricultural Parcel Texture */}
          <svg
            aria-hidden
            viewBox="0 0 600 400"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <radialGradient id="satVignette" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#1b3724" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#07120b" stopOpacity="0.65" />
              </radialGradient>
              <pattern id="cropRows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
                <line x1="0" y1="0" x2="0" y2="12" stroke="#2b5235" strokeWidth="1" strokeOpacity="0.28" />
              </pattern>
              <pattern id="pastureDots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="6" cy="6" r="1" fill="#3a6b47" fillOpacity="0.35" />
                <circle cx="18" cy="16" r="1.2" fill="#284d33" fillOpacity="0.4" />
              </pattern>
              {/* Grazing heatmap glow */}
              <radialGradient id="heatHigh" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#84cc16" stopOpacity="0.32" />
                <stop offset="65%" stopColor="#22c55e" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Base satellite agricultural parcels (lotes) */}
            <rect width="600" height="400" fill="#13281a" />
            <polygon points="0,0 260,0 220,170 0,145" fill="#183220" />
            <polygon points="260,0 600,0 600,190 220,170" fill="#152c1c" />
            <polygon points="260,0 600,0 600,190 220,170" fill="url(#cropRows)" />
            <polygon points="0,145 220,170 190,400 0,400" fill="#14291b" />
            <polygon points="220,170 600,190 600,400 190,400" fill="#193422" />
            <polygon points="220,170 600,190 600,400 190,400" fill="url(#pastureDots)" />

            {/* Subtle internal pasture subdivisions */}
            <polygon points="110,60 465,45 495,315 85,335" fill="#1c3b27" fillOpacity="0.55" />
            <polygon points="110,60 465,45 495,315 85,335" fill="url(#cropRows)" />

            {/* Natural stream / arroyo & watering hole (aguada) */}
            <path
              d="M -10,290 Q 140,265 250,305 T 610,355"
              fill="none"
              stroke="#0c2d38"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              d="M -10,290 Q 140,265 250,305 T 610,355"
              fill="none"
              stroke="#164e63"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            <ellipse cx="295" cy="185" rx="18" ry="11" fill="#0e3a47" stroke="#1e5b6e" strokeWidth="1.5" opacity="0.8" />

            {/* Rural dirt roads (caminos internos y ruta vecinal) */}
            <path d="M 0,145 L 220,170 L 600,190" fill="none" stroke="#3d493a" strokeWidth="2.5" opacity="0.65" />
            <path d="M 260,0 L 220,170 L 190,400" fill="none" stroke="#3d493a" strokeWidth="2" opacity="0.55" />

            {/* Subtle grazing density glow inside the active paddock */}
            <circle cx="245" cy="165" r="75" fill="url(#heatHigh)" />
            <circle cx="355" cy="215" r="60" fill="url(#heatHigh)" />

            {/* 1. Farm Perimeter Polygon (Perímetro del campo — green solid like LiveTrackingMap.tsx) */}
            <polygon
              points="55,36 510,26 535,342 42,358"
              fill="#22c55e"
              fillOpacity="0.05"
              stroke="#16a34a"
              strokeWidth="2"
            />

            {/* 2. Active Virtual Geofence (Cerco virtual — cyan dashed polygon like LiveTrackingMap.tsx) */}
            <polygon
              points="98,68 442,56 462,272 118,288"
              fill="#22d3ee"
              fillOpacity="0.13"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />

            {/* Geofence vertices (small cyan nodes) */}
            {[
              [98, 68],
              [442, 56],
              [462, 272],
              [118, 288],
            ].map(([cx, cy], idx) => (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r="3.5"
                fill="#06b6d4"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ))}

            {/* 3. Escape trajectory line (Animal #A21 leaving the cyan geofence) */}
            <path
              d="M 395,215 C 425,240 448,268 482,302"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />
            <circle cx="395" cy="215" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1" />
            <circle cx="438" cy="255" r="3" fill="#f97316" stroke="#ffffff" strokeWidth="1" />

            <rect width="600" height="400" fill="url(#satVignette)" />
          </svg>

          {/* Geofence Active Label Pill (top-left inside geofence) */}
          <div className="absolute top-6 left-6 sm:left-8 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/85 backdrop-blur-md border border-cyan-500/40 text-[11px] font-semibold text-cyan-300 shadow-lg">
            <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400/20" />
            Cerco: Lote Norte · Pastura
          </div>

          {/* Cluster Badge 1: 142 animals (mirrors AnimalMarkersLayer.tsx cluster badge) */}
          <div
            className="absolute top-[34%] left-[31%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            title="Grupo de Hacienda (142 animales)"
          >
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-green-700 text-white font-extrabold text-xs flex items-center justify-center border-[2.5px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] tracking-tight transition-transform group-hover:scale-110">
              142
            </div>
          </div>

          {/* Cluster Badge 2: 84 animals */}
          <div
            className="absolute top-[52%] left-[56%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            title="Grupo de Hacienda (84 animales)"
          >
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-500 to-green-700 text-white font-extrabold text-xs flex items-center justify-center border-[2.5px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] tracking-tight transition-transform group-hover:scale-110">
              84
            </div>
          </div>

          {/* Single Animal Marker (in range) */}
          <div
            className="absolute top-[25%] left-[52%] -translate-x-1/2 -translate-y-1/2"
            title="Caravana #B04 · 38.6 °C"
          >
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-green-700 text-white text-sm flex items-center justify-center border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
              🐄
            </div>
          </div>

          {/* Cluster Badge 3: 12 animals near bottom-left of geofence */}
          <div
            className="absolute bottom-[32%] left-[25%] -translate-x-1/2 translate-y-1/2"
            title="Grupo de Hacienda (12 animales)"
          >
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-green-700 text-white font-extrabold text-[11px] flex items-center justify-center border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
              12
            </div>
          </div>

          {/* Escaped Animal Marker #A21 (Red gradient + pulse badge, outside cyan geofence) */}
          <div className="absolute bottom-[18%] right-[17%] translate-x-1/2 translate-y-1/2 flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full bg-red-500/35 animate-ping" />
            <div className="relative w-9 h-9 rounded-full bg-linear-to-br from-red-500 to-red-700 text-white text-sm flex items-center justify-center border-[2.5px] border-white shadow-[0_4px_14px_rgba(239,68,68,0.6)]">
              🐄
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
            </div>
          </div>

          {/* Mini Inspection Tooltip next to #A21 (mirrors AnimalMarkersLayer Popup) */}
          <div className="absolute bottom-4 right-14 sm:right-24 rounded-lg bg-zinc-900/95 backdrop-blur-md border border-red-500/40 px-2.5 py-1.5 shadow-xl text-[10px] text-zinc-100 hidden xs:block">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <Navigation className="w-2.5 h-2.5 rotate-135" />
              <span>#A21 · Fuera de cerco</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-zinc-300">
              <span>🌡️ 39.4 °C</span>
              <span className="text-zinc-500">•</span>
              <span>hace 12 s</span>
            </div>
          </div>

          {/* Right Action Controls (mirrors MapActionControls.tsx) */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <div
              className="w-8 h-8 rounded-full bg-zinc-900/90 backdrop-blur-md text-zinc-200 border border-zinc-700/70 shadow-lg flex items-center justify-center"
              title="Pantalla Completa"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
            <div
              className="relative w-8 h-8 rounded-full bg-green-600/95 text-white border border-green-400 shadow-lg flex items-center justify-center"
              title="Hacienda activa (240)"
            >
              <PawPrint className="w-3.5 h-3.5" />
              <span className="absolute -bottom-1 -left-1.5 px-1 h-4 min-w-4 rounded-full bg-white text-green-700 text-[9px] font-extrabold flex items-center justify-center shadow">
                240
              </span>
            </div>
            <div
              className="w-8 h-8 rounded-full bg-zinc-900/90 backdrop-blur-md text-green-400 border border-zinc-700/70 shadow-lg flex items-center justify-center"
              title="Centrar en la hacienda"
            >
              <LocateFixed className="w-3.5 h-3.5" />
            </div>
            <div
              className="w-8 h-8 rounded-full bg-zinc-900/90 backdrop-blur-md text-green-400 border border-zinc-700/70 shadow-lg flex items-center justify-center"
              title="Capas: Satelital Híbrido"
            >
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Bottom-right Scale & Layer Tag */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none text-[10px] text-zinc-300/80">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/75 backdrop-blur-xs border border-zinc-700/50">
              <span className="w-2 h-2 rounded-xs bg-cyan-400/40 border border-cyan-400" />
              <span>Geocerca activa</span>
              <span className="text-zinc-500 ml-1">|</span>
              <span className="w-2 h-2 rounded-xs bg-green-500/30 border border-green-500 ml-1" />
              <span>Campo (420 ha)</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/75 backdrop-blur-xs border border-zinc-700/50 font-mono text-[9px]">
              <span>200 m</span>
              <span className="w-6 h-1 border-b border-x border-zinc-300 inline-block" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating alert card (sm+ floating, mobile stacked below) */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:mt-0 sm:block">
        <div className="sm:absolute sm:-top-5 sm:right-2 xl:-right-4 sm:w-60 rounded-xl border border-red-500/30 bg-surface/95 backdrop-blur-md shadow-xl sm:shadow-2xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-500/10">
                <BellRing className="w-3.5 h-3.5 animate-bounce" />
              </span>
              <span className="text-xs font-bold">Alerta de fuga</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
              LoRa · Vivo
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted leading-snug">
            Caravana <strong className="text-foreground">#A21</strong> cruzó{' '}
            <span className="text-cyan-600 dark:text-cyan-400 font-medium">Lote Norte</span>.
          </p>
        </div>

        {/* Floating health card */}
        <div className="sm:absolute sm:-bottom-6 sm:left-2 xl:-left-4 sm:w-58 rounded-xl border border-primary-500/30 bg-surface/95 backdrop-blur-md shadow-xl sm:shadow-2xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary-500/10">
                <HeartPulse className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold">Salud del rodeo</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-700 dark:text-primary-400">
              99.2% OK
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted leading-snug">
            <strong className="text-foreground">238/240</strong> animales en rango térmico normal (38.0–39.2 °C).
          </p>
        </div>
      </div>
    </div>
  );
}
