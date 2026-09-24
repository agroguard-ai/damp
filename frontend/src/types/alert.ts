import type { Animal } from './animal';

export type AlertType = 'ESCAPE' | 'HEALTH' | 'SYSTEM';

export interface HealthPrediction {
  id: string;
  animalId: string;
  predictedEvent: 'fiebre' | 'celo' | 'inactividad' | 'anomalia' | string;
  probability: number;
  threshold: number;
  detected: boolean;
  horizonHours: number;
  windowReadingsCount: number;
  alertId?: string | null;
  createdAt: string;
  animal?: {
    id: string;
    tag?: string | null;
    breed?: string | null;
    sex?: string | null;
    animalType?: { name: string; species?: string } | null;
  };
  alert?: {
    id: string;
    type: AlertType;
    message: string;
    isResolved: boolean;
    isFalsePositive: boolean;
    feedbackNote?: string | null;
  } | null;
}

export interface MlHealthMetrics {
  totalMlAlerts: number;
  falsePositives: number;
  truePositives: number;
  fieldPrecision: number;
  totalPredictions: number;
  eventBreakdown: Array<{
    predictedEvent: string;
    detected: boolean;
    _count: { _all: number };
  }>;
}

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  animalId: string;
  isResolved: boolean;
  isFalsePositive?: boolean;
  feedbackNote?: string | null;
  feedbackAt?: string | null;
  feedbackUserId?: string | null;
  createdAt: string;
  animal?: Animal;
  healthPredictions?: HealthPrediction[];
}

export interface AlertsQueryParams {
  farmId?: string;
  animalId?: string;
  type?: AlertType;
  resolved?: boolean;
  isFalsePositive?: boolean;
  source?: 'ML' | 'THRESHOLD' | 'ESCAPE';
  from?: string;
  to?: string;
}
