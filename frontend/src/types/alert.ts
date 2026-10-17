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
  /** Fin de la ventana de 24 h analizada (null en predicciones anteriores a este dato). */
  windowEndAt?: string | null;
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

/** Estado del servicio de IA (ml-service). */
export interface MlServiceStatus {
  online: boolean;
  modelLoaded: boolean;
  error: string | null;
  requiredWindowBlocks: number | null;
}

/** Un bloque de 30 min de la ventana que analizó el modelo. */
export interface PredictionInputBlock {
  /** Inicio del bloque en hora local del campo. */
  timestamp: string;
  temperature: number;
  distanceMeters: number;
  /** false si el bloque no tuvo lecturas y se rellenó con el anterior. */
  hasData: boolean;
}

export interface PredictionInputs {
  predictionId: string;
  animal: { id: string; tag: string | null };
  predictedEvent: string;
  probability: number;
  threshold: number;
  detected: boolean;
  windowStart: string;
  windowEnd: string;
  blocksWithData: number;
  blocks: PredictionInputBlock[];
}

/** Riesgo actual de un animal según las predicciones recientes del modelo. */
export interface AnimalMlRisk {
  animalId: string;
  events: { event: string; probability: number; createdAt: string }[];
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
