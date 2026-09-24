import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertType } from '@generated/prisma';

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
  constructor(private readonly prisma: PrismaService) {}

  private async getAccessibleFarmIds(userId: string): Promise<string[]> {
    const userFarms = await this.prisma.farm.findMany({
      where: {
        OR: [
          { userId },
          { farmUsers: { some: { userId, isActive: true } } },
        ],
      },
      select: { id: true },
    });
    return userFarms.map((f) => f.id);
  }

  private async assertFarmAccess(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findFirst({
      where: {
        id: farmId,
        OR: [
          { userId },
          { farmUsers: { some: { userId, isActive: true } } },
        ],
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
    const fieldPrecision =
      totalMlAlerts > 0 ? Number(((truePositives / totalMlAlerts) * 100).toFixed(1)) : 100;

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
}
