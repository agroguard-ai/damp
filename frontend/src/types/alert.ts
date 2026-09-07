import type { Animal } from './animal';

export type AlertType = 'ESCAPE' | 'HEALTH' | 'SYSTEM';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  animalId: string;
  isResolved: boolean;
  createdAt: string;
  animal?: Animal;
}

export interface AlertsQueryParams {
  farmId?: string;
  animalId?: string;
  type?: AlertType;
  resolved?: boolean;
  from?: string;
  to?: string;
}
