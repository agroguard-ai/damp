import { Controller, Post, Body } from '@nestjs/common';
import { IotService } from './iot.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Controller('api/iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  @Post('telemetry')
  async ingestTelemetry(@Body() payload: TelemetryPayloadDto) {
    return this.iotService.handleTelemetry(payload);
  }
}