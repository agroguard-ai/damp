import { apiFetch } from './client';
import type {
  Animal,
  AnimalLocation,
  AnimalsQueryParams,
  ArchiveAnimalPayload,
  CreateAnimalPayload,
  UpdateAnimalPayload,
  BulkAssignZonePayload,
  BulkTransferFarmPayload,
  UpdateAnimalZonePayload,
  LinkAnimalCollarPayload,
  AssignAnimalGeofencePayload,
} from '@/types';

export type { Animal, AnimalLocation };

export const animalsApi = {
  /** GET /api/animals?farmId=xxx&... — returns animals with optional filters */
  getAll: (params: AnimalsQueryParams): Promise<Animal[]> => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<
        string,
        string
      >
    );
    return apiFetch<Animal[]>(`/api/animals?${query.toString()}`);
  },

  /** POST /api/animals — creates a new animal */
  create: (data: CreateAnimalPayload): Promise<Animal> =>
    apiFetch<Animal>('/api/animals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animals/[id] — updates general animal details */
  update: (id: string, data: UpdateAnimalPayload): Promise<Animal> =>
    apiFetch<Animal>(`/api/animals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animals/[id]/archive — archives an animal (SOLD or DEAD) */
  archive: (id: string, data: ArchiveAnimalPayload): Promise<Animal> =>
    apiFetch<Animal>(`/api/animals/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animals/[id]/zone — updates an animal's zone */
  updateZone: (id: string, data: UpdateAnimalZonePayload): Promise<Animal> =>
    apiFetch<Animal>(`/api/animals/${id}/zone`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animals/[id]/collar — links or unlinks collar */
  updateCollar: (id: string, data: LinkAnimalCollarPayload): Promise<{ message: string; collarId?: number }> =>
    apiFetch<{ message: string; collarId?: number }>(`/api/animals/${id}/collar`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animals/[id]/geofence — assigns or unassigns virtual fence */
  updateGeofence: (id: string, data: AssignAnimalGeofencePayload): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/api/animals/${id}/geofence`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** POST /api/animals/bulk/zone — bulk assign zone to multiple animals */
  bulkAssignZone: (data: BulkAssignZonePayload): Promise<{ count: number; message: string }> =>
    apiFetch<{ count: number; message: string }>('/api/animals/bulk/zone', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** POST /api/animals/bulk/transfer-farm — bulk transfer animals to another farm */
  bulkTransferFarm: (data: BulkTransferFarmPayload): Promise<{ count: number; message: string }> =>
    apiFetch<{ count: number; message: string }>('/api/animals/bulk/transfer-farm', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** GET /api/animals/locations?farmId=xxx — returns live geolocations */
  getLocations: (farmId: string): Promise<AnimalLocation[]> =>
    apiFetch<AnimalLocation[]>(`/api/animals/locations?farmId=${farmId}`),
};
