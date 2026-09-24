import type { Farm } from './farm';
import type { Geofence } from './geofence';

export interface Zone {
  id: string;
  name: string;
  pastureType: string | null;
  farmId: string;
  polygonCoordinates: [number, number][];
  createdAt: string;
  updatedAt: string;
  farm?: Farm;
  geofences?: Geofence[];
  _count?: {
    animals: number;
    geofences: number;
  };
}

export interface CreateZonePayload {
  name: string;
  pastureType?: string;
  farmId: string;
  polygonCoordinates: [number, number][];
}
