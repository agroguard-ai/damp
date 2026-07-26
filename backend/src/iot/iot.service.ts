import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa una lectura de telemetría enviada por un collar IoT.
   *
   * 1. Valida que el collar exista.
   * 2. Persiste la lectura (lat, lng, temp).
   * 3. Busca el animal activo asociado al collar.
   * 4. Devuelve downlink con coordenadas de cerco virtual para el collar.
   */
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

    const activeAnimalCollar = await this.prisma.animalCollar.findFirst({
      where: { collarId: payload.collar_id, endAt: null },
      include: { animal: true },
    });

    if (!activeAnimalCollar) {
      return { downlink: 'NONE' };
    }

    const downlink = [
      [-32.94, -60.67],
      [-32.94, -60.65],
      [-32.96, -60.65],
      [-32.96, -60.67],
    ]
      .map((p) => `${p[0]},${p[1]}`)
      .join(';');

    return { downlink };
  }
}
