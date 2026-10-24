import type { TelemetryReading } from './telemetry';

export type CollarStatus = 'AVAILABLE' | 'OUT_OF_SERVICE';

export interface Collar {
  id: number;
  identifier: string;
  status: CollarStatus;
  isArchived?: boolean;
  fenceNotificationPending?: boolean;
  lastFenceSyncedAt?: string | null;
  lastTelemetryDate?: string | null;
  farmId?: string | null;
  farm?: {
    id: string;
    name: string | null;
    userId?: string | null;
    user?: { id: string; name: string | null; email: string } | null;
  } | null;
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
  id?: number;
  identifier?: string;
  farmId?: string;
}

export interface UpdateCollarPayload {
  id?: number;
  identifier?: string;
  farmId?: string | null;
}
