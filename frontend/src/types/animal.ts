import type { AnimalType } from './animal-type';
import type { Zone } from './zone';
import type { Collar } from './collar';
import type { TelemetryReading } from './telemetry';
import type { AnimalGeofence } from './geofence';
import type { MedicalEvent } from './medical-event';

export interface AnimalCollar {
  id: string;
  collarId: string;
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
  zoneId: string | null;
  collarId: string | null;
  isArchived: boolean;
  status: string;
  createdAt: string;
  animalType: AnimalType | null;
  zone: Zone | null;
  animalCollars: AnimalCollar[];
  animalGeofences: AnimalGeofence[];
  medicalEvents: MedicalEvent[];
}

export interface AnimalLocation extends Pick<Animal, 'id' | 'tag' | 'breed' | 'weightKg' | 'status'> {
  hasActiveAlert: boolean;
  animalType: Pick<AnimalType, 'id' | 'name' | 'species'> | null;
  zone: Pick<Zone, 'id' | 'name' | 'polygonCoordinates'> | null;
  collar: Pick<Collar, 'id' | 'serialNumber' | 'status'> | null;
  latestReading: TelemetryReading | null;
}

export interface AnimalsQueryParams {
  farmId: string;
  animalType?: string;
  collarStatus?: string;
  healthStatus?: string;
  status?: string;
}

export interface CreateAnimalPayload {
  farmId: string;
  tag: string;
  breed: string;
  weightKg: number;
  ageMonths: number;
  collarMacAddress?: string;
  animalTypeId?: string;
  zoneId?: string;
}

export interface ArchiveAnimalPayload {
  status: 'SOLD' | 'DEAD';
}
