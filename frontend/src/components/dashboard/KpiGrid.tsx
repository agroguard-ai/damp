import { Tractor, AlertTriangle, Smartphone } from 'lucide-react';
import { KpiCard } from './KpiCard';
import type { Farm } from '@/types';

interface KpiGridProps {
  farms: Farm[];
  alertsLength: number;
  loadingFarms: boolean;
  loadingAlerts: boolean;
}

export function KpiGrid({ farms, alertsLength, loadingFarms, loadingAlerts }: KpiGridProps) {
  // Compute total hectares
  const totalHectares = farms.reduce((acc, farm) => acc + (farm.totalAreaHa || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Farms Card */}
      <KpiCard
        title="Campos Activos"
        value={loadingFarms ? '...' : farms.length}
        icon={<Tractor className="w-5 h-5 text-zinc-400" />}
        footer={
          <>
            <span className="bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded font-medium text-green-600 dark:text-green-400">
              {loadingFarms ? '...' : `${totalHectares} Ha`}
            </span>
            <span className="text-zinc-500">Superficie administrada</span>
          </>
        }
      />

      {/* Active Alerts Card */}
      <KpiCard
        title="Alertas Activas"
        value={loadingAlerts ? '...' : alertsLength}
        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        footer={
          <>
            <span className="bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded font-medium text-red-650 dark:text-red-400">
              {alertsLength > 0 ? 'Urgente' : 'Ok'}
            </span>
            <span className="text-zinc-500">Fuera de geocerca</span>
          </>
        }
      />

      {/* Offline Devices Card */}
      <KpiCard
        title="Collares Offline"
        value={1}
        icon={<Smartphone className="w-5 h-5 text-amber-500" />}
        footer={
          <>
            <span className="bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded font-medium text-amber-600 dark:text-amber-400">
              Revisar
            </span>
            <span className="text-zinc-500">Sin señal &gt; 24h</span>
          </>
        }
      />
    </div>
  );
}
