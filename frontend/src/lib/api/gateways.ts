import { apiFetch } from './client';
import type { Gateway, CreateGatewayPayload, UpdateGatewayPayload } from '@/types';

export const gatewaysApi = {
  /** GET /api/gateways?farmId=xxx — returns all gateways for a given farm */
  getByFarm: (farmId: string): Promise<Gateway[]> => apiFetch<Gateway[]>(`/api/gateways?farmId=${farmId}`),

  /** POST /api/gateways — registers a new gateway associated to a farm and zone */
  create: (data: CreateGatewayPayload): Promise<Gateway> =>
    apiFetch<Gateway>('/api/gateways', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/gateways/[id] — corrects gateway data */
  update: (id: string, data: UpdateGatewayPayload): Promise<Gateway> =>
    apiFetch<Gateway>(`/api/gateways/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** DELETE /api/gateways/[id] — removes a gateway */
  delete: (id: string): Promise<void> => apiFetch<void>(`/api/gateways/${id}`, { method: 'DELETE' }),
};
