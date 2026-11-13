import { apiFetch } from './client';
import type { Alert, AlertsQueryParams, AnimalMlRisk, MlServiceStatus, PredictionInputs } from '@/types';

export const alertsApi = {
  /** GET /api/alerts — returns alerts for the authenticated user, optionally filtered */
  getAll: (params: AlertsQueryParams = {}): Promise<Alert[]> => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    );
    const qs = query.toString();
    return apiFetch<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`);
  },

  /** PATCH /api/alerts/[id]/resolve — marks an alert as resolved */
  resolve: (id: string): Promise<Alert> => apiFetch<Alert>(`/api/alerts/${id}/resolve`, { method: 'PATCH' }),

  /** GET /api/alerts/predictions — gets recent health predictions (including sub-threshold ones for review) */
  getPredictions: (params: { farmId: string; animalId?: string; limit?: number }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params.farmId) query.set('farmId', params.farmId);
    if (params.animalId) query.set('animalId', params.animalId);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<any[]>(`/api/alerts/predictions${qs ? `?${qs}` : ''}`);
  },

  /** GET /api/alerts/ml-metrics — gets field accuracy and false positive metrics for the farm */
  getMlMetrics: (farmId: string): Promise<any> =>
    apiFetch<any>(`/api/alerts/ml-metrics?farmId=${encodeURIComponent(farmId)}`),

  /** GET /api/alerts/ml-status — si el servicio de IA está online y con el modelo cargado */
  getMlStatus: (): Promise<MlServiceStatus> => apiFetch<MlServiceStatus>('/api/alerts/ml-status'),

  /** GET /api/alerts/predictions/[id]/inputs — ventana de 24 h que analizó el modelo */
  getPredictionInputs: (predictionId: string): Promise<PredictionInputs> =>
    apiFetch<PredictionInputs>(`/api/alerts/predictions/${predictionId}/inputs`),

  /** GET /api/alerts/predictions/current-risk — eventos detectados recientemente, por animal */
  getCurrentMlRisk: (farmId: string): Promise<AnimalMlRisk[]> =>
    apiFetch<AnimalMlRisk[]>(`/api/alerts/predictions/current-risk?farmId=${encodeURIComponent(farmId)}`),

  /** POST /api/alerts/predictions/run — fuerza una predicción inmediata de salud para un animal */
  runPrediction: (
    animalId: string
  ): Promise<{ animalId: string; windowEndAt: string; blocksWithData: number; predictions: any[] }> =>
    apiFetch('/api/alerts/predictions/run', {
      method: 'POST',
      body: JSON.stringify({ animalId }),
    }),

  /** GET /api/alerts/predictions/trajectory-48h — proyección futura a 48 h para un animal */
  getTrajectory48h: (
    animalId: string
  ): Promise<{
    available: boolean;
    reason?: string;
    generatedAt?: string;
    blocksWithData?: number;
    stages: Array<{ stage: string; probabilities: Record<string, number> }>;
    summary: Record<string, { max_probability: number; peak_stage: string }>;
  }> => apiFetch(`/api/alerts/predictions/trajectory-48h?animalId=${encodeURIComponent(animalId)}`),
};
