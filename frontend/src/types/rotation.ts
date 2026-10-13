import type { Geofence } from './geofence';

export type RotationStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type RotationStepStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface RotationStep {
  id: string;
  rotationPlanId: string;
  geofenceId: string;
  orderIndex: number;
  status: RotationStepStatus;
  activatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  geofence: Geofence;
}

export interface RotationPlan {
  id: string;
  farmId: string;
  name: string;
  status: RotationStatus;
  frequencyHours: number;
  currentStepIndex: number;
  totalSteps: number;
  autoRotate: boolean;
  startedAt: string;
  lastRotatedAt: string;
  nextRotationAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: RotationStep[];
}

export interface RotationHeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface RotationTransitionInfo {
  isTransitioning: boolean;
  fromGeofenceName?: string;
  toGeofenceName?: string;
  current5MinStep: number;
  total5MinSteps: number;
  fraction?: number;
  progressPercent: number;
  stepIntervalMinutes: number;
}

export interface RotationResponse {
  plan: RotationPlan | null;
  fromGeofence: Geofence | null;
  currentGeofence: Geofence | null;
  nextGeofence: Geofence | null;
  activeTransitionPolygon?: [number, number][] | null;
  transition?: RotationTransitionInfo | null;
  timeRemainingMinutes: number;
  totalAnimals: number;
  animalsWithCollarCount: number;
  heatmapPoints: RotationHeatmapPoint[];
  message?: string;
}

export interface CreateRotationPayload {
  name?: string;
  frequencyHours: number;
  geofenceIds: string[];
  autoRotate?: boolean;
}

export interface PostponeRotationPayload {
  hours?: number;
}
