import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
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
    });

    return users.map(({ farms, ...u }) => ({
      ...u,
      assignedCollarsCount: farms.reduce((acc, f) => acc + f._count.collars, 0),
    }));
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

  async findAllFarms() {
    return this.prisma.farm.findMany({
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
        email: true,
        name: true,
        globalRole: true,
        updatedAt: true,
      },
    });
  }
}
