import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';

import { GlobalRole } from '@generated/prisma';

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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;

    if (dto.farmId) {
      const farm = await this.prisma.farm.findUnique({ where: { id: dto.farmId } });
      if (!farm) {
        throw new NotFoundException(`La granja con ID ${dto.farmId} no existe.`);
      }

      if (!isSuperAdmin && farm.userId !== userId) {
        const member = await this.prisma.farmUser.findUnique({
          where: { farmId_userId: { farmId: dto.farmId, userId } },
          include: { role: true },
        });
        if (!member || !member.isActive || !['ADMIN', 'OPERATOR'].includes(member.role.name)) {
          throw new ForbiddenException('No tienes acceso a este establecimiento.');
        }
      }

      if (dto.zoneId) {
        await this.assertZoneBelongsToFarm(dto.farmId, dto.zoneId);
      }
    } else if (dto.zoneId) {
      throw new BadRequestException('No se puede asignar una zona sin asignar primero un establecimiento.');
    }

    // apiKey se genera server-side y se devuelve UNA sola vez, en la respuesta de este create()
    // (ver el omit en findByFarm/update más abajo) — es lo que el gateway físico manda en el
    // header X-API-Key para autenticarse en POST /api/iot/telemetry (ver iot/guards/iot-device-auth.guard.ts).
    const apiKey = randomBytes(32).toString('hex');
    const gateway = await this.prisma.gateway.create({
      data: {
        name: dto.name,
        farmId: dto.farmId || null,
        zoneId: dto.zoneId || null,
        apiKey,
      },
      include: {
        farm: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });
    return this.withStatus(gateway);
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;

    if (isSuperAdmin) {
      const gateways = await this.prisma.gateway.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          farm: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
        },
        omit: { apiKey: true },
      });
      return gateways.map((g) => this.withStatus(g));
    }

    const userFarms = await this.prisma.farm.findMany({
      where: {
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
      select: { id: true },
    });
    const farmIds = userFarms.map((f) => f.id);

    const gateways = await this.prisma.gateway.findMany({
      where: { farmId: { in: farmIds } },
      include: {
        farm: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      omit: { apiKey: true },
    });
    return gateways.map((g) => this.withStatus(g));
  }

  async findByFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;

    if (!isSuperAdmin && farm.userId !== userId) {
      const member = await this.prisma.farmUser.findUnique({
        where: { farmId_userId: { farmId, userId } },
      });
      if (!member || !member.isActive) {
        throw new ForbiddenException('You do not have access to this farm');
      }
    }

    const gateways = await this.prisma.gateway.findMany({
      where: { farmId },
      include: {
        farm: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      omit: { apiKey: true },
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;

    if (isSuperAdmin) {
      return gateway;
    }

    if (!gateway.farmId || !gateway.farm) {
      throw new ForbiddenException('No tienes permisos sobre este dispositivo no asignado.');
    }

    if (gateway.farm.userId !== userId) {
      const member = await this.prisma.farmUser.findUnique({
        where: { farmId_userId: { farmId: gateway.farmId, userId } },
        include: { role: true },
      });
      if (!member || !member.isActive || !['ADMIN', 'OPERATOR'].includes(member.role.name)) {
        throw new ForbiddenException('You do not have access to this gateway');
      }
    }
    return gateway;
  }

  async update(id: string, dto: UpdateGatewayDto, userId: string) {
    const gateway = await this.getOwned(id, userId);

    const targetFarmId = dto.farmId !== undefined ? dto.farmId : gateway.farmId;

    if (dto.farmId && dto.farmId !== gateway.farmId) {
      const farm = await this.prisma.farm.findUnique({ where: { id: dto.farmId } });
      if (!farm) {
        throw new NotFoundException(`La granja con ID ${dto.farmId} no existe.`);
      }
    }

    if (dto.zoneId) {
      if (!targetFarmId) {
        throw new BadRequestException('No se puede asignar una zona sin asignar primero un establecimiento.');
      }
      await this.assertZoneBelongsToFarm(targetFarmId, dto.zoneId);
    }

    const updated = await this.prisma.gateway.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.farmId !== undefined ? { farmId: dto.farmId } : {}),
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
      },
      include: {
        farm: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
      omit: { apiKey: true },
    });
    return this.withStatus(updated);
  }

  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    return this.prisma.gateway.delete({ where: { id }, omit: { apiKey: true } });
  }

  /** Actualiza el heartbeat del gateway a partir de un paquete de telemetría retransmitido (CU013). */
  async recordHeartbeat(gatewayId?: string, rssi?: number, snr?: number) {
    if (!gatewayId) return;
    await this.prisma.gateway.updateMany({
      where: { id: gatewayId },
      data: {
        lastSeenAt: new Date(),
        ...(rssi !== undefined && { lastRssi: rssi }),
        ...(snr !== undefined && { lastSnr: snr }),
      },
    });
  }

  /**
   * Valida el X-API-Key de un gateway físico y devuelve su registro completo.
   * Si se provee gatewayId, verifica la coincidencia; si no se provee, busca el gateway por apiKey.
   * Usado exclusivamente por IotDeviceAuthGuard.
   */
  async validateApiKey(
    providedKey: string,
    gatewayId?: string
  ): Promise<{ id: string; farmId: string | null; zoneId: string | null } | null> {
    if (!providedKey || typeof providedKey !== 'string') {
      return null;
    }

    if (gatewayId) {
      const gateway = await this.prisma.gateway.findUnique({
        where: { id: gatewayId },
        select: { id: true, farmId: true, zoneId: true, apiKey: true },
      });
      if (!gateway) return null;

      const expected = Buffer.from(gateway.apiKey);
      const provided = Buffer.from(providedKey);
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        return null;
      }
      return { id: gateway.id, farmId: gateway.farmId, zoneId: gateway.zoneId };
    }

    // Buscar directamente por apiKey única
    const gateway = await this.prisma.gateway.findUnique({
      where: { apiKey: providedKey },
      select: { id: true, farmId: true, zoneId: true },
    });
    return gateway || null;
  }
}

