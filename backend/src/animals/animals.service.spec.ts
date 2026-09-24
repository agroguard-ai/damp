import { AnimalsService } from './animals.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

function makePrismaMock() {
  return {
    farm: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    farmUser: { findUnique: jest.fn() },
    animal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    animalType: { findUnique: jest.fn() },
    zone: { findFirst: jest.fn(), findUnique: jest.fn() },
    geofence: { findUnique: jest.fn() },
    collar: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    animalCollar: { create: jest.fn(), updateMany: jest.fn() },
    animalGeofence: { create: jest.fn(), updateMany: jest.fn() },
    medicalEvent: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };
}

let prisma: ReturnType<typeof makePrismaMock>;

describe('AnimalsService', () => {
  let collarsServiceMock: any;
  let service: AnimalsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    collarsServiceMock = {
      assertAvailableForAssignment: jest.fn(),
    };
    service = new AnimalsService(prisma as any, collarsServiceMock);
  });

  describe('findAll — filtro hasActiveAlert', () => {
    it('agrega el filtro de alertas sin resolver cuando hasActiveAlert=true', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', hasActiveAlert: 'true' }, 'user-1');

      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ alerts: { some: { isResolved: false } } }),
        })
      );
    });

    it('no agrega el filtro de alertas cuando no se pide', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1' }, 'user-1');

      const [{ where }] = prisma.animal.findMany.mock.calls[0];
      expect(where.alerts).toBeUndefined();
    });

    it('agrega el filtro de collares activos cuando hasCollar=true', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', hasCollar: 'true' }, 'user-1');

      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ animalCollars: { some: { endAt: null } } }),
        })
      );
    });

    it('agrega el filtro de animales sin collar cuando hasCollar=false', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', hasCollar: 'false' }, 'user-1');

      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ animalCollars: { none: { endAt: null } } }),
        })
      );
    });
  });

  describe('CU005 - Asignación y Reglas de Negocio', () => {
    it('rechaza asignar animal a cerco virtual si no tiene collar activo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        zoneId: 'zone-1',
        animalCollars: [], // SIN COLLAR
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });

      await expect(service.assignGeofence('animal-1', 'geo-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('permite asignar animal a cerco virtual si tiene collar activo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        zoneId: 'zone-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        zoneId: 'zone-1',
        zone: { farmId: 'farm-1', name: 'Potrero 1' },
      });

      const res = await service.assignGeofence('animal-1', 'geo-1', 'user-1');
      expect(res.message).toContain('exitosamente');
      expect(prisma.animalGeofence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ animalId: 'animal-1', geofenceId: 'geo-1' }),
        })
      );
    });

    it('al desvincular un collar, cierra automáticamente cualquier cerco virtual activo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        animalCollars: [{ id: 'ac-1', endAt: null }],
        animalGeofences: [{ id: 'ag-1', endAt: null }],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });

      const res = await service.unlinkCollar('animal-1', 'user-1');
      expect(res.message).toContain('desvinculado');
      expect(prisma.animalCollar.updateMany).toHaveBeenCalled();
      expect(prisma.animalGeofence.updateMany).toHaveBeenCalled();
    });

    it('bulkAssignZone actualiza masivamente los animales de un campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.zone.findFirst.mockResolvedValue({ id: 'zone-1', farmId: 'farm-1' });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a1', animalGeofences: [] },
        { id: 'a2', animalGeofences: [] },
      ]);

      const res = await service.bulkAssignZone(
        { farmId: 'farm-1', animalIds: ['a1', 'a2'], zoneId: 'zone-1' },
        'user-1'
      );

      expect(res.count).toBe(2);
      expect(prisma.animal.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a1', 'a2'] } },
        data: { zoneId: 'zone-1' },
      });
    });
  });

  describe('CU007 - Gestión y Edición de Animales', () => {
    it('actualiza correctamente los datos generales del animal', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        tag: 'TAG-OLD',
        breed: 'Angus',
        weightKg: 400,
        animalCollars: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findFirst.mockResolvedValue(null);
      prisma.animal.update.mockResolvedValue({
        id: 'animal-1',
        tag: 'TAG-NEW',
        breed: 'Braford',
      });

      const res = await service.update(
        'animal-1',
        { tag: 'TAG-NEW', breed: 'Braford' },
        'user-1'
      );

      expect(res.message).toContain('exitosamente');
      expect(prisma.animal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'animal-1' },
          data: expect.objectContaining({ tag: 'TAG-NEW', breed: 'Braford' }),
        })
      );
    });

    it('lanza ConflictException si la caravana ya está en uso por otro animal activo del campo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        tag: 'TAG-1',
        animalCollars: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findFirst.mockResolvedValue({ id: 'animal-2', tag: 'TAG-DUPLICADA' });

      await expect(
        service.update('animal-1', { tag: 'TAG-DUPLICADA' }, 'user-1')
      ).rejects.toThrow(ConflictException);
    });

    it('registra automáticamente un evento clínico WEIGHING cuando se modifica el peso', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        tag: 'TAG-1',
        weightKg: 380,
        animalCollars: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findFirst.mockResolvedValue(null);
      prisma.animal.update.mockResolvedValue({ id: 'animal-1', weightKg: 415 });

      await service.update('animal-1', { weightKg: 415 }, 'user-1');

      expect(prisma.medicalEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            animalId: 'animal-1',
            type: 'WEIGHING',
            value: 415,
          }),
        })
      );
    });
  });
});
