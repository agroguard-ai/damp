import type { TelemetryReading } from './telemetry';

export interface Collar {
  id: string;
  serialNumber: string;
  status: string;
  firmwareVersion?: string;
  lastTelemetryDate?: string | null;
  telemetryReadings?: TelemetryReading[];
}
