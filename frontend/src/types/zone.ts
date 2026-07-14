export interface Zone {
  id: string;
  name: string;
  pastureType: string | null;
  farmId: string;
  polygonCoordinates: [number, number][];
  createdAt: string;
  updatedAt: string;
}

export interface CreateZonePayload {
  name: string;
  pastureType?: string;
  farmId: string;
  polygonCoordinates: [number, number][];
}
