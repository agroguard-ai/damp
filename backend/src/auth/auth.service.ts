import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas. Verifique su email y contraseña.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Su cuenta se encuentra suspendida o inhabilitada. Comuníquese con soporte.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
      name: user.name ?? undefined,
      mustChangePassword: user.mustChangePassword,
    };

    const secret = this.configService.get<string>('JWT_SECRET') || 'damp-super-secret-jwt-key-change-in-production';
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresIn as any,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        mustChangePassword: user.mustChangePassword,
        isActive: user.isActive,
        maxCollars: user.maxCollars,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña no puede ser igual a la actual');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    const payload: JwtPayload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      globalRole: updatedUser.globalRole,
      name: updatedUser.name ?? undefined,
      mustChangePassword: false,
    };

    const secret = this.configService.get<string>('JWT_SECRET') || 'damp-super-secret-jwt-key-change-in-production';
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresIn as any,
    });

    return {
      accessToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        globalRole: updatedUser.globalRole,
        mustChangePassword: false,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        mustChangePassword: true,
        isActive: true,
        maxCollars: true,
        createdAt: true,
        farmUsers: {
          where: { isActive: true },
          include: {
            farm: {
              select: {
                id: true,
                name: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }
}
