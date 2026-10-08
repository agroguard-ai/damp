export type GatewayStatus = 'NO_DATA' | 'ONLINE' | 'OFFLINE';

export interface Gateway {
  id: string;
  name: string;
  farmId?: string | null;
  zoneId?: string | null;
  farm?: { id: string; name: string | null } | null;
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
  farmId?: string;
  zoneId?: string;
}

export interface UpdateGatewayPayload {
  name?: string;
  farmId?: string | null;
  zoneId?: string | null;
}

