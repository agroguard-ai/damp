export interface Sector {
  id: string;
  farmId: string;
  name: string;
  description?: string | null;
  areaHa?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Geofence {
  id: string;
  sectorId: string;
  name: string;
  geometry?: unknown;
  active?: boolean;
  activatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sector: Sector;
}

export interface AnimalGeofence {
  id: string;
  animalId: string;
  geofenceId: string;
  startAt: string;
  endAt?: string | null;
  geofence: Geofence;
}
