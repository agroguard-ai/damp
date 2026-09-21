import { GeofencesService } from './geofences.service';
import { BadRequestException } from '@nestjs/common';

function makePrismaMock() {
  return {
    zone: { findUnique: jest.fn() },
    animal: { findMany: jest.fn() },
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

  // Zone polygon: square between lat -34.6 to -34.4, lng -58.6 to -58.4
  const zonePolygon = [
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
    it('crea el cerco exitosamente si todos los puntos están dentro del polígono de la zona', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero A',
        polygonCoordinates: zonePolygon,
        farm: { userId: 'user-1' },
      });
      prisma.animal.findMany.mockResolvedValue([]);
      prisma.animalGeofence.updateMany.mockResolvedValue({ count: 0 });
      prisma.geofence.create.mockResolvedValue({
        id: 'geo-1',
        name: 'Cerco Norte',
        zoneId: 'zone-1',
        active: true,
      });

      const result = await service.create(
        {
          zoneId: 'zone-1',
          name: 'Cerco Norte',
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
      expect(prisma.geofence.create).toHaveBeenCalled();
    });

    it('lanza BadRequestException si un vértice del cerco cae fuera del polígono de la zona', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero A',
        polygonCoordinates: zonePolygon,
        farm: { userId: 'user-1' },
      });

      await expect(
        service.create(
          {
            zoneId: 'zone-1',
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
  });
});
