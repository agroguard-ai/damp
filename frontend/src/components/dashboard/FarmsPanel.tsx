import { Farm } from '@/types';

interface FarmsPanelProps {
  farms: Farm[];
  loading: boolean;
}

export function FarmsPanel({ farms, loading }: FarmsPanelProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 lg:col-span-2">
      <h3 className="font-bold text-lg text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
        Tus Campos Registrados
      </h3>
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">No tienes campos registrados aún en tu cuenta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {farms.map((farm) => (
            <div
              key={farm.id}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50/50 dark:bg-zinc-950/50 hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white text-base">{farm.name}</h4>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-850 flex justify-between items-center text-xs">
                <span className="text-zinc-500">Superficie</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{farm.totalAreaHa} Ha</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
