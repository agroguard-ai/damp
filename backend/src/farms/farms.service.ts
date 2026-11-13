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

    // Solo crean campos el superadmin y los administradores de campos (FARM_ADMIN). Un USER es
    // siempre personal (operador/lector) de un FARM_ADMIN: no puede crearse un campo propio para
    // escalar a ADMIN, ni aunque lo hayan dado de baja de todos sus campos.
    if (dbUser.globalRole !== GlobalRole.SUPER_ADMIN && dbUser.globalRole !== GlobalRole.FARM_ADMIN) {
      throw new ForbiddenException('Solo los administradores de campos pueden registrar campos.');
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

  async findAll(userId: string, query?: { includeInactive?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Superadmin without emulation has no tenant farm context
    // (global farms oversight is provided via /admin/farms)
    if (user?.globalRole === GlobalRole.SUPER_ADMIN) {
      return [];
    }

    const includeInactive = query?.includeInactive === true;

    // Regular users see farms where they are owner or member
    return this.prisma.farm.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        AND: [
          {
            OR: [{ userId }, { farmUsers: { some: { userId, ...(includeInactive ? {} : { isActive: true }) } } }],
          },
          {
            OR: [{ user: null }, { user: { isActive: true } }],
          },
        ],
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        farmUsers: {
          where: { userId },
          include: { role: true },
        },
        _count: {
          select: {
            animals: { where: { isArchived: false } },
            geofences: true,
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

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Superadmin bypass
    if (user?.globalRole === GlobalRole.SUPER_ADMIN) {
      return farm;
    }

    // Suspension check: if the farm has an owner and that owner is inactive, block access
    if (farm.user && !farm.user.isActive) {
      throw new ForbiddenException('El servicio para este campo se encuentra suspendido. Comuníquese con soporte.');
    }

    // Owner check
    if (farm.userId === userId) {
      return farm;
    }

    // Membership check (permit viewing historical records if previously assigned)
    const member = await this.prisma.farmUser.findFirst({
      where: {
        farmId: id,
        userId,
        ...(farm.isActive ? { isActive: true } : {}),
      },
    });

    if (!member) {
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

    if (!farm.isActive) {
      throw new BadRequestException('El campo se encuentra archivado/inactivo y no puede ser modificado.');
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
        throw new ForbiddenException('Solo el administrador del campo puede modificarlo');
      }
    }

    if (
      updateFarmDto.polygonCoordinates &&
      Array.isArray(updateFarmDto.polygonCoordinates) &&
      updateFarmDto.polygonCoordinates.length >= 3
    ) {
      const newFarmCoords = updateFarmDto.polygonCoordinates as [number, number][];

      // Validate that all active geofences of this farm remain inside the new farm geometry
      const existingGeofences = await this.prisma.geofence.findMany({
        where: { farmId: id, active: true },
        select: { id: true, name: true, polygonCoordinates: true },
      });

      const conflictingGeofences: string[] = [];
      for (const geofence of existingGeofences) {
        if (!geofence.polygonCoordinates) continue;
        let geofenceCoords: [number, number][] = [];
        try {
          geofenceCoords =
            typeof geofence.polygonCoordinates === 'string'
              ? JSON.parse(geofence.polygonCoordinates)
              : (geofence.polygonCoordinates as [number, number][]);
        } catch {
          geofenceCoords = [];
        }

        if (Array.isArray(geofenceCoords) && geofenceCoords.length >= 3) {
          const hasPointsOutside = geofenceCoords.some((pt) => {
            if (!Array.isArray(pt) || pt.length !== 2) return false;
            return !isPointInPolygon([pt[0], pt[1]], newFarmCoords);
          });

          if (hasPointsOutside) {
            conflictingGeofences.push(`"${geofence.name}"`);
          }
        }
      }

      if (conflictingGeofences.length > 0) {
        const geofenceNames = conflictingGeofences.join(', ');
        throw new BadRequestException(
          `No se puede reducir el perímetro del campo: los siguientes cercos quedarían fuera de sus nuevos límites: ${geofenceNames}. Modificá o desactivá los cercos en conflicto antes de achicar el campo.`
        );
      }
    }

    return this.prisma.farm.update({
      where: { id },
      data: updateFarmDto,
    });
  }

  async remove(id: string, userId: string, permanent: boolean = false) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const farm = await this.prisma.farm.findUnique({ where: { id } });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    if (user?.globalRole !== GlobalRole.SUPER_ADMIN && farm.userId !== userId) {
      const member = await this.prisma.farmUser.findFirst({
        where: { farmId: id, userId, role: { name: 'ADMIN' } },
      });
      if (!member) {
        throw new ForbiddenException('Solo el propietario o un administrador del campo puede dar de baja el campo');
      }
    }

    // Eliminación definitiva / Purga física de registros (solo sobre un campo ya archivado)
    if (permanent) {
      if (farm.isActive) {
        throw new BadRequestException(
          'Primero debés dar de baja lógica el campo. La eliminación definitiva solo está disponible para campos archivados.'
        );
      }

      return this.prisma.$transaction(async (tx) => {
        const farmAnimals = await tx.animal.findMany({
          where: { farmId: id },
          select: { id: true },
        });
        const animalIds = farmAnimals.map((a) => a.id);

        if (animalIds.length > 0) {
          await tx.animalCollar.deleteMany({ where: { animalId: { in: animalIds } } });
          await tx.animalGeofence.deleteMany({ where: { animalId: { in: animalIds } } });
          await tx.medicalEvent.deleteMany({ where: { animalId: { in: animalIds } } });
          await tx.alert.deleteMany({ where: { animalId: { in: animalIds } } });
          await tx.healthPrediction.deleteMany({ where: { animalId: { in: animalIds } } });
          await tx.animal.deleteMany({ where: { farmId: id } });
        }

        // Las asignaciones históricas animal-cerco referencian las geocercas del campo:
        // en la purga definitiva se eliminan antes de borrar los cercos.
        await tx.animalGeofence.deleteMany({ where: { geofence: { farmId: id } } });
        await tx.collar.updateMany({ where: { farmId: id }, data: { farmId: null } });
        await tx.gateway.updateMany({ where: { farmId: id }, data: { farmId: null } });
        await tx.rotationPlan.deleteMany({ where: { farmId: id } });
        await tx.geofence.deleteMany({ where: { farmId: id } });
        await tx.alertSettings.deleteMany({ where: { farmId: id } });
        await tx.farmUser.deleteMany({ where: { farmId: id } });

        return tx.farm.delete({ where: { id } });
      });
    }

    // Baja lógica / Archivado (no destructivo)
    if (!farm.isActive) {
      throw new BadRequestException('El campo ya se encuentra dado de baja / archivado.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cerrar únicamente asignaciones a cercos virtuales del campo archivado
      const farmAnimals = await tx.animal.findMany({
        where: { farmId: id },
        select: { id: true },
      });
      const animalIds = farmAnimals.map((a) => a.id);

      if (animalIds.length > 0) {
        await tx.animalGeofence.updateMany({
          where: { animalId: { in: animalIds }, endAt: null },
          data: { endAt: new Date() },
        });
        // Los animales NO se archivan: conservan estado, historial y collar, pero quedan
        // libres de campo (farmId = null) para poder reasignarlos a otro campo.
        await tx.animal.updateMany({
          where: { farmId: id },
          data: { farmId: null },
        });
      }

      // 2. Desactivar (no borrar) las geocercas: conservan el histórico de asignaciones
      // animal-cerco y evitan romper la clave foránea de animal_geofences.
      const now = new Date();
      await tx.geofence.updateMany({
        where: { farmId: id },
        data: { active: false, deactivatedAt: now },
      });

      // 3. Cancelar planes de rotación activos y desactivar el personal del campo
      await tx.rotationPlan.updateMany({
        where: { farmId: id, status: 'ACTIVE' },
        data: { status: 'CANCELLED', completedAt: now },
      });
      await tx.farmUser.updateMany({
        where: { farmId: id },
        data: { isActive: false, removedAt: now },
      });

      // 4. Baja lógica / Archivado del campo
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
