import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  async handleTelemetryBatch(payloads: TelemetryPayloadDto[]) {
    if (!payloads || payloads.length === 0) {
      return {
        status: 'ignored',
        message: 'No telemetry payload provided',
        processed: 0,
      };
    }

    // 1. Obtener todos los MAC IDs del lote
    const macIds = payloads.map((p) => p.mac_id);

    // 2. Buscar todos los collares registrados para esos MACs
    const collars = await this.prisma.collar.findMany({
      where: { serialNumber: { in: macIds } },
    });

    const collarMap = new Map(collars.map((c) => [c.serialNumber, c.id]));
    const collarIds = collars.map((c) => c.id);

    // 3. Buscar asignaciones activas de animales para esos collares
    const assignments = await this.prisma.animalCollar.findMany({
      where: {
        collarId: { in: collarIds },
        endAt: null,
      },
    });

    const assignedCollarIds = new Set(assignments.map((a) => a.collarId));

    // 4. Filtrar y preparar lecturas válidas
    const validReadings: any[] = [];
    const collarsToUpdate = new Set<string>();

    for (const item of payloads) {
      const collarId = collarMap.get(item.mac_id);
      // Validar si existe el collar y si está asignado a un animal activo
      if (collarId && assignedCollarIds.has(collarId)) {
        validReadings.push({
          collarId: collarId,
          latitude: item.lat,
          longitude: item.lng,
          temperature: item.temp,
          batteryLevel: item.battery,
          timestamp: new Date(),
        });
        collarsToUpdate.add(collarId);
      }
    }

    // 5. Inserción masiva si hay lecturas válidas
    if (validReadings.length > 0) {
      await this.prisma.telemetryReading.createMany({
        data: validReadings,
      });

      // Actualización masiva de lastTelemetryDate en los collares
      await this.prisma.collar.updateMany({
        where: { id: { in: Array.from(collarsToUpdate) } },
        data: {
          lastTelemetryDate: new Date(),
        },
      });
    }

    return {
      status: 'success',
      message: `Processed batch of ${payloads.length} items. Inserted: ${validReadings.length} readings.`,
      inserted: validReadings.length,
      ignored: payloads.length - validReadings.length,
    };
  }
}
