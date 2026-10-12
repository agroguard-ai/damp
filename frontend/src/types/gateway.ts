export type GatewayStatus = 'NO_DATA' | 'ONLINE' | 'OFFLINE';

export interface Gateway {
  id: string;
  name: string;
  farmId?: string | null;
  zoneId?: string | null;
  farm?: {
    id: string;
    name: string | null;
    userId?: string | null;
    user?: { id: string; name: string | null; email: string } | null;
  } | null;
  zone?: { id: string; name: string } | null;
  apiKey?: string;
  status: GatewayStatus;
  lastSeenAt?: string | null;
  lastRssi?: number | null;
  lastSnr?: number | null;
  createdAt: string;
}

export interface CreateGatewayPayload {
  name: string;
  apiKey?: string;
  farmId?: string;
  zoneId?: string;
}

export interface UpdateGatewayPayload {
  name?: string;
  apiKey?: string;
  farmId?: string | null;
  zoneId?: string | null;
}

