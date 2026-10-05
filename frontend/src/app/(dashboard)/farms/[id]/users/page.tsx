import { FarmUserList } from '@/components/roles/FarmUserList';
import { Users } from 'lucide-react';

export default async function FarmUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            Gestión de Usuarios de la Granja
          </h1>
        </div>
      </div>
      <FarmUserList farmId={id} />
    </div>
  );
}
