import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthorizedRequest } from '@/auth/guards/global-roles.guard';
import { JwtPayload } from '@/auth/current-user.decorator';
import { GlobalRole } from '@generated/prisma';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!bearerToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    let tokenPayload: JwtPayload;
    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'damp-super-secret-jwt-key-change-in-production';
      tokenPayload = await this.jwtService.verifyAsync<JwtPayload>(bearerToken, {
        secret,
      });

      if (!tokenPayload || !tokenPayload.sub) {
        throw new UnauthorizedException('Invalid session token');
      }
    } catch (err) {
      this.logger.error('Token verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = tokenPayload;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: tokenPayload.sub },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User record not found in system database');
    }

    request.dbUser = dbUser;

    // Emulation support: If authenticated as SUPER_ADMIN and X-Emulate-User-Id is provided
    const emulateHeader = request.headers['x-emulate-user-id'];
    const emulateUserId =
      typeof emulateHeader === 'string'
        ? emulateHeader.trim()
        : Array.isArray(emulateHeader)
          ? emulateHeader[0]?.trim()
          : undefined;

    if (dbUser.globalRole === GlobalRole.SUPER_ADMIN && emulateUserId && emulateUserId !== dbUser.id) {
      const emulatedUser = await this.prisma.user.findUnique({
        where: { id: emulateUserId },
      });

      if (!emulatedUser) {
        throw new BadRequestException('El usuario especificado para emulación no existe');
      }

      if (emulatedUser.globalRole === GlobalRole.SUPER_ADMIN) {
        throw new BadRequestException('No se permite emular a un usuario con rol SUPER_ADMIN');
      }

      request.realSuperAdmin = dbUser;
      request.dbUser = emulatedUser;
      request.user = {
        sub: emulatedUser.id,
        email: emulatedUser.email,
        name: emulatedUser.name ?? undefined,
        globalRole: emulatedUser.globalRole,
        mustChangePassword: false,
        isEmulated: true,
        realSuperAdminId: dbUser.id,
      };
    }

    return true;
  }
}
