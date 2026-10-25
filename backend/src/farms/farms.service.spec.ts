import { FarmsService } from './farms.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GlobalRole } from '@generated/prisma';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn() },
    role: { findUnique: jest.fn(), create: jest.fn() },
    farm: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    farmUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    geofence: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('FarmsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: FarmsService;

  const farmPolygon = [
    [-35.0, -59.0],
    [-35.0, -58.0],
    [-34.0, -58.0],
    [-34.0, -59.0],
  ];

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new FarmsService(prisma as any);
  });

  describe('create — quién puede registrar campos', () => {
    it('un FARM_ADMIN crea el campo y queda como su ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', globalRole: GlobalRole.FARM_ADMIN });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
      const tx = { farm: { create: jest.fn().mockResolvedValue({ id: 'farm-1' }) }, farmUser: { create: jest.fn() } };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await service.create({ name: 'La Esperanza' } as any, 'user-1');

      expect(tx.farmUser.create).toHaveBeenCalledWith({
        data: { farmId: 'farm-1', userId: 'user-1', roleId: 'role-admin' },
      });
    });

    it('un USER (operador/lector, aunque no tenga campos) no puede crear campos', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', globalRole: GlobalRole.USER });

      await expect(service.create({ name: 'Propio' } as any, 'user-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update — geofence containment validation', () => {
    it('actualiza el campo exitosamente si todos sus cercos quedan dentro del nuevo perímetro', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', globalRole: GlobalRole.USER });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });
      prisma.geofence.findMany.mockResolvedValue([
        {
          id: 'geo-1',
          name: 'Cerco Norte',
          polygonCoordinates: [
            [-34.8, -58.8],
            [-34.8, -58.2],
            [-34.2, -58.2],
            [-34.2, -58.8],
          ],
        },
      ]);
      prisma.farm.update.mockResolvedValue({ id: 'farm-1', name: 'Campo Actualizado' });

      const result = await service.update(
        'farm-1',
        {
          polygonCoordinates: [
            [-35.0, -59.0],
            [-35.0, -58.0],
            [-34.0, -58.0],
            [-34.0, -59.0],
          ],
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(prisma.farm.update).toHaveBeenCalled();
    });

    it('lanza BadRequestException si al achicar el campo un cerco queda fuera de los nuevos límites', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', globalRole: GlobalRole.USER });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });
      // Geofence exists at latitude -34.2
      prisma.geofence.findMany.mockResolvedValue([
        {
          id: 'geo-1',
          name: 'Cerco Norte',
          polygonCoordinates: [
            [-34.4, -58.8],
            [-34.4, -58.2],
            [-34.1, -58.2],
          ],
        },
      ]);

      // New smaller farm caps latitude at -34.5 (excluding -34.1)
      await expect(
        service.update(
          'farm-1',
          {
            polygonCoordinates: [
              [-35.0, -59.0],
              [-35.0, -58.0],
              [-34.5, -58.0],
              [-34.5, -59.0],
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);

      expect(prisma.farm.update).not.toHaveBeenCalled();
    });
  });
});
