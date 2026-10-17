import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';

function makePrismaMock() {
  return {
    farm: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    alert: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    healthPrediction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    animalCollar: { findMany: jest.fn() },
    telemetryReading: { findMany: jest.fn() },
  };
}

describe('AlertsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AlertsService;
  let mlHealthService: { status: jest.Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.farm.findMany.mockResolvedValue([{ id: 'farm-1' }]);
    mlHealthService = { status: jest.fn() };
    service = new AlertsService(prisma as any, mlHealthService as any);
  });

  describe('markFalsePositive', () => {
    it('throws NotFoundException when alert does not exist', async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      await expect(service.markFalsePositive('alert-1', 'user-1', 'Nota')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user has no access to the farm', async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        animal: {
          farm: {
            userId: 'other-user',
            farmUsers: [],
          },
        },
      });

      await expect(service.markFalsePositive('alert-1', 'user-1', 'Nota')).rejects.toThrow(ForbiddenException);
    });

    it('updates alert as false positive with feedback note and resolves it', async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        animal: {
          farm: {
            userId: 'user-1',
            farmUsers: [],
          },
        },
      });
      prisma.alert.update.mockResolvedValue({
        id: 'alert-1',
        isFalsePositive: true,
        isResolved: true,
        feedbackNote: 'Falsa alarma de celo',
      });

      const result = await service.markFalsePositive('alert-1', 'user-1', 'Falsa alarma de celo');

      expect(prisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({
            isFalsePositive: true,
            isResolved: true,
            feedbackNote: 'Falsa alarma de celo',
            feedbackUserId: 'user-1',
          }),
        })
      );
      expect(result.isFalsePositive).toBe(true);
    });
  });

  describe('getHealthPredictions', () => {
    it('verifies farm access and fetches predictions', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.healthPrediction.findMany.mockResolvedValue([
        { id: 'pred-1', predictedEvent: 'celo', probability: 0.25, detected: false },
      ]);

      const result = await service.getHealthPredictions('user-1', 'farm-1', undefined, 20);

      expect(prisma.farm.findFirst).toHaveBeenCalled();
      expect(prisma.healthPrediction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { animal: { farmId: 'farm-1' } },
          take: 20,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getMlPerformanceMetrics', () => {
    it('calculates metrics correctly including field precision rate', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.alert.count
        .mockResolvedValueOnce(10) // totalMlAlerts
        .mockResolvedValueOnce(2); // falsePositives
      prisma.healthPrediction.count.mockResolvedValue(100);
      prisma.healthPrediction.groupBy.mockResolvedValue([
        { predictedEvent: 'fiebre', detected: true, _count: { _all: 8 } },
      ]);

      const metrics = await service.getMlPerformanceMetrics('user-1', 'farm-1');

      expect(metrics.totalMlAlerts).toBe(10);
      expect(metrics.falsePositives).toBe(2);
      expect(metrics.truePositives).toBe(8);
      expect(metrics.fieldPrecision).toBe(80.0);
      expect(metrics.totalPredictions).toBe(100);
    });
  });

  describe('findAll filters', () => {
    it('filters by source ML', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.alert.findMany.mockResolvedValue([]);

      await service.findAll('user-1', { farmId: 'farm-1', source: 'ML' });

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            message: { contains: '[IA:' },
          }),
        })
      );
    });

    it('filters by isFalsePositive flag', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.alert.findMany.mockResolvedValue([]);

      await service.findAll('user-1', { farmId: 'farm-1', isFalsePositive: true });

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isFalsePositive: true,
          }),
        })
      );
    });
  });

  describe('getCurrentMlRisk', () => {
    it('devuelve, por animal, el evento detectado con mayor probabilidad (uno por evento)', async () => {
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1' });
      const createdAt = new Date();
      // findMany viene ordenado por probabilidad desc
      prisma.healthPrediction.findMany.mockResolvedValue([
        { animalId: 'a1', predictedEvent: 'fiebre', probability: 0.97, createdAt },
        { animalId: 'a1', predictedEvent: 'fiebre', probability: 0.8, createdAt },
        { animalId: 'a1', predictedEvent: 'celo', probability: 0.6, createdAt },
        { animalId: 'a2', predictedEvent: 'anomalia', probability: 0.55, createdAt },
      ]);

      const risk = await service.getCurrentMlRisk('user-1', 'farm-1');

      expect(risk).toEqual([
        {
          animalId: 'a1',
          events: [
            { event: 'fiebre', probability: 0.97, createdAt },
            { event: 'celo', probability: 0.6, createdAt },
          ],
        },
        { animalId: 'a2', events: [{ event: 'anomalia', probability: 0.55, createdAt }] },
      ]);
      expect(prisma.healthPrediction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ detected: true, animal: { farmId: 'farm-1' } }) })
      );
    });

    it('rechaza si el usuario no tiene acceso al campo', async () => {
      prisma.farm.findFirst.mockResolvedValue(null);
      await expect(service.getCurrentMlRisk('user-1', 'farm-x')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPredictionInputs', () => {
    it('reconstruye los 48 bloques de la ventana que analizó el modelo', async () => {
      const windowEnd = new Date('2026-10-13T15:00:00Z');
      prisma.healthPrediction.findUnique.mockResolvedValue({
        id: 'pred-1',
        animalId: 'a1',
        predictedEvent: 'fiebre',
        probability: 0.9,
        threshold: 0.3,
        detected: true,
        windowEndAt: windowEnd,
        createdAt: windowEnd,
        animal: { id: 'a1', tag: '001', farmId: 'farm-1' },
      });
      prisma.farm.findFirst.mockResolvedValue({ id: 'farm-1' });
      prisma.animalCollar.findMany.mockResolvedValue([{ collarId: 7 }]);
      prisma.telemetryReading.findMany.mockResolvedValue([
        { temperature: 40.2, latitude: -34, longitude: -58, timestamp: new Date('2026-10-13T14:40:00Z') },
      ]);

      const result = await service.getPredictionInputs('user-1', 'pred-1');

      expect(result.blocks).toHaveLength(48);
      expect(result.blocksWithData).toBe(1);
      expect(result.blocks[47]).toEqual({
        timestamp: '2026-10-13T11:30:00-03:00',
        temperature: 40.2,
        distanceMeters: 0,
        hasData: true,
      });
      expect(result.blocks[0].hasData).toBe(false); // rellenado (bfill)
      expect(prisma.telemetryReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ collarId: { in: [7] } }) })
      );
    });

    it('lanza NotFoundException si la predicción no existe', async () => {
      prisma.healthPrediction.findUnique.mockResolvedValue(null);
      await expect(service.getPredictionInputs('user-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});
