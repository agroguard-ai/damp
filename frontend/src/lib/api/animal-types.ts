import { apiFetch } from './client';
import type { AnimalType, CreateAnimalTypePayload } from '@/types';

export const animalTypesApi = {
  /** GET /api/animal-types — returns all animal types */
  getAll: (): Promise<AnimalType[]> => apiFetch<AnimalType[]>('/api/animal-types'),

  /** POST /api/animal-types — creates a new animal type */
  create: (data: CreateAnimalTypePayload): Promise<AnimalType> =>
    apiFetch<AnimalType>('/api/animal-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** DELETE /api/animal-types/[id] — deletes an animal type */
  delete: (id: string): Promise<void> => apiFetch<void>(`/api/animal-types/${id}`, { method: 'DELETE' }),
};
