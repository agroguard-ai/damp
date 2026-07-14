export interface AnimalType {
  id: string;
  name: string;
  species: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnimalTypePayload {
  name: string;
  species: string;
  description?: string;
}
