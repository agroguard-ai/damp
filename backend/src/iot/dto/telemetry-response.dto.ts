export interface BoundaryPoint {
  lat: number;
  lng: number;
}

export interface BoundaryUpdateInfo {
  id: string;
  coordinates: BoundaryPoint[];
  status: 'PENDING' | 'INFORMED';
  informedAt: string | null;
}

export interface TelemetryResponseDto {
  status: 'success';
  message: string;
  animalId: string | null;
  boundaryUpdates: BoundaryUpdateInfo[];
}
