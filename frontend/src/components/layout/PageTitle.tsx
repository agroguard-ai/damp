'use client';

import { usePathname } from 'next/navigation';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/farms/new': 'Campos',
  '/zonas': 'Zonas',
  '/animals': 'Hacienda',
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

export default function PageTitle() {
  const pathname = usePathname();
  const pageTitle = getTitleFromPathname(pathname);

  return <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{pageTitle}</h2>;
}
