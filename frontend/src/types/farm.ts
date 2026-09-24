export interface Farm {
  id: string;
  name: string;
  address: string;
  province: string;
  location: string | null;
  totalAreaHa: number;
  polygonCoordinates?: [number, number][] | string | null;
  renspa?: string | null;
  userId: string;
  createdAt: string;
  isActive?: boolean;
  archivedAt?: string | null;
  farmUsers?: Array<{
    userId: string;
    role?: {
      id: string;
      name: string;
    };
  }>;
  _count?: {
    animals: number;
    zones: number;
    farmUsers: number;
  };
}

export interface CreateFarmPayload {
  name: string;
  address: string;
  province: string;
  totalAreaHa: number;
  polygonCoordinates?: [number, number][];
  renspa?: string;
}
