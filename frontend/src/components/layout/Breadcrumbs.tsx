'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

// Etiquetas en español para los segmentos de ruta conocidos (item 2.1 del análisis UX/UI:
// reemplaza el título estático duplicado del Topbar por breadcrumbs dinámicos).
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  farms: 'Campos',
  new: 'Nuevo',
  users: 'Usuarios',
  animals: 'Hacienda',
  zonas: 'Zonas',
  cercos: 'Cercos',
  collares: 'Collares',
  gateways: 'Gateways',
  alertas: 'Alertas',
  reportes: 'Reportes',
  geolocalizacion: 'Geolocalización',
  'animal-types': 'Tipos de Animal',
  admin: 'Administración',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IDs (UUID o numéricos) en la URL: no hay nombre legible sin una consulta extra, se muestran truncados. */
function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (UUID_PATTERN.test(segment)) return `#${segment.slice(0, 8)}`;
  if (/^\d+$/.test(segment)) return `#${segment}`;
  return segment;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-white">
        <Home className="w-4 h-4 text-green-600" />
        Dashboard
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
      <Link
        href="/dashboard"
        className="text-zinc-400 hover:text-green-600 dark:hover:text-green-400 transition-colors shrink-0"
      >
        <Home className="w-4 h-4" />
      </Link>
      {segments.map((segment, idx) => {
        const href = '/' + segments.slice(0, idx + 1).join('/');
        const isLast = idx === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-zinc-900 dark:text-white truncate">{labelFor(segment)}</span>
            ) : (
              <Link
                href={href}
                className="text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 transition-colors truncate"
              >
                {labelFor(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
