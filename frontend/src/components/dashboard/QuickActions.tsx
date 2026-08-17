import { CirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function QuickActions() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 lg:col-span-1">
      <h3 className="font-bold text-lg text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
        Acciones Rápidas
      </h3>
      <div className="flex flex-col gap-3">
        <Button
          href="/farms/new"
          label="Registrar Campo"
          icon={CirclePlus}
          variant="outline"
          size="md"
          className="w-full justify-start text-left bg-zinc-150/10 dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#212124] text-zinc-900 dark:text-white font-medium"
        />
        <Button
          href="/animals/new"
          label="Registrar Nuevo Animal"
          icon={CirclePlus}
          variant="outline"
          size="md"
          className="w-full justify-start text-left bg-zinc-150/10 dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#212124] text-zinc-900 dark:text-white font-medium"
        />
        <Button
          href="/animals"
          label="Ver Panel de Monitoreo"
          icon={CirclePlus}
          variant="outline"
          size="md"
          className="w-full justify-start text-left bg-zinc-150/10 dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#212124] text-zinc-900 dark:text-white font-medium"
        />
      </div>
    </div>
  );
}
