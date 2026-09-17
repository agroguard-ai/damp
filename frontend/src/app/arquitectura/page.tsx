import Link from 'next/link';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/proxy';
import {
  Hexagon,
  ArrowLeft,
  Maximize2,
  ExternalLink,
  Cpu,
  Layers,
  BrainCircuit,
  Database,
  Radio,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'Arquitectura del Sistema — DAMP Agro',
  description:
    'Diagrama interactivo de arquitectura técnica de DAMP Agro y AgroGuard: Collares IoT LoRa, Backend NestJS, PostGIS e Inferencia de IA.',
};

export default async function ArquitecturaPage() {
  const cookieStore = await cookies();
  const isSignedIn = Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al inicio</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
              <Hexagon className="w-6 h-6 text-primary-600 fill-primary-600/10 shrink-0" />
              <span>
                DAMP <span className="text-primary-700">Agro</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/architecture.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-surface hover:bg-surface-raised transition-colors"
              title="Abrir en pantalla completa en una nueva pestaña"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pantalla completa</span>
            </a>

            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors shadow-sm"
              >
                Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors shadow-sm"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 sm:py-12">
        {/* Intro */}
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary-700 shadow-sm mb-4">
            <Cpu className="w-3.5 h-3.5" />
            Arquitectura Verificada con Archify
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Arquitectura Integral{' '}
            <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-600 bg-clip-text text-transparent">
              DAMP & AgroGuard
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            Diagrama interactivo de alto nivel compilado a partir del código real del ecosistema: firmware embebido LoRa
            915 MHz, plataforma web Next.js 16, backend NestJS con PostGIS, autenticación nativa JWT y microservicio
            predictivo BiLSTM.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-primary-600" />
              LoRa 915 MHz + WiFi
            </span>
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-primary-600" />
              NestJS 11 + Prisma ORM
            </span>
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border flex items-center gap-1.5">
              <Database className="w-3 h-3 text-primary-600" />
              PostgreSQL 15 + PostGIS
            </span>
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border flex items-center gap-1.5">
              <BrainCircuit className="w-3 h-3 text-primary-600" />
              FastAPI + Keras BiLSTM
            </span>
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-primary-600" />
              Auth Nativa JWT + RBAC
            </span>
          </div>
        </div>

        {/* Embedded Interactive Viewer */}
        <div className="relative rounded-2xl border border-border bg-surface shadow-xl overflow-hidden mb-16">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised/80 backdrop-blur-sm text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">Visor Interactivo Archify</span>
              <span className="hidden sm:inline text-subtle">• Paneo, zoom, vistas guiadas y exportación HD</span>
            </div>
            <a
              href="/architecture.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary-700 hover:text-primary-800 transition-colors"
            >
              <span>Abrir standalone</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="w-full h-[620px] sm:h-[720px] lg:h-[820px] bg-background">
            <iframe
              src="/architecture.html"
              title="Diagrama Interactivo de Arquitectura DAMP & AgroGuard"
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>

        {/* Technical Deep Dive Cards */}
        <div className="mb-12">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
              Detalle de Ingeniería
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Capas del Ecosistema Ganadero</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Edge */}
            <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center mb-4">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">1. Nodo de Campo (AgroGuard)</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Dispositivos de campo diseñados para operar en zonas rurales con baja cobertura.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-cyan-600">• Collar:</span>
                    <span>Seeed XIAO ESP32-S3 + radio LoRa SX1262 (915 MHz), sonda térmica DS18B20 y GPS NEO-6M.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-cyan-600">• Gateway:</span>
                    <span>
                      Heltec LoRa32 V3 (ESP32-S3 + SX1262 + WiFi) reenvía la telemetría autenticada vía HTTP POST al
                      backend.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-cyan-600">• Downlink:</span>
                    <span>
                      El backend retorna las coordenadas de la geocerca activa y el gateway las sincroniza con el
                      collar.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Core */}
            <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">2. Plataforma Central (DAMP)</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Monorepo de producción orquestado con Docker y desplegado en VPS con Dockploy.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-600">• Web GIS:</span>
                    <span>
                      Next.js 16 + React 19 + Leaflet con renderizado geoespacial de parcelas, collares y alertas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-600">• Core API:</span>
                    <span>
                      NestJS 11 + Prisma ORM gestiona la ingesta IoT, motor de geocercas (Point-in-Polygon) y reportes.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-600">• Base Espacial:</span>
                    <span>
                      PostgreSQL 15 con PostGIS para almacenamiento de polígonos y consultas geoespaciales avanzadas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-600">• Auth Nativa:</span>
                    <span>
                      JWT con bcrypt y roles RBAC (Super Admin, Dueño, Operador) sin dependencias de servicios externos.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* ML */}
            <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center mb-4">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">3. Inteligencia Artificial</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Ciclo completo de machine learning desacoplado entre entrenamiento e inferencia en tiempo real.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-violet-600">• damp-ml-api:</span>
                    <span>
                      Pipeline DVC que sintetiza telemetría y entrena el modelo BiLSTM multitarea en Keras con Focal
                      Loss.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-violet-600">• ml-service:</span>
                    <span>
                      Microservicio FastAPI que carga final_model.keras y predice fiebre, celo e inactividad a 6 horas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-violet-600">• Sin Fuga de Datos:</span>
                    <span>
                      Entrada estricta de 48 lecturas (24hs) con features nativas del collar (temperatura, GPS, hora
                      solar).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2 font-bold">
            <Hexagon className="w-4 h-4 text-primary-600 shrink-0" />
            <span>DAMP Agro</span>
          </div>
          <p>© {new Date().getFullYear()} DAMP Agro. Documentación y arquitectura técnica del sistema.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
            <a
              href="/architecture.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Ver HTML Nativo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
