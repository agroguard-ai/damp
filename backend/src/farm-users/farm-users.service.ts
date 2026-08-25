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
            clerkId: true,
            email: true,
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

    // Dynamic role lookup / creation if standard seed hasn't run yet
    let role = await this.prisma.role.findUnique({
      where: { name: dto.roleName.toUpperCase() },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: dto.roleName.toUpperCase(),
        },
      });
    }

    // Si el usuario ya había sido removido de la granja (soft-delete), reasignarlo reactiva
    // la membresía en vez de dejarla inactiva con un rol nuevo sin efecto.
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
            clerkId: true,
            email: true,
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

    let role = await this.prisma.role.findUnique({
      where: { name: dto.roleName.toUpperCase() },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: dto.roleName.toUpperCase(),
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
            clerkId: true,
            email: true,
            globalRole: true,
          },
        },
        role: true,
      },
    });
  }

  /**
   * Baja lógica (CU002/CU018): marca la membresía inactiva en vez de borrar la fila, para
   * conservar el rastro de quién tuvo acceso a la granja y cuándo se lo revocaron.
   * assignSubUser() reactiva (isActive: true, removedAt: null) si se vuelve a invitar al mismo
   * usuario más adelante.
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
