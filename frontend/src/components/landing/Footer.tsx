import Link from 'next/link';
import { Brand } from './Brand';

const navSectionLinks = [
  { href: '#producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#arquitectura', label: 'Arquitectura' },
  { href: '#planes', label: 'Planes' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#preguntas-frecuentes', label: 'Preguntas' },
];

const secondaryLinks = [
  { href: '/arquitectura', label: 'Arquitectura interactiva', isNextLink: true },
  { href: '/architecture.html', label: 'Diagrama standalone', isExternal: true },
  { href: '#', label: 'Políticas de privacidad' },
  { href: '#', label: 'Términos y condiciones' },
];

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex justify-between">
          <Brand className="text-base text-foreground shrink-0" />
          <div className="flex items-center gap-8 text-sm font-medium text-muted">
            {navSectionLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground transition-colors">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="my-8 border-t border-border w-full" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-subtle text-center lg:text-left">
            <p className="text-xs sm:text-sm">
              © {new Date().getFullYear()} DAMP Agro por Matias Luhmann, Santino Cataldi y Tomás Wardoloff.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-x-6 gap-y-2 text-xs sm:text-sm text-muted shrink-0">
            {secondaryLinks.map((link) => {
              if (link.isNextLink) {
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="hover:text-foreground transition-colors font-medium"
                  >
                    {link.label}
                  </Link>
                );
              }
              if (link.isExternal) {
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <a key={link.label} href={link.href} className="hover:text-foreground transition-colors">
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
