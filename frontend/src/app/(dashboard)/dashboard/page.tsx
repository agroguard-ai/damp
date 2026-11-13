'use client';

import { useState, useMemo } from 'react';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { FarmsPanel } from '@/components/dashboard/FarmsPanel';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { DashboardFieldCycleCard } from '@/components/dashboard/DashboardFieldCycleCard';
import { DashboardChartCard } from '@/components/dashboard/DashboardChartCard';
import { useApi } from '@/hooks/useApi';
import { farmsApi } from '@/lib/api/farms';
import { alertsApi } from '@/lib/api/alerts';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';

export default function Home() {
  const { user, emulatedUser } = useAuth();
  const { data: farms = [], loading: loadingFarms } = useApi(farmsApi.getAll);

  const { data: alerts = [], loading: loadingAlerts } = useApi(() => alertsApi.getAll({ resolved: false }));
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  const activeFarms = useMemo(() => farms.filter((f) => f.isActive !== false), [farms]);
  const effectiveFarmId = useMemo(() => {
    if (selectedFarmId && activeFarms.some((f) => f.id === selectedFarmId)) {
      return selectedFarmId;
    }
    return activeFarms[0]?.id ?? farms[0]?.id ?? '';
  }, [selectedFarmId, activeFarms, farms]);

  const effectiveFarm = useMemo(
    () => farms.find((f) => f.id === effectiveFarmId),
    [farms, effectiveFarmId]
  );

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="el Dashboard y Métricas de Campo" />;
  }

  return (
    <div className="p-page-sm md:p-frame space-y-block">
      {/* KPI Cards Grid */}
      <KpiGrid farms={farms} alertsLength={alerts.length} loadingFarms={loadingFarms} loadingAlerts={loadingAlerts} />

      {/* Campo con animales en ciclo + Gráfica de actividad */}
      {(loadingFarms || farms.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <div className="lg:col-span-2">
            <DashboardFieldCycleCard
              farms={activeFarms.length > 0 ? activeFarms : farms}
              selectedFarmId={effectiveFarmId}
              onSelectFarmId={setSelectedFarmId}
              loadingFarms={loadingFarms}
            />
          </div>
          <div className="lg:col-span-1">
            <DashboardChartCard farmId={effectiveFarmId} farmName={effectiveFarm?.name} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Tus Campos */}
        <FarmsPanel farms={farms} loading={loadingFarms} />

        {/* Quick Actions Panel */}
        <QuickActions />
      </div>
    </div>
  );
}
