import { apiFetch } from './client';
import type { AnimalType, CreateAnimalTypePayload, UpdateAnimalTypePayload } from '@/types';

export const animalTypesApi = {
  /** GET /api/animal-types — returns animal types (active only by default, or all if includeInactive=true) */
  getAll: (params?: { includeInactive?: boolean }): Promise<AnimalType[]> => {
    const query = params?.includeInactive ? '?includeInactive=true' : '';
    return apiFetch<AnimalType[]>(`/api/animal-types${query}`);
  },

  /** POST /api/animal-types — creates a new animal type */
  create: (data: CreateAnimalTypePayload): Promise<AnimalType> =>
    apiFetch<AnimalType>('/api/animal-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** PATCH /api/animal-types/[id] — updates an animal type */
  update: (id: string, data: UpdateAnimalTypePayload): Promise<AnimalType> =>
    apiFetch<AnimalType>(`/api/animal-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** DELETE /api/animal-types/[id] — soft deletes (or deletes) an animal type */
  delete: (id: string): Promise<{ message: string; isArchived?: boolean }> =>
    apiFetch<{ message: string; isArchived?: boolean }>(`/api/animal-types/${id}`, { method: 'DELETE' }),

  /** PATCH /api/animal-types/[id]/reactivate — restores an archived animal type */
  reactivate: (id: string): Promise<{ message: string; animalType: AnimalType }> =>
    apiFetch<{ message: string; animalType: AnimalType }>(`/api/animal-types/${id}/reactivate`, {
      method: 'PATCH',
    }),
};
