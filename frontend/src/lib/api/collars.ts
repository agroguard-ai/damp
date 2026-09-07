import { apiFetch } from './client';
import type { Collar, CollarStatus, CreateCollarPayload, UpdateCollarPayload } from '@/types';

export const collarsApi = {
  /** GET /api/collars — returns all collars with their current assignment/status */
  getAll: (): Promise<Collar[]> => apiFetch<Collar[]>('/api/collars'),

  /** GET /api/collars/[id] — returns a single collar with assignment history */
  getOne: (id: number): Promise<Collar> => apiFetch<Collar>(`/api/collars/${id}`),

  /** POST /api/collars — registers a new physical collar by its unique identifier */
  create: (data: CreateCollarPayload): Promise<Collar> =>
    apiFetch<Collar>('/api/collars', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/collars/[id] — corrects collar data */
  update: (id: number, data: UpdateCollarPayload): Promise<Collar> =>
    apiFetch<Collar>(`/api/collars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/collars/[id]/status — marks a collar as damaged / out of service / available */
  updateStatus: (id: number, status: CollarStatus): Promise<Collar> =>
    apiFetch<Collar>(`/api/collars/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
