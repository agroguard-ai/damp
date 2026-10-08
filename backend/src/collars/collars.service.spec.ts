import { Test, TestingModule } from '@nestjs/testing';
import { CollarsService } from './collars.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GlobalRole } from '@generated/prisma';

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
    animalCollar: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    collarClaim: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    collarRequest: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    user: {
      update: jest.Mock;
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
      animalCollar: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      collarClaim: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      collarRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
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

  describe('updateStatus y liberación automática', () => {
    it('libera automáticamente al animal activo si se marca como DAMAGED', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'AVAILABLE', farmId: 'farm-1' });
      prisma.collar.update.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'DAMAGED' });

      const superAdminUser = { sub: 'sa-1', globalRole: GlobalRole.SUPER_ADMIN, email: 'sa@test.com' };
      await service.updateStatus(1, 'DAMAGED', superAdminUser);

      expect(prisma.animalCollar.updateMany).toHaveBeenCalledWith({
        where: { collarId: 1, endAt: null },
        data: { endAt: expect.any(Date) },
      });
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'DAMAGED' },
        include: { farm: { select: { id: true, name: true } } },
      });
    });

    it('permite a un granjero marcar como DAMAGED un collar de su propio campo', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'AVAILABLE', farmId: 'farm-1' });
      prisma.farm.findMany.mockResolvedValue([{ id: 'farm-1' }]);
      prisma.collar.update.mockResolvedValue({ id: 1, identifier: 'COL-001', status: 'DAMAGED' });

      const farmerUser = { sub: 'farmer-1', globalRole: GlobalRole.USER, email: 'farmer@test.com' };
      await service.updateStatus(1, 'DAMAGED', farmerUser);

      expect(prisma.animalCollar.updateMany).toHaveBeenCalled();
      expect(prisma.collar.update).toHaveBeenCalled();
    });

    it('rechaza con ForbiddenException si un usuario intenta cambiar el estado de un collar de otro campo', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 2, identifier: 'COL-002', status: 'AVAILABLE', farmId: 'farm-other' });
      prisma.farm.findMany.mockResolvedValue([{ id: 'farm-my' }]);

      const farmerUser = { sub: 'farmer-1', globalRole: GlobalRole.USER, email: 'farmer@test.com' };
      await expect(service.updateStatus(2, 'DAMAGED', farmerUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Reclamos (Collar Claims)', () => {
    it('crea un reclamo y marca como DAMAGED liberando el animal si markAsDamaged es true', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 5, identifier: 'COL-005', status: 'AVAILABLE', farmId: 'farm-1' });
      prisma.farm.findMany.mockResolvedValue([{ id: 'farm-1' }]);
      prisma.collar.update.mockResolvedValue({ id: 5, identifier: 'COL-005', status: 'DAMAGED' });
      prisma.collarClaim.create.mockResolvedValue({
        id: 'claim-1',
        collarId: 5,
        reason: 'Correa rota',
        status: 'PENDING',
      });

      const user = { sub: 'farmer-1', globalRole: GlobalRole.USER, email: 'farmer@test.com' };
      const res = await service.createClaim(
        5,
        { reason: 'Correa rota', description: 'Se rompió la correa', markAsDamaged: true },
        user
      );

      expect(res.id).toBe('claim-1');
      expect(prisma.animalCollar.updateMany).toHaveBeenCalledWith({
        where: { collarId: 5, endAt: null },
        data: { endAt: expect.any(Date) },
      });
      expect(prisma.collarClaim.create).toHaveBeenCalled();
    });
  });

  describe('Solicitudes (Collar Requests)', () => {
    it('aprueba la solicitud e incrementa maxCollars si incrementMaxCollars es true', async () => {
      prisma.collarRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        farmId: 'farm-1',
        requestedCount: 3,
        farm: { userId: 'owner-1' },
      });
      prisma.collarRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
      });

      await service.updateRequest('req-1', {
        status: 'APPROVED',
        incrementMaxCollars: true,
        responseNotes: 'Aprobado por contrato',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
        data: { maxCollars: { increment: 3 } },
      });
      expect(prisma.collarRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          responseNotes: 'Aprobado por contrato',
        }),
        include: expect.any(Object),
      });
    });
  });
});
