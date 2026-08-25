import { NotFoundException } from '@nestjs/common';
import { FarmUsersService } from './farm-users.service';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    role: { findUnique: jest.fn(), create: jest.fn() },
    farmUser: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  };
}

describe('FarmUsersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: FarmUsersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new FarmUsersService(prisma as any);
  });

  describe('findAllInFarm', () => {
    it('solo trae membresías activas', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      prisma.farmUser.findMany.mockResolvedValue([]);

      await service.findAllInFarm('farm-1');

      expect(prisma.farmUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId: 'farm-1', isActive: true } })
      );
    });
  });

  describe('removeSubUser', () => {
    it('hace baja lógica (isActive: false, removedAt) en vez de borrar la fila', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true });
      prisma.farmUser.update.mockResolvedValue({ id: 'fu1', isActive: false });

      await service.removeSubUser('farm-1', 'user-1');

      expect(prisma.farmUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { farmId_userId: { farmId: 'farm-1', userId: 'user-1' } },
          data: expect.objectContaining({ isActive: false, removedAt: expect.any(Date) }),
        })
      );
    });

    it('tira 404 si la membresía ya estaba dada de baja', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: false });

      await expect(service.removeSubUser('farm-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.farmUser.update).not.toHaveBeenCalled();
    });

    it('tira 404 si la membresía nunca existió', async () => {
      prisma.farmUser.findUnique.mockResolvedValue(null);
      await expect(service.removeSubUser('farm-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignSubUser', () => {
    it('reactiva (isActive: true, removedAt: null) al reasignar un usuario previamente removido', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'OPERATOR' });
      prisma.farmUser.upsert.mockResolvedValue({ id: 'fu1', isActive: true });

      await service.assignSubUser('farm-1', { userId: 'user-1', roleName: 'operator' } as any);

      expect(prisma.farmUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isActive: true, removedAt: null }),
        })
      );
    });
  });

  describe('updateSubUserRole', () => {
    it('tira 404 si la membresía está dada de baja', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: false });
      await expect(
        service.updateSubUserRole('farm-1', 'user-1', { roleName: 'ADMIN' } as any)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
