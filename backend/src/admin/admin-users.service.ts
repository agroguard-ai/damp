import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        globalRole: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            farmUsers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateGlobalRole(userId: string, dto: UpdateGlobalRoleDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        globalRole: dto.globalRole,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        globalRole: true,
        updatedAt: true,
      },
    });
  }
}
