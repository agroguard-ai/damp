/* eslint-disable */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

function makeContext(headers: Record<string, string>): { context: ExecutionContext; request: any } {
  const request: any = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('test-secret') };
    prisma = { user: { findUnique: jest.fn() } };

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService
    );
  });

  it('lanza UnauthorizedException si falta el header Authorization', async () => {
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el header no empieza con Bearer', async () => {
    const { context } = makeContext({ authorization: 'Basic 1234' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el token es inválido', async () => {
    const { context } = makeContext({ authorization: 'Bearer invalid-token' });
    jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el usuario no existe en la base de datos', async () => {
    const { context } = makeContext({ authorization: 'Bearer valid-token' });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'test@example.com' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('permite el acceso y adjunta user y dbUser a la request', async () => {
    const { context, request } = makeContext({ authorization: 'Bearer valid-token' });
    const payload = { sub: 'u1', email: 'test@example.com', globalRole: 'USER' };
    const dbUser = { id: 'u1', email: 'test@example.com', globalRole: 'USER' };

    jwtService.verifyAsync.mockResolvedValue(payload);
    prisma.user.findUnique.mockResolvedValue(dbUser);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(payload);
    expect(request.dbUser).toEqual(dbUser);
  });

  it('permite a SUPER_ADMIN emular a otro usuario cuando viaja x-emulate-user-id', async () => {
    const { context, request } = makeContext({
      authorization: 'Bearer valid-token',
      'x-emulate-user-id': 'u2-customer',
    });
    const superAdminPayload = { sub: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };
    const superAdminDbUser = { id: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };
    const emulatedCustomerDbUser = {
      id: 'u2-customer',
      email: 'customer@campo.com',
      name: 'Cliente Campo',
      globalRole: 'USER',
    };

    jwtService.verifyAsync.mockResolvedValue(superAdminPayload);
    prisma.user.findUnique
      .mockResolvedValueOnce(superAdminDbUser)
      .mockResolvedValueOnce(emulatedCustomerDbUser);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.realSuperAdmin).toEqual(superAdminDbUser);
    expect(request.dbUser).toEqual(emulatedCustomerDbUser);
    expect(request.user.sub).toBe('u2-customer');
    expect(request.user.isEmulated).toBe(true);
    expect(request.user.realSuperAdminId).toBe('u1-admin');
  });

  it('lanza BadRequestException si SUPER_ADMIN intenta emular a un usuario inexistente', async () => {
    const { context } = makeContext({
      authorization: 'Bearer valid-token',
      'x-emulate-user-id': 'non-existent-user',
    });
    const superAdminPayload = { sub: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };
    const superAdminDbUser = { id: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };

    jwtService.verifyAsync.mockResolvedValue(superAdminPayload);
    prisma.user.findUnique
      .mockResolvedValueOnce(superAdminDbUser)
      .mockResolvedValueOnce(null);

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('lanza BadRequestException si SUPER_ADMIN intenta emular a otro SUPER_ADMIN', async () => {
    const { context } = makeContext({
      authorization: 'Bearer valid-token',
      'x-emulate-user-id': 'u2-another-admin',
    });
    const superAdminPayload = { sub: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };
    const superAdminDbUser = { id: 'u1-admin', email: 'admin@damp.com', globalRole: 'SUPER_ADMIN' };
    const anotherAdminDbUser = { id: 'u2-another-admin', email: 'admin2@damp.com', globalRole: 'SUPER_ADMIN' };

    jwtService.verifyAsync.mockResolvedValue(superAdminPayload);
    prisma.user.findUnique
      .mockResolvedValueOnce(superAdminDbUser)
      .mockResolvedValueOnce(anotherAdminDbUser);

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('ignora x-emulate-user-id si el usuario no es SUPER_ADMIN', async () => {
    const { context, request } = makeContext({
      authorization: 'Bearer valid-token',
      'x-emulate-user-id': 'u2-target',
    });
    const regularPayload = { sub: 'u1-regular', email: 'regular@damp.com', globalRole: 'USER' };
    const regularDbUser = { id: 'u1-regular', email: 'regular@damp.com', globalRole: 'USER' };

    jwtService.verifyAsync.mockResolvedValue(regularPayload);
    prisma.user.findUnique.mockResolvedValue(regularDbUser);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user.sub).toBe('u1-regular');
    expect(request.user.isEmulated).toBeUndefined();
    expect(request.realSuperAdmin).toBeUndefined();
  });
});
