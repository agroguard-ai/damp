import { apiFetch } from './client';

export interface FarmDashboard {
  totalAnimals: number;
  assignedCollars: number;
  totalZones: number;
  activeGeofences: number;
  unresolvedAlerts: number;
  alertsByType: { type: string; count: number }[];
  alertsByDay: { date: string; count: number }[];
}

export const reportsApi = {
  /** GET /api/reports/farms/[farmId]/dashboard — KPIs y series para gráficos */
  getDashboard: (farmId: string): Promise<FarmDashboard> =>
    apiFetch<FarmDashboard>(`/api/reports/farms/${farmId}/dashboard`),
};
