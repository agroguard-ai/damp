import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    farm: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      farm: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('debe mapear usuarios calculando assignedCollarsCount desde sus campos', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          name: 'Productor 1',
          email: 'p1@damp.com',
          isActive: true,
          maxCollars: 20,
          farms: [
            { id: 'f1', _count: { collars: 5 } },
            { id: 'f2', _count: { collars: 3 } },
          ],
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].assignedCollarsCount).toBe(8);
      expect((result.data[0] as any).farms).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('debe actualizar isActive a false cuando se suspende', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });

      const result = await service.updateStatus('u1', false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false },
        select: expect.anything(),
      });
      expect(result.isActive).toBe(false);
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('inexistente', false)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMaxCollars', () => {
    it('debe actualizar maxCollars si el nuevo cupo es mayor o igual a los collares asignados', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        farms: [{ _count: { collars: 10 } }],
      });
      prisma.user.update.mockResolvedValue({ id: 'u1', maxCollars: 15 });

      const result = await service.updateMaxCollars('u1', 15);
      expect(result.maxCollars).toBe(15);
    });

    it('debe rechazar con BadRequestException si se intenta reducir el cupo por debajo de los collares ya asignados', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        farms: [{ _count: { collars: 10 } }],
      });

      await expect(service.updateMaxCollars('u1', 5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data }));
    });

    it('por defecto crea un administrador de campos con su cupo de collares', async () => {
      await service.createUser({ email: 'Nuevo@Campo.com ', name: 'Nuevo', maxCollars: 20 });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'nuevo@campo.com', globalRole: 'FARM_ADMIN', maxCollars: 20 }),
        })
      );
    });

    it('un super admin no recibe cupo de collares', async () => {
      await service.createUser({ email: 'sa@damp.com', name: 'SA', globalRole: 'SUPER_ADMIN', maxCollars: 20 });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ globalRole: 'SUPER_ADMIN', maxCollars: 0 }) })
      );
    });
  });

  describe('updateGlobalRole', () => {
    it('cambia entre SUPER_ADMIN y FARM_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', globalRole: 'FARM_ADMIN' });
      prisma.user.update.mockResolvedValue({ id: 'u1', globalRole: 'SUPER_ADMIN' });

      await service.updateGlobalRole('u1', { globalRole: 'SUPER_ADMIN' });

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('rechaza cambiar el rol del personal (USER) de un administrador de campos', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', globalRole: 'USER' });

      await expect(service.updateGlobalRole('u2', { globalRole: 'FARM_ADMIN' })).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
