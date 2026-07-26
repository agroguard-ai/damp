import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnresolvedAlerts(userId: string) {
    const userFarms = await this.prisma.farm.findMany({
      where: { userId },
      select: { id: true },
    });
    const farmIds = userFarms.map((f) => f.id);

    return this.prisma.alert.findMany({
      where: {
        isResolved: false,
        animal: {
          farmId: { in: farmIds },
        },
      },
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
