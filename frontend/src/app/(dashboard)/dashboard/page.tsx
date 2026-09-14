'use client';

import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { FarmsPanel } from '@/components/dashboard/FarmsPanel';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useApi } from '@/hooks/useApi';
import { farmsApi } from '@/lib/api/farms';
import { alertsApi } from '@/lib/api/alerts';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';

export default function Home() {
  const { user, emulatedUser } = useAuth();
  const { data: farms = [], loading: loadingFarms } = useApi(farmsApi.getAll);

  const { data: alerts = [], loading: loadingAlerts } = useApi(() => alertsApi.getAll({ resolved: false }));

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="el Dashboard y Métricas de Campo" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Bienvenido</h1>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <KpiGrid farms={farms} alertsLength={alerts.length} loadingFarms={loadingFarms} loadingAlerts={loadingAlerts} />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tus Campos */}
        <FarmsPanel farms={farms} loading={loadingFarms} />

        {/* Quick Actions Panel */}
        <QuickActions />
      </div>
    </div>
  );
}
