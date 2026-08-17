export type MedicalEventType = 'VACCINATION' | 'TREATMENT' | 'SURGERY' | 'WEIGHING' | 'BIRTH';

export interface MedicalEvent {
  id: string;
  animalId: string;
  type: MedicalEventType | null;
  description: string | null;
  value: number | null;
  occurredAt: string;
  createdAt: string;
}

export interface CreateMedicalEventPayload {
  animalId: string;
  type: MedicalEventType;
  description?: string;
  value?: number;
  occurredAt?: string;
}
