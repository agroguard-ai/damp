import { Injectable, Logger, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GatewaysService } from '@/gateways/gateways.service';
import { AlertSettingsService } from '@/alert-settings/alert-settings.service';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { isPointInPolygon } from './utils/geofencing.utils';
import { haversineMeters } from './utils/haversine.utils';
import { MlHealthService, ML_WINDOW_SIZE } from './ml-health.service';
import { ZoneRotationsService } from '@/zones/zone-rotations.service';

// Distancia por debajo de la cual un conjunto de lecturas se considera "sin movimiento" (jitter de GPS incluido).
const INACTIVITY_RADIUS_M = 15;

const EVENT_LABELS_ES: Record<string, string> = {
  fiebre: 'fiebre',
  celo: 'celo',
  inactividad: 'inactividad prolongada',
  anomalia: 'un evento anómalo',
};

@Injectable()
export class IotService {
  private readonly logger = new Logger(IotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewaysService: GatewaysService,
    private readonly alertSettingsService: AlertSettingsService,
    private readonly mlHealthService: MlHealthService,
    @Optional() private readonly zoneRotationsService?: ZoneRotationsService
  ) {}

  /**
   * Procesa una lectura de telemetría enviada por un collar IoT.
   *
   * 1. Valida que el collar exista.
   * 2. Valida que el collar pertenezca a la misma granja que el gateway autenticado.
   * 3. Persiste la lectura (lat, lng, temp).
   * 4. Busca el animal activo asociado al collar y su cerco virtual activo.
   * 5. Si el animal está fuera del cerco, dispara una alerta ESCAPE (si no hay ya una sin resolver).
   * 6. Devuelve downlink con las coordenadas del cerco activo para el collar (o "NONE").
   */
  async handleTelemetry(
    payload: TelemetryPayloadDto,
    authenticatedGateway?: { id: string; farmId: string | null; zoneId: string | null }
  ) {
    const collar = await this.prisma.collar.findUnique({
      where: { id: payload.collar_id },
    });

    if (!collar) {
      throw new NotFoundException(`Collar with id ${payload.collar_id} not found`);
    }

    // Validación de pertenencia estricta: el collar debe pertenecer al mismo establecimiento que el gateway autenticado
    if (authenticatedGateway?.farmId && collar.farmId && collar.farmId !== authenticatedGateway.farmId) {
      this.logger.warn(
        `[IoT Telemetry] Rechazado 403: El collar ${collar.id} pertenece al campo ${collar.farmId}, pero fue retransmitido por un gateway del campo ${authenticatedGateway.farmId}.`
      );
      throw new ForbiddenException(
        `El collar con ID ${payload.collar_id} no pertenece al establecimiento de este gateway.`
      );
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

    // gateway_id ya se validó en IotDeviceAuthGuard (existe y el X-API-Key matchea) antes de llegar acá.
    await this.gatewaysService.recordHeartbeat(payload.gateway_id, payload.rssi, payload.snr);

    const animalCollar = await this.prisma.animalCollar.findFirst({
      where: { collarId: payload.collar_id, endAt: null },
      select: { animalId: true, animal: { select: { farmId: true, zoneId: true } } },
    });

    if (!animalCollar) {
      return { downlink: 'NONE' };
    }

    await this.checkHealthThresholds(animalCollar.animalId, animalCollar.animal.farmId, payload);
    await this.checkPredictiveHealth(animalCollar.animalId, payload.collar_id);

    // Obtener las coordenadas del cerco activo.
    // Si la zona tiene un plan de rotación activo (CU012), sincroniza el avance y calcula
    // las coordenadas rotadas / incrementales hora a hora para enviar en el downlink al gateway.
    let activeFence: { polygon: [number, number][]; geofenceName: string } | null = null;
    if (this.zoneRotationsService) {
      activeFence = await this.zoneRotationsService.resolveActiveCoordinatesForAnimal(
        animalCollar.animalId,
        animalCollar.animal.zoneId
      );
    } else {
      const animalGeofence = await this.prisma.animalGeofence.findFirst({
        where: { animalId: animalCollar.animalId, endAt: null, geofence: { active: true } },
        include: { geofence: true },
      });
      if (animalGeofence?.geofence.polygonCoordinates) {
        let poly: [number, number][] = [];
        try {
          poly =
            typeof animalGeofence.geofence.polygonCoordinates === 'string'
              ? JSON.parse(animalGeofence.geofence.polygonCoordinates)
              : (animalGeofence.geofence.polygonCoordinates as [number, number][]);
        } catch {
          poly = [];
        }
        if (Array.isArray(poly) && poly.length >= 3) {
          activeFence = { polygon: poly, geofenceName: animalGeofence.geofence.name };
        }
      }
    }

    if (!activeFence || activeFence.polygon.length === 0) {
      return { downlink: 'NONE' };
    }

    const polygon = activeFence.polygon;

    const isInside = isPointInPolygon([payload.lat, payload.lng], polygon);
    if (!isInside) {
      await this.raiseEscapeAlert(animalCollar.animalId, activeFence.geofenceName);
    }

    // Downlink con las coordenadas actualizadas para que el gateway se las transmita al collar por LoRa
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
   *
   * Es reactiva e instantánea (una sola lectura fuera de umbral ya alcanza) — complementa,
   * no reemplaza, a checkPredictiveHealth, que mira 24hs de historial y predice a futuro.
   */
  private async checkHealthThresholds(animalId: string, farmId: string, payload: TelemetryPayloadDto) {
    const settings = await this.alertSettingsService.getEffective(farmId);

    if (payload.temp >= settings.feverThreshold) {
      await this.raiseHealthAlert(
        animalId,
        '[UMBRAL:FIEBRE]',
        `Temperatura elevada detectada: ${payload.temp}°C (posible fiebre).`
      );
      return;
    }
    if (payload.temp <= settings.hypothermiaThreshold) {
      await this.raiseHealthAlert(
        animalId,
        '[UMBRAL:HIPOTERMIA]',
        `Temperatura baja detectada: ${payload.temp}°C (posible hipotermia).`
      );
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
        '[UMBRAL:INACTIVIDAD]',
        `El animal no registra movimiento significativo hace más de ${inactivityMinutes} minutos.`
      );
    }
  }

  /**
   * Predicción con el modelo LSTM real (damp-ml-api, servido por damp/ml-service): a
   * partir de las últimas ML_WINDOW_SIZE lecturas, predice si cada evento (fiebre,
   * celo, inactividad, anomalía) va a estar activo en las próximas 6hs. Requiere
   * historial suficiente — si el animal tiene menos de ML_WINDOW_SIZE lecturas
   * todavía, el servicio devuelve ready=false y no se genera ninguna alerta.
   */
  private async checkPredictiveHealth(animalId: string, collarId: number) {
    const [animal, recentReadings] = await Promise.all([
      this.prisma.animal.findUnique({ where: { id: animalId }, select: { sex: true } }),
      this.prisma.telemetryReading.findMany({
        where: { collarId },
        orderBy: { timestamp: 'desc' },
        take: ML_WINDOW_SIZE,
        select: { temperature: true, latitude: true, longitude: true, timestamp: true },
      }),
    ]);

    if (recentReadings.length < ML_WINDOW_SIZE) {
      return; // Historial insuficiente todavía para una ventana de 24hs.
    }

    const readings = recentReadings.reverse().map((r) => ({
      temperature: r.temperature,
      lat: r.latitude,
      lng: r.longitude,
      timestamp: r.timestamp.toISOString(),
    }));

    const result = await this.mlHealthService.predict(animalId, animal?.sex, readings);
    if (!result?.ready) {
      return;
    }

    for (const [eventName, prediction] of Object.entries(result.events)) {
      const label = EVENT_LABELS_ES[eventName] ?? eventName;
      const confidencePct = Math.round(prediction.probability * 100);

      let alertId: string | null = null;
      if (prediction.detected) {
        const alert = await this.raiseHealthAlert(
          animalId,
          `[IA:${eventName.toUpperCase()}]`,
          `Modelo predictivo: posible ${label} en las próximas 6hs (confianza ${confidencePct}%).`
        );
        alertId = alert?.id ?? null;
      }

      // CU014: Cuando la certeza es alta, dispara alerta y guarda la predicción vinculada.
      // Camino alternativo 1: Cuando la certeza es baja, guarda la predicción sin alertar para revisión posterior.
      try {
        await this.prisma.healthPrediction.create({
          data: {
            animalId,
            predictedEvent: eventName,
            probability: prediction.probability,
            threshold: prediction.threshold,
            detected: prediction.detected,
            horizonHours: 6,
            windowReadingsCount: readings.length,
            alertId,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Error al guardar predicción de salud para animal ${animalId}: ${err?.message || err}`);
      }
    }
  }

  /**
   * Crea una alerta HEALTH si no hay ya una sin resolver con el mismo `dedupeKey` (prefijo
   * del mensaje). El dedupeKey separa por tipo de evento y por fuente (umbral configurado
   * vs. predicción del modelo) para que no se bloqueen entre sí — sin eso, una alerta de
   * fiebre por umbral impediría que se cree una de celo predicha por el modelo, por ejemplo.
   */
  private async raiseHealthAlert(animalId: string, dedupeKey: string, message: string) {
    const existing = await this.prisma.alert.findFirst({
      where: { animalId, type: 'HEALTH', isResolved: false, message: { startsWith: dedupeKey } },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.alert.create({
      data: { animalId, type: 'HEALTH', message: `${dedupeKey} ${message}` },
    });
  }
}
