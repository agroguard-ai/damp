import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertType } from '@generated/prisma';

export interface AlertsQuery {
  farmId?: string;
  animalId?: string;
  type?: AlertType;
  resolved?: boolean;
  from?: string;
  to?: string;
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: AlertsQuery) {
    const userFarms = await this.prisma.farm.findMany({
      where: { userId },
      select: { id: true },
    });
    const farmIds = userFarms.map((f) => f.id);

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
            farm: true,
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alerta con ID ${id} no encontrada.`);
    }

    if (alert.animal.farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta alerta.');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        isResolved: true,
      },
    });
  }
}
