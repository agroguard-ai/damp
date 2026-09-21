import { ZonesService } from './zones.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    zone: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    geofence: {
      findMany: jest.fn(),
    },
  };
}

describe('ZonesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ZonesService;

  // Farm polygon: square between lat -35 to -34, lng -59 to -58
  const farmPolygon = [
    [-35.0, -59.0],
    [-35.0, -58.0],
    [-34.0, -58.0],
    [-34.0, -59.0],
  ];

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ZonesService(prisma as any);
  });

  describe('create — boundary validation', () => {
    it('crea la zona exitosamente si todos los puntos están dentro del polígono del campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });
      prisma.zone.create.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero 1',
        farmId: 'farm-1',
      });

      const result = await service.create(
        {
          name: 'Potrero 1',
          farmId: 'farm-1',
          polygonCoordinates: [
            [-34.5, -58.5],
            [-34.5, -58.2],
            [-34.2, -58.2],
          ],
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(prisma.zone.create).toHaveBeenCalled();
    });

    it('lanza BadRequestException si un punto está fuera de los límites del campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        polygonCoordinates: farmPolygon,
      });

      await expect(
        service.create(
          {
            name: 'Potrero Inválido',
            farmId: 'farm-1',
            polygonCoordinates: [
              [-34.5, -58.5],
              [-34.5, -58.2],
              [-36.0, -58.2], // Outside! Lat -36 is outside [-35, -34]
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);

      expect(prisma.zone.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el campo no existe', async () => {
      prisma.farm.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Potrero 1',
            farmId: 'farm-non-existent',
            polygonCoordinates: [[-34.5, -58.5], [-34.5, -58.2], [-34.2, -58.2]],
          },
          'user-1'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el campo pertenece a otro usuario', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'other-user',
      });

      await expect(
        service.create(
          {
            name: 'Potrero 1',
            farmId: 'farm-1',
            polygonCoordinates: [[-34.5, -58.5], [-34.5, -58.2], [-34.2, -58.2]],
          },
          'user-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update — geofence containment validation', () => {
    it('actualiza la zona exitosamente si sus cercos quedan dentro de la nueva geometría', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Zona 1',
        farm: { id: 'farm-1', userId: 'user-1', polygonCoordinates: farmPolygon },
      });
      prisma.geofence.findMany.mockResolvedValue([
        {
          id: 'fence-1',
          name: 'Cerco Pastura A',
          polygonCoordinates: [
            [-34.6, -58.6],
            [-34.6, -58.4],
            [-34.4, -58.4],
          ],
        },
      ]);
      prisma.zone.update.mockResolvedValue({ id: 'zone-1', name: 'Zona 1' });

      const result = await service.update(
        'zone-1',
        {
          polygonCoordinates: [
            [-34.8, -58.8],
            [-34.8, -58.2],
            [-34.2, -58.2],
            [-34.2, -58.8],
          ],
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(prisma.zone.update).toHaveBeenCalled();
    });

    it('lanza BadRequestException si al achicar la zona un cerco queda fuera', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Zona 1',
        farm: { id: 'farm-1', userId: 'user-1', polygonCoordinates: farmPolygon },
      });
      // Geofence is at lng -58.3
      prisma.geofence.findMany.mockResolvedValue([
        {
          id: 'fence-1',
          name: 'Cerco Pastura A',
          polygonCoordinates: [
            [-34.6, -58.3],
            [-34.6, -58.2],
            [-34.5, -58.2],
          ],
        },
      ]);

      // New smaller zone bounds lng between -58.8 and -58.5 (excluding -58.3)
      await expect(
        service.update(
          'zone-1',
          {
            polygonCoordinates: [
              [-34.8, -58.8],
              [-34.8, -58.5],
              [-34.2, -58.5],
              [-34.2, -58.8],
            ],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);

      expect(prisma.zone.update).not.toHaveBeenCalled();
    });
  });

  describe('findByFarm', () => {
    it('retorna las zonas del campo incluyendo geofences y conteos', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.zone.findMany.mockResolvedValue([{ id: 'z1', name: 'Zona 1' }]);

      const result = await service.findByFarm('farm-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(prisma.zone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { farmId: 'farm-1' },
          include: expect.objectContaining({
            geofences: expect.any(Object),
            _count: expect.any(Object),
          }),
        })
      );
    });
  });
});
