import { StaffList } from '@/components/roles/StaffList';
import { Users } from 'lucide-react';

export default function PersonalPage() {
  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
        <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        Gestión de Personal
      </h1>
      <StaffList />
    </div>
  );
}
