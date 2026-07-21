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
   * Además de persistir la lectura, busca el animal activo asociado al collar
   * y devuelve cualquier actualización de límites (BoundaryUpdate) pendiente,
   * marcándola como INFORMED.
   *
   * @param payload - Datos de telemetría: collar_id, lat, lng, temp
   * @returns Estado de la operación + boundary updates informados al collar
   */
  @Post('telemetry')
  async ingestTelemetry(@Body() payload: TelemetryPayloadDto): Promise<TelemetryResponseDto> {
    return this.iotService.handleTelemetry(payload);
  }
}