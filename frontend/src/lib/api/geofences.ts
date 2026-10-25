import { apiFetch } from './client';
import type { Geofence, CreateGeofencePayload, UpdateGeofencePayload } from '@/types';

export const geofencesApi = {
  /** GET /api/geofences?farmId=xxx — returns all geofences for a given farm */
  getByFarm: (farmId: string): Promise<Geofence[]> => apiFetch<Geofence[]>(`/api/geofences?farmId=${farmId}`),

  /** POST /api/geofences — creates a new geofence within a farm */
  create: (data: CreateGeofencePayload): Promise<Geofence> =>
    apiFetch<Geofence>('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/geofences/[id] — edits name, pasture and/or polygon of a geofence */
  update: ({ id, ...data }: { id: string } & UpdateGeofencePayload): Promise<Geofence> =>
    apiFetch<Geofence>(`/api/geofences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/geofences/[id]/deactivate — deactivates a geofence (baja lógica) */
  deactivate: (id: string): Promise<Geofence> =>
    apiFetch<Geofence>(`/api/geofences/${id}/deactivate`, { method: 'PATCH' }),

  /** PATCH /api/geofences/[id]/activate — activates a geofence */
  activate: (id: string): Promise<Geofence> =>
    apiFetch<Geofence>(`/api/geofences/${id}/activate`, { method: 'PATCH' }),
};
