import { Controller, Post, Body } from '@nestjs/common';
import { IotService } from './iot.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryResponseDto } from './dto/telemetry-response.dto';

@Controller('api/iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  /**
   * Recibe una lectura de telemetría desde un collar IoT.
   *
   * Persiste la lectura y devuelve un downlink con coordenadas
   * de cerco virtual para enviar al collar por LoRa.
   *
   * @param payload - Datos de telemetría: collar_id, lat, lng, temp
   * @returns downlink con coordenadas del cerco virtual
   */
  @Post('telemetry')
  async ingestTelemetry(@Body() payload: TelemetryPayloadDto): Promise<TelemetryResponseDto> {
    return this.iotService.handleTelemetry(payload);
  }
}
