'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User, ShieldCheck, Eye, ChevronDown, Check, X, Search, Loader2 } from 'lucide-react';

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  globalRole: string;
}

export default function Topbar() {
  const { user, emulatedUser, setEmulation, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dropdownOpen && isSuperAdmin && users.length === 0) {
      async function loadUsers() {
        try {
          setLoadingUsers(true);
          const res = await fetch('/api/admin/users');
          if (res.ok) {
            const data = await res.json();
            setUsers(data);
          }
        } catch (err) {
          console.error('Error fetching users for topbar emulation:', err);
        } finally {
          setLoadingUsers(false);
        }
      }
      void loadUsers();
    }
  }, [dropdownOpen, isSuperAdmin, users.length]);

  const filteredUsers = users.filter(
    (u) =>
      u.globalRole !== 'SUPER_ADMIN' &&
      (u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      {/* Left Area: Emulation Selector for SuperAdmin */}
      <div className="flex items-center gap-3">
        {isSuperAdmin && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                emulatedUser
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25'
                  : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Eye
                className={`w-3.5 h-3.5 ${emulatedUser ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`}
              />
              {emulatedUser ? (
                <span>
                  Emulando a:{' '}
                  <span className="font-bold underline underline-offset-2">
                    {emulatedUser.name || emulatedUser.email}
                  </span>
                </span>
              ) : (
                <span>👤 Seleccionar Usuario a Emular</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-3 z-50 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Emular Usuario / Cliente</span>
                  {emulatedUser && (
                    <button
                      onClick={() => {
                        void setEmulation(null);
                        setDropdownOpen(false);
                      }}
                      className="text-[11px] text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Desactivar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  {loadingUsers ? (
                    <div className="p-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Cargando usuarios...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">No hay usuarios.</div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = emulatedUser?.id === u.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            void setEmulation(u.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2.5 hover:bg-purple-500/10 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected ? 'bg-purple-500/15' : ''
                          }`}
                        >
                          <div className="truncate">
                            <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {u.name || 'Sin nombre'}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                              {u.email}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Area: Logged In Admin / User profile */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/60 border border-green-300 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 font-semibold text-xs">
                {user.name ? user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {user.name || user.email}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{user.email}</span>
              </div>
            </div>

            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <ShieldCheck className="w-3 h-3" />
                SUPER ADMIN
              </span>
            )}

            <button
              onClick={() => void logout()}
              title="Cerrar sesión"
              className="p-2 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
