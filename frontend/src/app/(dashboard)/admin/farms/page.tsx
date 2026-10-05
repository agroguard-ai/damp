'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Users, MapPin, Tag, ShieldCheck, ChevronRight } from 'lucide-react';

interface FarmAdminRecord {
  id: string;
  name: string | null;
  address: string | null;
  province: string | null;
  location: string | null;
  totalAreaHa: number | null;
  renspa: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  farmUsers: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
    role: {
      name: string;
    };
  }>;
  _count: {
    animals: number;
    zones: number;
    gateways: number;
    farmUsers: number;
  };
}

export default function AdminFarmsPage() {
  const [farms, setFarms] = useState<FarmAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFarms() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/farms');
        if (!res.ok) {
          throw new Error('No se pudo cargar la lista global de granjas.');
        }
        const data = await res.json();
        setFarms(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error de conexión';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void loadFarms();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-zinc-500 font-medium">Cargando todas las granjas del sistema...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 w-full">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-purple-600" />
            Todas las Granjas
          </h1>
        </div>
        <div className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200">
          Total Granjas: {farms.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {farms.map((f) => {
          const adminMember = f.farmUsers.find((fu) => fu.role.name === 'ADMIN')?.user;
          return (
            <div
              key={f.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white leading-tight">
                    {f.name || 'Granja sin nombre'}
                  </h3>
                  {f.renspa && (
                    <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                      {f.renspa}
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  {(f.location || f.province) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{[f.location, f.province].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {f.totalAreaHa != null && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{f.totalAreaHa} Hectáreas</span>
                    </div>
                  )}
                </div>

                {/* Administrador de la granja */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                    Administrador Único:
                  </span>
                  {adminMember ? (
                    <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-100 dark:border-purple-900/50">
                      <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="text-xs">
                        <div className="font-semibold text-purple-900 dark:text-purple-200">
                          {adminMember.name || 'Sin nombre'}
                        </div>
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                          {adminMember.email}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">Sin administrador asignado</span>
                  )}
                </div>

                {/* Métricas rápidas */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                    <span className="block font-bold text-zinc-900 dark:text-white">{f._count.animals}</span>
                    <span className="text-[10px] text-zinc-500">Animales</span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                    <span className="block font-bold text-zinc-900 dark:text-white">{f._count.zones}</span>
                    <span className="text-[10px] text-zinc-500">Zonas</span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                    <span className="block font-bold text-zinc-900 dark:text-white">{f._count.farmUsers}</span>
                    <span className="text-[10px] text-zinc-500">Miembros</span>
                  </div>
                </div>
              </div>

              {/* Botón de gestión de empleados */}
              <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link
                  href={`/farms/${f.id}/users`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <Users className="w-3.5 h-3.5" />
                  Gestionar Empleados
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
