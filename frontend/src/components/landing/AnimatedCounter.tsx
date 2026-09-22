'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 1200;

export function AnimatedCounter({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(() => setDisplay(value));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          const eased = 1 - (1 - progress) ** 3;
          setDisplay(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [value]);

  const digits = String(display).split('');

  return (
    <div ref={ref} className="flex flex-col items-start gap-1.5">
      <div className="flex items-baseline gap-0.5">
        {digits.map((digit, i) => (
          <span
            key={i}
            className="inline-flex items-center justify-center w-8 h-11 sm:w-9 sm:h-12 rounded-lg bg-primary-950 text-white text-2xl sm:text-3xl font-bold tabular-nums dark:bg-neutral-800"
          >
            {digit}
          </span>
        ))}
        <span className="ml-1 text-2xl sm:text-3xl font-bold text-primary-700">{suffix}</span>
      </div>
      <p className="text-sm text-muted max-w-[16rem] leading-snug">{label}</p>
    </div>
  );
}
