import { AnimalTypesService } from './animal-types.service';

function makePrismaMock() {
  return {
    animalType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('AnimalTypesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnimalTypesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnimalTypesService(prisma as any);
  });

  describe('findAll', () => {
    it('filtra por isActive: true por defecto', async () => {
      prisma.animalType.findMany.mockResolvedValue([]);
      await service.findAll(false);
      expect(prisma.animalType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { _count: { select: { animals: true } } },
        orderBy: { name: 'asc' },
      });
    });

    it('retorna todos si includeInactive=true', async () => {
      prisma.animalType.findMany.mockResolvedValue([]);
      await service.findAll(true);
      expect(prisma.animalType.findMany).toHaveBeenCalledWith({
        where: {},
        include: { _count: { select: { animals: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('crea con isActive: true', async () => {
      prisma.animalType.findUnique.mockResolvedValue(null);
      prisma.animalType.create.mockResolvedValue({
        id: '1',
        name: 'Angus',
        species: 'Bovino',
        isActive: true,
      });

      const res = await service.create({ name: 'Angus', species: 'Bovino' });
      expect(res.isActive).toBe(true);
      expect(prisma.animalType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Angus', isActive: true }),
        include: { _count: { select: { animals: true } } },
      });
    });
  });

  describe('remove (baja lógica)', () => {
    it('aplica baja lógica si tiene animales asignados para preservar histórico', async () => {
      prisma.animalType.findUnique.mockResolvedValue({
        id: '1',
        name: 'Hereford',
        species: 'Bovino',
        isActive: true,
        _count: { animals: 15 },
      });
      prisma.animalType.update.mockResolvedValue({
        id: '1',
        name: 'Hereford',
        isActive: false,
        _count: { animals: 15 },
      });

      const res = await service.remove('1');
      expect(res.isArchived).toBe(true);
      expect(res.message).toContain('15 animal(es) asignados');
      expect(prisma.animalType.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
        include: { _count: { select: { animals: true } } },
      });
    });

    it('aplica baja lógica correctamente si tiene 0 animales asignados', async () => {
      prisma.animalType.findUnique.mockResolvedValue({
        id: '2',
        name: 'Raza Nueva',
        species: 'Bovino',
        isActive: true,
        _count: { animals: 0 },
      });
      prisma.animalType.update.mockResolvedValue({
        id: '2',
        name: 'Raza Nueva',
        isActive: false,
        _count: { animals: 0 },
      });

      const res = await service.remove('2');
      expect(res.isArchived).toBe(true);
      expect(prisma.animalType.update).toHaveBeenCalledWith({
        where: { id: '2' },
        data: { isActive: false },
        include: { _count: { select: { animals: true } } },
      });
    });
  });

  describe('reactivate', () => {
    it('restaura el tipo a isActive: true', async () => {
      prisma.animalType.findUnique.mockResolvedValue({
        id: '1',
        name: 'Hereford',
        isActive: false,
      });
      prisma.animalType.update.mockResolvedValue({
        id: '1',
        name: 'Hereford',
        isActive: true,
        _count: { animals: 15 },
      });

      const res = await service.reactivate('1');
      expect(res.animalType.isActive).toBe(true);
      expect(res.message).toContain('reactivado exitosamente');
      expect(prisma.animalType.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: true },
        include: { _count: { select: { animals: true } } },
      });
    });
  });
});
