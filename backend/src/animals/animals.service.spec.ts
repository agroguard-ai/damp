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
    geofence: { findUnique: jest.fn(), findFirst: jest.fn() },
    collar: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    animalCollar: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    animalGeofence: { create: jest.fn(), createMany: jest.fn(), updateMany: jest.fn() },
    medicalEvent: { create: jest.fn() },
    telemetryReading: { findMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };
}

let prisma: any;

describe('AnimalsService', () => {
  let collarsServiceMock: any;
  let service: AnimalsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    collarsServiceMock = {
      assertAvailableForAssignment: jest.fn(),
    };
    service = new AnimalsService(prisma, collarsServiceMock);
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

    it('filtra por cerco virtual solo con asignaciones vigentes (CUU-029)', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([]);

      await service.findAll({ farmId: 'farm-1', geofenceId: 'geo-1' }, 'user-1');

      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            animalGeofences: { some: { geofenceId: 'geo-1', endAt: null } },
          }),
        })
      );
    });
  });

  describe('CU005 - Asignación y Reglas de Negocio', () => {
    it('rechaza asignar animal a cerco virtual si no tiene collar activo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        animalCollars: [],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });

      await expect(service.assignGeofence('animal-1', 'geo-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('permite asignar animal a cerco virtual si tiene collar activo', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        farmId: 'farm-1',
      });

      const res = await service.assignGeofence('animal-1', 'geo-1', 'user-1');
      expect(res.message).toContain('exitosamente');
      expect(prisma.animalGeofence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ animalId: 'animal-1', geofenceId: 'geo-1' }),
        })
      );
    });

    it('rechaza asignar a un cerco activo si el animal no tiene lectura GPS reciente', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: '001',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        farmId: 'farm-1',
        polygonCoordinates: [
          [-34.51, -58.51],
          [-34.51, -58.49],
          [-34.49, -58.49],
          [-34.49, -58.51],
        ],
      });
      prisma.telemetryReading.findMany.mockResolvedValue([]);

      await expect(service.assignGeofence('animal-1', 'geo-1', 'user-1')).rejects.toThrow(
        /1 animal no tiene lectura GPS en la última hora[\s\S]*desactivar el cerco/
      );
      expect(prisma.animalGeofence.create).not.toHaveBeenCalled();
    });

    it('rechaza asignar a un cerco activo si el animal está fuera del polígono', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: '001',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        farmId: 'farm-1',
        polygonCoordinates: [
          [-34.51, -58.51],
          [-34.51, -58.49],
          [-34.49, -58.49],
          [-34.49, -58.51],
        ],
      });
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.52, longitude: -58.5 }]);

      await expect(service.assignGeofence('animal-1', 'geo-1', 'user-1')).rejects.toThrow(/fuera del cerco/);
      expect(prisma.animalGeofence.create).not.toHaveBeenCalled();
    });

    it('rechaza asignar a un cerco activo si el animal está a menos de 25 m del borde', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: '001',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        farmId: 'farm-1',
        polygonCoordinates: [
          [-34.51, -58.51],
          [-34.51, -58.49],
          [-34.49, -58.49],
          [-34.49, -58.51],
        ],
      });
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.5099, longitude: -58.5 }]);

      await expect(service.assignGeofence('animal-1', 'geo-1', 'user-1')).rejects.toThrow(/25 m del borde/);
    });

    it('permite asignar a un cerco activo si el animal está dentro con margen', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: '001',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: true,
        farmId: 'farm-1',
        polygonCoordinates: [
          [-34.51, -58.51],
          [-34.51, -58.49],
          [-34.49, -58.49],
          [-34.49, -58.51],
        ],
      });
      prisma.telemetryReading.findMany.mockResolvedValue([{ collarId: 10, latitude: -34.5, longitude: -58.5 }]);

      const res = await service.assignGeofence('animal-1', 'geo-1', 'user-1');

      expect(res.message).toContain('exitosamente');
      expect(prisma.animalGeofence.create).toHaveBeenCalled();
    });

    it('permite asignar a un cerco inactivo sin validar posición ni notificar al collar', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: '001',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, endAt: null }],
        animalGeofences: [],
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findUnique.mockResolvedValue({
        id: 'geo-1',
        active: false,
        farmId: 'farm-1',
        polygonCoordinates: [
          [-34.51, -58.51],
          [-34.51, -58.49],
          [-34.49, -58.49],
          [-34.49, -58.51],
        ],
      });

      const res = await service.assignGeofence('animal-1', 'geo-1', 'user-1');

      expect(res.message).toContain('exitosamente');
      expect(prisma.telemetryReading.findMany).not.toHaveBeenCalled();
      expect(prisma.collar.updateMany).not.toHaveBeenCalled();
      expect(prisma.animalGeofence.create).toHaveBeenCalled();
    });

    it('bulkAssignGeofence no notifica collares si el cerco destino está inactivo', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findFirst.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', active: false });
      prisma.animal.findMany.mockResolvedValue([{ id: 'a1', tag: '001', animalCollars: [{ collarId: 10 }] }]);

      await service.bulkAssignGeofence({ farmId: 'farm-1', animalIds: ['a1'], geofenceId: 'geo-1' }, 'user-1');

      expect(prisma.animalGeofence.createMany).toHaveBeenCalled();
      expect(prisma.collar.updateMany).not.toHaveBeenCalled();
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

    it('bulkAssignGeofence asigna masivamente los animales de un campo a un cerco', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findFirst.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', active: true });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a1', tag: '001', animalCollars: [{ collarId: 10 }] },
        { id: 'a2', tag: '002', animalCollars: [{ collarId: 11 }] },
      ]);

      const res = await service.bulkAssignGeofence(
        { farmId: 'farm-1', animalIds: ['a1', 'a2'], geofenceId: 'geo-1' },
        'user-1'
      );

      expect(res.count).toBe(2);
      expect(prisma.animalGeofence.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ animalId: 'a1', geofenceId: 'geo-1' }),
          expect.objectContaining({ animalId: 'a2', geofenceId: 'geo-1' }),
        ],
      });
      expect(prisma.collar.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
        data: { fenceNotificationPending: true },
      });
    });

    it('bulkAssignGeofence rechaza animales sin collar activo', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.geofence.findFirst.mockResolvedValue({ id: 'geo-1', farmId: 'farm-1', active: true });
      prisma.animal.findMany.mockResolvedValue([{ id: 'a1', tag: '001', animalCollars: [] }]);

      await expect(
        service.bulkAssignGeofence({ farmId: 'farm-1', animalIds: ['a1'], geofenceId: 'geo-1' }, 'user-1')
      ).rejects.toThrow(BadRequestException);
      expect(prisma.animalGeofence.createMany).not.toHaveBeenCalled();
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

      const res = await service.update('animal-1', { tag: 'TAG-NEW', breed: 'Braford' }, 'user-1');

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

      await expect(service.update('animal-1', { tag: 'TAG-DUPLICADA' }, 'user-1')).rejects.toThrow(ConflictException);
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

  describe('CU010 - Seguimiento Histórico y Mapa de Calor', () => {
    it('obtiene el recorrido histórico ordenado cronológicamente para un animal', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        tag: 'TAG-1',
        breed: 'Angus',
        farmId: 'farm-1',
        animalCollars: [{ collarId: 10, startAt: new Date(), endAt: null }],
        animalType: { id: 't1', name: 'Bovino', species: 'Bovino' },
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.telemetryReading.findMany.mockResolvedValue([
        { id: 'r1', latitude: -34.5, longitude: -58.5, temperature: 38.5, timestamp: new Date('2026-02-01T10:00:00Z') },
        { id: 'r2', latitude: -34.6, longitude: -58.6, temperature: 38.7, timestamp: new Date('2026-02-01T11:00:00Z') },
      ]);

      const res = await service.getAnimalTrajectory('animal-1', 'user-1', '2026-02-01', '2026-02-02');

      expect(res.totalPoints).toBe(2);
      expect(res.points[0].latitude).toBe(-34.5);
      expect(prisma.telemetryReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ collarId: { in: [10] } }),
          orderBy: { timestamp: 'asc' },
        })
      );
    });

    it('devuelve array vacío si el animal nunca tuvo collares asignados', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-2',
        tag: 'TAG-2',
        breed: 'Hereford',
        farmId: 'farm-1',
        animalCollars: [],
        animalType: null,
      });
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });

      const res = await service.getAnimalTrajectory('animal-2', 'user-1');

      expect(res.totalPoints).toBe(0);
      expect(res.points).toEqual([]);
      expect(prisma.telemetryReading.findMany).not.toHaveBeenCalled();
    });

    it('obtiene puntos para el mapa de calor del campo', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animalCollar.findMany.mockResolvedValue([
        { collarId: 10, startAt: new Date('2026-01-01'), endAt: null },
        { collarId: 20, startAt: new Date('2026-01-01'), endAt: null },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { latitude: -34.5, longitude: -58.5 },
        { latitude: -34.501, longitude: -58.502 },
      ]);

      const res = await service.getFarmHeatmap('farm-1', 'user-1', 7);

      expect(res.totalPoints).toBe(2);
      expect(prisma.telemetryReading.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ farmId: 'farm-1' }),
        })
      );
    });

    it('atribuye on-demand lecturas viejas sin farmId usando el vínculo animal-collar', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animalCollar.findMany.mockResolvedValue([
        { collarId: 10, startAt: new Date('2026-01-01'), endAt: new Date('2026-06-01') },
      ]);
      prisma.telemetryReading.findMany
        .mockResolvedValueOnce([
          { id: 'r-1', collarId: 10, timestamp: new Date('2026-03-01') },
          { id: 'r-2', collarId: 10, timestamp: new Date('2026-07-01') },
        ])
        .mockResolvedValueOnce([]);

      await service.getFarmHeatmap('farm-1', 'user-1', 7);

      expect(prisma.telemetryReading.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['r-1'] }, farmId: null },
        data: { farmId: 'farm-1' },
      });
    });
  });

  describe('bulkTransferFarm — sin cambios sobre cercos virtuales', () => {
    it('mueve los animales al campo destino sin tocar sus asignaciones a cercos', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1', isActive: true, farmUsers: [] });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'animal-1', farmId: 'farm-1', animalCollars: [{ collarId: 10 }] },
      ]);

      const res = await service.bulkTransferFarm(
        { sourceFarmId: 'farm-1', targetFarmId: 'farm-2', animalIds: ['animal-1'] },
        'user-1'
      );

      expect(res.count).toBe(1);
      expect(prisma.animalGeofence.updateMany).not.toHaveBeenCalled();
      expect(prisma.animal.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['animal-1'] } },
        data: { farmId: 'farm-2', ownerId: 'user-1' },
      });
    });
  });
});
