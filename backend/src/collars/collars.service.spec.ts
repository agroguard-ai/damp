import { Test, TestingModule } from '@nestjs/testing';
import { CollarsService } from './collars.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('CollarsService', () => {
  let service: CollarsService;
  let prisma: {
    collar: {
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    farm: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    animalCollar: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      collar: {
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      farm: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      animalCollar: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
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
      prisma.collar.count.mockResolvedValue(4); // 4 collares ya asignados. Con el nuevo serán 5 <= 5.
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
      prisma.collar.count.mockResolvedValue(5); // Ya tiene 5 collares asignados. 5 + 1 > 5.

      await expect(service.create({ identifier: 'COL-006', farmId: 'farm-1' })).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.collar.create).not.toHaveBeenCalled();
    });
  });

  describe('update con límite de collares', () => {
    it('rechaza con BadRequestException si se transfiere un collar a una granja cuyo dueño no tiene cupo', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 10, identifier: 'COL-010', farmId: 'farm-old' });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-target',
        user: { id: 'owner-2', name: 'Granjero 2', email: 'g2@test.com', maxCollars: 2 },
      });
      prisma.collar.count.mockResolvedValue(2); // Ya tiene 2 collares asignados

      await expect(service.update(10, { farmId: 'farm-target' })).rejects.toThrow(BadRequestException);
    });
  });
});
