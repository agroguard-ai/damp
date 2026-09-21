import { apiFetch } from './client';
import type { Zone, CreateZonePayload } from '@/types';

export const zonesApi = {
  /** GET /api/zones?farmId=xxx — returns all zones for a given farm */
  getByFarm: (farmId: string): Promise<Zone[]> => apiFetch<Zone[]>(`/api/zones?farmId=${farmId}`),

  /** GET /api/zones/[id] — returns a single zone */
  getOne: (id: string): Promise<Zone> => apiFetch<Zone>(`/api/zones/${id}`),

  /** POST /api/zones — creates a new zone */
  create: (data: CreateZonePayload): Promise<Zone> =>
    apiFetch<Zone>('/api/zones', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/zones/[id] — updates an existing zone */
  update: ({ id, ...data }: { id: string } & Partial<CreateZonePayload>): Promise<Zone> =>
    apiFetch<Zone>(`/api/zones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** DELETE /api/zones/[id] — deletes a zone */
  delete: (id: string): Promise<void> => apiFetch<void>(`/api/zones/${id}`, { method: 'DELETE' }),
};
