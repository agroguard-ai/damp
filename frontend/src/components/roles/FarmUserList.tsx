'use client';

import { useState, useEffect, useCallback } from 'react';

interface FarmUserRecord {
  id: string;
  farmId: string;
  userId: string;
  roleId: string;
  user: {
    id: string;
    clerkId: string;
    email: string;
    globalRole: string;
  };
  role: {
    id: string;
    name: string;
  };
}

export function FarmUserList({ farmId }: { farmId: string }) {
  const [members, setMembers] = useState<FarmUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New sub-user form state
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('OPERATOR');
  const [assigning, setAssigning] = useState(false);

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
    if (!confirm('¿Está seguro de remover a este usuario de la granja?')) return;

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
        <div className="text-gray-500 font-medium">Cargando usuarios de la granja...</div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Assign Sub-user Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Asignar Nuevo Sub-usuario</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ingrese el email del usuario para otorgarle acceso a esta granja con un rol específico.
        </p>

        <form onSubmit={(e) => void handleAssignUser(e)} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="email@ejemplo.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            required
            className="flex-1 rounded-md border-gray-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="rounded-md border-gray-300 border p-2 text-sm bg-gray-50 font-medium"
          >
            <option value="ADMIN">ADMIN (Administrador Granja)</option>
            <option value="OPERATOR">OPERATOR (Operador de campo)</option>
            <option value="VIEWER">VIEWER (Solo lectura)</option>
          </select>

          <button
            type="submit"
            disabled={assigning}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            {assigning ? 'Asignando...' : 'Agregar Usuario'}
          </button>
        </form>
      </div>

      {/* Sub-users List Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">Usuarios Asignados a la Granja</h3>
          <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full">
            Integrantes: {members.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Usuario / Email</th>
                <th className="px-6 py-3">Rol en Granja</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {m.user?.email}
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{m.userId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={m.role?.name ?? 'OPERATOR'}
                      onChange={(e) => void handleRoleUpdate(m.userId, e.target.value)}
                      className="rounded-md border-gray-300 border p-1.5 text-xs font-semibold bg-gray-50 text-gray-800"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => void handleRemoveUser(m.userId)}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold hover:underline"
                    >
                      Revocar Acceso
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
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
