import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole, User } from '@generated/prisma';
import { GLOBAL_ROLES_KEY } from '@/auth/decorators/global-roles.decorator';
import { AuthenticatedRequest } from '@/auth/current-user.decorator';

export interface AuthorizedRequest extends AuthenticatedRequest {
  dbUser?: User;
}

@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>(GLOBAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
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

    if (requiredRoles.includes(request.dbUser.globalRole)) {
      return true;
    }

    throw new ForbiddenException(`Access denied: required global role standard not met`);
  }
}
