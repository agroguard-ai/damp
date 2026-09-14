import { NotFoundException } from '@nestjs/common';
import { IotService } from './iot.service';
import { ML_WINDOW_SIZE } from './ml-health.service';

function makePrismaMock() {
  return {
    collar: { findUnique: jest.fn(), update: jest.fn() },
    telemetryReading: { create: jest.fn(), findMany: jest.fn() },
    animalCollar: { findFirst: jest.fn() },
    animal: { findUnique: jest.fn() },
    animalGeofence: { findFirst: jest.fn() },
    alert: { findFirst: jest.fn(), create: jest.fn() },
  };
}

describe('IotService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let gatewaysService: { recordHeartbeat: jest.Mock };
  let alertSettingsService: { getEffective: jest.Mock };
  let mlHealthService: { predict: jest.Mock };
  let service: IotService;

  beforeEach(() => {
    prisma = makePrismaMock();
    gatewaysService = { recordHeartbeat: jest.fn() };
    alertSettingsService = {
      getEffective: jest.fn().mockResolvedValue({
        feverThreshold: 39.5,
        hypothermiaThreshold: 37.0,
        inactivityMinutes: 120,
      }),
    };
    mlHealthService = { predict: jest.fn() };

    service = new IotService(
      prisma as any,
      gatewaysService as any,
      alertSettingsService as any,
      mlHealthService as any
    );
  });

  describe('handleTelemetry', () => {
    it('throws NotFoundException when the collar does not exist', async () => {
      prisma.collar.findUnique.mockResolvedValue(null);

      await expect(service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it('returns downlink NONE when the collar has no animal assigned', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1 });
      prisma.telemetryReading.create.mockResolvedValue({});
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue(null);

      const result = await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any);

      expect(result).toEqual({ downlink: 'NONE' });
      expect(mlHealthService.predict).not.toHaveBeenCalled();
    });
  });

  describe('checkPredictiveHealth (via handleTelemetry)', () => {
    const baseSetup = () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1 });
      prisma.telemetryReading.create.mockResolvedValue({});
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue({
        animalId: 'animal-1',
        animal: { farmId: 'farm-1' },
      });
      prisma.animalGeofence.findFirst.mockResolvedValue(null);
      prisma.animal.findUnique.mockResolvedValue({ sex: 'FEMALE' });
      prisma.alert.findFirst.mockResolvedValue(null);
    };

    it('does not call ml-service when there is less history than the model window', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(
        Array.from({ length: ML_WINDOW_SIZE - 1 }, () => ({
          temperature: 38.5,
          latitude: 0,
          longitude: 0,
          timestamp: new Date(),
        }))
      );

      await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any);

      expect(mlHealthService.predict).not.toHaveBeenCalled();
    });

    it('calls ml-service with the last ML_WINDOW_SIZE readings in chronological order', async () => {
      baseSetup();
      const readings = Array.from({ length: ML_WINDOW_SIZE }, (_, i) => ({
        temperature: 38.5,
        latitude: i,
        longitude: 0,
        timestamp: new Date(2026, 0, 1, 0, i), // orden desc simulado (findMany pide desc)
      }));
      prisma.telemetryReading.findMany.mockResolvedValue([...readings].reverse());
      mlHealthService.predict.mockResolvedValue({ ready: false, events: {} });

      await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any);

      expect(mlHealthService.predict).toHaveBeenCalledTimes(1);
      const [animalId, sex, sentReadings] = mlHealthService.predict.mock.calls[0];
      expect(animalId).toBe('animal-1');
      expect(sex).toBe('FEMALE');
      expect(sentReadings).toHaveLength(ML_WINDOW_SIZE);
      expect(sentReadings[0].lat).toBe(0); // el más viejo primero (orden cronológico)
      expect(sentReadings[ML_WINDOW_SIZE - 1].lat).toBe(ML_WINDOW_SIZE - 1); // el más reciente último
    });

    it('creates a HEALTH alert with an [IA:EVENT] prefix for each detected event', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(
        Array.from({ length: ML_WINDOW_SIZE }, () => ({
          temperature: 38.5,
          latitude: 0,
          longitude: 0,
          timestamp: new Date(),
        }))
      );
      mlHealthService.predict.mockResolvedValue({
        ready: true,
        events: {
          fiebre: { probability: 0.91, threshold: 0.3, detected: true },
          celo: { probability: 0.1, threshold: 0.4, detected: false },
        },
      });

      await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any);

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('HEALTH');
      expect(data.message).toContain('[IA:FIEBRE]');
      expect(data.message).toContain('91%');
    });

    it('does not create a duplicate alert when an unresolved one with the same dedupeKey already exists', async () => {
      baseSetup();
      prisma.alert.findFirst.mockResolvedValue({ id: 'existing-alert' });
      prisma.telemetryReading.findMany.mockResolvedValue(
        Array.from({ length: ML_WINDOW_SIZE }, () => ({
          temperature: 38.5,
          latitude: 0,
          longitude: 0,
          timestamp: new Date(),
        }))
      );
      mlHealthService.predict.mockResolvedValue({
        ready: true,
        events: { fiebre: { probability: 0.9, threshold: 0.3, detected: true } },
      });

      await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 38 } as any);

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('threshold and AI-predicted alerts do not block each other', () => {
    it('still raises a [UMBRAL:FIEBRE] alert when an unresolved [IA:...] alert exists for the same animal', async () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1 });
      prisma.telemetryReading.create.mockResolvedValue({});
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue({
        animalId: 'animal-1',
        animal: { farmId: 'farm-1' },
      });
      prisma.animalGeofence.findFirst.mockResolvedValue(null);
      prisma.animal.findUnique.mockResolvedValue({ sex: 'MALE' });

      // Simula que ya existe una alerta [IA:...] sin resolver, pero ninguna [UMBRAL:FIEBRE]:
      // el dedupe está scoped por prefijo, así que debe poder crearse igual.
      prisma.alert.findFirst.mockImplementation(({ where }: any) =>
        where.message.startsWith === '[UMBRAL:FIEBRE]' ? Promise.resolve(null) : Promise.resolve({ id: 'ia-alert' })
      );
      prisma.telemetryReading.findMany.mockResolvedValue([]);

      await service.handleTelemetry({ collar_id: 1, lat: 0, lng: 0, temp: 40 } as any); // fiebre por umbral

      expect(prisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ message: expect.stringContaining('[UMBRAL:FIEBRE]') }),
        })
      );
    });
  });
});
