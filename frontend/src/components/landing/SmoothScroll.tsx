'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll suave (Lenis) + barra de progreso, solo para la landing.
 *
 * - Lenis se maneja desde el ticker de GSAP y avisa a ScrollTrigger en cada
 *   scroll: así las animaciones atadas al scroll (ej. el collar 3D de
 *   CollarExplode.tsx) se mueven en el mismo frame que la página, sin saltos.
 * - Se monta en `app/page.tsx` y se destruye al salir de la landing, así el
 *   dashboard (mapas Leaflet, tablas con scroll) sigue con el scroll nativo.
 * - Respeta `prefers-reduced-motion`: si el usuario pidió menos movimiento,
 *   Lenis no se activa (la barra de progreso sí, porque no anima nada).
 * - En celulares queda el scroll táctil nativo (`syncTouch` en false).
 * - Los links `#ancla` del Nav y el Footer los resuelve Lenis con scroll suave.
 *   Lenis ya respeta el `scroll-mt-20` (80px) de cada sección, así que no hace
 *   falta un offset extra: el título queda justo debajo del Nav sticky.
 * - Para que un bloque con scroll propio (ej. un modal) no lo maneje Lenis,
 *   agregarle el atributo `data-lenis-prevent`.
 */
export function SmoothScroll() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let lenis: Lenis | null = null;
    const tick = (time: number) => lenis?.raf(time * 1000);

    if (!prefersReducedMotion) {
      lenis = new Lenis({
        autoRaf: false,
        lerp: 0.1,
        anchors: true,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const updateBar = () => {
      if (!barRef.current) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      barRef.current.style.transform = `scaleX(${progress})`;
    };

    updateBar();
    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);

    return () => {
      window.removeEventListener('scroll', updateBar);
      window.removeEventListener('resize', updateBar);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        ref={barRef}
        className="h-full origin-left bg-linear-to-r from-primary-500 via-primary-400 to-secondary-400"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
