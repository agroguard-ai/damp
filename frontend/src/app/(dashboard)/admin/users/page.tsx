import { AdminUserList } from '@/components/roles/AdminUserList';
import { Users } from 'lucide-react';

export default function AdminUsersPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-green-600 dark:text-green-500" />
            Panel Superadmin: Usuarios de la Plataforma
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gestión global de clientes, productores y administradores del sistema
          </p>
        </div>
      </div>
      <AdminUserList />
    </div>
  );
}
