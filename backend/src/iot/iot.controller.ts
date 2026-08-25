import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IotService } from './iot.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryResponseDto } from './dto/telemetry-response.dto';
import { IotDeviceAuthGuard } from './guards/iot-device-auth.guard';

@Controller('api/iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  /**
   * Recibe una lectura de telemetría desde un collar IoT, retransmitida por un gateway
   * autenticado (gateway_id + header X-API-Key, ver IotDeviceAuthGuard).
   *
   * Persiste la lectura y devuelve un downlink con coordenadas
   * de cerco virtual para enviar al collar por LoRa.
   *
   * @param payload - Datos de telemetría: collar_id, lat, lng, temp, gateway_id, rssi, snr
   * @returns downlink con coordenadas del cerco virtual
   */
  @Post('telemetry')
  @UseGuards(IotDeviceAuthGuard)
  async ingestTelemetry(@Body() payload: TelemetryPayloadDto): Promise<TelemetryResponseDto> {
    return this.iotService.handleTelemetry(payload);
  }
}
