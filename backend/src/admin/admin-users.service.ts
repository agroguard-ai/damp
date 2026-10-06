import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginationQueryDto } from '@/common/pagination/dto/pagination-query.dto';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: PaginationQueryDto) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          mustChangePassword: true,
          isActive: true,
          maxCollars: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              farmUsers: true,
            },
          },
          farms: {
            select: {
              id: true,
              _count: {
                select: {
                  collars: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count(),
    ]);

    const data = users.map(({ farms, ...u }) => ({
      ...u,
      assignedCollarsCount: farms.reduce((acc, f) => acc + f._count.collars, 0),
    }));

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        totalItems,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const tempPassword = dto.initialPassword?.trim() || `Damp${Math.random().toString(36).substring(2, 8)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: dto.name.trim(),
        passwordHash,
        globalRole: dto.globalRole ?? 'USER',
        mustChangePassword: true,
        isActive: true,
        maxCollars: dto.maxCollars ?? 0,
      },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        mustChangePassword: true,
        isActive: true,
        maxCollars: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      user: {
        ...user,
        assignedCollarsCount: 0,
        _count: { farmUsers: 0 },
      },
      temporaryPassword: tempPassword,
    };
  }

  async updateStatus(userId: string, isActive: boolean) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        isActive: true,
        maxCollars: true,
        updatedAt: true,
      },
    });
  }

  async updateMaxCollars(userId: string, maxCollars: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        farms: {
          select: {
            _count: { select: { collars: true } },
          },
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const currentAssigned = existingUser.farms.reduce((acc, f) => acc + f._count.collars, 0);
    if (maxCollars < currentAssigned) {
      throw new BadRequestException(
        `No se puede reducir el cupo a ${maxCollars} porque el usuario ya tiene ${currentAssigned} collares asignados a sus granjas.`
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { maxCollars },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        isActive: true,
        maxCollars: true,
        updatedAt: true,
      },
    });
  }

  async findAllFarms(query?: PaginationQueryDto) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const [farms, totalItems] = await Promise.all([
      this.prisma.farm.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          farmUsers: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, name: true, email: true } },
              role: true,
            },
          },
          _count: {
            select: {
              animals: true,
              zones: true,
              gateways: true,
              farmUsers: true,
            },
          },
        },
      }),
      this.prisma.farm.count(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: farms,
      meta: {
        totalItems,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
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
        email: true,
        name: true,
        globalRole: true,
        updatedAt: true,
      },
    });
  }
}
