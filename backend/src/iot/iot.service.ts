import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

/**
 * Coordenadas dummy de un polígono de límites cerca de Rosario (-32.95, -60.66).
 * Representan 4 esquinas de un cuadrante de prueba.
 * En producción, estos puntos vendrán de la zona/geocerca asociada al animal.
 */
const DUMMY_BOUNDARY_POINTS = [
  { lat: -32.94, lng: -60.67 },
  { lat: -32.94, lng: -60.65 },
  { lat: -32.96, lng: -60.65 },
  { lat: -32.96, lng: -60.67 },
];

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa una lectura de telemetría enviada por un collar IoT.
   *
   * 1. Valida que el collar exista.
   * 2. Persiste la lectura (lat, lng, temp).
   * 3. Busca el animal activamente asociado al collar (AnimalCollar con endAt IS NULL).
   * 4. Devuelve coordenadas límite dummy (cerca de Rosario) con estado INFORMED.
   *
   * @todo En el futuro, las coordenadas se guardarán en una tabla BoundaryUpdate
   *       con estados PENDING / INFORMED, y solo se devolverán cuando haya
   *       cambios reales en los límites de la zona/geocerca del animal.
   *
   * @param payload - Datos enviados por el collar (collar_id, lat, lng, temp)
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

    const animalId = activeAnimalCollar?.animal?.id ?? null;

    return {
      status: 'success' as const,
      message: 'Reading registered successfully',
      animalId,
      boundaryUpdates: [
        {
          id: 'dummy-boundary-001',
          coordinates: DUMMY_BOUNDARY_POINTS,
          status: 'INFORMED' as const,
          informedAt: new Date().toISOString(),
        },
      ],
    };
  }
}
