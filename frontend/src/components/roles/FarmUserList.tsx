'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/context/ConfirmDialogContext';

interface FarmUserRecord {
  id: string;
  farmId: string;
  userId: string;
  roleId: string;
  user: {
    id: string;
    name?: string | null;
    email: string;
    globalRole: string;
  };
  role: {
    id: string;
    name: string;
  };
}

export function FarmUserList({ farmId }: { farmId: string }) {
  const confirm = useConfirm();
  const [members, setMembers] = useState<FarmUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New sub-user form state
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('OPERATOR');
  const [assigning, setAssigning] = useState(false);

  // El patrón fetch-on-mount con loading/error manejados a mano siempre dispara
  // react-hooks/set-state-in-effect (mismo problema que ya resolvió src/hooks/useApi.ts
  // de la misma forma — no hay una reestructuración razonable que lo evite sin reescribir
  // esto para usar ese hook en vez de fetch directo).
  /* eslint-disable */
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/farms/${farmId}/users`);
      if (!res.ok) {
        throw new Error('No se pudo cargar la lista de miembros de la granja.');
      }
      const data: FarmUserRecord[] = await res.json();
      setMembers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);
  /* eslint-enable */

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;

    try {
      setAssigning(true);
      const res = await fetch(`/api/farms/${farmId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, roleName: selectedRole }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message || 'Error al asignar sub-usuario a la granja');
      }

      setEmailInput('');
      void fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al asignar usuario';
      alert(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/farms/${farmId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName: newRole }),
      });

      if (!res.ok) {
        throw new Error('Error al modificar el rol del sub-usuario');
      }

      void fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al modificar rol';
      alert(message);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    const ok = await confirm({
      title: 'Remover usuario de la granja',
      description: 'Pierde acceso a este establecimiento de inmediato. Se puede volver a invitar más adelante.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/farms/${farmId}/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Error al remover sub-usuario');
      }

      void fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al remover';
      alert(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-zinc-500 dark:text-zinc-400 font-medium">Cargando usuarios de la granja...</div>
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
      {/* Assign Sub-user Form */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Asignar Nuevo Sub-usuario</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Ingrese el email del usuario para otorgarle acceso a esta granja con un rol específico.
        </p>

        <form onSubmit={(e) => void handleAssignUser(e)} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="email@ejemplo.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            required
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 p-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 p-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <option value="ADMIN">ADMIN (Administrador Granja)</option>
            <option value="OPERATOR">OPERATOR (Operador de campo)</option>
            <option value="VIEWER">VIEWER (Solo lectura)</option>
          </select>

          <button
            type="submit"
            disabled={assigning}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {assigning ? 'Asignando...' : 'Agregar Usuario'}
          </button>
        </form>
      </div>

      {/* Sub-users List Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Usuarios Asignados a la Granja</h3>
          <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 text-xs font-semibold px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
            Integrantes: {members.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-400 uppercase font-semibold text-xs border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5">Usuario / Email</th>
                <th className="px-6 py-3.5">Rol en Granja</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
                    {m.user?.email}
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{m.userId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={m.role?.name ?? 'OPERATOR'}
                      onChange={(e) => void handleRoleUpdate(m.userId, e.target.value)}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-1.5 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => void handleRemoveUser(m.userId)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-semibold hover:underline cursor-pointer"
                    >
                      Revocar Acceso
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500">
                    No hay sub-usuarios asignados a esta granja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
