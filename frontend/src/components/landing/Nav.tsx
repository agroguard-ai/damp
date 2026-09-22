'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Brand } from './Brand';
import { useNavIsDark } from '@/context/NavThemeContext';

const navLinks = [
  { href: '#producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#arquitectura', label: 'Arquitectura' },
  { href: '#planes', label: 'Planes' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#preguntas-frecuentes', label: 'Preguntas' },
];

export function Nav({ isSignedIn }: { isSignedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDark = useNavIsDark();

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300 ${
        isDark ? 'border-white/10 bg-neutral-950/70' : 'border-border bg-background/80'
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Brand className={`text-lg ${isDark ? 'text-white' : 'text-foreground'}`} />

        <nav
          className={`hidden md:flex items-center gap-8 text-sm font-medium transition-colors duration-300 ${
            isDark ? 'text-neutral-300' : 'text-muted'
          }`}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-foreground'}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-colors shadow-sm"
            >
              Ir al dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={`hidden sm:inline-flex px-4 py-2 text-sm font-medium transition-colors ${
                  isDark ? 'text-white hover:text-primary-300' : 'text-foreground hover:text-primary-600'
                }`}
              >
                Iniciar sesión
              </Link>
              <a
                href="mailto:ventas@damp.com"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active transition-colors shadow-sm"
              >
                Solicitar Demo
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`md:hidden p-2 transition-colors ${
              isDark ? 'text-neutral-300 hover:text-white' : 'text-muted hover:text-foreground'
            }`}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <nav
          id="mobile-nav-menu"
          className="md:hidden border-t border-border bg-background px-6 py-4 flex flex-col gap-1 text-sm font-medium text-muted"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="py-2.5 hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          {!isSignedIn && (
            <Link
              href="/sign-in"
              onClick={() => setIsOpen(false)}
              className="py-2.5 hover:text-foreground transition-colors sm:hidden"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
