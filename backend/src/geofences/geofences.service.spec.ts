import { GeofencesService } from './geofences.service';
import { BadRequestException } from '@nestjs/common';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    animal: { findMany: jest.fn() },
    animalCollar: { findMany: jest.fn() },
    collar: { updateMany: jest.fn() },
    animalGeofence: { updateMany: jest.fn() },
    geofence: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('GeofencesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: GeofencesService;

  // Farm polygon: square between lat -34.6 to -34.4, lng -58.6 to -58.4
  const farmPolygon = [
    [-34.6, -58.6],
    [-34.6, -58.4],
    [-34.4, -58.4],
    [-34.4, -58.6],
  ];

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new GeofencesService(prisma as any);
  });

  describe('create — boundary validation', () => {
    it('crea el cerco exitosamente si todos los puntos están dentro del polígono del campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });
      prisma.animal.findMany.mockResolvedValue([]);
      prisma.animalGeofence.updateMany.mockResolvedValue({ count: 0 });
      prisma.geofence.create.mockResolvedValue({
        id: 'geo-1',
        name: 'Cerco Norte',
        farmId: 'farm-1',
        active: true,
      });

      const result = await service.create(
        {
          farmId: 'farm-1',
          name: 'Cerco Norte',
          pastureType: 'Alfalfa',
          animalIds: [],
          polygonCoordinates: [
            [-34.55, -58.55],
            [-34.55, -58.45],
            [-34.45, -58.45],
          ],
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(prisma.geofence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ farmId: 'farm-1', pastureType: 'Alfalfa' }),
        })
      );
    });

    it('lanza BadRequestException si un vértice del cerco cae fuera del polígono del campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });

      await expect(
        service.create(
          {
            farmId: 'farm-1',
            name: 'Cerco Inválido',
            animalIds: [],
            polygonCoordinates: [
              [-34.55, -58.55],
              [-34.55, -58.45],
              [-35.0, -58.45], // Outside! Lat -35 is outside [-34.6, -34.4]
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);

      expect(prisma.geofence.create).not.toHaveBeenCalled();
    });

    it('rechaza animales que pertenecen a otro campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        polygonCoordinates: null,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a-1', tag: '001', farmId: 'farm-2', animalCollars: [{ collarId: 1 }] },
      ]);

      await expect(
        service.create(
          {
            farmId: 'farm-1',
            name: 'Cerco 1',
            animalIds: ['a-1'],
            polygonCoordinates: [
              [-34.55, -58.55],
              [-34.55, -58.45],
              [-34.45, -58.45],
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});
