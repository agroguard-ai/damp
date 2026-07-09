import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createZoneDto: CreateZoneDto, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: createZoneDto.farmId },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('You do not have permission to add zones to this farm');
    }

    return this.prisma.zone.create({
      data: {
        name: createZoneDto.name,
        pastureType: createZoneDto.pastureType,
        farmId: createZoneDto.farmId,
        ...(createZoneDto.polygonCoordinates && {
          polygonCoordinates: createZoneDto.polygonCoordinates as any,
        }),
      },
    });
  }

  async findByFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this farm');
    }

    return this.prisma.zone.findMany({
      where: { farmId },
    });
  }

  async findOne(id: string, userId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: { farm: true },
    });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    if (zone.farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this zone');
    }
    return zone;
  }

  async update(id: string, updateZoneDto: Partial<CreateZoneDto>, userId: string) {
    await this.findOne(id, userId); // Ownership check
    return this.prisma.zone.update({
      where: { id },
      data: {
        name: updateZoneDto.name,
        pastureType: updateZoneDto.pastureType,
        ...(updateZoneDto.polygonCoordinates && {
          polygonCoordinates: updateZoneDto.polygonCoordinates as any,
        }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // Ownership check
    return this.prisma.zone.delete({
      where: { id },
    });
  }
}
