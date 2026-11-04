import { StaffList } from '@/components/roles/StaffList';
import { Users } from 'lucide-react';

export default function PersonalPage() {
  return (
    <div className="p-page-sm md:p-frame w-full space-y-gutter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-green-600 dark:text-green-500" />
          Gestión de Personal
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Operadores y lectores de tus campos. Cada persona tiene el mismo rol en todos sus campos.
        </p>
      </div>
      <StaffList />
    </div>
  );
}
