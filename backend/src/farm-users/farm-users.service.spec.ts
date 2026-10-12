import { NotFoundException } from '@nestjs/common';
import { FarmUsersService } from './farm-users.service';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    role: { findUnique: jest.fn(), create: jest.fn() },
    farmUser: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
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
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: true, role: { name: 'OPERATOR' } });
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
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: false, role: { name: 'OPERATOR' } });

      await expect(service.removeSubUser('farm-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(prisma.farmUser.update).not.toHaveBeenCalled();
    });

    it('tira 404 si la membresía nunca existió', async () => {
      prisma.farmUser.findUnique.mockResolvedValue(null);
      await expect(service.removeSubUser('farm-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza dar de baja al único administrador activo de la granja', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu-admin', isActive: true, role: { name: 'ADMIN' } });
      prisma.farmUser.findFirst.mockResolvedValue(null);

      await expect(service.removeSubUser('farm-1', 'user-1')).rejects.toThrow(
        'No se puede dar de baja al único administrador de la granja. Asigná otro administrador antes de remover este acceso.'
      );
      expect(prisma.farmUser.update).not.toHaveBeenCalled();
    });

    it('permite dar de baja a un administrador si existe otro administrador activo', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu-admin', isActive: true, role: { name: 'ADMIN' } });
      prisma.farmUser.findFirst.mockResolvedValue({ id: 'fu-other-admin', userId: 'user-2' });
      prisma.farmUser.update.mockResolvedValue({ id: 'fu-admin', isActive: false });

      await service.removeSubUser('farm-1', 'user-1');

      expect(prisma.farmUser.update).toHaveBeenCalled();
    });
  });

  describe('assignSubUser', () => {
    it('reactiva (isActive: true, removedAt: null) al reasignar un usuario previamente removido', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      prisma.farmUser.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'OPERATOR' });
      prisma.farmUser.upsert.mockResolvedValue({ id: 'fu1', isActive: true });

      await service.assignSubUser('farm-1', { userId: 'user-1', roleName: 'operator' });

      expect(prisma.farmUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isActive: true, removedAt: null }),
        })
      );
    });

    it('rechaza asignar un usuario que ya pertenece a otra granja', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-2' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      prisma.farmUser.findFirst.mockResolvedValue({
        id: 'fu1',
        farmId: 'farm-1',
        userId: 'user-1',
        isActive: true,
        farm: { name: 'Granja Los Pinos' },
      });

      await expect(service.assignSubUser('farm-2', { userId: 'user-1', roleName: 'OPERATOR' })).rejects.toThrow(
        'El usuario "a@b.com" ya se encuentra asignado al establecimiento "Granja Los Pinos". Un usuario solo puede pertenecer a una granja a la vez.'
      );
    });

    it('rechaza asignar ADMIN si ya existe otro administrador activo en la granja', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'user2@b.com' });
      prisma.farmUser.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'fu-admin-1', userId: 'user-1', roleId: 'role-admin' });

      await expect(service.assignSubUser('farm-1', { userId: 'user-2', roleName: 'ADMIN' } as any)).rejects.toThrow(
        'Esta granja ya posee un rol administrador asignado. Solo puede haber un único administrador por granja.'
      );
    });
  });

  describe('updateSubUserRole', () => {
    it('tira 404 si la membresía está dada de baja', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({ id: 'fu1', isActive: false });
      await expect(service.updateSubUserRole('farm-1', 'user-1', { roleName: 'ADMIN' } as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rechaza actualizar rol a ADMIN si ya existe otro administrador activo', async () => {
      prisma.farmUser.findUnique.mockResolvedValue({
        id: 'fu-emp',
        farmId: 'farm-1',
        userId: 'user-2',
        isActive: true,
      });
      prisma.farmUser.findFirst.mockResolvedValue({ id: 'fu-admin-1', userId: 'user-1', roleId: 'role-admin' });

      await expect(service.updateSubUserRole('farm-1', 'user-2', { roleName: 'ADMIN' } as any)).rejects.toThrow(
        'Esta granja ya posee un rol administrador asignado. Solo puede haber un único administrador por granja.'
      );
    });
  });
});
