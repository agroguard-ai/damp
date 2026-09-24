export interface AnimalType {
  id: string;
  name: string;
  species: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    animals: number;
  };
}

export interface CreateAnimalTypePayload {
  name: string;
  species: string;
  description?: string;
}

export interface UpdateAnimalTypePayload {
  name?: string;
  species?: string;
  description?: string;
  isActive?: boolean;
}
