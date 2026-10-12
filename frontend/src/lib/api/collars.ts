import { apiFetch } from './client';
import type {
  Collar,
  CollarStatus,
  CreateCollarPayload,
  UpdateCollarPayload,
} from '@/types';

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

  /** PATCH /api/collars/[id]/archive — archives a collar (soft delete), releases active animal & farm quota */
  archive: (id: number): Promise<Collar> =>
    apiFetch<Collar>(`/api/collars/${id}/archive`, {
      method: 'PATCH',
    }),

  /** PATCH /api/collars/[id]/restore — restores an archived collar to available status */
  restore: (id: number): Promise<Collar> =>
    apiFetch<Collar>(`/api/collars/${id}/restore`, {
      method: 'PATCH',
    }),

  /** POST /api/collars/[id]/sync-fence — marks collar to receive fence downlink on next report */
  syncFence: (id: number): Promise<Collar> =>
    apiFetch<Collar>(`/api/collars/${id}/sync-fence`, {
      method: 'POST',
    }),

  /** DELETE /api/collars/[id] — deletes a collar permanently if unreferenced, or archives if forceArchive=true */
  delete: (id: number, forceArchive?: boolean): Promise<void> =>
    apiFetch<void>(`/api/collars/${id}${forceArchive ? '?forceArchive=true' : ''}`, {
      method: 'DELETE',
    }),
};
