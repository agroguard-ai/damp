import { Controller, Post, Body, UseGuards, Req, Res, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { IotService } from './iot.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { IotDeviceAuthGuard } from './guards/iot-device-auth.guard';

@Controller('api/iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  /**
   * Recibe una lectura de telemetría desde un collar IoT, retransmitida por un gateway
   * autenticado (gateway_id + header X-API-Key, ver IotDeviceAuthGuard).
   *
   * Persiste la lectura y devuelve:
   * - 200 con downlink de cerco virtual si hay actualización para enviar al collar.
   * - 204 No Content si no hay cambios/downlink pendiente (el gateway no emite nada por LoRa).
   *
   * @param payload - Datos de telemetría: collar_id, lat, lng, temp, gateway_id, rssi, snr
   */
  @Post('telemetry')
  @UseGuards(IotDeviceAuthGuard)
  async ingestTelemetry(
    @Body() payload: TelemetryPayloadDto,
    @Req() req: Request & { gateway?: { id: string; farmId: string; zoneId: string } },
    @Res() res: Response
  ) {
    const result = await this.iotService.handleTelemetry(payload, req.gateway);

    if (!result.downlink || result.downlink === 'NONE') {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }
}

