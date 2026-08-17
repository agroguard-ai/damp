import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';

@Injectable()
export class GeofencesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedZone(zoneId: string, userId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
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

  async create(dto: CreateGeofenceDto, userId: string) {
    await this.getOwnedZone(dto.zoneId, userId);

    if (dto.animalIds.length > 0) {
      const animals = await this.prisma.animal.findMany({
        where: { id: { in: dto.animalIds } },
      });
      if (animals.length !== dto.animalIds.length) {
        throw new NotFoundException('One or more animals were not found');
      }
      const outsideZone = animals.filter((a) => a.zoneId !== dto.zoneId);
      if (outsideZone.length > 0) {
        throw new BadRequestException(
          `Animals not assigned to this zone: ${outsideZone.map((a) => a.tag ?? a.id).join(', ')}`
        );
      }
    }

    const now = new Date();

    // An animal can only be actively fenced by one geofence at a time.
    await this.prisma.animalGeofence.updateMany({
      where: { animalId: { in: dto.animalIds }, endAt: null },
      data: { endAt: now },
    });

    return this.prisma.geofence.create({
      data: {
        zoneId: dto.zoneId,
        name: dto.name,
        polygonCoordinates: dto.polygonCoordinates as any,
        active: true,
        activatedAt: now,
        animalGeofences: {
          create: dto.animalIds.map((animalId) => ({
            animalId,
            startAt: now,
          })),
        },
      },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });
  }

  async findAllByZone(zoneId: string, userId: string) {
    await this.getOwnedZone(zoneId, userId);

    return this.prisma.geofence.findMany({
      where: { zoneId },
      orderBy: { createdAt: 'desc' },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });
  }

  async deactivate(id: string, userId: string) {
    const geofence = await this.prisma.geofence.findUnique({
      where: { id },
      include: { zone: { include: { farm: true } } },
    });
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }
    if (geofence.zone.farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this geofence');
    }

    const now = new Date();

    await this.prisma.animalGeofence.updateMany({
      where: { geofenceId: id, endAt: null },
      data: { endAt: now },
    });

    return this.prisma.geofence.update({
      where: { id },
      data: { active: false, deactivatedAt: now },
    });
  }
}
