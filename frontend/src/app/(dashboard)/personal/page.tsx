import { StaffList } from '@/components/roles/StaffList';
import { Users } from 'lucide-react';

export default function PersonalPage() {
  return (
    <div className="p-page-sm md:p-frame w-full space-y-gutter">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
        <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        Gestión de Personal
      </h1>
      <StaffList />
    </div>
  );
}
