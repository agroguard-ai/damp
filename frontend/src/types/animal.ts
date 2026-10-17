import type { AnimalType } from './animal-type';
import type { Collar } from './collar';
import type { TelemetryReading } from './telemetry';
import type { AnimalGeofence } from './geofence';
import type { MedicalEvent } from './medical-event';

export interface AnimalCollar {
  id: string;
  collarId: number;
  animalId: string;
  startAt: string;
  endAt?: string | null;
  collar: Collar;
}

export interface Animal {
  id: string;
  farmId: string;
  tag: string | null;
  sex: 'MALE' | 'FEMALE' | string;
  birthDate: string | null;
  breed: string;
  weightKg: number;
  animalTypeId: string | null;
  collarId: string | null;
  isArchived: boolean;
  status: string;
  createdAt: string;
  animalType: AnimalType | null;
  animalCollars: AnimalCollar[];
  animalGeofences: AnimalGeofence[];
  medicalEvents: MedicalEvent[];
}

export interface AnimalLocation extends Pick<Animal, 'id' | 'tag' | 'breed' | 'weightKg' | 'status'> {
  hasActiveAlert: boolean;
  animalType: Pick<AnimalType, 'id' | 'name' | 'species'> | null;
  /** Cerco al que está asignado actualmente el animal (si tiene). */
  geofence: { id: string; name: string } | null;
  collar: Pick<Collar, 'id'> | null;
  latestReading: TelemetryReading | null;
}

export interface AnimalsQueryParams {
  farmId: string;
  geofenceId?: string;
  animalType?: string;
  healthStatus?: string;
  status?: string;
  hasActiveAlert?: string;
  hasCollar?: string;
}

export interface CreateAnimalPayload {
  farmId: string;
  tag: string;
  breed: string;
  weightKg: number;
  ageMonths: number;
  collarId?: number;
  animalTypeId?: string;
}

export interface UpdateAnimalPayload {
  tag?: string;
  breed?: string;
  weightKg?: number;
  ageMonths?: number;
  collarId?: number | null;
  animalTypeId?: string | null;
}

export interface ArchiveAnimalPayload {
  status: 'SOLD' | 'DEAD';
}

export interface BulkAssignGeofencePayload {
  farmId: string;
  animalIds: string[];
  geofenceId?: string | null;
}

export interface BulkTransferFarmPayload {
  sourceFarmId: string;
  targetFarmId: string;
  animalIds: string[];
  farmId?: string;
}

export interface LinkAnimalCollarPayload {
  collarId: number | null;
}

export interface AssignAnimalGeofencePayload {
  geofenceId: string | null;
}

export interface TrajectoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  temperature: number;
  timestamp: string;
}

export interface AnimalTrajectoryResponse {
  points: TrajectoryPoint[];
  totalPoints: number;
  animal: {
    id: string;
    tag: string | null;
    breed: string;
    animalType: AnimalType | null;
  };
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface FarmHeatmapResponse {
  points: HeatmapPoint[];
  totalPoints: number;
}
