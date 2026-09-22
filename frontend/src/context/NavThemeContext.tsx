'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

interface NavThemeApi {
  isDark: boolean;
  setSectionDark: (id: number, active: boolean) => void;
  nextId: () => number;
}

const NavThemeContext = createContext<NavThemeApi | null>(null);

export function NavThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const darkSections = useRef(new Set<number>());
  const idCounter = useRef(0);

  const api = useMemo<NavThemeApi>(
    () => ({
      isDark,
      setSectionDark: (id, active) => {
        if (active) darkSections.current.add(id);
        else darkSections.current.delete(id);
        setIsDark(darkSections.current.size > 0);
      },
      nextId: () => idCounter.current++,
    }),
    [isDark]
  );

  return <NavThemeContext.Provider value={api}>{children}</NavThemeContext.Provider>;
}

export function useNavIsDark() {
  return useContext(NavThemeContext)?.isDark ?? false;
}

/** Marks the given section ref as "dark background" while it's crossing the nav band. */
export function useNavDarkSection<T extends HTMLElement>(ref: RefObject<T | null>) {
  const api = useContext(NavThemeContext);
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current || !api) return;
    if (idRef.current === null) {
      idRef.current = api.nextId();
    }
    const id = idRef.current;
    const el = ref.current;

    // Only shrink the root from the top (past the sticky nav) — shrinking from the
    // bottom too would require enough remaining scroll room for the section's top
    // edge to reach that band, which fails for a short section near the page end
    // (e.g. CtaBanner, right before the footer, with no scroll room left to reach it).
    const observer = new IntersectionObserver(([entry]) => api.setSectionDark(id, entry.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
      threshold: 0,
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      api.setSectionDark(id, false);
    };
  }, [ref, api]);
}
