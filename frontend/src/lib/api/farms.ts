import { apiFetch } from './client';
import type { Farm, CreateFarmPayload } from '@/types';

export const farmsApi = {
  /** GET /api/farms — returns all farms for the authenticated user */
  getAll: (): Promise<Farm[]> => apiFetch<Farm[]>('/api/farms'),

  /** POST /api/farms — creates a new farm */
  create: (data: CreateFarmPayload): Promise<Farm> =>
    apiFetch<Farm>('/api/farms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
