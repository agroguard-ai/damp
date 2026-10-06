import { IsNumber, IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';

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
   * UUID del Gateway (tabla "gateways") que retransmitió el paquete.
   * Opcional: si no se envía en el body, se deduce automáticamente a partir del header X-API-Key.
   */
  @IsString()
  @IsOptional()
  gateway_id?: string;

  /** Calidad de señal LoRa (RSSI) del paquete recibido por el gateway. Opcional — no hace falta para autenticar ni para el downlink, solo enriquece el heartbeat. */
  @IsNumber()
  @IsOptional()
  rssi?: number;

  /** Relación señal/ruido LoRa (SNR) del paquete recibido por el gateway. Opcional, mismo motivo que rssi. */
  @IsNumber()
  @IsOptional()
  snr?: number;
}
