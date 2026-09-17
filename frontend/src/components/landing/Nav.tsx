import Link from 'next/link';
import { ArrowRight, Menu } from 'lucide-react';
import { Brand } from './Brand';

export function Nav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Brand className="text-lg text-foreground" />

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <a href="#producto" className="hover:text-foreground transition-colors">
            Producto
          </a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">
            Cómo funciona
          </a>
          <a href="#arquitectura" className="hover:text-foreground transition-colors">
            Arquitectura
          </a>
          <a href="#planes" className="hover:text-foreground transition-colors">
            Planes
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700 transition-colors shadow-sm"
            >
              Ir al dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-foreground hover:text-primary-600 transition-colors"
              >
                Iniciar sesión
              </Link>
              <a
                href="mailto:ventas@damp.com"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700 transition-colors shadow-sm"
              >
                Solicitar Demo
              </a>
            </>
          )}
          <button className="md:hidden p-2 text-muted" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
