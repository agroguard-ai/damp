'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import React from 'react';

export interface SidebarLinkProps {
  href: string;
  label: string;
  logo: React.ReactNode;
  isCollapsed?: boolean;
}

export function SidebarLink({ href, label, logo, isCollapsed }: SidebarLinkProps) {
  const pathname = usePathname();

  // Determine if active based on current pathname
  let isActive = false;
  if (href === '/dashboard') {
    isActive = pathname === '/dashboard';
  } else if (href === '/farms') {
    // Campos is at /farms and includes subroutes like /farms/new or /farms/[id]
    isActive = pathname.startsWith('/farms');
  } else if (href === '/animals') {
    // Hacienda is active for /animals, but not when registering animal (/animals/new)
    isActive = pathname.startsWith('/animals') && !pathname.startsWith('/animals/new');
  } else {
    isActive = pathname.startsWith(href);
  }

  const activeClasses = 'border-l-2 border-[#00a63e] bg-[#262629] text-white hover:bg-[#2c2c30]';
  const inactiveClasses = 'border-l-2 border-transparent bg-[#18181b] text-white hover:bg-[#212124]';

  return (
    <Link
      href={href}
      className={`flex items-center py-2.5 rounded-r-lg rounded-l-none text-sm font-medium transition-all pl-2 ${
        isCollapsed ? 'pr-2' : 'pr-3'
      } ${isActive ? activeClasses : inactiveClasses}`}
      title={isCollapsed ? label : undefined}
    >
      <span className="shrink-0 w-6 h-6 flex items-center justify-center">{logo}</span>
      <span
        className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
          isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-40 ml-3 text-base'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
