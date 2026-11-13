import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertType, HealthPrediction } from '@generated/prisma';
import { EVENT_LABELS_ES, ML_HEALTH_THRESHOLDS, MlHealthService } from '@/iot/ml-health.service';
import {
  blockStartFor,
  buildMlWindow,
  ML_BLOCK_MINUTES,
  ML_MIN_BLOCKS_WITH_DATA,
  ML_WINDOW_BLOCKS,
} from '@/iot/ml-window';

/** Antigüedad máxima de una predicción para contar como "riesgo actual" de un animal. */
const CURRENT_RISK_HOURS = 6;

export interface AlertsQuery {
  farmId?: string;
  animalId?: string;
  type?: AlertType;
  resolved?: boolean;
  source?: 'ML' | 'THRESHOLD' | 'ESCAPE';
  from?: string;
  to?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlHealthService: MlHealthService
  ) {}

  private async getAccessibleFarmIds(userId: string): Promise<string[]> {
    const userFarms = await this.prisma.farm.findMany({
      where: {
        isActive: true,
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
      select: { id: true },
    });
    return userFarms.map((f) => f.id);
  }

  private async assertFarmAccess(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findFirst({
      where: {
        id: farmId,
        isActive: true,
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
    });
    if (!farm) {
      throw new ForbiddenException('No tienes acceso a este campo o el campo está inactivo.');
    }
    return farm;
  }

  async findAll(userId: string, query: AlertsQuery) {
    const farmIds = await this.getAccessibleFarmIds(userId);

    const animalFilter: Record<string, unknown> = {
      farmId: query.farmId ? query.farmId : { in: farmIds },
    };

    const where: Record<string, unknown> = { animal: animalFilter };

    if (query.animalId) {
      where.animalId = query.animalId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.resolved !== undefined) {
      where.isResolved = query.resolved;
    }
    if (query.source === 'ML') {
      where.message = { contains: '[IA:' };
    } else if (query.source === 'THRESHOLD') {
      where.message = { contains: '[UMBRAL:' };
    } else if (query.source === 'ESCAPE') {
      where.type = 'ESCAPE';
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    return this.prisma.alert.findMany({
      where,
      include: {
        animal: {
          include: {
            animalType: true,
          },
        },
        healthPredictions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async resolveAlert(id: string, userId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        animal: {
          include: {
            farm: {
              include: {
                farmUsers: { where: { userId, isActive: true } },
              },
            },
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta con ID ${id} no encontrada.`);
    }

    const farm = alert.animal.farm;
    if (!farm) {
      throw new ForbiddenException('La alerta pertenece a un animal sin campo asignado.');
    }
    const isOwner = farm.userId === userId;
    const isMember = farm.farmUsers.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tienes acceso a esta alerta.');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        isResolved: true,
      },
    });
  }

  /**
   * CU014 - Camino alternativo 2:
   * Consulta el historial de predicciones de salud del rodeo o de un animal puntual,
   * incluyendo aquellas predicciones de baja certeza guardadas para revisión preventiva.
   */
  async getHealthPredictions(userId: string, farmId: string, animalId?: string, limit = 50) {
    await this.assertFarmAccess(farmId, userId);

    return this.prisma.healthPrediction.findMany({
      where: {
        animal: { farmId },
        ...(animalId ? { animalId } : {}),
      },
      include: {
        animal: {
          select: {
            id: true,
            tag: true,
            breed: true,
            sex: true,
            animalType: { select: { name: true, species: true } },
          },
        },
        alert: {
          select: {
            id: true,
            type: true,
            message: true,
            isResolved: true,
            feedbackNote: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  /**
   * CU014 - Métricas de desempeño del modelo ML en campo:
   * Calcula tasa de falsos positivos vs. confirmados para auditar el rendimiento del modelo.
   */
  async getMlPerformanceMetrics(userId: string, farmId: string) {
    await this.assertFarmAccess(farmId, userId);

    const [totalMlAlerts, totalPredictions, eventCounts] = await Promise.all([
      this.prisma.alert.count({
        where: { animal: { farmId }, message: { contains: '[IA:' } },
      }),
      this.prisma.healthPrediction.count({
        where: { animal: { farmId } },
      }),
      this.prisma.healthPrediction.groupBy({
        by: ['predictedEvent', 'detected'],
        where: { animal: { farmId } },
        _count: { _all: true },
      }),
    ]);

    return {
      totalMlAlerts,
      totalPredictions,
      eventBreakdown: eventCounts,
    };
  }

  /** Estado del servicio de IA (para avisar en el front si está caído o sin modelo). */
  getMlStatus() {
    return this.mlHealthService.status();
  }

  /**
   * "¿En qué se basó?": reconstruye la ventana de 24 h (48 bloques de 30 min) que analizó el
   * modelo para una predicción, con la misma agregación que se usó al predecir (ml-window.ts).
   */
  async getPredictionInputs(userId: string, predictionId: string) {
    const prediction = await this.prisma.healthPrediction.findUnique({
      where: { id: predictionId },
      include: { animal: { select: { id: true, tag: true, farmId: true } } },
    });
    if (!prediction) {
      throw new NotFoundException('Predicción no encontrada.');
    }
    if (!prediction.animal.farmId) {
      throw new ForbiddenException('La predicción pertenece a un animal sin campo asignado.');
    }
    await this.assertFarmAccess(prediction.animal.farmId, userId);

    const blockMs = ML_BLOCK_MINUTES * 60 * 1000;
    // Predicciones anteriores a windowEndAt: se asume la ventana del bloque en que se crearon
    const windowEnd = prediction.windowEndAt ?? blockStartFor(prediction.createdAt);
    const windowStart = new Date(windowEnd.getTime() - ML_WINDOW_BLOCKS * blockMs);
    const from = new Date(windowStart.getTime() - blockMs);

    // Collares que tuvo el animal durante la ventana
    const animalCollars = await this.prisma.animalCollar.findMany({
      where: {
        animalId: prediction.animalId,
        startAt: { lt: windowEnd },
        OR: [{ endAt: null }, { endAt: { gt: from } }],
      },
      select: { collarId: true },
    });

    const readings = animalCollars.length
      ? await this.prisma.telemetryReading.findMany({
          where: {
            collarId: { in: animalCollars.map((ac) => ac.collarId) },
            timestamp: { gte: from, lt: windowEnd },
          },
          orderBy: { timestamp: 'asc' },
          select: { temperature: true, latitude: true, longitude: true, timestamp: true },
        })
      : [];

    const window = buildMlWindow(readings, new Date(windowEnd.getTime() - 1));

    return {
      predictionId: prediction.id,
      animal: { id: prediction.animal.id, tag: prediction.animal.tag },
      predictedEvent: prediction.predictedEvent,
      probability: prediction.probability,
      threshold: prediction.threshold,
      detected: prediction.detected,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      blocksWithData: window.blocksWithData,
      blocks: window.blocks.map((b, i) => ({
        timestamp: b.timestamp,
        temperature: Number(b.temperature.toFixed(2)),
        distanceMeters: Math.round(b.distance_m),
        hasData: window.hasData[i],
      })),
    };
  }

  /**
   * Riesgo actual por animal: eventos que el modelo detectó en las predicciones de las
   * últimas CURRENT_RISK_HOURS horas (la más alta por animal y evento).
   */
  async getCurrentMlRisk(userId: string, farmId: string) {
    await this.assertFarmAccess(farmId, userId);

    const since = new Date(Date.now() - CURRENT_RISK_HOURS * 3_600_000);
    const predictions = await this.prisma.healthPrediction.findMany({
      where: { animal: { farmId }, detected: true, createdAt: { gte: since } },
      select: { animalId: true, predictedEvent: true, probability: true, createdAt: true },
      orderBy: { probability: 'desc' },
    });

    const byAnimal = new Map<string, { event: string; probability: number; createdAt: Date }[]>();
    for (const p of predictions) {
      const events = byAnimal.get(p.animalId) ?? [];
      if (!events.some((e) => e.event === p.predictedEvent)) {
        events.push({ event: p.predictedEvent, probability: p.probability, createdAt: p.createdAt });
      }
      byAnimal.set(p.animalId, events);
    }

    return Array.from(byAnimal.entries()).map(([animalId, events]) => ({ animalId, events }));
  }

  /**
   * Fuerza una predicción inmediata de salud para un animal específico usando las últimas 24 h
   * de telemetría (48 bloques de 30 min), sin esperar al siguiente bloque ni omitir si ya existía
   * una predicción previa para la ventana actual.
   */
  async triggerAnimalPrediction(userId: string, animalId: string) {
    if (!animalId) {
      throw new BadRequestException('Debes indicar el animal para ejecutar la predicción.');
    }

    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, farmId: true, sex: true, tag: true },
    });
    if (!animal) {
      throw new NotFoundException('Animal no encontrado.');
    }
    if (!animal.farmId) {
      throw new ForbiddenException('El animal no pertenece a ningún campo.');
    }
    await this.assertFarmAccess(animal.farmId, userId);

    const blockMs = ML_BLOCK_MINUTES * 60 * 1000;
    const windowEnd = blockStartFor(new Date());
    const windowStart = new Date(windowEnd.getTime() - ML_WINDOW_BLOCKS * blockMs);
    const from = new Date(windowStart.getTime() - blockMs);

    const animalCollars = await this.prisma.animalCollar.findMany({
      where: {
        animalId,
        startAt: { lt: windowEnd },
        OR: [{ endAt: null }, { endAt: { gt: from } }],
      },
      select: { collarId: true },
    });

    const readings = animalCollars.length
      ? await this.prisma.telemetryReading.findMany({
          where: {
            collarId: { in: animalCollars.map((ac) => ac.collarId) },
            timestamp: { gte: from, lt: windowEnd },
          },
          orderBy: { timestamp: 'asc' },
          select: { temperature: true, latitude: true, longitude: true, timestamp: true },
        })
      : [];

    const window = buildMlWindow(readings, new Date(windowEnd.getTime() - 1));
    if (window.blocksWithData < ML_MIN_BLOCKS_WITH_DATA) {
      throw new BadRequestException(
        `Historial insuficiente para predecir: se requieren al menos ${ML_MIN_BLOCKS_WITH_DATA} bloques de 30 min con datos en las últimas 24 h (actualmente hay ${window.blocksWithData}).`
      );
    }

    const result = await this.mlHealthService.predict(animalId, animal.sex, window.blocks);
    if (!result) {
      throw new ServiceUnavailableException('El servicio de IA (ml-service) no respondió o no está disponible.');
    }
    if (!result.ready) {
      throw new BadRequestException('El modelo de IA aún no está listo o la ventana es insuficiente.');
    }

    const created: HealthPrediction[] = [];
    for (const [eventName, prediction] of Object.entries(result.events)) {
      const label = EVENT_LABELS_ES[eventName] ?? eventName;
      const confidencePct = Math.round(prediction.probability * 100);
      const threshold = prediction.threshold ?? ML_HEALTH_THRESHOLDS[eventName] ?? 0.5;
      const isDetected = prediction.detected ?? prediction.probability >= threshold;

      let alertId: string | null = null;
      if (isDetected) {
        const dedupeKey = `[IA:${eventName.toUpperCase()}]`;
        const existingAlert = await this.prisma.alert.findFirst({
          where: { animalId, type: 'HEALTH', isResolved: false, message: { startsWith: dedupeKey } },
          select: { id: true },
        });
        if (existingAlert) {
          alertId = existingAlert.id;
        } else {
          const alert = await this.prisma.alert.create({
            data: {
              animalId,
              type: 'HEALTH',
              message: `${dedupeKey} Modelo predictivo: posible ${label} en las próximas 6hs (confianza ${confidencePct}%).`,
            },
          });
          alertId = alert.id;
        }
      }

      const saved = await this.prisma.healthPrediction.create({
        data: {
          animalId,
          predictedEvent: eventName,
          probability: prediction.probability,
          threshold,
          detected: isDetected,
          horizonHours: 6,
          windowReadingsCount: window.blocksWithData,
          windowEndAt: windowEnd,
          alertId,
        },
      });
      created.push(saved);
    }

    return {
      animalId,
      windowEndAt: windowEnd,
      blocksWithData: window.blocksWithData,
      predictions: created,
    };
  }

  /**
   * Proyección futura a 48 h (4 tramos de 12 h: 0-12h, 12-24h, 24-36h, 36-48h) para un animal.
   * Devuelve available=false de forma controlada si falta historial (< 72 bloques de 48h) o ml-service no responde.
   */
  async getAnimalTrajectory48h(userId: string, animalId: string) {
    if (!animalId) {
      throw new BadRequestException('Debes indicar el animal.');
    }

    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, farmId: true, sex: true },
    });
    if (!animal) {
      throw new NotFoundException('Animal no encontrado.');
    }
    if (!animal.farmId) {
      throw new ForbiddenException('El animal no pertenece a ningún campo.');
    }
    await this.assertFarmAccess(animal.farmId, userId);

    const windowBlocks48h = 96;
    const minBlocks48h = 72;
    const blockMs = ML_BLOCK_MINUTES * 60 * 1000;
    const windowEnd = blockStartFor(new Date());
    const windowStart = new Date(windowEnd.getTime() - windowBlocks48h * blockMs);
    const from = new Date(windowStart.getTime() - blockMs);

    const animalCollars = await this.prisma.animalCollar.findMany({
      where: {
        animalId,
        startAt: { lt: windowEnd },
        OR: [{ endAt: null }, { endAt: { gt: from } }],
      },
      select: { collarId: true },
    });

    const readings = animalCollars.length
      ? await this.prisma.telemetryReading.findMany({
          where: {
            collarId: { in: animalCollars.map((ac) => ac.collarId) },
            timestamp: { gte: from, lt: windowEnd },
          },
          orderBy: { timestamp: 'asc' },
          select: { temperature: true, latitude: true, longitude: true, timestamp: true },
        })
      : [];

    const window = buildMlWindow(readings, new Date(windowEnd.getTime() - 1), windowBlocks48h);
    if (window.blocksWithData < minBlocks48h) {
      return {
        available: false,
        reason: `Se requieren al menos ${minBlocks48h} bloques con datos en 48 h (actualmente ${window.blocksWithData}).`,
        stages: [],
        summary: {},
      };
    }

    const result = await this.mlHealthService.predictTrajectory48h(animalId, animal.sex, window.blocks);
    if (!result || !result.ready) {
      return {
        available: false,
        reason: 'El modelo de trayectoria 48 h no está disponible en este momento.',
        stages: [],
        summary: {},
      };
    }

    return {
      available: true,
      generatedAt: windowEnd.toISOString(),
      blocksWithData: window.blocksWithData,
      stages: result.trajectory_stages,
      summary: result.passed_states_summary,
    };
  }
}
