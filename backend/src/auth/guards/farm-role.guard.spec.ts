import { ExecutionContext, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@generated/prisma';
import { FarmRoleGuard } from './farm-role.guard';
import { REQUIRE_FARM_ROLE_KEY } from '@/auth/decorators/require-farm-role.decorator';
import { RESOLVE_FARM_ID_FROM_KEY, ResolveFarmIdFromOptions } from '@/auth/decorators/resolve-farm-id-from.decorator';

function makeContext(opts: {
  clerkSub?: string;
  dbUser?: unknown;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = {
    user: opts.clerkSub ? { sub: opts.clerkSub } : undefined,
    dbUser: opts.dbUser,
    params: opts.params ?? {},
    body: opts.body ?? {},
    query: opts.query ?? {},
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('FarmRoleGuard', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    farmUser: { findUnique: jest.Mock };
    animal: { findUnique: jest.Mock };
    zone: { findUnique: jest.Mock };
    geofence: { findUnique: jest.Mock };
    gateway: { findUnique: jest.Mock };
    alert: { findUnique: jest.Mock };
  };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: FarmRoleGuard;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      farmUser: { findUnique: jest.fn() },
      animal: { findUnique: jest.fn() },
      zone: { findUnique: jest.fn() },
      geofence: { findUnique: jest.fn() },
      gateway: { findUnique: jest.fn() },
      alert: { findUnique: jest.fn() },
    };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new FarmRoleGuard(reflector as unknown as Reflector, prisma as any);
  });

  // reflector.getAllAndOverride se llama dos veces por request: REQUIRE_FARM_ROLE_KEY primero, RESOLVE_FARM_ID_FROM_KEY después.
  function mockReflector(requiredRoles: string[] | undefined, resolveFrom: ResolveFarmIdFromOptions | undefined) {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FARM_ROLE_KEY) return requiredRoles;
      if (key === RESOLVE_FARM_ID_FROM_KEY) return resolveFrom;
      return undefined;
    });
  }

  it('bypassa el chequeo de membresía para SUPER_ADMIN (AUTHZ-04)', async () => {
    mockReflector(['ADMIN'], undefined);
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.SUPER_ADMIN },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.farmUser.findUnique).not.toHaveBeenCalled();
  });

  it('permite acceso con farmId directo en params cuando el usuario es miembro y no se requiere rol específico', async () => {
    mockReflector(undefined, undefined);
    prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'VIEWER' } });
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.USER },
      params: { farmId: 'farm-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.farmUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { farmId_userId: { farmId: 'farm-1', userId: 'u1' } } })
    );
  });

  it('NO trata params.id como farmId — evita el bug de tratar un id de recurso como id de granja', async () => {
    mockReflector(undefined, undefined);
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.USER },
      params: { id: 'zone-99' }, // :id de una zona, no una granja
    });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    expect(prisma.farmUser.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza con rol insuficiente aunque sea miembro de la granja', async () => {
    mockReflector(['ADMIN'], undefined);
    prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'VIEWER' } });
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.USER },
      params: { farmId: 'farm-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si el usuario no es miembro de la granja', async () => {
    mockReflector(undefined, undefined);
    prisma.farmUser.findUnique.mockResolvedValue(null);
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.USER },
      params: { farmId: 'farm-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si la membresía existe pero fue dada de baja (isActive: false)', async () => {
    mockReflector(undefined, undefined);
    prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: false, role: { name: 'VIEWER' } });
    const { context } = makeContext({
      clerkSub: 'clerk_1',
      dbUser: { id: 'u1', globalRole: GlobalRole.USER },
      params: { farmId: 'farm-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  describe('@ResolveFarmIdFrom', () => {
    it('resuelve el farmId de un animal cuando :id no es directamente un farmId', async () => {
      mockReflector(undefined, { resource: 'animal', idKey: 'id' });
      prisma.animal.findUnique.mockResolvedValue({ farmId: 'farm-42' });
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'OPERATOR' } });
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        params: { id: 'animal-1' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(prisma.animal.findUnique).toHaveBeenCalledWith({ where: { id: 'animal-1' }, select: { farmId: true } });
      expect(prisma.farmUser.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId_userId: { farmId: 'farm-42', userId: 'u1' } } })
      );
    });

    it('resuelve el farmId de una geofence vía su zona (2 hops)', async () => {
      mockReflector(['OPERATOR', 'ADMIN'], { resource: 'geofence', idKey: 'id' });
      prisma.geofence.findUnique.mockResolvedValue({ zone: { farmId: 'farm-7' } });
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'OPERATOR' } });
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        params: { id: 'geofence-1' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(prisma.geofence.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'geofence-1' } }));
    });

    it('resuelve el farmId de un alert vía su animal (2 hops)', async () => {
      mockReflector(['OPERATOR', 'ADMIN'], { resource: 'alert', idKey: 'id' });
      prisma.alert.findUnique.mockResolvedValue({ animal: { farmId: 'farm-9' } });
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'ADMIN' } });
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        params: { id: 'alert-1' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('lee el id del recurso desde body cuando idKey no está en params (ej: animalId en el body de un medical-event)', async () => {
      mockReflector(undefined, { resource: 'animal', idKey: 'animalId' });
      prisma.animal.findUnique.mockResolvedValue({ farmId: 'farm-3' });
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'OPERATOR' } });
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        body: { animalId: 'animal-5', type: 'VACCINATION' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(prisma.animal.findUnique).toHaveBeenCalledWith({ where: { id: 'animal-5' }, select: { farmId: true } });
    });

    it('tira 404 si el recurso a resolver no existe', async () => {
      mockReflector(undefined, { resource: 'animal', idKey: 'id' });
      prisma.animal.findUnique.mockResolvedValue(null);
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        params: { id: 'animal-inexistente' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    });

    it('tira 400 si falta el id del recurso para resolver', async () => {
      mockReflector(undefined, { resource: 'animal', idKey: 'id' });
      const { context } = makeContext({
        clerkSub: 'clerk_1',
        dbUser: { id: 'u1', globalRole: GlobalRole.USER },
        params: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });
  });
});
