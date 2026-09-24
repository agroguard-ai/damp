import { apiFetch } from './client';
import type { Farm, CreateFarmPayload } from '@/types';

export const farmsApi = {
  /** GET /api/farms — returns all farms for the authenticated user */
  getAll: (): Promise<Farm[]> => apiFetch<Farm[]>('/api/farms'),

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

  /** DELETE /api/farms/:id — removes a farm */
  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/farms/${id}`, {
      method: 'DELETE',
    }),
};
