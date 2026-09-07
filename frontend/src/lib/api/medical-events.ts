import { apiFetch } from './client';
import type { MedicalEvent, CreateMedicalEventPayload } from '@/types';

export const medicalEventsApi = {
  /** GET /api/medical-events?animalId=xxx — returns the chronological history for an animal */
  getByAnimal: (animalId: string): Promise<MedicalEvent[]> =>
    apiFetch<MedicalEvent[]>(`/api/medical-events?animalId=${animalId}`),

  /** POST /api/medical-events — logs a new medical event for an animal */
  create: (data: CreateMedicalEventPayload): Promise<MedicalEvent> =>
    apiFetch<MedicalEvent>('/api/medical-events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
