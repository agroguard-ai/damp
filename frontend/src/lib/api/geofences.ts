import { apiFetch } from './client';
import type { Geofence, CreateGeofencePayload } from '@/types';

export const geofencesApi = {
  /** GET /api/geofences?farmId=xxx — returns all geofences for a given farm */
  getByFarm: (farmId: string): Promise<Geofence[]> => apiFetch<Geofence[]>(`/api/geofences?farmId=${farmId}`),

  /** POST /api/geofences — creates a new geofence within a farm */
  create: (data: CreateGeofencePayload): Promise<Geofence> =>
    apiFetch<Geofence>('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/geofences/[id]/deactivate — deactivates a geofence (baja lógica) */
  deactivate: (id: string): Promise<Geofence> =>
    apiFetch<Geofence>(`/api/geofences/${id}/deactivate`, { method: 'PATCH' }),
};
