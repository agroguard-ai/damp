import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole, FarmUser, Role } from '@generated/prisma';
import { REQUIRE_FARM_ROLE_KEY } from '@/auth/decorators/require-farm-role.decorator';
import {
  RESOLVE_FARM_ID_FROM_KEY,
  ResolveFarmIdFromOptions,
  FarmIdResource,
} from '@/auth/decorators/resolve-farm-id-from.decorator';
import { AuthorizedRequest } from '@/auth/guards/global-roles.guard';
import { PrismaClient } from '@generated/prisma';

export interface FarmAuthorizedRequest extends AuthorizedRequest {
  farmUser?: FarmUser & { role: Role };
}

type FarmIdResolver = (prisma: PrismaClient, resourceId: string) => Promise<string | null>;

/** Cómo sacar el farmId de cada tipo de recurso cuando no viaja directo en la request. */
const FARM_ID_RESOLVERS: Record<FarmIdResource, FarmIdResolver> = {
  animal: async (prisma, id) =>
    (await prisma.animal.findUnique({ where: { id }, select: { farmId: true } }))?.farmId ?? null,
  zone: async (prisma, id) =>
    (await prisma.zone.findUnique({ where: { id }, select: { farmId: true } }))?.farmId ?? null,
  gateway: async (prisma, id) =>
    (await prisma.gateway.findUnique({ where: { id }, select: { farmId: true } }))?.farmId ?? null,
  geofence: async (prisma, id) => {
    const geofence = await prisma.geofence.findUnique({
      where: { id },
      select: { zone: { select: { farmId: true } } },
    });
    return geofence?.zone.farmId ?? null;
  },
  alert: async (prisma, id) => {
    const alert = await prisma.alert.findUnique({ where: { id }, select: { animal: { select: { farmId: true } } } });
    return alert?.animal.farmId ?? null;
  },
};

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
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    if (!request.dbUser) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
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

    // OJO: no cae a params.id como fallback genérico — en la mayoría de las rutas :id es
    // el id del recurso (zona, animal, gateway...), no de la granja, y tratarlo como farmId
    // "encontraría" un farmId incorrecto sin nunca pasar por el resolver de @ResolveFarmIdFrom.
    const rawFarmId = params?.farmId ?? body?.farmId ?? query?.farmId;
    let farmId = typeof rawFarmId === 'string' ? rawFarmId : undefined;

    if (!farmId) {
      const resolveFrom = this.reflector.getAllAndOverride<ResolveFarmIdFromOptions>(RESOLVE_FARM_ID_FROM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (resolveFrom) {
        const idKey = resolveFrom.idKey ?? 'id';
        const rawResourceId = params?.[idKey] ?? body?.[idKey] ?? query?.[idKey];
        const resourceId = typeof rawResourceId === 'string' ? rawResourceId : undefined;

        if (!resourceId) {
          throw new BadRequestException(`Missing "${idKey}" to resolve the farm for this request`);
        }

        farmId = (await FARM_ID_RESOLVERS[resolveFrom.resource](this.prisma, resourceId)) ?? undefined;

        if (!farmId) {
          throw new NotFoundException(`${resolveFrom.resource} "${resourceId}" not found`);
        }
      }
    }

    if (!farmId) {
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

    // isActive: false = baja lógica (CU002/CU018) — la fila sigue existiendo para conservar
    // el historial, pero no debe seguir dando acceso.
    if (!farmUser || !farmUser.isActive) {
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
