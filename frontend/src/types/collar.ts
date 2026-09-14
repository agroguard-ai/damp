import type { TelemetryReading } from './telemetry';

export type CollarStatus = 'AVAILABLE' | 'DAMAGED' | 'OUT_OF_SERVICE';

export interface Collar {
  id: number;
  identifier: string;
  status: CollarStatus;
  lastTelemetryDate?: string | null;
  farmId?: string | null;
  farm?: { id: string; name: string | null } | null;
  createdAt: string;
  telemetryReadings?: TelemetryReading[];
  assignedAnimal?: { id: string; tag: string | null; farmId?: string } | null;
  animalCollars?: {
    id: string;
    animalId: string;
    startAt: string;
    endAt?: string | null;
    animal: { id: string; tag: string | null; farmId?: string };
  }[];
}

export interface CreateCollarPayload {
  identifier: string;
  farmId?: string;
}

export interface UpdateCollarPayload {
  identifier?: string;
  farmId?: string | null;
}
