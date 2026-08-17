import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GatewaysService } from '@/gateways/gateways.service';
import { AlertSettingsService } from '@/alert-settings/alert-settings.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { isPointInPolygon } from './utils/geofencing.utils';
import { haversineMeters } from './utils/haversine.utils';

// Distancia por debajo de la cual un conjunto de lecturas se considera "sin movimiento" (jitter de GPS incluido).
const INACTIVITY_RADIUS_M = 15;

@Injectable()
export class IotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewaysService: GatewaysService,
    private readonly alertSettingsService: AlertSettingsService
  ) {}

  /**
   * Procesa una lectura de telemetría enviada por un collar IoT.
   *
   * 1. Valida que el collar exista.
   * 2. Persiste la lectura (lat, lng, temp).
   * 3. Busca el animal activo asociado al collar y su cerco virtual activo.
   * 4. Si el animal está fuera del cerco, dispara una alerta ESCAPE (si no hay ya una sin resolver).
   * 5. Devuelve downlink con las coordenadas del cerco activo para el collar (o "NONE").
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

    if (payload.gateway_id) {
      await this.gatewaysService.recordHeartbeat(payload.gateway_id, payload.rssi, payload.snr);
    }

    const animalCollar = await this.prisma.animalCollar.findFirst({
      where: { collarId: payload.collar_id, endAt: null },
      select: { animalId: true, animal: { select: { farmId: true } } },
    });

    if (!animalCollar) {
      return { downlink: 'NONE' };
    }

    await this.checkHealthThresholds(animalCollar.animalId, animalCollar.animal.farmId, payload);

    const animalGeofence = await this.prisma.animalGeofence.findFirst({
      where: { animalId: animalCollar.animalId, endAt: null, geofence: { active: true } },
      include: { geofence: true },
    });

    if (!animalGeofence?.geofence.polygonCoordinates) {
      return { downlink: 'NONE' };
    }

    const polygon = animalGeofence.geofence.polygonCoordinates as unknown as [number, number][];

    const isInside = isPointInPolygon([payload.lat, payload.lng], polygon);
    if (!isInside) {
      await this.raiseEscapeAlert(animalCollar.animalId, animalGeofence.geofence.name);
    }

    const downlink = polygon.map((p) => `${p[0]},${p[1]}`).join(';');

    return { downlink };
  }

  private async raiseEscapeAlert(animalId: string, geofenceName: string) {
    const existing = await this.prisma.alert.findFirst({
      where: { animalId, type: 'ESCAPE', isResolved: false },
    });

    if (existing) {
      return;
    }

    await this.prisma.alert.create({
      data: {
        animalId,
        type: 'ESCAPE',
        message: `El animal salió del cerco virtual "${geofenceName}".`,
      },
    });
  }

  /**
   * Evalúa la lectura actual contra los umbrales configurados por la granja (CU016) y,
   * si corresponde, dispara una alerta HEALTH (fiebre, hipotermia o inactividad prolongada).
   */
  private async checkHealthThresholds(animalId: string, farmId: string, payload: TelemetryPayloadDto) {
    const settings = await this.alertSettingsService.getEffective(farmId);

    if (payload.temp >= settings.feverThreshold) {
      await this.raiseHealthAlert(animalId, `Temperatura elevada detectada: ${payload.temp}°C (posible fiebre).`);
      return;
    }
    if (payload.temp <= settings.hypothermiaThreshold) {
      await this.raiseHealthAlert(animalId, `Temperatura baja detectada: ${payload.temp}°C (posible hipotermia).`);
      return;
    }

    await this.checkInactivity(animalId, payload.collar_id, settings.inactivityMinutes);
  }

  private async checkInactivity(animalId: string, collarId: number, inactivityMinutes: number) {
    const since = new Date(Date.now() - inactivityMinutes * 60 * 1000);
    const readings = await this.prisma.telemetryReading.findMany({
      where: { collarId, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      select: { latitude: true, longitude: true, timestamp: true },
    });

    if (readings.length < 2) {
      return; // No hay suficiente historial en la ventana para evaluar inactividad todavía.
    }

    const elapsedMs = readings[readings.length - 1].timestamp.getTime() - readings[0].timestamp.getTime();
    if (elapsedMs < inactivityMinutes * 60 * 1000) {
      return; // Ventana todavía no cubre el período configurado.
    }

    const origin: [number, number] = [readings[0].latitude, readings[0].longitude];
    const hasMoved = readings.some((r) => haversineMeters(origin, [r.latitude, r.longitude]) > INACTIVITY_RADIUS_M);

    if (!hasMoved) {
      await this.raiseHealthAlert(
        animalId,
        `El animal no registra movimiento significativo hace más de ${inactivityMinutes} minutos.`
      );
    }
  }

  private async raiseHealthAlert(animalId: string, message: string) {
    const existing = await this.prisma.alert.findFirst({
      where: { animalId, type: 'HEALTH', isResolved: false },
    });

    if (existing) {
      return;
    }

    await this.prisma.alert.create({
      data: { animalId, type: 'HEALTH', message },
    });
  }
}
