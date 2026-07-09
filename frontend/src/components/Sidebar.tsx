'use client';

import { useState } from 'react';
import { SidebarLink } from './SidebarLink';
import { Hexagon, Menu, LayoutDashboard, Globe, Map, ClipboardList, MapPin, Tags } from 'lucide-react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-zinc-800 bg-[#18181b] text-white shrink-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div
        className={`h-16 flex items-center border-b border-zinc-800 transition-all duration-300 ${
          isCollapsed ? 'justify-center px-0' : 'px-6'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-white transition-colors focus:outline-none"
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? (
            <Menu className="w-6 h-6 text-green-600 dark:text-green-500 transition-all duration-300" />
          ) : (
            <div className="flex items-center gap-2.5">
              <Hexagon className="w-6 h-6 text-green-600 dark:text-green-500" />
              <span className="whitespace-nowrap transition-all duration-300">DAMP Agro</span>
            </div>
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav
        className={`flex-1 py-6 space-y-1.5 overflow-y-auto transition-all duration-300 ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}
      >
        {/* Dashboard */}
        <SidebarLink
          href="/"
          label="Dashboard"
          logo={<LayoutDashboard className="w-5 h-5" />}
          isCollapsed={isCollapsed}
        />

        {/* Campos */}
        <SidebarLink href="/farms/new" label="Campos" logo={<Globe className="w-5 h-5" />} isCollapsed={isCollapsed} />

        {/* Zonas */}
        <SidebarLink href="/zonas" label="Zonas" logo={<Map className="w-5 h-5" />} isCollapsed={isCollapsed} />

        {/* Hacienda */}
        <SidebarLink
          href="/animals"
          label="Hacienda"
          logo={<ClipboardList className="w-5 h-5" />}
          isCollapsed={isCollapsed}
        />

        {/* Geolocalización */}
        <SidebarLink
          href="/geolocalizacion"
          label="Geolocalización"
          logo={<MapPin className="w-5 h-5" />}
          isCollapsed={isCollapsed}
        />

        {/* Tipos de Animal */}
        <SidebarLink
          href="/animal-types"
          label="Tipos de Animal"
          logo={<Tags className="w-5 h-5" />}
          isCollapsed={isCollapsed}
        />
      </nav>
    </aside>
  );
}
