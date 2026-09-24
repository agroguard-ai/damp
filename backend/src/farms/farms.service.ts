import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole } from '@generated/prisma';
import { CreateFarmDto } from './dto/create-farm.dto';
import { isPointInPolygon } from '@/iot/utils/geofencing.utils';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFarmDto: CreateFarmDto, userId: string) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      throw new NotFoundException('User record not found in system database');
    }

    let adminRole = await this.prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      adminRole = await this.prisma.role.create({ data: { name: 'ADMIN' } });
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          ...createFarmDto,
          userId: dbUser.id,
        },
      });
      await tx.farmUser.create({
        data: { farmId: farm.id, userId: dbUser.id, roleId: adminRole.id },
      });
      return farm;
    });
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Superadmin without emulation has no tenant farm context
    // (global farms oversight is provided via /admin/farms)
    if (user?.globalRole === GlobalRole.SUPER_ADMIN) {
      return [];
    }

    // Regular users see farms where they are owner or active member, and farm is active
    return this.prisma.farm.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
          },
          {
            OR: [{ user: null }, { user: { isActive: true } }],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        farmUsers: {
          where: { userId, isActive: true },
          include: { role: true },
        },
        _count: {
          select: {
            animals: { where: { isArchived: false } },
            zones: true,
            farmUsers: { where: { isActive: true } },
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: {
        alertSettings: true,
        user: { select: { id: true, isActive: true } },
      },
    });

    if (!farm || !farm.isActive) {
      throw new NotFoundException('Farm not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Superadmin bypass
    if (user?.globalRole === GlobalRole.SUPER_ADMIN) {
      return farm;
    }

    // Suspension check: if the farm has an owner and that owner is inactive, block access
    if (farm.user && !farm.user.isActive) {
      throw new ForbiddenException('El servicio para este establecimiento se encuentra suspendido. Comuníquese con soporte.');
    }

    // Owner check
    if (farm.userId === userId) {
      return farm;
    }

    // Membership check
    const member = await this.prisma.farmUser.findUnique({
      where: {
        farmId_userId: { farmId: id, userId },
      },
    });

    if (!member || !member.isActive) {
      throw new ForbiddenException('You do not have access to this farm');
    }

    return farm;
  }

  async update(id: string, updateFarmDto: Partial<CreateFarmDto>, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const farm = await this.prisma.farm.findUnique({ where: { id } });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    if (user?.globalRole !== GlobalRole.SUPER_ADMIN && farm.userId !== userId) {
      const adminMember = await this.prisma.farmUser.findFirst({
        where: {
          farmId: id,
          userId,
          isActive: true,
          role: { name: 'ADMIN' },
        },
      });

      if (!adminMember) {
        throw new ForbiddenException('Solo el administrador de la granja puede modificarla');
      }
    }

    if (
      updateFarmDto.polygonCoordinates &&
      Array.isArray(updateFarmDto.polygonCoordinates) &&
      updateFarmDto.polygonCoordinates.length >= 3
    ) {
      const newFarmCoords = updateFarmDto.polygonCoordinates as [number, number][];

      // Validate that all existing zones assigned to this farm remain inside the new farm geometry
      const existingZones = await this.prisma.zone.findMany({
        where: { farmId: id },
        select: { id: true, name: true, polygonCoordinates: true },
      });

      const conflictingZones: string[] = [];
      for (const zone of existingZones) {
        if (!zone.polygonCoordinates) continue;
        let zoneCoords: [number, number][] = [];
        try {
          zoneCoords =
            typeof zone.polygonCoordinates === 'string'
              ? JSON.parse(zone.polygonCoordinates as string)
              : (zone.polygonCoordinates as [number, number][]);
        } catch {
          zoneCoords = [];
        }

        if (Array.isArray(zoneCoords) && zoneCoords.length >= 3) {
          const hasPointsOutside = zoneCoords.some((pt) => {
            if (!Array.isArray(pt) || pt.length !== 2) return false;
            return !isPointInPolygon([pt[0], pt[1]], newFarmCoords);
          });

          if (hasPointsOutside) {
            conflictingZones.push(`"${zone.name}"`);
          }
        }
      }

      if (conflictingZones.length > 0) {
        const zoneNames = conflictingZones.join(', ');
        throw new BadRequestException(
          `No se puede reducir el perímetro del campo: las siguientes zonas quedarían fuera de sus nuevos límites: ${zoneNames}. Modificá o eliminá las zonas en conflicto antes de achicar el establecimiento.`
        );
      }
    }

    return this.prisma.farm.update({
      where: { id },
      data: updateFarmDto,
    });
  }

  async remove(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const farm = await this.prisma.farm.findUnique({ where: { id } });

    if (!farm || !farm.isActive) {
      throw new NotFoundException('Farm not found');
    }

    if (user?.globalRole !== GlobalRole.SUPER_ADMIN && farm.userId !== userId) {
      const member = await this.prisma.farmUser.findFirst({
        where: { farmId: id, userId, isActive: true, role: { name: 'ADMIN' } },
      });
      if (!member) {
        throw new ForbiddenException('Solo el propietario o un administrador de la granja puede dar de baja el establecimiento');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener animales de la granja para cerrar asignaciones de collares y geocercas
      const farmAnimals = await tx.animal.findMany({
        where: { farmId: id },
        select: { id: true },
      });
      const animalIds = farmAnimals.map((a) => a.id);

      if (animalIds.length > 0) {
        await tx.animalCollar.updateMany({
          where: { animalId: { in: animalIds }, endAt: null },
          data: { endAt: new Date() },
        });
        await tx.animalGeofence.updateMany({
          where: { animalId: { in: animalIds }, endAt: null },
          data: { endAt: new Date() },
        });
        await tx.animal.updateMany({
          where: { farmId: id },
          data: { isArchived: true, zoneId: null },
        });
      }

      // 2. Liberar collares asignados al campo para que vuelvan a la flota disponible
      await tx.collar.updateMany({
        where: { farmId: id },
        data: { farmId: null },
      });

      // 3. Eliminar geocercas y zonas de la granja
      await tx.geofence.deleteMany({
        where: { zone: { farmId: id } },
      });
      await tx.zone.deleteMany({
        where: { farmId: id },
      });

      // 4. Inactivar miembros de la granja
      await tx.farmUser.updateMany({
        where: { farmId: id },
        data: { isActive: false, removedAt: new Date() },
      });

      // 5. Baja lógica del establecimiento
      return tx.farm.update({
        where: { id },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });
    });
  }
}
