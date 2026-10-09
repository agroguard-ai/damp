import { ZoneRotationsService } from './zone-rotations.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function makePrismaMock() {
  return {
    farm: { findUnique: jest.fn() },
    zone: { findUnique: jest.fn() },
    animal: { findMany: jest.fn() },
    collar: { updateMany: jest.fn() },
    geofence: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    zoneRotationPlan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    zoneRotationStep: {
      update: jest.fn(),
    },
    animalGeofence: {
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    telemetryReading: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(makePrismaMock())),
  };
}

describe('ZoneRotationsService (CU012)', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ZoneRotationsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.$transaction = jest.fn(async (cb) => cb(prisma));
    service = new ZoneRotationsService(prisma as any);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('createRotation', () => {
    it('falla con BadRequestException si no hay animales asignados a la zona (Precondición)', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero Norte',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.animal.findMany.mockResolvedValue([]); // 0 animales

      await expect(
        service.createRotation(
          'zone-1',
          {
            frequencyHours: 24,
            geofenceIds: ['geo-1', 'geo-2'],
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('falla con BadRequestException si se define un solo perímetro (Camino Alternativo 1)', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero Norte',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'animal-1', zoneId: 'zone-1', animalCollars: [{ collarId: 10 }] },
      ]);

      await expect(
        service.createRotation(
          'zone-1',
          {
            frequencyHours: 24,
            geofenceIds: ['geo-1'], // Solo 1 perímetro
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el plan de rotación y activa el paso 0 asignando los animales con collar', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'Potrero Norte',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.animal.findMany.mockResolvedValue([
        { id: 'animal-1', zoneId: 'zone-1', animalCollars: [{ collarId: 10 }] },
        { id: 'animal-2', zoneId: 'zone-1', animalCollars: [{ collarId: 11 }] },
      ]);
      prisma.geofence.findMany.mockResolvedValue([
        { id: 'geo-1', zoneId: 'zone-1', name: 'Cerco A' },
        { id: 'geo-2', zoneId: 'zone-1', name: 'Cerco B' },
      ]);

      const mockPlan = {
        id: 'plan-1',
        zoneId: 'zone-1',
        status: 'ACTIVE',
        frequencyHours: 12,
        currentStepIndex: 0,
        totalSteps: 2,
        steps: [
          { id: 'step-1', geofenceId: 'geo-1', orderIndex: 0, status: 'ACTIVE' },
          { id: 'step-2', geofenceId: 'geo-2', orderIndex: 1, status: 'PENDING' },
        ],
      };
      prisma.zoneRotationPlan.create.mockResolvedValue(mockPlan);

      const result = await service.createRotation(
        'zone-1',
        {
          name: 'Rotación Verano',
          frequencyHours: 12,
          geofenceIds: ['geo-1', 'geo-2'],
        },
        'user-1'
      );

      expect(result).toEqual(mockPlan);
      expect(prisma.geofence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'geo-1' },
          data: expect.objectContaining({ active: true }),
        })
      );
      expect(prisma.animalGeofence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({ animalId: 'animal-1', geofenceId: 'geo-1' }),
            expect.objectContaining({ animalId: 'animal-2', geofenceId: 'geo-1' }),
          ],
        })
      );
    });
  });

  describe('advanceRotation (Camino Alternativo 2: adelantar manualmente)', () => {
    it('avanza al siguiente cerco sin romper el calendario y actualiza la asignación de animales', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });

      const currentPlan = {
        id: 'plan-1',
        zoneId: 'zone-1',
        status: 'ACTIVE',
        frequencyHours: 24,
        currentStepIndex: 0,
        totalSteps: 2,
        steps: [
          { id: 'step-1', geofenceId: 'geo-1', orderIndex: 0, status: 'ACTIVE' },
          { id: 'step-2', geofenceId: 'geo-2', orderIndex: 1, status: 'PENDING' },
        ],
        zone: { id: 'zone-1' },
      };

      prisma.zoneRotationPlan.findFirst.mockResolvedValue(currentPlan);
      prisma.zoneRotationPlan.findUnique.mockResolvedValue(currentPlan);
      prisma.animal.findMany.mockResolvedValue([
        { id: 'a1', zoneId: 'zone-1', animalCollars: [{ collarId: 10 }] },
      ]);
      prisma.zoneRotationPlan.update.mockResolvedValue({
        ...currentPlan,
        currentStepIndex: 1,
      });

      const res = await service.advanceRotation('zone-1', 'user-1');

      expect(res).toBeDefined();
      expect(prisma.zoneRotationStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
      expect(prisma.zoneRotationStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-2' },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });
  });

  describe('postponeRotation (Camino Alternativo 2: posponer manualmente)', () => {
    it('pospone la próxima rotación por las horas indicadas', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });

      const now = new Date();
      const currentNext = new Date(now.getTime() + 5 * 3600 * 1000);
      prisma.zoneRotationPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        zoneId: 'zone-1',
        status: 'ACTIVE',
        nextRotationAt: currentNext,
      });
      prisma.zoneRotationPlan.update.mockImplementation(({ data }) =>
        Promise.resolve({ nextRotationAt: data.nextRotationAt })
      );

      const res = await service.postponeRotation('zone-1', { hours: 3 }, 'user-1');

      expect(res.message).toContain('3 hora(s)');
      expect(prisma.zoneRotationPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({
            nextRotationAt: new Date(currentNext.getTime() + 3 * 3600 * 1000),
          }),
        })
      );
    });
  });

  describe('getRotation', () => {
    it('retorna plan null si la zona no tiene rotaciones configuradas', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.zoneRotationPlan.findFirst.mockResolvedValue(null);

      const result = await service.getRotation('zone-1', 'user-1');

      expect(result.plan).toBeNull();
    });

    it('retorna estado con fromGeofence, currentGeofence y nextGeofence', async () => {
      prisma.zone.findUnique.mockResolvedValue({
        id: 'zone-1',
        farmId: 'farm-1',
        farm: { id: 'farm-1', userId: 'user-1' },
      });
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm-1',
        userId: 'user-1',
        isActive: true,
      });

      const geoA = { id: 'geo-1', name: 'Cerco 1' };
      const geoB = { id: 'geo-2', name: 'Cerco 2' };
      const geoC = { id: 'geo-3', name: 'Cerco 3' };

      prisma.zoneRotationPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        zoneId: 'zone-1',
        status: 'ACTIVE',
        currentStepIndex: 1, // En el paso 1 (Cerco 2)
        totalSteps: 3,
        frequencyHours: 24,
        startedAt: new Date(Date.now() - 30 * 3600 * 1000),
        nextRotationAt: new Date(Date.now() + 18 * 3600 * 1000),
        steps: [
          { orderIndex: 0, geofence: geoA },
          { orderIndex: 1, geofence: geoB },
          { orderIndex: 2, geofence: geoC },
        ],
      });

      prisma.animal.findMany.mockResolvedValue([
        {
          id: 'a1',
          tag: 'CAR-01',
          animalCollars: [{ collarId: 101 }],
        },
      ]);
      prisma.telemetryReading.findMany.mockResolvedValue([
        { latitude: -34.5, longitude: -58.5 },
      ]);

      const result = await service.getRotation('zone-1', 'user-1');

      expect(result.fromGeofence).toEqual(geoA); // Desde dónde partió
      expect(result.currentGeofence).toEqual(geoB); // Dónde está ahora
      expect(result.nextGeofence).toEqual(geoC); // A dónde va
      expect(result.heatmapPoints).toHaveLength(1);
    });
  });

  describe('resolveActiveCoordinatesForAnimal (Gradual 5-min transitions for LoRa telemetry)', () => {
    it('calcula y devuelve el polígono intermedio correspondiente a la ventana de 5 min actual', async () => {
      const poly1: [number, number][] = [
        [-34.1, -58.1],
        [-34.1, -58.2],
        [-34.2, -58.2],
        [-34.2, -58.1],
      ];
      const poly2: [number, number][] = [
        [-34.3, -58.3],
        [-34.3, -58.4],
        [-34.4, -58.4],
        [-34.4, -58.3],
      ];

      // Plan activo iniciado hace 15 minutos (paso 3 de 5 min para una frecuencia de 1 hora = 12 pasos)
      const lastRotatedAt = new Date(Date.now() - 15 * 60 * 1000);
      const nextRotationAt = new Date(Date.now() + 45 * 60 * 1000);

      prisma.zoneRotationPlan.findFirst.mockResolvedValue({
        id: 'plan-rot',
        zoneId: 'zone-1',
        status: 'ACTIVE',
        frequencyHours: 1, // 60 min -> 12 pasos de 5 min
        lastRotatedAt,
        nextRotationAt,
        currentStepIndex: 0,
        autoRotate: true,
        steps: [
          {
            orderIndex: 0,
            geofence: { id: 'g1', name: 'Cerco Inicial', polygonCoordinates: JSON.stringify(poly1) },
          },
          {
            orderIndex: 1,
            geofence: { id: 'g2', name: 'Cerco Destino', polygonCoordinates: JSON.stringify(poly2) },
          },
        ],
      });

      const result = await service.resolveActiveCoordinatesForAnimal('animal-1', 'zone-1');

      expect(result).not.toBeNull();
      expect(result?.polygon).toBeDefined();
      expect(result?.polygon.length).toBe(4);
      // El paso a los 15 min es el paso 3 (15/5 = 3), fracción 3/12 = 0.25 (25% hacia Cerco 2)
      // Vértice 0: -34.1 + 0.25 * (-34.3 - (-34.1)) = -34.1 - 0.05 = -34.15
      expect(result?.polygon[0][0]).toBeCloseTo(-34.15, 2);
      expect((result as any).transition).toBeDefined();
      expect((result as any).transition.current5MinStep).toBe(4); // Paso 4 en base 1
      expect((result as any).transition.total5MinSteps).toBe(12);
      expect((result as any).transition.progressPercent).toBe(25);
    });
  });
});
