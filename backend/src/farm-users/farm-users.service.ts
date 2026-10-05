import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@generated/prisma';
import { AssignFarmUserDto } from './dto/assign-farm-user.dto';
import { UpdateFarmUserDto } from './dto/update-farm-user.dto';

@Injectable()
export class FarmUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllInFarm(farmId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${farmId}" not found`);
    }

    return this.prisma.farmUser.findMany({
      where: { farmId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            globalRole: true,
            createdAt: true,
          },
        },
        role: true,
      },
    });
  }

  async assignSubUser(farmId: string, dto: AssignFarmUserDto) {
    if (!dto.userId && !dto.email) {
      throw new BadRequestException('Either userId or email must be provided to assign a farm sub-user');
    }

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${farmId}" not found`);
    }

    let user: User | null = null;
    if (dto.userId) {
      user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    } else if (dto.email) {
      user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    }

    if (!user) {
      throw new NotFoundException(`Target user not found in system database`);
    }

    // Regla de negocio: Un usuario solo puede pertenecer a 1 granja a la vez
    const existingMembership = await this.prisma.farmUser.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.farmId === farmId) {
        throw new BadRequestException('El usuario ya se encuentra asignado a esta granja.');
      } else {
        const farmName = existingMembership.farm?.name || 'otra granja';
        throw new BadRequestException(
          `El usuario "${user.email}" ya se encuentra asignado al establecimiento "${farmName}". Un usuario solo puede pertenecer a una granja a la vez.`
        );
      }
    }

    const roleNameUpper = dto.roleName.toUpperCase();

    // Regla de negocio: cada granja posee un único rol administrador
    if (roleNameUpper === 'ADMIN') {
      const existingAdmin = await this.prisma.farmUser.findFirst({
        where: {
          farmId,
          isActive: true,
          role: { name: 'ADMIN' },
          userId: { not: user.id },
        },
      });

      if (existingAdmin) {
        throw new BadRequestException(
          'Esta granja ya posee un rol administrador asignado. Solo puede haber un único administrador por granja.'
        );
      }
    }

    // Dynamic role lookup / creation if standard seed hasn't run yet
    let role = await this.prisma.role.findUnique({
      where: { name: roleNameUpper },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: roleNameUpper,
        },
      });
    }

    return this.prisma.farmUser.upsert({
      where: {
        farmId_userId: {
          farmId,
          userId: user.id,
        },
      },
      create: {
        farmId,
        userId: user.id,
        roleId: role.id,
      },
      update: {
        roleId: role.id,
        isActive: true,
        removedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            globalRole: true,
          },
        },
        role: true,
      },
    });
  }

  async updateSubUserRole(farmId: string, userId: string, dto: UpdateFarmUserDto) {
    const existing = await this.prisma.farmUser.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId,
        },
      },
    });

    if (!existing || !existing.isActive) {
      throw new NotFoundException(`Sub-user membership not found for farm "${farmId}" and user "${userId}"`);
    }

    const roleNameUpper = dto.roleName.toUpperCase();

    // Regla de negocio: cada granja posee un único rol administrador
    if (roleNameUpper === 'ADMIN') {
      const existingAdmin = await this.prisma.farmUser.findFirst({
        where: {
          farmId,
          isActive: true,
          role: { name: 'ADMIN' },
          userId: { not: userId },
        },
      });

      if (existingAdmin) {
        throw new BadRequestException(
          'Esta granja ya posee un rol administrador asignado. Solo puede haber un único administrador por granja.'
        );
      }
    }

    let role = await this.prisma.role.findUnique({
      where: { name: roleNameUpper },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: roleNameUpper,
        },
      });
    }

    return this.prisma.farmUser.update({
      where: {
        farmId_userId: {
          farmId,
          userId,
        },
      },
      data: {
        roleId: role.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            globalRole: true,
          },
        },
        role: true,
      },
    });
  }

  /**
   * Baja lógica (CU002/CU018): marca la membresía inactiva en vez de borrar la fila.
   */
  async removeSubUser(farmId: string, userId: string) {
    const existing = await this.prisma.farmUser.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId,
        },
      },
    });

    if (!existing || !existing.isActive) {
      throw new NotFoundException(`Sub-user membership not found for farm "${farmId}" and user "${userId}"`);
    }

    return this.prisma.farmUser.update({
      where: {
        farmId_userId: {
          farmId,
          userId,
        },
      },
      data: {
        isActive: false,
        removedAt: new Date(),
      },
    });
  }
}
