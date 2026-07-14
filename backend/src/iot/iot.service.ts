import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  async handleTelemetry(payload: TelemetryPayloadDto) {
    const collar = await this.prisma.collar.findUnique({
      where: { id: payload.collar_id },
    });

    if (!collar) {
      throw new NotFoundException(`Collar with id ${payload.collar_id} not found`);
    }

    await this.prisma.telemetryReading.create({
      data: {
        collarId: payload.collar_id,
        latitude: payload.lat,
        longitude: payload.lng,
        temperature: payload.temp,
      },
    });

    await this.prisma.collar.update({
      where: { id: payload.collar_id },
      data: { lastTelemetryDate: new Date() },
    });

    return { status: 'success', message: 'Reading registered successfully' };
  }
}