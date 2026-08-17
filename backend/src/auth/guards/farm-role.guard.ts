import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole, FarmUser, Role } from '@generated/prisma';
import { REQUIRE_FARM_ROLE_KEY } from '@/auth/decorators/require-farm-role.decorator';
import { AuthorizedRequest } from '@/auth/guards/global-roles.guard';

export interface FarmAuthorizedRequest extends AuthorizedRequest {
  farmUser?: FarmUser & { role: Role };
}

@Injectable()
export class FarmRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRE_FARM_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<FarmAuthorizedRequest>();
    const clerkUser = request.user;

    if (!clerkUser?.sub) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    if (!request.dbUser) {
      const dbUser = await this.prisma.user.findUnique({
        where: { clerkId: clerkUser.sub },
      });

      if (!dbUser) {
        throw new ForbiddenException('User record not found in system database');
      }

      request.dbUser = dbUser;
    }

    // AUTHZ-04: SuperAdmin global role bypasses farm-level membership checks automatically
    if (request.dbUser.globalRole === GlobalRole.SUPER_ADMIN) {
      return true;
    }

    const params = request.params as Record<string, unknown> | undefined;
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown> | undefined;

    const rawFarmId = params?.farmId ?? params?.id ?? body?.farmId ?? query?.farmId;
    const farmId = typeof rawFarmId === 'string' ? rawFarmId : undefined;

    if (!farmId || typeof farmId !== 'string') {
      throw new BadRequestException('Farm identifier (farmId) missing from request parameters');
    }

    const farmUser = await this.prisma.farmUser.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId: request.dbUser.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!farmUser) {
      throw new ForbiddenException('User is not a registered member of this farm');
    }

    request.farmUser = farmUser;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (requiredRoles.includes(farmUser.role.name)) {
      return true;
    }

    throw new ForbiddenException(`Insufficient farm role permissions. Required: ${requiredRoles.join(', ')}`);
  }
}
