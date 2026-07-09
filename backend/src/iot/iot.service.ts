import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { isPointInPolygon } from './utils/geofencing.utils';

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
    console.log('[Telemetry Ingestion] Received MACs:', macIds);

    // 2. Buscar todos los collares registrados para esos MACs
    const collars = await this.prisma.collar.findMany({
      where: { serialNumber: { in: macIds } },
    });
    console.log('[Telemetry Ingestion] Found registered collars:', collars);

    const collarMap = new Map(collars.map((c) => [c.serialNumber, c.id]));
    const collarIds = collars.map((c) => c.id);

    // 3. Buscar asignaciones activas de animales para esos collares
    const assignments = await this.prisma.animalCollar.findMany({
      where: {
        collarId: { in: collarIds },
        endAt: null,
      },
      include: {
        collar: true,
        animal: {
          include: {
            zone: true,
            farm: {
              include: {
                zones: true,
              },
            },
          },
        },
      },
    });
    console.log('[Telemetry Ingestion] Found active assignments:', assignments);

    const assignedCollarIds = new Set(assignments.map((a) => a.collarId));
    console.log('[Telemetry Ingestion] Active assigned collar IDs:', Array.from(assignedCollarIds));

    // Determinar sugerencias de geolocalización basadas en los lotes del establecimiento
    const suggestedLocations: Record<string, { lat: number; lng: number }> = {};
    for (const assignment of assignments) {
      const zones = assignment.animal.farm.zones;
      if (zones && zones.length > 0) {
        try {
          const coords = typeof zones[0].polygonCoordinates === 'string'
            ? JSON.parse(zones[0].polygonCoordinates)
            : zones[0].polygonCoordinates;
          if (assignment.collar.serialNumber && Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && coords[0].length === 2) {
            suggestedLocations[assignment.collar.serialNumber] = {
              lat: coords[0][0],
              lng: coords[0][1],
            };
          }
        } catch (e) {
          console.error('[Telemetry Ingestion] Error parsing zones coordinates:', e);
        }
      }
    }

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

        // Control de Cerco Eléctrico Virtual (Geofencing)
        const assignment = assignments.find((a) => a.collarId === collarId);
        if (assignment && assignment.animal && assignment.animal.zone) {
          const zone = assignment.animal.zone;
          if (zone.polygonCoordinates) {
            try {
              const polyCoords = typeof zone.polygonCoordinates === 'string'
                ? JSON.parse(zone.polygonCoordinates)
                : zone.polygonCoordinates;
              
              if (Array.isArray(polyCoords) && polyCoords.length > 0) {
                const isInside = isPointInPolygon([item.lat, item.lng], polyCoords);
                
                if (!isInside) {
                  // Buscar si ya existe una alerta de escape activa para este animal
                  const activeAlert = await this.prisma.alert.findFirst({
                    where: {
                      animalId: assignment.animal.id,
                      type: 'ESCAPE',
                      isResolved: false,
                    },
                  });

                  if (!activeAlert) {
                    await this.prisma.alert.create({
                      data: {
                        type: 'ESCAPE',
                        message: `El animal con caravana "${assignment.animal.tag || assignment.animal.id.slice(0, 5)}" ha traspasado los límites del potrero "${zone.name}".`,
                        animalId: assignment.animal.id,
                      },
                    });
                    console.log(`[Geofencing Alert] Created ESCAPE alert for animal ${assignment.animal.tag || assignment.animal.id}`);
                  }
                }
              }
            } catch (e) {
              console.error('[Geofencing] Error during polygon validation:', e);
            }
          }
        }
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
      suggestedLocations,
    };
  }
}
