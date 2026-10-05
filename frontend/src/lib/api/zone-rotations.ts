import { apiFetch } from './client';
import type {
  ZoneRotationResponse,
  ZoneRotationPlan,
  CreateZoneRotationPayload,
  PostponeRotationPayload,
} from '@/types';

export const zoneRotationsApi = {
  /** GET /api/zones/:zoneId/rotation — gets current rotation status, steps, from/current/next fences and heatmap */
  getRotation: (zoneId: string): Promise<ZoneRotationResponse> =>
    apiFetch<ZoneRotationResponse>(`/api/zones/${zoneId}/rotation`),

  /** POST /api/zones/:zoneId/rotation — creates and starts a rotation plan */
  createRotation: (zoneId: string, data: CreateZoneRotationPayload): Promise<ZoneRotationPlan> =>
    apiFetch<ZoneRotationPlan>(`/api/zones/${zoneId}/rotation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** POST /api/zones/:zoneId/rotation/advance — advances to next step immediately */
  advanceRotation: (zoneId: string): Promise<{ message: string; plan?: ZoneRotationPlan; completed?: boolean }> =>
    apiFetch<{ message: string; plan?: ZoneRotationPlan; completed?: boolean }>(
      `/api/zones/${zoneId}/rotation/advance`,
      { method: 'POST' }
    ),

  /** POST /api/zones/:zoneId/rotation/postpone — postpones rotation by X hours */
  postponeRotation: (
    zoneId: string,
    data: PostponeRotationPayload
  ): Promise<{ message: string; nextRotationAt: string }> =>
    apiFetch<{ message: string; nextRotationAt: string }>(`/api/zones/${zoneId}/rotation/postpone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** POST /api/zones/:zoneId/rotation/pause — pauses automatic rotation */
  pauseRotation: (zoneId: string): Promise<{ message: string; plan: ZoneRotationPlan }> =>
    apiFetch<{ message: string; plan: ZoneRotationPlan }>(`/api/zones/${zoneId}/rotation/pause`, {
      method: 'POST',
    }),

  /** POST /api/zones/:zoneId/rotation/resume — resumes paused rotation */
  resumeRotation: (zoneId: string): Promise<{ message: string; plan: ZoneRotationPlan }> =>
    apiFetch<{ message: string; plan: ZoneRotationPlan }>(`/api/zones/${zoneId}/rotation/resume`, {
      method: 'POST',
    }),

  /** DELETE /api/zones/:zoneId/rotation — cancels/terminates rotation */
  cancelRotation: (zoneId: string): Promise<{ message: string; plan: ZoneRotationPlan }> =>
    apiFetch<{ message: string; plan: ZoneRotationPlan }>(`/api/zones/${zoneId}/rotation`, {
      method: 'DELETE',
    }),
};
