export interface Geofence {
  id: string;
  farmId: string;
  name: string;
  pastureType?: string | null;
  polygonCoordinates: [number, number][] | null;
  active: boolean;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  animalGeofences?: AnimalGeofence[];
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
  farmId: string;
  name: string;
  pastureType?: string;
  polygonCoordinates: [number, number][];
  animalIds: string[];
}
