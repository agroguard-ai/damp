import { Controller, Post, Body, ParseArrayPipe } from '@nestjs/common';
import { IotService } from './iot.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Controller('api/iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  @Post('telemetry')
  async ingestTelemetry(
    @Body(new ParseArrayPipe({ items: TelemetryPayloadDto }))
    payloads: TelemetryPayloadDto[],
  ) {
    return this.iotService.handleTelemetryBatch(payloads);
  }
}
