export interface IotRequestLog {
  id: string;
  createdAt: string;
  endpoint: string;
  method: string;
  ipAddress: string | null;
  gatewayId: string | null;
  gatewayName: string | null;
  farmId: string | null;
  farmName: string | null;
  apiKeyUsed: string | null;
  collarId: number | null;
  headers: Record<string, any> | null;
  payload: any;
  lat: number | null;
  lng: number | null;
  temp: number | null;
  rssi: number | null;
  snr: number | null;
  statusCode: number;
  status: 'SUCCESS' | 'REJECTED_AUTH' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'SERVER_ERROR' | string;
  responseBody: any;
  errorMessage: string | null;
  downlinkSent: string | null;
  durationMs: number | null;
}

export interface IotLogsSummary {
  totalRequests: number;
  successRequests: number;
  rejectedRequests: number;
  errorRequests: number;
  activeCollars24h: number;
  activeGateways24h: number;
}

export interface IotLogsResponse {
  data: IotRequestLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
