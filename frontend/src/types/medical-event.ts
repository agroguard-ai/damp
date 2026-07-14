export interface MedicalEvent {
  id: string;
  animalId: string;
  type: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
}
