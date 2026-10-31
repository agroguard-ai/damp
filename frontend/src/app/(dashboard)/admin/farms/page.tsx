'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, MapPin, Tag, ShieldCheck, ChevronRight } from 'lucide-react';
import { Pagination, PaginationMeta } from '@/components/ui/Pagination';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface FarmAdminRecord {
  id: string;
  name: string | null;
  address: string | null;
  province: string | null;
  location: string | null;
  totalAreaHa: number | null;
  isActive: boolean;
  archivedAt: string | null;
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
    geofences: number;
    gateways: number;
    farmUsers: number;
  };
}

export default function AdminFarmsPage() {
  const { setEmulation } = useAuth();
  const { toast } = useToast();
  const [farms, setFarms] = useState<FarmAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<(PaginationMeta & { activeItems?: number }) | null>(null);

  useEffect(() => {
    async function loadFarms() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/farms?page=${page}&limit=${limit}&includeInactive=true`);
        if (!res.ok) {
          throw new Error('No se pudo cargar la lista global de campos.');
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setFarms(data);
          setMeta(null);
        } else {
          setFarms(data.data || []);
          setMeta(data.meta || null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error de conexión';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void loadFarms();
  }, [page, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-zinc-500 font-medium">Cargando todos los campos del sistema...</div>
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
            Todos los Campos
          </h1>
        </div>
        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
          Activos: {meta?.activeItems ?? farms.filter((f) => f.isActive !== false).length}
          {meta && meta.totalItems > (meta.activeItems ?? 0) && (
            <span className="text-zinc-400 dark:text-zinc-500">
              {' '}
              · Archivados: {meta.totalItems - (meta.activeItems ?? 0)}
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {farms.map((f) => {
          const adminMember = f.farmUsers.find((fu) => fu.role.name === 'ADMIN')?.user;
          const isArchived = f.isActive === false;
          return (
            <div
              key={f.id}
              className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                isArchived ? 'border-zinc-200 dark:border-zinc-800 opacity-75' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white leading-tight">
                    {f.name || 'Campo sin nombre'}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isArchived
                        ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        : 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {isArchived ? 'Archivado' : 'Activo'}
                  </span>
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-4 gap-y-1">
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

                {/* Administrador del campo */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                    <span className="block font-bold text-zinc-900 dark:text-white">{f._count.geofences}</span>
                    <span className="text-[10px] text-zinc-500">Cercos</span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                    <span className="block font-bold text-zinc-900 dark:text-white">{f._count.farmUsers}</span>
                    <span className="text-[10px] text-zinc-500">Miembros</span>
                  </div>
                </div>
              </div>

              {/* Gestión de empleados: el personal es del administrador de campos, así que se entra emulándolo */}
              {adminMember && !isArchived && (
                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                  <button
                    onClick={() =>
                      void setEmulation(adminMember.id, '/personal').catch((err: unknown) =>
                        toast.error(err instanceof Error ? err.message : 'Error al iniciar emulación')
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Gestionar Empleados
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {meta && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <Pagination
            meta={meta}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
