import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlobalRole } from '@generated/prisma';
import { FarmUsersService } from './farm-users.service';

function makePrismaMock() {
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    farm: { findMany: jest.fn() },
    role: { upsert: jest.fn() },
    farmUser: { updateMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transacción interactiva: corre el callback con el mismo mock; en array: resuelve las operaciones.
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: typeof prisma) => unknown)(prisma) : Promise.all(arg as unknown[])
  );
  return prisma;
}

const ADMIN = { id: 'admin-1', globalRole: GlobalRole.FARM_ADMIN };
const ADMIN_FARMS = [
  { id: 'farm-a', name: 'La Esperanza' },
  { id: 'farm-b', name: 'El Palmar' },
];

describe('FarmUsersService (personal del administrador de campos)', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: FarmUsersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new FarmUsersService(prisma as any);
    prisma.farm.findMany.mockResolvedValue(ADMIN_FARMS);
    prisma.role.upsert.mockResolvedValue({ id: 'role-op', name: 'OPERATOR' });
  });

  /** Primer findUnique: el administrador; el siguiente: la persona buscada. */
  function mockUsers(target: unknown) {
    prisma.user.findUnique.mockResolvedValueOnce(ADMIN).mockResolvedValueOnce(target);
  }

  describe('acceso', () => {
    it('rechaza a quien no es FARM_ADMIN (ej. un operador)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'op-1', globalRole: GlobalRole.USER });
      await expect(service.findStaff('op-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createStaff', () => {
    const dto = { email: 'Pedro@Campo.com', name: 'Pedro', roleName: 'OPERATOR' as const, farmIds: ['farm-a', 'farm-b'] };

    it('crea un USER con contraseña temporal y lo asigna con el mismo rol a todos los campos elegidos', async () => {
      mockUsers(null);
      prisma.user.create.mockResolvedValue({ id: 'u-1', email: 'pedro@campo.com', name: 'Pedro' });

      const result = await service.createStaff(ADMIN.id, dto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'pedro@campo.com', globalRole: GlobalRole.USER, mustChangePassword: true }),
      });
      expect(prisma.farmUser.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.farmUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { farmId: 'farm-b', userId: 'u-1', roleId: 'role-op' } })
      );
      expect(result.temporaryPassword).toMatch(/^Damp/);
      expect(result.user.farms).toEqual(ADMIN_FARMS);
    });

    it('rechaza asignar un campo que no administra', async () => {
      mockUsers(null);
      await expect(service.createStaff(ADMIN.id, { ...dto, farmIds: ['farm-ajeno'] })).rejects.toThrow(
        ForbiddenException
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rechaza un email ya registrado por otra persona', async () => {
      mockUsers({ id: 'x', globalRole: GlobalRole.USER, isActive: true, farmUsers: [{ farmId: 'farm-otro' }] });
      await expect(service.createStaff(ADMIN.id, dto)).rejects.toThrow(ConflictException);
    });

    it('reincorpora a alguien dado de baja que había sido personal de este administrador', async () => {
      mockUsers({ id: 'u-old', globalRole: GlobalRole.USER, isActive: false, farmUsers: [{ farmId: 'farm-a' }] });
      prisma.user.update.mockResolvedValue({ id: 'u-old', email: 'pedro@campo.com', name: 'Pedro' });

      await service.createStaff(ADMIN.id, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-old' },
        data: expect.objectContaining({ isActive: true, mustChangePassword: true }),
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStaff', () => {
    const staff = {
      id: 'u-1',
      globalRole: GlobalRole.USER,
      isActive: true,
      farmUsers: [{ farmId: 'farm-a', role: { name: 'OPERATOR' } }],
    };

    it('cambia los campos: da de baja los que se sacan y activa los nuevos', async () => {
      mockUsers(staff);

      await service.updateStaff(ADMIN.id, 'u-1', { farmIds: ['farm-b'] });

      expect(prisma.farmUser.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', isActive: true, farmId: { notIn: ['farm-b'] } },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(prisma.farmUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId_userId: { farmId: 'farm-b', userId: 'u-1' } } })
      );
    });

    it('404 si la persona tiene campos de otro administrador', async () => {
      mockUsers({ ...staff, farmUsers: [{ farmId: 'farm-otro', role: { name: 'OPERATOR' } }] });
      await expect(service.updateStaff(ADMIN.id, 'u-1', { roleName: 'VIEWER' })).rejects.toThrow(NotFoundException);
    });

    it('404 si se intenta editar a un administrador de campos', async () => {
      mockUsers({ ...staff, globalRole: GlobalRole.FARM_ADMIN });
      await expect(service.updateStaff(ADMIN.id, 'u-1', { roleName: 'VIEWER' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeStaff', () => {
    it('da de baja todas sus membresías y desactiva la cuenta', async () => {
      mockUsers({ id: 'u-1', globalRole: GlobalRole.USER, farmUsers: [{ farmId: 'farm-a', role: { name: 'VIEWER' } }] });

      await service.removeStaff(ADMIN.id, 'u-1');

      expect(prisma.farmUser.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', isActive: true },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { isActive: false } });
    });
  });
});
