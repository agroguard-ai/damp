import { apiFetch } from './client';
import type { Farm, CreateFarmPayload } from '@/types';

export const farmsApi = {
  /**
   * GET /api/farms — returns the authenticated user's farms.
   * By default only active farms are returned (operational context); pass
   * `includeInactive` to also list archived farms in the management view.
   */
  getAll: (includeInactive = false): Promise<Farm[]> =>
    apiFetch<Farm[]>(`/api/farms${includeInactive ? '?includeInactive=true' : ''}`),

  /** GET /api/farms/:id — returns a single farm by id */
  getOne: (id: string): Promise<Farm> => apiFetch<Farm>(`/api/farms/${id}`),

  /** POST /api/farms — creates a new farm */
  create: (data: CreateFarmPayload): Promise<Farm> =>
    apiFetch<Farm>('/api/farms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/farms/:id — updates an existing farm */
  update: (id: string, data: Partial<CreateFarmPayload>): Promise<Farm> =>
    apiFetch<Farm>(`/api/farms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** DELETE /api/farms/:id — archives a farm (logical delete) */
  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/farms/${id}`, {
      method: 'DELETE',
    }),

  /** DELETE /api/farms/:id?permanent=true — permanently purges an archived farm and its records */
  deletePermanent: (id: string): Promise<void> =>
    apiFetch<void>(`/api/farms/${id}?permanent=true`, {
      method: 'DELETE',
    }),
};
