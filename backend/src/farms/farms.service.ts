import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFarmDto: CreateFarmDto, userId: string) {
    // Sin esto, el creador de una granja nueva queda sin ninguna fila en FarmUser — y el único
    // endpoint para agregarse un rol de granja (POST /farms/:farmId/users) exige ya ser ADMIN de
    // esa granja, así que nadie podría auto-otorgárselo (deadlock, salvo ser SUPER_ADMIN global).
    const dbUser = await this.prisma.user.findUnique({ where: { clerkId: userId } });
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
          userId,
        },
      });
      await tx.farmUser.create({
        data: { farmId: farm.id, userId: dbUser.id, roleId: adminRole.id },
      });
      return farm;
    });
  }

  async findAll(userId: string) {
    return this.prisma.farm.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this farm');
    }
    return farm;
  }

  async update(id: string, updateFarmDto: Partial<CreateFarmDto>, userId: string) {
    await this.findOne(id, userId); // Validates existence and ownership
    return this.prisma.farm.update({
      where: { id },
      data: updateFarmDto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // Validates existence and ownership
    return this.prisma.farm.delete({
      where: { id },
    });
  }
}
