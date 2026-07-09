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
  if (href === '/') {
    isActive = pathname === '/';
  } else if (href === '/farms/new') {
    // Campos is at /farms/new but checks for /farms base route
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
      className={`flex items-center gap-3 py-2.5 rounded-r-lg rounded-l-none text-sm font-medium transition-all ${
        isCollapsed ? 'justify-center px-0' : 'px-3'
      } ${isActive ? activeClasses : inactiveClasses}`}
      title={isCollapsed ? label : undefined}
    >
      <span className="shrink-0">{logo}</span>
      <span
        className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
          isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
