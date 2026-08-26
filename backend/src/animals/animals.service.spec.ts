import { AnimalsService } from './animals.service';

function makePrismaMock() {
  return {
    farm: { findFirst: jest.fn(), findMany: jest.fn() },
    animal: { findMany: jest.fn() },
  };
}

describe('AnimalsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnimalsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnimalsService(prisma as any, {} as any);
  });

  describe('findAll — filtro hasActiveAlert', () => {
    it('agrega el filtro de alertas sin resolver cuando hasActiveAlert=true', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', hasActiveAlert: 'true' }, 'user-1');

      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ alerts: { some: { isResolved: false } } }),
        })
      );
    });

    it('no agrega el filtro de alertas cuando no se pide', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1' }, 'user-1');

      const [{ where }] = prisma.animal.findMany.mock.calls[0];
      expect(where.alerts).toBeUndefined();
    });

    it('no agrega el filtro con cualquier valor que no sea el string "true"', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', hasActiveAlert: 'false' }, 'user-1');

      const [{ where }] = prisma.animal.findMany.mock.calls[0];
      expect(where.alerts).toBeUndefined();
    });
  });
});
