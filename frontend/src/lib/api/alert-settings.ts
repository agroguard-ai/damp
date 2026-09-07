import { apiFetch } from './client';
import type { AlertSettings, UpdateAlertSettingsPayload } from '@/types';

export const alertSettingsApi = {
  /** GET /api/farms/[farmId]/alert-settings — returns effective thresholds (or defaults) for a farm */
  getByFarm: (farmId: string): Promise<AlertSettings> => apiFetch<AlertSettings>(`/api/farms/${farmId}/alert-settings`),

  /** PUT /api/farms/[farmId]/alert-settings — creates/updates the threshold configuration for a farm */
  update: (farmId: string, data: UpdateAlertSettingsPayload): Promise<AlertSettings> =>
    apiFetch<AlertSettings>(`/api/farms/${farmId}/alert-settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
