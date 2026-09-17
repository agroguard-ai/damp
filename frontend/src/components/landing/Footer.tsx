import Link from 'next/link';
import { Brand } from './Brand';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Brand className="text-base" />
        <p className="text-sm text-subtle text-center sm:text-right">
          © {new Date().getFullYear()} DAMP Agro. Plataforma de gestión ganadera de precisión.
        </p>
        <div className="flex items-center gap-6 text-sm text-muted">
          <Link href="/arquitectura" className="hover:text-foreground transition-colors font-medium">
            Arquitectura
          </Link>
          <a
            href="/architecture.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Diagrama standalone
          </a>
        </div>
      </div>
    </footer>
  );
}
