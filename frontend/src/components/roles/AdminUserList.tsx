'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, Key, Copy, Check, X, ShieldAlert, ShieldCheck, Loader2, Eye } from 'lucide-react';

interface UserRecord {
  id: string;
  name: string | null;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
  mustChangePassword?: boolean;
  createdAt: string;
  _count?: {
    farmUsers: number;
  };
}

export function AdminUserList() {
  const { setEmulation } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'USER' | 'SUPER_ADMIN'>('USER');
  const [formPassword, setFormPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /* eslint-disable */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error('No se pudo cargar la lista de usuarios globales.');
      }
      const data: UserRecord[] = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);
  /* eslint-enable */

  const handleRoleChange = async (userId: string, newRole: 'SUPER_ADMIN' | 'USER') => {
    try {
      setUpdatingId(userId);
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalRole: newRole }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar el rol global del usuario');
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, globalRole: newRole } : u)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      alert(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formName) return;

    try {
      setCreating(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          globalRole: formRole,
          initialPassword: formPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al crear usuario');
      }

      setCreatedCredentials({
        email: data.user.email,
        pass: data.temporaryPassword,
      });

      setUsers((prev) => [data.user, ...prev]);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('USER');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear usuario';
      alert(message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Acceso a DAMP Agro:\nUsuario: ${createdCredentials.email}\nContraseña Temporal: ${createdCredentials.pass}\n(Deberás cambiar la contraseña en tu primer ingreso)`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartEmulation = async (userId: string) => {
    try {
      await setEmulation(userId, '/dashboard');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al iniciar emulación');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        <div className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Cargando usuarios del sistema...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Table Top Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Usuarios Plataforma (Global)</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Gestión de clientes y administradores creados por Ventas o SuperAdmin
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
              Total: {users.length}
            </span>
            <button
              onClick={() => {
                setCreatedCredentials(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Usuario / Cliente
            </button>
          </div>
        </div>

        {/* Credentials Banner when a user was just created */}
        {createdCredentials && (
          <div className="m-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ¡Usuario creado! Compartí estas credenciales provisionales con el cliente:
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Email:</span> {createdCredentials.email} |{' '}
                <span className="font-semibold">Clave temporal:</span>{' '}
                <code className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono font-bold text-amber-950 dark:text-amber-100 border border-amber-300/50 dark:border-amber-700/50">
                  {createdCredentials.pass}
                </code>
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                * El cliente deberá cambiar esta clave obligatoriamente en su primer inicio de sesión.
              </div>
            </div>
            <button
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar Credenciales'}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-400 uppercase font-semibold text-xs border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5">Nombre / Usuario</th>
                <th className="px-6 py-3.5">Email / ID</th>
                <th className="px-6 py-3.5">Granjas</th>
                <th className="px-6 py-3.5">Rol Global</th>
                <th className="px-6 py-3.5">Estado Clave</th>
                <th className="px-6 py-3.5">Fecha Alta</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">{u.name || 'Sin nombre'}</td>
                  <td className="px-6 py-4 font-medium text-zinc-800 dark:text-zinc-200">
                    {u.email}
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{u.id}</div>
                  </td>
                  <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-medium">{u._count?.farmUsers ?? 0}</td>
                  <td className="px-6 py-4">
                    <select
                      disabled={updatingId === u.id}
                      value={u.globalRole}
                      onChange={(e) => void handleRoleChange(u.id, e.target.value as 'SUPER_ADMIN' | 'USER')}
                      className="block w-full rounded-lg border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-xs bg-zinc-50 dark:bg-zinc-800 border p-2 font-semibold text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="USER">USER (Usuario estándar)</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (Administrador Global)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {u.mustChangePassword ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Provisional (Pendiente)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                        <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        Clave definitiva
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(u.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.globalRole !== 'SUPER_ADMIN' ? (
                      <button
                        onClick={() => void handleStartEmulation(u.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                        title={`Emular a ${u.name || u.email} e interactuar en su nombre`}
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Emular
                      </button>
                    ) : (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic select-none">
                        No emulable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-600 dark:text-green-400 border border-green-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Crear Usuario / Cliente</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Alta de cuenta por equipo de ventas / administración
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nombre Completo o Razón Social
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Agropecuaria El Ombú"
                  className="w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contacto@elombu.com"
                  className="w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Rol Global</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as 'USER' | 'SUPER_ADMIN')}
                  className="w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="USER">USER (Cliente / Productor estándar)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Super Administrador Plataforma)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Contraseña Temporal <span className="font-normal text-zinc-400">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Dejar vacío para generar automáticamente"
                  minLength={8}
                  className="w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  El cliente deberá cambiar esta clave obligatoriamente la primera vez que inicie sesión.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
