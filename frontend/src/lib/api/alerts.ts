import { apiFetch } from './client';
import type { Alert, AlertsQueryParams } from '@/types';

export const alertsApi = {
  /** GET /api/alerts — returns alerts for the authenticated user, optionally filtered */
  getAll: (params: AlertsQueryParams = {}): Promise<Alert[]> => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    );
    const qs = query.toString();
    return apiFetch<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`);
  },

  /** PATCH /api/alerts/[id]/resolve — marks an alert as resolved */
  resolve: (id: string): Promise<Alert> => apiFetch<Alert>(`/api/alerts/${id}/resolve`, { method: 'PATCH' }),
};
