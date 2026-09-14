'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  Users,
  Building2,
} from 'lucide-react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, emulatedUser } = useAuth();

  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
  const isEmulating = isSuperAdmin && !!emulatedUser;
  const isSuperAdminWithoutEmulation = isSuperAdmin && !isEmulating;

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
      <nav className="flex-1 py-6 px-3 space-y-4 overflow-y-auto">
        {/* MODO 1: SUPER_ADMIN SIN EMULACIÓN (Gestión Central & Inventario) */}
        {isSuperAdminWithoutEmulation ? (
          <>
            <div className="space-y-1.5">
              {!isCollapsed && (
                <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-purple-400">
                  Inventario & Plataforma
                </div>
              )}
              {/* Tipos de Animal: ABM exclusivo para SuperAdmin */}
              <SidebarLink
                href="/animal-types"
                label="Tipos de Animal"
                logo={<Tags className="text-purple-400" />}
                isCollapsed={isCollapsed}
              />
              {/* Collares: Inventario global de hardware */}
              <SidebarLink
                href="/collares"
                label="Collares (Flota)"
                logo={<Radio className="text-purple-400" />}
                isCollapsed={isCollapsed}
              />
              {/* Gateways: Hardware de retransmisión */}
              <SidebarLink
                href="/gateways"
                label="Gateways LoRa"
                logo={<Router className="text-purple-400" />}
                isCollapsed={isCollapsed}
              />
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              {!isCollapsed && (
                <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-purple-400">
                  Administración Global
                </div>
              )}
              <SidebarLink
                href="/admin/users"
                label="Usuarios Sistema"
                logo={<Users className="text-purple-400" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/admin/farms"
                label="Todas las Granjas"
                logo={<Building2 className="text-purple-400" />}
                isCollapsed={isCollapsed}
              />
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              {!isCollapsed && (
                <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Gestión de Campo (Requiere Emular)
                </div>
              )}
              <SidebarLink
                href="/dashboard"
                label="Dashboard"
                logo={<LayoutDashboard className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/farms/new"
                label="Campos"
                logo={<Tractor className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/zonas"
                label="Zonas"
                logo={<Map className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/animals"
                label="Hacienda"
                logo={<ClipboardList className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/geolocalizacion"
                label="Geolocalización"
                logo={<MapPin className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/alertas"
                label="Alertas"
                logo={<Bell className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
              <SidebarLink
                href="/reportes"
                label="Reportes"
                logo={<FileDown className="opacity-70" />}
                isCollapsed={isCollapsed}
              />
            </div>
          </>
        ) : (
          /* MODO 2: GRANJERO / USUARIO ESTÁNDAR O SUPER_ADMIN EMULANDO */
          <div className="space-y-1.5">
            <SidebarLink href="/dashboard" label="Dashboard" logo={<LayoutDashboard />} isCollapsed={isCollapsed} />
            <SidebarLink href="/farms/new" label="Campos" logo={<Tractor />} isCollapsed={isCollapsed} />
            <SidebarLink href="/zonas" label="Zonas" logo={<Map />} isCollapsed={isCollapsed} />
            <SidebarLink href="/animals" label="Hacienda" logo={<ClipboardList />} isCollapsed={isCollapsed} />
            <SidebarLink href="/geolocalizacion" label="Geolocalización" logo={<MapPin />} isCollapsed={isCollapsed} />
            {/* Collares: solo collares contratados */}
            <SidebarLink href="/collares" label="Collares" logo={<Radio />} isCollapsed={isCollapsed} />
            {/* Gateways: solo de este campo */}
            <SidebarLink href="/gateways" label="Gateways" logo={<Router />} isCollapsed={isCollapsed} />
            <SidebarLink href="/alertas" label="Alertas" logo={<Bell />} isCollapsed={isCollapsed} />
            <SidebarLink href="/reportes" label="Reportes" logo={<FileDown />} isCollapsed={isCollapsed} />
          </div>
        )}
      </nav>
    </aside>
  );
}
