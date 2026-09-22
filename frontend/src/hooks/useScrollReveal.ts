'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * Fade+slide reveal on scroll, gated by prefers-reduced-motion.
 * Pass `stagger` > 0 to cascade the container's direct children instead of
 * animating the container as a single block.
 *
 * A few deliberate choices here, each fixing a real, reproduced bug:
 * - Triggering is a plain IntersectionObserver, not GSAP's ScrollTrigger.
 *   ScrollTrigger's start/end/toggleActions state machine was unreliable in
 *   this app: a trigger could report `isActive` without its scroll progress
 *   ever updating, leaving the reveal stuck hidden.
 * - Each child gets its own independent single-target tween instead of one
 *   multi-target tween using GSAP's built-in `stagger` option. The
 *   multi-target form could report `progress`/`isActive` reaching
 *   completion while never rendering the final values to the DOM for some
 *   targets.
 * - The tween is explicitly `.kill()`ed on cleanup rather than relying on
 *   `gsap.matchMedia().revert()` alone: in dev, React mounts effects twice
 *   (Strict Mode), and a first-mount tween left alive could keep
 *   re-asserting its frozen hidden value over the second mount's tween.
 * - Every tween gets a small minimum `delay` (including the first, "0
 *   stagger" one) — a zero-delay tween played in the same tick as others
 *   could finish and get GC'd by GSAP before ever rendering past its
 *   initial hidden state.
 */
export function useScrollReveal<T extends HTMLElement>(options?: { stagger?: number }) {
  const ref = useRef<T>(null);
  const stagger = options?.stagger ?? 0;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (!ref.current) return;

        const targets = stagger > 0 ? Array.from(ref.current.children) : [ref.current];
        const tweens = targets.map((el, i) =>
          gsap.from(el, {
            opacity: 0,
            y: 16,
            duration: 0.4,
            delay: 0.02 + i * stagger,
            ease: 'power1.out',
            paused: true,
          })
        );

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              tweens.forEach((tween) => tween.play());
              observer.disconnect();
            }
          },
          { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
        );
        observer.observe(ref.current);

        return () => {
          observer.disconnect();
          tweens.forEach((tween) => tween.kill());
        };
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return ref;
}
