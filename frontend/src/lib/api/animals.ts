import { apiFetch } from './client';
import type { Animal, AnimalLocation, AnimalsQueryParams, ArchiveAnimalPayload, CreateAnimalPayload } from '@/types';

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

  /** PATCH /api/animals/[id]/archive — archives an animal (SOLD or DEAD) */
  archive: (id: string, data: ArchiveAnimalPayload): Promise<Animal> =>
    apiFetch<Animal>(`/api/animals/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** GET /api/animals/locations?farmId=xxx — returns live geolocations */
  getLocations: (farmId: string): Promise<AnimalLocation[]> =>
    apiFetch<AnimalLocation[]>(`/api/animals/locations?farmId=${farmId}`),
};
