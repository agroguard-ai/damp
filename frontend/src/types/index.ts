export interface Farm {
  id: string;
  name: string;
  address: string;
  province: string;
  totalAreaHa: number;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  animalId: string;
  isResolved: boolean;
  createdAt: string;
  animal?: {
    tag: string | null;
    breed: string;
    animalType?: {
      name: string;
      species: string;
    };
  };
}
