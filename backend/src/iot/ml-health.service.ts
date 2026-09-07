import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Debe coincidir con `lookback` del modelo entrenado (damp-ml-api/machine-learning/model/preprocess.py). */
export const ML_WINDOW_SIZE = 48;

export interface MlEventPrediction {
  probability: number;
  threshold: number;
  detected: boolean;
}

export interface MlPredictionResult {
  ready: boolean;
  events: Record<string, MlEventPrediction>;
}

export interface MlReadingInput {
  temperature: number;
  lat: number;
  lng: number;
  timestamp: string;
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

  async predict(
    animalId: string,
    sex: string | null | undefined,
    readings: MlReadingInput[]
  ): Promise<MlPredictionResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/predict/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animal_id: animalId, sex, readings }),
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
