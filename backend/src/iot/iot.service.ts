import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  async handleTelemetry(payload: TelemetryPayloadDto) {
    const { mac_id, lat, lng, temp, battery } = payload;

    // 1. Buscar collar por mac_id (serialNumber)
    const collar = await this.prisma.collar.findUnique({
      where: { serialNumber: mac_id },
    });

    if (!collar) {
      throw new NotFoundException(`Collar with MAC/Serial Number ${mac_id} not found.`);
    }

    // 2. Verificar si está asignado a un animal activo
    const assignment = await this.prisma.animalCollar.findFirst({
      where: {
        collarId: collar.id,
        endAt: null,
      },
    });

    if (!assignment) {
      return {
        status: 'ignored',
        message: `Telemetry ignored: Collar ${mac_id} is not assigned to any active animal.`,
      };
    }

    // 3. Guardar lectura de telemetría
    const reading = await this.prisma.telemetryReading.create({
      data: {
        collarId: collar.id,
        latitude: lat,
        longitude: lng,
        temperature: temp,
        batteryLevel: battery,
        timestamp: new Date(),
      },
    });

    // 4. Actualizar last_telemetry_date en el collar
    await this.prisma.collar.update({
      where: { id: collar.id },
      data: {
        lastTelemetryDate: new Date(),
      },
    });

    return {
      status: 'success',
      message: 'Telemetry registered successfully',
      readingId: reading.id,
      animalId: assignment.animalId,
    };
  }
}
