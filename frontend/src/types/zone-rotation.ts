import type { Geofence } from './geofence';
import type { Zone } from './zone';

export type ZoneRotationStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type RotationStepStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface ZoneRotationStep {
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

export interface ZoneRotationPlan {
  id: string;
  zoneId: string;
  name: string;
  status: ZoneRotationStatus;
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
  steps: ZoneRotationStep[];
  zone?: Zone;
}

export interface RotationHeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface ZoneRotationTransitionInfo {
  isTransitioning: boolean;
  fromGeofenceName?: string;
  toGeofenceName?: string;
  current5MinStep: number;
  total5MinSteps: number;
  fraction?: number;
  progressPercent: number;
  stepIntervalMinutes: number;
}

export interface ZoneRotationResponse {
  plan: ZoneRotationPlan | null;
  fromGeofence: Geofence | null;
  currentGeofence: Geofence | null;
  nextGeofence: Geofence | null;
  activeTransitionPolygon?: [number, number][] | null;
  transition?: ZoneRotationTransitionInfo | null;
  timeRemainingMinutes: number;
  totalAnimalsInZone: number;
  animalsWithCollarCount: number;
  heatmapPoints: RotationHeatmapPoint[];
  message?: string;
}

export interface CreateZoneRotationPayload {
  name?: string;
  frequencyHours: number;
  geofenceIds: string[];
  autoRotate?: boolean;
}

export interface PostponeRotationPayload {
  hours?: number;
}
