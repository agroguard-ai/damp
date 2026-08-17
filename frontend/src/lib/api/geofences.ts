import { apiFetch } from './client';
import type { Geofence, CreateGeofencePayload } from '@/types';

export const geofencesApi = {
  /** GET /api/geofences?zoneId=xxx — returns all geofences for a given zone */
  getByZone: (zoneId: string): Promise<Geofence[]> => apiFetch<Geofence[]>(`/api/geofences?zoneId=${zoneId}`),

  /** POST /api/geofences — creates a new geofence within a zone */
  create: (data: CreateGeofencePayload): Promise<Geofence> =>
    apiFetch<Geofence>('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/geofences/[id]/deactivate — deactivates a geofence (baja lógica) */
  deactivate: (id: string): Promise<Geofence> =>
    apiFetch<Geofence>(`/api/geofences/${id}/deactivate`, { method: 'PATCH' }),
};
