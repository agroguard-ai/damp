import type { Animal } from './animal';

export interface Alert {
  id: string;
  type: 'ESCAPE' | 'HEALTH' | 'SYSTEM' | string;
  message: string;
  animalId: string;
  isResolved: boolean;
  createdAt: string;
  animal?: Animal;
}
