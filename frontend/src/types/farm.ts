export interface Farm {
  id: string;
  name: string;
  address: string;
  province: string;
  location: string | null;
  totalAreaHa: number;
  userId: string;
  createdAt: string;
}

export interface CreateFarmPayload {
  name: string;
  address: string;
  province: string;
  totalAreaHa: number;
}
