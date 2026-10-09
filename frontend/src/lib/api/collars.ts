import { apiFetch } from './client';
import type {
  Collar,
  CollarStatus,
  CreateCollarPayload,
  UpdateCollarPayload,
  CollarClaim,
  CreateCollarClaimPayload,
  UpdateCollarClaimPayload,
  CollarRequest,
  CreateCollarRequestPayload,
  UpdateCollarRequestPayload,
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

  /** DELETE /api/collars/[id] — deletes a collar permanently if unreferenced, or archives if forceArchive=true */
  delete: (id: number, forceArchive?: boolean): Promise<void> =>
    apiFetch<void>(`/api/collars/${id}${forceArchive ? '?forceArchive=true' : ''}`, {
      method: 'DELETE',
    }),

  /** GET /api/collars/claims — returns claims */
  getClaims: (): Promise<CollarClaim[]> => apiFetch<CollarClaim[]>('/api/collars/claims'),

  /** POST /api/collars/[id]/claims — creates a new claim on a collar */
  createClaim: (collarId: number, data: CreateCollarClaimPayload): Promise<CollarClaim> =>
    apiFetch<CollarClaim>(`/api/collars/${collarId}/claims`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/collars/claims/[claimId] — updates a claim status / resolution */
  updateClaim: (claimId: string, data: UpdateCollarClaimPayload): Promise<CollarClaim> =>
    apiFetch<CollarClaim>(`/api/collars/claims/${claimId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** GET /api/collars/requests — returns collar quota requests */
  getRequests: (): Promise<CollarRequest[]> => apiFetch<CollarRequest[]>('/api/collars/requests'),

  /** POST /api/collars/requests — creates a request for more collars */
  createRequest: (data: CreateCollarRequestPayload): Promise<CollarRequest> =>
    apiFetch<CollarRequest>('/api/collars/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/collars/requests/[requestId] — resolves a collar request */
  updateRequest: (requestId: string, data: UpdateCollarRequestPayload): Promise<CollarRequest> =>
    apiFetch<CollarRequest>(`/api/collars/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
