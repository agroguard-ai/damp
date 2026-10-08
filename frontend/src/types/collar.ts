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
  id?: number;
  identifier?: string;
  farmId?: string;
}

export interface UpdateCollarPayload {
  identifier?: string;
  farmId?: string | null;
}

export type CollarClaimStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface CollarClaim {
  id: string;
  collarId: number;
  farmId?: string | null;
  userId: string;
  reason: string;
  description?: string | null;
  status: CollarClaimStatus;
  resolutionNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  collar?: { id: number; identifier: string; status: CollarStatus };
  farm?: { id: string; name: string | null } | null;
  user?: { id: string; name: string | null; email: string };
}

export interface CreateCollarClaimPayload {
  reason: string;
  description?: string;
  markAsDamaged?: boolean;
}

export interface UpdateCollarClaimPayload {
  status: CollarClaimStatus;
  resolutionNotes?: string;
}

export type CollarRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CollarRequest {
  id: string;
  farmId: string;
  userId: string;
  requestedCount: number;
  notes?: string | null;
  status: CollarRequestStatus;
  responseNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  farm?: { id: string; name: string | null } | null;
  user?: { id: string; name: string | null; email: string };
}

export interface CreateCollarRequestPayload {
  farmId: string;
  requestedCount: number;
  notes?: string;
}

export interface UpdateCollarRequestPayload {
  status: CollarRequestStatus;
  responseNotes?: string;
  incrementMaxCollars?: boolean;
}
