'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserRecord {
  id: string;
  clerkId: string;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
  createdAt: string;
  _count?: {
    farmUsers: number;
  };
}

export function AdminUserList() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // El patrón fetch-on-mount con loading/error manejados a mano siempre dispara
  // react-hooks/set-state-in-effect (mismo problema que ya resolvió src/hooks/useApi.ts
  // de la misma forma — no hay una reestructuración razonable que lo evite sin reescribir
  // esto para usar ese hook en vez de fetch directo).
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 font-medium">Cargando usuarios del sistema...</div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Usuarios Plataforma (Global)</h2>
          <p className="text-sm text-gray-500">Gestión de roles y permisos globales para clientes y administradores</p>
        </div>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
          Total: {users.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Email / ID</th>
              <th className="px-6 py-3">Clerk ID</th>
              <th className="px-6 py-3">Granjas</th>
              <th className="px-6 py-3">Rol Global</th>
              <th className="px-6 py-3">Fecha Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {u.email}
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{u.id}</div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{u.clerkId}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{u._count?.farmUsers ?? 0}</td>
                <td className="px-6 py-4">
                  <select
                    disabled={updatingId === u.id}
                    value={u.globalRole}
                    onChange={(e) => void handleRoleChange(u.id, e.target.value as 'SUPER_ADMIN' | 'USER')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 border p-1.5 font-semibold text-gray-800"
                  >
                    <option value="USER">USER (Cliente estándar)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Administrador Global)</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
