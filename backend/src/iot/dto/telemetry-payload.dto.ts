import { IsNumber, IsInt, IsOptional, IsString } from 'class-validator';

/**
 * DTO de entrada para POST /api/iot/telemetry.
 * Representa una lectura enviada por un collar IoT, retransmitida por el gateway LoRa.
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

  /**
   * ID del gateway que retransmitió el paquete. Opcional: el firmware actual (v3) no lo envía todavía.
   * Cuando esté presente, actualiza el estado "online" del gateway (CU013).
   */
  @IsString()
  @IsOptional()
  gateway_id?: string;

  /** Calidad de señal LoRa (RSSI) del paquete recibido por el gateway. Opcional, mismo motivo que gateway_id. */
  @IsNumber()
  @IsOptional()
  rssi?: number;

  /** Relación señal/ruido LoRa (SNR) del paquete recibido por el gateway. Opcional, mismo motivo que gateway_id. */
  @IsNumber()
  @IsOptional()
  snr?: number;
}
