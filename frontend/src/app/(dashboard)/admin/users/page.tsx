import { AdminUserList } from '@/components/roles/AdminUserList';

export default function AdminUsersPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración Global</h1>
      </div>
      <AdminUserList />
    </div>
  );
}
