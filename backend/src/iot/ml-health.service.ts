import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MlBlock } from './ml-window';

/** La predicción corre en segundo plano, pero no debe quedar colgada si ml-service no responde. */
const ML_REQUEST_TIMEOUT_MS = 10_000;

export interface MlEventPrediction {
  probability: number;
  threshold?: number;
  detected?: boolean;
}

export interface MlServiceStatus {
  /** ml-service respondió. */
  online: boolean;
  /** El modelo entrenado está cargado y puede predecir. */
  modelLoaded: boolean;
  error: string | null;
  /** Bloques de 30 min que necesita el modelo (48 = 24 h). */
  requiredWindowBlocks: number | null;
}

export interface MlPredictionResult {
  ready: boolean;
  events: Record<string, MlEventPrediction>;
}

/**
 * Cliente HTTP hacia damp/ml-service (modelo LSTM multitarea real, ver
 * damp-ml-api/README.md). Predicción complementaria a la heurística por
 * umbrales de IotService: si el servicio no responde, no debe romper la
 * ingesta de telemetría — se loguea y se sigue sin predicción.
 */
@Injectable()
export class MlHealthService {
  private readonly logger = new Logger(MlHealthService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ML_SERVICE_URL') ?? 'http://localhost:8000';
  }

  /** Estado de ml-service para mostrarlo en el front (no lanza: si no responde, online=false). */
  async status(): Promise<MlServiceStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) {
        return {
          online: false,
          modelLoaded: false,
          error: `ml-service respondió ${response.status}`,
          requiredWindowBlocks: null,
        };
      }
      const body = (await response.json()) as {
        model_loaded?: boolean;
        model_load_error?: string | null;
        required_window_size?: number | null;
      };
      return {
        online: true,
        modelLoaded: Boolean(body.model_loaded),
        error: body.model_load_error ?? null,
        requiredWindowBlocks: body.required_window_size ?? null,
      };
    } catch (error) {
      return { online: false, modelLoaded: false, error: (error as Error).message, requiredWindowBlocks: null };
    }
  }

  async predict(
    animalId: string,
    sex: string | null | undefined,
    readings: MlBlock[]
  ): Promise<MlPredictionResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/predict/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animal_id: animalId, sex, readings }),
        signal: AbortSignal.timeout(ML_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`ml-service respondió ${response.status} para el animal ${animalId}`);
        return null;
      }

      const body = await response.json();
      return { ready: body.ready, events: body.events ?? {} };
    } catch (error) {
      this.logger.warn(`No se pudo contactar a ml-service: ${(error as Error).message}`);
      return null;
    }
  }
}
