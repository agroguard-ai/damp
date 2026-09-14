'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, Users, ArrowRight, Loader2, Search } from 'lucide-react';
import Link from 'next/link';

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  globalRole: string;
  _count?: {
    farmUsers: number;
  };
}

export function EmulationRequiredState({ title = 'Recursos del Sistema' }: { title?: string }) {
  const { setEmulation } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Error fetching users for emulation:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.globalRole !== 'SUPER_ADMIN' &&
      (u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(search.toLowerCase())))
  );

  const handleSelect = async (id: string) => {
    try {
      setSelectingId(id);
      await setEmulation(id);
    } catch (err) {
      console.error('Failed to emulate user:', err);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <Eye className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Seleccioná un Usuario para Emular</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Como Superadministrador, para visualizar y gestionar {title} debés seleccionar a qué cuenta o cliente deseás
            representar. Las acciones se realizarán en su nombre.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4 text-left">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* User selector list */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-200 dark:divide-zinc-800 max-h-64 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/40">
            {loading ? (
              <div className="p-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando usuarios...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">No se encontraron usuarios coincidentes.</div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void handleSelect(u.id)}
                  disabled={selectingId === u.id}
                  className="w-full text-left px-4 py-3 hover:bg-purple-500/10 transition-colors flex items-center justify-between gap-3 group cursor-pointer disabled:opacity-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {u.name || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                      {u._count?.farmUsers ?? 0} granjas
                    </span>
                    {selectingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            <Users className="w-3.5 h-3.5" />
            Gestionar todos los usuarios en el Panel Global
          </Link>
        </div>
      </div>
    </div>
  );
}
