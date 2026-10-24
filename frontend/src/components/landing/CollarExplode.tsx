'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavDarkSection } from '@/context/NavThemeContext';
import type { CollarScene, FrameInfo } from './collar/scene';

gsap.registerPlugin(ScrollTrigger);

type Tone = 'green' | 'amber';

interface Part {
  name: string;
  title: string;
  text: string;
  tone: Tone;
}

/** Mismo orden que las capas de la escena 3D (de arriba hacia abajo). */
const PARTS: Part[] = [
  {
    name: 'Carcasa',
    title: 'Una cáscara para el campo',
    text: 'Protege la electrónica del agua, el barro y los golpes, y deja pasar la señal de radio y del GPS.',
    tone: 'green',
  },
  {
    name: 'GPS',
    title: 'Dónde está el animal',
    text: 'La antena cerámica mira al cielo y calcula latitud y longitud con los satélites que ve.',
    tone: 'green',
  },
  {
    name: 'Radio LoRa',
    title: 'Habla sin internet',
    text: 'Manda los datos por radio al gateway de la base y escucha 1 segundo por si llegan coordenadas nuevas del cerco.',
    tone: 'green',
  },
  {
    name: 'Cerebro',
    title: 'Quién decide',
    text: 'Lee los sensores, arma el mensaje, guarda el cerco virtual y calcula si el animal está adentro o afuera.',
    tone: 'green',
  },
  {
    name: 'Buzzer + LED',
    title: 'Avisa en el momento',
    text: 'Si el animal sale del cerco, el buzzer pita y el LED parpadea ahí mismo, sin esperar al servidor.',
    tone: 'green',
  },
  {
    name: 'Batería',
    title: 'De qué vive',
    text: 'Una batería LiPo alimenta todo. Hoy dura unas 7–8 horas; el próximo paso es dormir el collar entre envíos.',
    tone: 'green',
  },
  {
    name: 'Sensor',
    title: 'Cómo se mide',
    text: 'Una cápsula de acero en la correa toca el cuello y mide la temperatura para detectar fiebre o hipotermia.',
    tone: 'green',
  },
];

const CYCLE = ['Mide', 'Transmite', 'Escucha 1 s', 'Evalúa el cerco', 'Avisa o descansa'];

/** 0 = intro, 1–7 = piezas, 8 = cierre. Debe coincidir con los tramos de scene.ts. */
function stepFromProgress(p: number) {
  if (p < 0.1) return 0;
  if (p >= 0.8) return PARTS.length + 1;
  return 1 + Math.min(PARTS.length - 1, Math.floor((p - 0.1) / 0.1));
}

const toneText: Record<Tone, string> = { green: 'text-primary-400', amber: 'text-accent-400' };

/**
 * "El collar por dentro": sección fija (pin) de la landing. Mientras se
 * scrollea, el collar en 3D se abre capa por capa y cada pieza se explica.
 *
 * - El scroll lo suaviza Lenis (SmoothScroll.tsx) y el avance lo mide un
 *   ScrollTrigger con `scrub`, así el modelo sigue exactamente al scroll.
 * - Three.js se carga con import dinámico: no pesa en la carga inicial.
 * - Con `prefers-reduced-motion` no se fija la sección: se muestra el collar
 *   abierto, quieto, y las piezas como lista.
 * - Si el navegador no tiene WebGL, queda la lista de piezas sin el 3D.
 */
export function CollarExplode() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tagLabelRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CollarScene | null>(null);
  const progressRef = useRef(0);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useNavDarkSection(sectionRef);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Escena 3D
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = pinRef.current;
    if (!canvas || !host) return;
    let cancelled = false;
    let loading = false;
    let lastActive = -2;

    const onFrame = (info: FrameInfo) => {
      const tag = tagRef.current;
      if (!tag) return;
      if (info.active !== lastActive && tagLabelRef.current) {
        lastActive = info.active;
        if (info.active >= 0) tagLabelRef.current.textContent = PARTS[info.active].name;
        tag.dataset.tone = info.active >= 0 ? PARTS[info.active].tone : 'green';
      }
      tag.style.opacity = String(Math.max(0, info.visibility * 1.4 - 0.4));
      // Que la etiqueta no se salga por los bordes ni pise el texto inferior en mobile.
      const parentW = tag.parentElement?.clientWidth ?? window.innerWidth;
      const parentH = tag.parentElement?.clientHeight ?? window.innerHeight;
      const tagW = (tagLabelRef.current?.offsetWidth ?? 90) + 56;
      const maxX = Math.max(12, parentW - tagW - 12);
      const clampedX = Math.min(Math.max(12, info.x), maxX);
      const isMobile = parentW < 1024;
      const maxY = isMobile ? parentH * 0.52 : parentH - 48;
      const clampedY = Math.min(Math.max(84, info.y), maxY);
      tag.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
    };

    const loadScene = () => {
      if (loading || sceneRef.current || cancelled) return;
      loading = true;
      import('./collar/scene')
        .then(({ createCollarScene }) => {
          if (cancelled) return;
          try {
            const scene = createCollarScene(canvas, { onFrame, staticProgress: reduced ? 0.5 : undefined });
            sceneRef.current = scene;
            const rect = canvas.getBoundingClientRect();
            scene.resize(rect.width, rect.height);
            scene.setProgress(progressRef.current);
          } catch {
            setWebglFailed(true);
          }
        })
        .catch(() => setWebglFailed(true));
    };

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sceneRef.current?.resize(width, height);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadScene();
          sceneRef.current?.setRunning(true);
        } else {
          sceneRef.current?.setRunning(false);
        }
      },
      {
        rootMargin: '400px 0px',
      }
    );
    io.observe(host);

    return () => {
      cancelled = true;
      ro.disconnect();
      io.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [reduced]);

  // Scroll: fija la sección y le pasa el progreso a la escena
  useEffect(() => {
    if (reduced || !sectionRef.current || !pinRef.current) return;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      pin: pinRef.current,
      start: 'top top',
      end: mobile ? '+=520%' : '+=650%',
      scrub: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        sceneRef.current?.setProgress(self.progress);
        if (barRef.current) barRef.current.style.transform = `scaleY(${self.progress})`;
        setStep((prev) => {
          const next = stepFromProgress(self.progress);
          return prev === next ? prev : next;
        });
      },
    });
    return () => trigger.kill();
  }, [reduced]);

  const activePart = step >= 1 && step <= PARTS.length ? step - 1 : -1;

  if (reduced) {
    return (
      <section ref={sectionRef} id="collar" className="relative bg-neutral-950 text-neutral-50 py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading />
          {!webglFailed && (
            <div ref={pinRef} className="relative mt-10 h-[60vh] min-h-80">
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
            </div>
          )}
          <PartsList />
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} id="collar" className="relative bg-neutral-950 text-neutral-50 scroll-mt-20">
      <div ref={pinRef} className="relative h-svh w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_42%_55%,rgba(34,197,94,0.16),transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_70%_60%_at_45%_50%,black,transparent)]"
        />

        {webglFailed ? (
          <div className="relative mx-auto max-w-7xl px-6 py-24">
            <SectionHeading />
            <PartsList />
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full lg:w-[64%]"
              aria-label="Modelo 3D del collar DAMP abriéndose en capas"
              role="img"
            />

            {/* Etiqueta que sigue a la pieza activa */}
            <div
              ref={tagRef}
              aria-hidden
              data-tone="green"
              className="pointer-events-none absolute left-0 top-0 opacity-0 will-change-transform group"
            >
              <div className="flex -translate-y-1/2 items-center">
                <span className="h-px w-6 sm:w-10 bg-primary-400/80 group-data-[tone=amber]:bg-accent-400/80" />
                <span className="h-2 w-2 -ml-1 order-first rounded-full bg-primary-400 shadow-[0_0_12px_rgba(74,222,128,0.9)] group-data-[tone=amber]:bg-accent-400" />
                <span
                  ref={tagLabelRef}
                  className="ml-1 whitespace-nowrap rounded-full border border-primary-500/70 bg-neutral-950/85 px-2.5 sm:px-3 py-0.5 sm:py-1 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.14em] text-primary-300 backdrop-blur group-data-[tone=amber]:border-accent-500/70 group-data-[tone=amber]:text-accent-300"
                />
              </div>
            </div>

            {/* Encabezado fijo */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 mx-auto max-w-7xl px-5 sm:px-6 pt-20 lg:pt-28 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary-400">
                Por dentro del collar
              </span>
              {activePart >= 0 && (
                <span className="lg:hidden rounded-full border border-white/15 bg-neutral-900/80 backdrop-blur px-2.5 py-0.5 font-mono text-[10px] text-neutral-300">
                  {String(activePart + 1).padStart(2, '0')} / {String(PARTS.length).padStart(2, '0')}
                </span>
              )}
            </div>

            {/* Lista de piezas + progreso (escritorio) */}
            <div
              className={`pointer-events-none absolute bottom-10 left-0 right-0 mx-auto hidden max-w-7xl px-6 transition-opacity duration-500 lg:block ${
                activePart >= 0 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-stretch gap-4">
                <div className="relative w-px bg-white/10">
                  <div ref={barRef} className="absolute inset-0 origin-top bg-primary-400" style={{ transform: 'scaleY(0)' }} />
                </div>
                <ol className="space-y-1.5 font-mono text-xs tracking-wider">
                  {PARTS.map((part, i) => (
                    <li
                      key={part.name}
                      className={`flex items-center gap-2.5 transition-colors duration-300 ${
                        activePart === i ? toneText[part.tone] : 'text-neutral-500'
                      }`}
                    >
                      <span
                        className={`h-px transition-all duration-300 ${activePart === i ? 'w-6 bg-current' : 'w-3 bg-neutral-600'}`}
                      />
                      {part.name.toUpperCase()}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Textos por paso */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[40%]">
              <div className="relative h-[42svh] sm:h-[44svh] bg-linear-to-t from-neutral-950 via-neutral-950/95 via-65% to-transparent lg:h-full lg:bg-none">
                <StepPanel visible={step === 0}>
                  <h2 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold leading-[1.08] tracking-tight text-balance">
                    Siete piezas que cuidan a{' '}
                    <span className="bg-linear-to-r from-primary-400 to-secondary-300 bg-clip-text text-transparent">
                      cada animal
                    </span>
                  </h2>
                  <p className="mt-2.5 sm:mt-5 max-w-md text-sm sm:text-lg leading-relaxed text-neutral-400">
                    Seguí bajando: el collar se abre capa por capa y te muestra qué hace cada parte.
                  </p>
                  <div className="mt-4 sm:mt-8 inline-flex items-center gap-2.5 font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] text-primary-400">
                    <span className="relative h-6 w-4 sm:h-8 sm:w-5 rounded-full border border-primary-400/60 shrink-0">
                      <span className="absolute left-1/2 top-1.5 h-1.5 w-0.5 -translate-x-1/2 animate-bounce rounded-full bg-primary-400" />
                    </span>
                    <span>Deslizá</span>
                  </div>
                </StepPanel>

                {PARTS.map((part, i) => (
                  <StepPanel key={part.name} visible={step === i + 1}>
                    <p className={`font-mono text-[11px] sm:text-xs uppercase tracking-[0.18em] ${toneText[part.tone]}`}>
                      {String(i + 1).padStart(2, '0')} / {String(PARTS.length).padStart(2, '0')}
                    </p>
                    <h3 className="mt-1.5 sm:mt-3 font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance">
                      {part.title}
                    </h3>
                    <p className="mt-2 sm:mt-4 max-w-md text-sm sm:text-lg leading-snug sm:leading-relaxed text-neutral-400">
                      {part.text}
                    </p>
                  </StepPanel>
                ))}

                <StepPanel visible={step === PARTS.length + 1}>
                  <p className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.18em] text-primary-400">Todo junto</p>
                  <h3 className="mt-1.5 sm:mt-3 font-display text-2xl sm:text-4xl font-bold tracking-tight">
                    Un ciclo cada 5 minutos
                  </h3>
                  <ol className="mt-3 sm:mt-6 grid grid-cols-2 sm:grid-cols-1 max-w-md gap-1.5 sm:gap-2">
                    {CYCLE.map((item, i) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 sm:gap-3 rounded-lg border border-white/10 bg-white/3 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 text-xs sm:text-sm text-neutral-200"
                      >
                        <span className="font-mono text-[11px] sm:text-xs text-primary-400">{i + 1}</span>
                        <span className="truncate">{item}</span>
                      </li>
                    ))}
                  </ol>
                </StepPanel>
              </div>
            </div>

            <p className="pointer-events-none absolute bottom-4 right-6 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600 lg:block">
              Render del diseño · prototipo sin carcasa definitiva
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function StepPanel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visible}
      className={`absolute inset-x-0 bottom-5 sm:bottom-10 px-5 sm:px-6 transition-[opacity,margin,filter] duration-500 ease-out lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:pl-0 lg:pr-12 ${
        visible ? 'mt-0 opacity-100 blur-none' : 'mt-6 opacity-0 blur-[2px]'
      }`}
    >
      {children}
    </div>
  );
}

function SectionHeading() {
  return (
    <div className="max-w-2xl">
      <span className="text-sm font-semibold uppercase tracking-wider text-primary-400">Por dentro del collar</span>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Siete piezas que cuidan a cada animal</h2>
    </div>
  );
}

function PartsList() {
  return (
    <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PARTS.map((part, i) => (
        <li key={part.name} className="rounded-xl border border-white/10 bg-white/3 p-5">
          <p className={`font-mono text-xs uppercase tracking-[0.18em] ${toneText[part.tone]}`}>
            {String(i + 1).padStart(2, '0')} / {String(PARTS.length).padStart(2, '0')}
          </p>
          <h3 className="mt-2 font-display text-xl font-bold">{part.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{part.text}</p>
        </li>
      ))}
    </ol>
  );
}
