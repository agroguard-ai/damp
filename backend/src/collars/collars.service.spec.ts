import { Test, TestingModule } from '@nestjs/testing';
import { CollarsService } from './collars.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CollarStatus, GlobalRole } from '@generated/prisma';

describe('CollarsService', () => {
  let service: CollarsService;
  let prisma: {
    collar: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    farm: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    farmUser: {
      findMany: jest.Mock;
    };
    animalCollar: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    telemetryReading: {
      count: jest.Mock;
    };
    user: {
      update: jest.Mock;
    };
    collarRequest: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    rotationPlan: {
      findFirst: jest.Mock;
    };
    $executeRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      $executeRaw: jest.fn(),
      collar: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      farm: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      farmUser: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      animalCollar: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      telemetryReading: {
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        update: jest.fn(),
      },
      collarRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      rotationPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollarsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CollarsService>(CollarsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create con límite de collares', () => {
    it('permite crear un collar asignado a una granja si no se supera el cupo del dueño', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        user: { id: 'owner-1', name: 'Granjero 1', email: 'g1@test.com', maxCollars: 5 },
      });
      prisma.collar.count.mockResolvedValue(4);
      prisma.collar.create.mockResolvedValue({ id: 1, identifier: 'COL-001', farmId: 'farm-1' });

      const result = await service.create({ identifier: 'COL-001', farmId: 'farm-1' });
      expect(result.id).toBe(1);
      expect(prisma.collar.create).toHaveBeenCalled();
    });

    it('rechaza con BadRequestException si se intenta superar el cupo contratado de collares', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        user: { id: 'owner-1', name: 'Granjero 1', email: 'g1@test.com', maxCollars: 5 },
      });
      prisma.collar.count.mockResolvedValue(5);

      await expect(service.create({ identifier: 'COL-006', farmId: 'farm-1' })).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.collar.create).not.toHaveBeenCalled();
    });
  });

  describe('update con límite de collares', () => {
    it('permite modificar el ID numérico de un collar existente si no colisiona', async () => {
      prisma.collar.findUnique
        .mockResolvedValueOnce({ id: 2, identifier: 'COLLAR-2', farmId: 'farm-1' }) // getOrThrow(2)
        .mockResolvedValueOnce(null); // check conflict for new id 5
      prisma.collar.update.mockResolvedValue({ id: 5, identifier: 'COLLAR-5', farmId: 'farm-1' });

      const result = await service.update(2, { id: 5 });

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.id).toBe(5);
    });

    it('rechaza con ConflictException si el nuevo ID numérico ya existe', async () => {
      prisma.collar.findUnique
        .mockResolvedValueOnce({ id: 2, identifier: 'COLLAR-2', farmId: 'farm-1' }) // getOrThrow(2)
        .mockResolvedValueOnce({ id: 5, identifier: 'COLLAR-5' }); // already exists!

      await expect(service.update(2, { id: 5 })).rejects.toThrow();
    });

    it('rechaza con BadRequestException si se transfiere un collar a una granja cuyo dueño no tiene cupo', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 10, identifier: 'COL-010', farmId: 'farm-old' });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-target',
        user: { id: 'owner-2', name: 'Granjero 2', email: 'g2@test.com', maxCollars: 2 },
      });
      prisma.collar.count.mockResolvedValue(2);

      await expect(service.update(10, { farmId: 'farm-target' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus y control exclusivo de Superadministrador', () => {
    it('libera automáticamente al animal activo si se marca como OUT_OF_SERVICE', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'AVAILABLE', farmId: 'farm-1' });
      prisma.collar.update.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'OUT_OF_SERVICE' });

      const superAdminUser = { sub: 'sa-1', globalRole: GlobalRole.SUPER_ADMIN, email: 'sa@test.com' };
      await service.updateStatus(1, CollarStatus.OUT_OF_SERVICE, superAdminUser);

      expect(prisma.animalCollar.updateMany).toHaveBeenCalledWith({
        where: { collarId: 1, endAt: null },
        data: { endAt: expect.any(Date) },
      });
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'OUT_OF_SERVICE' },
        include: { farm: { select: { id: true, name: true } } },
      });
    });

    it('rechaza con ForbiddenException si un usuario que no es Superadmin intenta cambiar el estado de un collar', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'AVAILABLE', farmId: 'farm-1' });

      const farmerUser = { sub: 'farmer-1', globalRole: GlobalRole.USER, email: 'farmer@test.com' };
      await expect(service.updateStatus(1, CollarStatus.OUT_OF_SERVICE, farmerUser)).rejects.toThrow(ForbiddenException);
    });
  });


  describe('archive y restore', () => {
    it('archiva un collar liberando animales activos y estableciendo OUT_OF_SERVICE', async () => {
      prisma.collar.findUnique.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        farmId: 'farm-1',
        status: 'AVAILABLE',
      });
      prisma.animalCollar.updateMany.mockResolvedValue({ count: 1 });
      prisma.collar.update.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        isArchived: true,
        status: 'OUT_OF_SERVICE',
        farmId: null,
      });

      const res = await service.archive(10);
      expect(prisma.animalCollar.updateMany).toHaveBeenCalledWith({
        where: { collarId: 10, endAt: null },
        data: { endAt: expect.any(Date) },
      });
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          isArchived: true,
          status: 'OUT_OF_SERVICE',
          farmId: null,
        },
        include: expect.any(Object),
      });
      expect(res.isArchived).toBe(true);
    });

    it('restaura un collar archivado a AVAILABLE', async () => {
      prisma.collar.findUnique.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        isArchived: true,
        status: 'OUT_OF_SERVICE',
      });
      prisma.collar.update.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        isArchived: false,
        status: 'AVAILABLE',
      });

      const res = await service.restore(10);
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          isArchived: false,
          status: 'AVAILABLE',
        },
        include: expect.any(Object),
      });
      expect(res.isArchived).toBe(false);
    });

    it('marca un collar con fenceNotificationPending = true en syncFence si tiene animal y cerco activo', async () => {
      prisma.collar.findUnique.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        fenceNotificationPending: false,
        farmId: 'farm-1',
      });
      prisma.animalCollar.findFirst.mockResolvedValue({
        animal: {
          id: 'a-1',
          tag: 'ER-01',
          farmId: 'farm-1',
          animalGeofences: [{ id: 'ag-1', geofence: { id: 'g-1', active: true } }],
        },
      });
      prisma.collar.update.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        fenceNotificationPending: true,
      });

      const superAdminUser = { sub: 'sa-1', globalRole: GlobalRole.SUPER_ADMIN, email: 'sa@test.com' };
      const res = await service.syncFence(10, superAdminUser);
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          fenceNotificationPending: true,
        },
        include: expect.any(Object),
      });
      expect(res.fenceNotificationPending).toBe(true);
    });

    it('rechaza syncFence si el collar no está colocado en ningún animal', async () => {
      prisma.collar.findUnique.mockResolvedValue({
        id: 10,
        identifier: 'COL-010',
        farmId: 'farm-1',
      });
      prisma.animalCollar.findFirst.mockResolvedValue(null);

      const superAdminUser = { sub: 'sa-1', globalRole: GlobalRole.SUPER_ADMIN, email: 'sa@test.com' };
      await expect(service.syncFence(10, superAdminUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove (eliminación segura)', () => {
    it('elimina físicamente si no tiene registros históricos asociados', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 5, identifier: 'COL-005' });
      prisma.animalCollar.count.mockResolvedValue(0);
      prisma.telemetryReading.count.mockResolvedValue(0);
      prisma.collar.delete.mockResolvedValue({ id: 5 });

      await service.remove(5);
      expect(prisma.collar.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('rechaza la eliminación con BadRequestException explicativo si tiene historial', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 19, identifier: 'COLLAR-19' });
      prisma.animalCollar.count.mockResolvedValue(2);
      prisma.telemetryReading.count.mockResolvedValue(10);

      await expect(service.remove(19)).rejects.toThrow(BadRequestException);
      await expect(service.remove(19)).rejects.toThrow(/posee historial registrado/);
      expect(prisma.collar.delete).not.toHaveBeenCalled();
    });

    it('archiva en vez de fallar si forceArchive es true', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 19, identifier: 'COLLAR-19', farmId: 'farm-1' });
      prisma.animalCollar.count.mockResolvedValue(1);
      prisma.telemetryReading.count.mockResolvedValue(0);
      prisma.collar.update.mockResolvedValue({
        id: 19,
        identifier: 'COLLAR-19',
        isArchived: true,
        status: 'OUT_OF_SERVICE',
        farmId: null,
      });

      const res = await service.remove(19, true);
      expect(res.isArchived).toBe(true);
      expect(prisma.collar.delete).not.toHaveBeenCalled();
    });
  });
});
