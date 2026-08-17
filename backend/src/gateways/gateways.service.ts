import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';

// El firmware v3 envía telemetría cada 5 minutos; se tolera hasta 3 ciclos perdidos antes de marcar offline.
const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

@Injectable()
export class GatewaysService {
  constructor(private readonly prisma: PrismaService) {}

  private withStatus<T extends { lastSeenAt: Date | null }>(gateway: T) {
    let status: 'NO_DATA' | 'ONLINE' | 'OFFLINE' = 'NO_DATA';
    if (gateway.lastSeenAt) {
      const elapsed = Date.now() - gateway.lastSeenAt.getTime();
      status = elapsed <= ONLINE_THRESHOLD_MS ? 'ONLINE' : 'OFFLINE';
    }
    return { ...gateway, status };
  }

  private async assertZoneBelongsToFarm(farmId: string, zoneId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`La zona con ID ${zoneId} no existe.`);
    }
    if (zone.farmId !== farmId) {
      throw new BadRequestException('La zona indicada no pertenece a la granja indicada.');
    }
  }

  async create(dto: CreateGatewayDto, userId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: dto.farmId } });
    if (!farm) {
      throw new NotFoundException(`La granja con ID ${dto.farmId} no existe.`);
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este establecimiento.');
    }
    await this.assertZoneBelongsToFarm(dto.farmId, dto.zoneId);

    const gateway = await this.prisma.gateway.create({
      data: { name: dto.name, farmId: dto.farmId, zoneId: dto.zoneId },
    });
    return this.withStatus(gateway);
  }

  async findByFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this farm');
    }

    const gateways = await this.prisma.gateway.findMany({
      where: { farmId },
      include: { zone: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return gateways.map((g) => this.withStatus(g));
  }

  private async getOwned(id: string, userId: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id },
      include: { farm: true },
    });
    if (!gateway) {
      throw new NotFoundException(`Gateway with id ${id} not found`);
    }
    if (gateway.farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this gateway');
    }
    return gateway;
  }

  async update(id: string, dto: UpdateGatewayDto, userId: string) {
    const gateway = await this.getOwned(id, userId);
    if (dto.zoneId) {
      await this.assertZoneBelongsToFarm(gateway.farmId, dto.zoneId);
    }
    const updated = await this.prisma.gateway.update({
      where: { id },
      data: { name: dto.name, zoneId: dto.zoneId },
    });
    return this.withStatus(updated);
  }

  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    return this.prisma.gateway.delete({ where: { id } });
  }

  /** Actualiza el heartbeat del gateway a partir de un paquete de telemetría retransmitido (CU013). */
  async recordHeartbeat(gatewayId: string, rssi?: number, snr?: number) {
    await this.prisma.gateway.updateMany({
      where: { id: gatewayId },
      data: {
        lastSeenAt: new Date(),
        ...(rssi !== undefined && { lastRssi: rssi }),
        ...(snr !== undefined && { lastSnr: snr }),
      },
    });
  }
}
