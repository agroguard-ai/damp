import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        mustChangePassword: true,
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

  async createUser(dto: CreateUserDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(`El correo electrónico "${normalizedEmail}" ya está registrado`);
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      user,
      temporaryPassword: tempPassword,
    };
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
