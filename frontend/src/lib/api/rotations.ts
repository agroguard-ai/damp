import { apiFetch } from './client';
import type { RotationResponse, RotationPlan, CreateRotationPayload, PostponeRotationPayload } from '@/types';

export const rotationsApi = {
  /** GET /api/farms/:farmId/rotation — gets current rotation status, steps, from/current/next fences and heatmap */
  getRotation: (farmId: string): Promise<RotationResponse> =>
    apiFetch<RotationResponse>(`/api/farms/${farmId}/rotation`),

  /** POST /api/farms/:farmId/rotation — creates and starts a rotation plan */
  createRotation: (farmId: string, data: CreateRotationPayload): Promise<RotationPlan> =>
    apiFetch<RotationPlan>(`/api/farms/${farmId}/rotation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** POST /api/farms/:farmId/rotation/advance — advances to next step immediately */
  advanceRotation: (farmId: string): Promise<{ message: string; plan?: RotationPlan; completed?: boolean }> =>
    apiFetch<{ message: string; plan?: RotationPlan; completed?: boolean }>(`/api/farms/${farmId}/rotation/advance`, {
      method: 'POST',
    }),

  /** POST /api/farms/:farmId/rotation/postpone — postpones rotation by X hours */
  postponeRotation: (
    farmId: string,
    data: PostponeRotationPayload
  ): Promise<{ message: string; nextRotationAt: string }> =>
    apiFetch<{ message: string; nextRotationAt: string }>(`/api/farms/${farmId}/rotation/postpone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** POST /api/farms/:farmId/rotation/pause — pauses automatic rotation */
  pauseRotation: (farmId: string): Promise<{ message: string; plan: RotationPlan }> =>
    apiFetch<{ message: string; plan: RotationPlan }>(`/api/farms/${farmId}/rotation/pause`, {
      method: 'POST',
    }),

  /** POST /api/farms/:farmId/rotation/resume — resumes paused rotation */
  resumeRotation: (farmId: string): Promise<{ message: string; plan: RotationPlan }> =>
    apiFetch<{ message: string; plan: RotationPlan }>(`/api/farms/${farmId}/rotation/resume`, {
      method: 'POST',
    }),

  /** DELETE /api/farms/:farmId/rotation — cancels/terminates rotation */
  cancelRotation: (farmId: string): Promise<{ message: string; plan: RotationPlan }> =>
    apiFetch<{ message: string; plan: RotationPlan }>(`/api/farms/${farmId}/rotation`, {
      method: 'DELETE',
    }),
};
