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
    telemetryReading: { findMany: jest.fn() },
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

    it('rechaza crear un cerco activo si un animal seleccionado no tiene lectura GPS en la última hora', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        isActive: true,
        polygonCoordinates: null,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a-1', tag: '001', farmId: 'farm-1', animalCollars: [{ collarId: 10 }] },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValue([]);

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
      ).rejects.toThrow(/lectura GPS en la última hora/);
      expect(prisma.geofence.create).not.toHaveBeenCalled();
    });

    it('rechaza crear un cerco activo si un animal seleccionado está fuera del polígono', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        isActive: true,
        polygonCoordinates: null,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a-1', tag: '001', farmId: 'farm-1', animalCollars: [{ collarId: 10 }] },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.6, longitude: -58.5 }]);

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
      ).rejects.toThrow(/fuera del cerco/);
      expect(prisma.geofence.create).not.toHaveBeenCalled();
    });

    it('crea el cerco activo con animales que están dentro y lejos del borde', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        name: 'Estancia A',
        userId: 'user-1',
        isActive: true,
        polygonCoordinates: null,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a-1', tag: '001', farmId: 'farm-1', animalCollars: [{ collarId: 10 }] },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.54, longitude: -58.53 }]);
      prisma.animalGeofence.updateMany.mockResolvedValue({ count: 0 });
      prisma.animalCollar.findMany.mockResolvedValue([]);
      prisma.geofence.create.mockResolvedValue({ id: 'geo-1', active: true });

      await service.create(
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
      );

      expect(prisma.geofence.create).toHaveBeenCalled();
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
      prisma.animalGeofence.findMany.mockResolvedValue([
        { animalId: 'a-1', animal: { tag: '001' } },
        { animalId: 'a-2', animal: { tag: '002' } },
      ]);
      prisma.animalCollar.findMany.mockResolvedValue([
        { collarId: 10, animalId: 'a-1' },
        { collarId: 11, animalId: 'a-2' },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValue([]);

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

    it('rechaza la edición si un animal quedó fuera del nuevo polígono en la última hora', async () => {
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        farmId: 'farm-1',
        farm,
        polygonCoordinates: insidePolygon,
      });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.52, longitude: -58.48 }]);

      const narrower: [number, number][] = [
        [-34.55, -58.55],
        [-34.55, -58.5],
        [-34.5, -58.5],
        [-34.5, -58.55],
      ];

      await expect(service.update('geo-1', { polygonCoordinates: narrower }, 'user-1')).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.telemetryReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ timestamp: { gte: expect.any(Date) } }),
        })
      );
      expect(prisma.geofence.update).not.toHaveBeenCalled();
    });

    it('permite la edición si las lecturas de la última hora siguen dentro del nuevo polígono', async () => {
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        farmId: 'farm-1',
        farm,
        polygonCoordinates: insidePolygon,
      });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.51, longitude: -58.51 }]);
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', animalGeofences: [] });

      const wider: [number, number][] = [
        [-34.56, -58.56],
        [-34.56, -58.44],
        [-34.44, -58.44],
        [-34.44, -58.56],
      ];

      await service.update('geo-1', { polygonCoordinates: wider }, 'user-1');

      expect(prisma.geofence.update).toHaveBeenCalled();
    });

    it('no bloquea si el animal ya estaba fuera del trazado anterior', async () => {
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        farmId: 'farm-1',
        farm,
        polygonCoordinates: insidePolygon,
      });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.59, longitude: -58.59 }]);
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', animalGeofences: [] });

      const narrower: [number, number][] = [
        [-34.55, -58.55],
        [-34.55, -58.5],
        [-34.5, -58.5],
        [-34.5, -58.55],
      ];

      await service.update('geo-1', { polygonCoordinates: narrower }, 'user-1');

      expect(prisma.geofence.update).toHaveBeenCalled();
    });
  });

  describe('activate & deactivate', () => {
    const farm = { id: 'farm-1', name: 'Estancia A', userId: 'user-1', polygonCoordinates: farmPolygon };

    it('desactiva un cerco conservando las asignaciones de animales y notificando collares', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1' }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 20 }]);
      prisma.collar.updateMany.mockResolvedValue({ count: 1 });
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', active: false });

      const result = await service.deactivate('geo-1', 'user-1');

      expect(prisma.collar.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [20] } },
        data: { fenceNotificationPending: true },
      });
      expect(prisma.animalGeofence.updateMany).not.toHaveBeenCalled();
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
      prisma.animalGeofence.findMany.mockResolvedValue([]);
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

    it('rechaza reactivar si un animal asignado está fuera del cerco en la última hora', async () => {
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
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.51, longitude: -58.44 }]);

      await expect(service.activate('geo-1', 'user-1')).rejects.toThrow(/mové los animales dentro del cerco/i);
      expect(prisma.geofence.update).not.toHaveBeenCalled();
    });

    it('rechaza reactivar si un animal asignado no tiene lectura GPS en la última hora', async () => {
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
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([]);

      await expect(service.activate('geo-1', 'user-1')).rejects.toThrow(/lectura GPS en la última hora/);
      expect(prisma.geofence.update).not.toHaveBeenCalled();
    });

    it('rechaza reactivar si un animal asignado no tiene collar activo', async () => {
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
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([]);

      await expect(service.activate('geo-1', 'user-1')).rejects.toThrow(/lectura GPS en la última hora/);
      expect(prisma.telemetryReading.findMany).not.toHaveBeenCalled();
      expect(prisma.geofence.update).not.toHaveBeenCalled();
    });

    it('permite reactivar si los animales asignados están dentro del cerco en la última hora', async () => {
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
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 10, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.54, longitude: -58.54 }]);
      prisma.geofence.update.mockResolvedValue({ id: 'geo-1', active: true });

      const result = await service.activate('geo-1', 'user-1');

      expect(result.active).toBe(true);
      expect(prisma.geofence.update).toHaveBeenCalled();
    });

    it('al activar un cerco con animales asignados marca sus collares como pendientes', async () => {
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        farmId: 'farm-1',
        farm,
        active: false,
        polygonCoordinates: [
          [-34.55, -58.55],
          [-34.55, -58.45],
          [-34.45, -58.45],
        ],
      });
      prisma.animalGeofence.findMany.mockResolvedValue([{ animalId: 'a-1', animal: { tag: '001' } }]);
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 30, animalId: 'a-1' }]);
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 30, latitude: -34.5, longitude: -58.5 }]);
      prisma.geofence.update.mockResolvedValue({
        id: 'geo-1',
        active: true,
        animalGeofences: [{ animalId: 'a-1' }],
      });

      await service.activate('geo-1', 'user-1');

      expect(prisma.collar.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [30] } },
        data: { fenceNotificationPending: true },
      });
    });

    it('rechaza activar si el usuario no tiene acceso', async () => {
      prisma.geofence.findUnique.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', farm });
      prisma.farmUser.findFirst.mockResolvedValue(null);

      await expect(service.activate('geo-1', 'other-user')).rejects.toThrow();
    });
  });
});
