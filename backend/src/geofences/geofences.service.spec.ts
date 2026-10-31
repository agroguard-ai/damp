import { GeofencesService } from './geofences.service';
import { BadRequestException } from '@nestjs/common';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    farmUser: { findFirst: jest.fn() },
    animal: { findMany: jest.fn() },
    animalCollar: { findMany: jest.fn() },
    collar: { updateMany: jest.fn() },
    animalGeofence: { updateMany: jest.fn(), findMany: jest.fn() },
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
        isActive: true,
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
        isActive: true,
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
        isActive: true,
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

  describe('update', () => {
    const farm = { id: 'farm-1', name: 'Estancia A', userId: 'user-1', polygonCoordinates: farmPolygon };
    const insidePolygon: [number, number][] = [
      [-34.55, -58.55],
      [-34.55, -58.45],
      [-34.45, -58.45],
    ];

    it('actualiza nombre y pastura sin tocar el polígono ni los collares', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', animalGeofences: [] });

      await service.update('geo-1', { name: ' Cerco Sur ', pastureType: '' }, 'user-1');

      expect(prisma.geofence.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Cerco Sur', pastureType: null } })
      );
      expect(prisma.collar.updateMany).not.toHaveBeenCalled();
    });

    it('al cambiar el polígono marca los collares de sus animales como pendientes', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.geofence.update.mockResolvedValue({
        id: 'geo-1',
        animalGeofences: [{ animalId: 'a-1' }, { animalId: 'a-2' }],
      });
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10 }, { collarId: 11 }]);

      await service.update('geo-1', { polygonCoordinates: insidePolygon }, 'user-1');

      expect(prisma.collar.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
        data: { fenceNotificationPending: true },
      });
    });

    it('rechaza un polígono con vértices fuera del perímetro del campo', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });

      await expect(
        service.update(
          'geo-1',
          {
            polygonCoordinates: [
              [-34.55, -58.55],
              [-34.55, -58.45],
              [-35.0, -58.45],
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
      expect(prisma.geofence.update).not.toHaveBeenCalled();
    });
  });

  describe('activate & deactivate', () => {
    const farm = { id: 'farm-1', name: 'Estancia A', userId: 'user-1', polygonCoordinates: farmPolygon };

    it('desactiva un cerco y finaliza las asignaciones de animales notificando collares', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1' }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 20 }]);
      prisma.animalGeofence.updateMany.mockResolvedValue({ count: 1 });
      prisma.collar.updateMany.mockResolvedValue({ count: 1 });
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', active: false });

      const result = await service.deactivate('geo-1', 'user-1');

      expect(prisma.collar.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [20] } },
        data: { fenceNotificationPending: true },
      });
      expect(prisma.animalGeofence.updateMany).toHaveBeenCalledWith({
        where: { geofenceId: 'geo-1', endAt: null },
        data: { endAt: expect.any(Date) },
      });
      expect(prisma.geofence.update).toHaveBeenCalledWith({
        where: { id: 'geo-1' },
        data: { active: false, deactivatedAt: expect.any(Date) },
      });
      expect(result.active).toBe(false);
    });

    it('activa un cerco previamente desactivado', async () => {
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        farmId: 'farm-1',
        farm,
        polygonCoordinates: [
          [-34.55, -58.55],
          [-34.55, -58.45],
          [-34.45, -58.45],
        ],
      });
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', active: true });

      const result = await service.activate('geo-1', 'user-1');

      expect(prisma.geofence.update).toHaveBeenCalledWith({
        where: { id: 'geo-1' },
        data: {
          active: true,
          activatedAt: expect.any(Date),
          deactivatedAt: null,
        },
        include: {
          animalGeofences: {
            where: { endAt: null },
            include: { animal: true },
          },
        },
      });
      expect(result.active).toBe(true);
    });

    it('rechaza activar si el usuario no tiene acceso', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.farmUser.findFirst.mockResolvedValue(null);

      await expect(service.activate('geo-1', 'other-user')).rejects.toThrow();
    });
  });
});
