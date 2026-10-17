import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertType } from '@generated/prisma';
import { MlHealthService } from '@/iot/ml-health.service';
import { blockStartFor, buildMlWindow, ML_BLOCK_MINUTES, ML_WINDOW_BLOCKS } from '@/iot/ml-window';

/** Antigüedad máxima de una predicción para contar como "riesgo actual" de un animal. */
const CURRENT_RISK_HOURS = 6;

export interface AlertsQuery {
  farmId?: string;
  animalId?: string;
  type?: AlertType;
  resolved?: boolean;
  isFalsePositive?: boolean;
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
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
    });
    if (!farm) {
      throw new ForbiddenException('No tienes acceso a este establecimiento.');
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
    if (query.isFalsePositive !== undefined) {
      where.isFalsePositive = query.isFalsePositive;
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

    const isOwner = alert.animal.farm.userId === userId;
    const isMember = alert.animal.farm.farmUsers.length > 0;
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
   * CU014 - Camino alternativo 3:
   * Permite que el usuario marque una alerta generada por el modelo como falso positivo,
   * guardando el feedback explícito para usarlo en futuros reentrenamientos.
   */
  async markFalsePositive(id: string, userId: string, feedbackNote?: string) {
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

    const isOwner = alert.animal.farm.userId === userId;
    const isMember = alert.animal.farm.farmUsers.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tienes acceso a esta alerta.');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        isFalsePositive: true,
        isResolved: true,
        feedbackNote: feedbackNote?.trim() || 'Marcado como falso positivo por el productor / operario.',
        feedbackAt: new Date(),
        feedbackUserId: userId,
      },
      include: {
        animal: {
          include: {
            animalType: true,
          },
        },
        healthPredictions: true,
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
            isFalsePositive: true,
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

    const [totalMlAlerts, falsePositives, totalPredictions, eventCounts] = await Promise.all([
      this.prisma.alert.count({
        where: { animal: { farmId }, message: { contains: '[IA:' } },
      }),
      this.prisma.alert.count({
        where: { animal: { farmId }, message: { contains: '[IA:' }, isFalsePositive: true },
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

    const truePositives = Math.max(0, totalMlAlerts - falsePositives);
    const fieldPrecision = totalMlAlerts > 0 ? Number(((truePositives / totalMlAlerts) * 100).toFixed(1)) : 100;

    return {
      totalMlAlerts,
      falsePositives,
      truePositives,
      fieldPrecision,
      totalPredictions,
      eventBreakdown: eventCounts,
    };
  }

  /**
   * CU014 - Dataset de feedback para reentrenamiento futuro:
   * Exporta alertas y predicciones con feedback de operarios (falsos positivos vs alertas validadas).
   */
  async getFeedbackDataset(userId: string, farmId?: string) {
    if (farmId) {
      await this.assertFarmAccess(farmId, userId);
    } else {
      const farmIds = await this.getAccessibleFarmIds(userId);
      if (farmIds.length === 0) return [];
    }

    const farmIds = farmId ? [farmId] : await this.getAccessibleFarmIds(userId);

    return this.prisma.alert.findMany({
      where: {
        animal: { farmId: { in: farmIds } },
        message: { contains: '[IA:' },
      },
      include: {
        animal: {
          select: { id: true, tag: true, breed: true, sex: true },
        },
        healthPredictions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
}
