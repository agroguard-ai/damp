import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { isPointInPolygon } from '@/iot/utils/geofencing.utils';

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

    // Validate that zone coordinates are strictly within the farm's polygon boundary
    if (
      createZoneDto.polygonCoordinates &&
      Array.isArray(createZoneDto.polygonCoordinates) &&
      createZoneDto.polygonCoordinates.length >= 3
    ) {
      if (farm.polygonCoordinates) {
        let farmCoords: [number, number][] = [];
        try {
          farmCoords =
            typeof farm.polygonCoordinates === 'string'
              ? JSON.parse(farm.polygonCoordinates)
              : (farm.polygonCoordinates as [number, number][]);
        } catch {
          farmCoords = [];
        }

        if (Array.isArray(farmCoords) && farmCoords.length >= 3) {
          for (const pt of createZoneDto.polygonCoordinates as [number, number][]) {
            if (Array.isArray(pt) && pt.length === 2) {
              const inside = isPointInPolygon([pt[0], pt[1]], farmCoords);
              if (!inside) {
                throw new BadRequestException(
                  `La coordenada [${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}] de la zona se encuentra fuera de los límites del establecimiento. La zona debe estar completamente contenida dentro del campo.`
                );
              }
            }
          }
        }
      }
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
      include: {
        geofences: {
          select: {
            id: true,
            name: true,
            active: true,
            polygonCoordinates: true,
          },
        },
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
      include: {
        geofences: {
          select: {
            id: true,
            name: true,
            active: true,
            polygonCoordinates: true,
            animalGeofences: {
              where: { endAt: null },
            },
          },
        },
        _count: {
          select: {
            animals: true,
            geofences: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        farm: true,
        geofences: {
          where: { active: true },
          include: {
            animalGeofences: {
              where: { endAt: null },
              include: { animal: true },
            },
          },
        },
      },
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
    const existingZone = await this.findOne(id, userId); // Ownership check

    if (
      updateZoneDto.polygonCoordinates &&
      Array.isArray(updateZoneDto.polygonCoordinates) &&
      updateZoneDto.polygonCoordinates.length >= 3
    ) {
      const newZoneCoords = updateZoneDto.polygonCoordinates as [number, number][];

      // 1. Validate that the new zone coordinates remain within the parent farm perimeter
      if (existingZone.farm.polygonCoordinates) {
        let farmCoords: [number, number][] = [];
        try {
          farmCoords =
            typeof existingZone.farm.polygonCoordinates === 'string'
              ? JSON.parse(existingZone.farm.polygonCoordinates)
              : (existingZone.farm.polygonCoordinates as [number, number][]);
        } catch {
          farmCoords = [];
        }

        if (Array.isArray(farmCoords) && farmCoords.length >= 3) {
          for (const pt of newZoneCoords) {
            if (Array.isArray(pt) && pt.length === 2) {
              const inside = isPointInPolygon([pt[0], pt[1]], farmCoords);
              if (!inside) {
                throw new BadRequestException(
                  `La coordenada [${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}] de la zona se encuentra fuera de los límites del establecimiento.`
                );
              }
            }
          }
        }
      }

      // 2. Validate that all existing geofences assigned to this zone remain inside the new zone geometry
      const existingGeofences = await this.prisma.geofence.findMany({
        where: { zoneId: id, active: true },
        select: { id: true, name: true, polygonCoordinates: true },
      });

      const conflictingGeofences: string[] = [];
      for (const fence of existingGeofences) {
        if (!fence.polygonCoordinates) continue;
        let fenceCoords: [number, number][] = [];
        try {
          fenceCoords =
            typeof fence.polygonCoordinates === 'string'
              ? JSON.parse(fence.polygonCoordinates as string)
              : (fence.polygonCoordinates as [number, number][]);
        } catch {
          fenceCoords = [];
        }

        if (Array.isArray(fenceCoords) && fenceCoords.length >= 3) {
          const hasPointsOutside = fenceCoords.some((pt) => {
            if (!Array.isArray(pt) || pt.length !== 2) return false;
            return !isPointInPolygon([pt[0], pt[1]], newZoneCoords);
          });

          if (hasPointsOutside) {
            conflictingGeofences.push(`"${fence.name}"`);
          }
        }
      }

      if (conflictingGeofences.length > 0) {
        const fenceNames = conflictingGeofences.join(', ');
        throw new BadRequestException(
          `No se puede reducir la zona "${existingZone.name}": los siguientes cercos eléctricos quedarían fuera de sus nuevos límites: ${fenceNames}. Modificá o eliminá los cercos en conflicto antes de achicar la zona.`
        );
      }
    }

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
