import { FarmUserList } from '@/components/roles/FarmUserList';

export default async function FarmUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios y Permisos de Granja</h1>
      </div>
      <FarmUserList farmId={id} />
    </div>
  );
}
