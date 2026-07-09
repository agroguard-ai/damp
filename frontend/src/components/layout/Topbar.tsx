'use client';

import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/farms/new': 'Campos',
  '/zonas': 'Zonas',
  '/animals': 'Hacienda (Monitoreo)',
  '/animals/new': 'Registrar Animal',
  '/geolocalizacion': 'Geolocalización',
  '/animal-types': 'Tipos de Animal',
};

function getTitleFromPathname(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }

  if (pathname.startsWith('/animals/')) {
    return 'Hacienda';
  }
  if (pathname.startsWith('/farms/')) {
    return 'Campos';
  }
  if (pathname.startsWith('/zonas/')) {
    return 'Zonas';
  }

  return 'DAMP Agro';
}

export default function Topbar() {
  const pathname = usePathname();
  const pageTitle = getTitleFromPathname(pathname);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
      <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{pageTitle}</h2>
      <div className="flex items-center gap-4">
        <UserButton />
      </div>
    </header>
  );
}
