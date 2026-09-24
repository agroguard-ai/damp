import type { Zone } from './zone';

export interface Geofence {
  id: string;
  zoneId: string;
  name: string;
  polygonCoordinates: [number, number][] | null;
  active: boolean;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  animalGeofences?: AnimalGeofence[];
  zone?: Zone | null;
}

export interface AnimalGeofence {
  id: string;
  animalId: string;
  geofenceId: string;
  startAt: string;
  endAt?: string | null;
  geofence?: Geofence;
  animal?: { id: string; tag: string | null };
}

export interface CreateGeofencePayload {
  zoneId: string;
  name: string;
  polygonCoordinates: [number, number][];
  animalIds: string[];
}
