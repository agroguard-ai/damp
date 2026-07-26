import { IsNumber, IsInt } from 'class-validator';

/**
 * DTO de entrada para POST /api/iot/telemetry.
 * Representa una lectura enviada por un collar IoT.
 */
export class TelemetryPayloadDto {
  /** ID autoincremental del collar en la base de datos */
  @IsInt()
  collar_id: number;

  /** Latitud de la lectura GPS */
  @IsNumber()
  lat: number;

  /** Longitud de la lectura GPS */
  @IsNumber()
  lng: number;

  /** Temperatura corporal del animal medida por el collar */
  @IsNumber()
  temp: number;
}
