import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole } from '@generated/prisma';
import { CreateFarmDto } from './dto/create-farm.dto';

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

    // Regular users see farms where they are owner or active member
    return this.prisma.farm.findMany({
      where: {
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        farmUsers: {
          where: { userId, isActive: true },
          include: { role: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: {
        alertSettings: true,
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

    return this.prisma.farm.update({
      where: { id },
      data: updateFarmDto,
    });
  }

  async remove(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const farm = await this.prisma.farm.findUnique({ where: { id } });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    if (user?.globalRole !== GlobalRole.SUPER_ADMIN && farm.userId !== userId) {
      throw new ForbiddenException('Solo el propietario o un Superadmin puede eliminar la granja');
    }

    return this.prisma.farm.delete({
      where: { id },
    });
  }
}
