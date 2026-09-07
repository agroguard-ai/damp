'use client';

import { useState } from 'react';
import { SidebarLink } from '@/components/layout/SidebarLink';
import {
  Hexagon,
  Menu,
  LayoutDashboard,
  Tractor,
  Map,
  ClipboardList,
  MapPin,
  Tags,
  Radio,
  Router,
  Bell,
  FileDown,
} from 'lucide-react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-zinc-800 bg-[#18181b] text-white shrink-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center border-b border-zinc-800 px-5 shrink-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center font-bold text-lg tracking-tight text-white transition-colors focus:outline-none cursor-pointer"
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
            <Hexagon
              className={`absolute w-6 h-6 text-green-600 dark:text-green-500 transition-all duration-300 ${
                isCollapsed ? 'opacity-0 scale-75 rotate-90' : 'opacity-100 scale-100 rotate-0'
              }`}
            />
            <Menu
              className={`absolute w-6 h-6 text-green-600 dark:text-green-500 transition-all duration-300 ${
                isCollapsed ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-90'
              }`}
            />
          </div>
          <span
            className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden text-left ${
              isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-40 ml-2.5'
            }`}
          >
            DAMP Agro
          </span>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        {/* Dashboard */}
        <SidebarLink href="/dashboard" label="Dashboard" logo={<LayoutDashboard />} isCollapsed={isCollapsed} />

        {/* Campos */}
        <SidebarLink href="/farms/new" label="Campos" logo={<Tractor />} isCollapsed={isCollapsed} />

        {/* Zonas */}
        <SidebarLink href="/zonas" label="Zonas" logo={<Map />} isCollapsed={isCollapsed} />

        {/* Hacienda */}
        <SidebarLink href="/animals" label="Hacienda" logo={<ClipboardList />} isCollapsed={isCollapsed} />

        {/* Geolocalización */}
        <SidebarLink href="/geolocalizacion" label="Geolocalización" logo={<MapPin />} isCollapsed={isCollapsed} />

        {/* Tipos de Animal */}
        <SidebarLink href="/animal-types" label="Tipos de Animal" logo={<Tags />} isCollapsed={isCollapsed} />

        {/* Collares */}
        <SidebarLink href="/collares" label="Collares" logo={<Radio />} isCollapsed={isCollapsed} />

        {/* Gateways */}
        <SidebarLink href="/gateways" label="Gateways" logo={<Router />} isCollapsed={isCollapsed} />

        {/* Alertas */}
        <SidebarLink href="/alertas" label="Alertas" logo={<Bell />} isCollapsed={isCollapsed} />

        {/* Reportes */}
        <SidebarLink href="/reportes" label="Reportes" logo={<FileDown />} isCollapsed={isCollapsed} />
      </nav>
    </aside>
  );
}
