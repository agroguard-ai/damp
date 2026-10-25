import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IotService } from './iot.service';
import { ML_WINDOW_BLOCKS, ML_MIN_BLOCKS_WITH_DATA } from './ml-window';

function makePrismaMock() {
  return {
    collar: { findUnique: jest.fn(), update: jest.fn() },
    telemetryReading: { create: jest.fn(), findMany: jest.fn() },
    animalCollar: { findFirst: jest.fn() },
    animal: { findUnique: jest.fn() },
    animalGeofence: { findFirst: jest.fn() },
    alert: { findFirst: jest.fn(), create: jest.fn() },
    healthPrediction: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
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

    it('returns rotated downlink coordinates when animal farm has active rotation', async () => {
      const rotationsService = {
        resolveActiveCoordinatesForAnimal: jest.fn().mockResolvedValue({
          polygon: [
            [-34.1, -58.1],
            [-34.1, -58.2],
            [-34.2, -58.2],
          ],
          geofenceName: 'Cerco Rotado Paso 2',
        }),
      };

      const customService = new IotService(
        prisma as any,
        gatewaysService as any,
        alertSettingsService as any,
        mlHealthService as any,
        rotationsService as any
      );

      prisma.collar.findUnique.mockResolvedValue({ id: 1, fenceNotificationPending: true });
      prisma.telemetryReading.create.mockResolvedValue({});
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue({
        animalId: 'animal-1',
        animal: { farmId: 'farm-1' },
      });
      prisma.animal.findUnique.mockResolvedValue({ sex: 'FEMALE' });
      prisma.telemetryReading.findMany.mockResolvedValue([]);
      prisma.alert.findFirst.mockResolvedValue(null);

      const result = await customService.handleTelemetry({
        collar_id: 1,
        lat: -34.15,
        lng: -58.15,
        temp: 38.5,
      } as any);

      expect(rotationsService.resolveActiveCoordinatesForAnimal).toHaveBeenCalledWith('animal-1', 'farm-1');
      expect(result.downlink).toBe('-34.10000,-58.10000;-34.10000,-58.20000;-34.20000,-58.20000');
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          fenceNotificationPending: false,
          lastFenceSyncedAt: expect.any(Date),
        }),
      });
    });

    it('returns downlink NONE when fenceNotificationPending is false', async () => {
      const rotationsService = {
        resolveActiveCoordinatesForAnimal: jest.fn().mockResolvedValue({
          polygon: [
            [-34.1, -58.1],
            [-34.1, -58.2],
            [-34.2, -58.2],
          ],
          geofenceName: 'Cerco Rotado Paso 2',
        }),
      };

      const customService = new IotService(
        prisma as any,
        gatewaysService as any,
        alertSettingsService as any,
        mlHealthService as any,
        rotationsService as any
      );

      prisma.collar.findUnique.mockResolvedValue({ id: 1, fenceNotificationPending: false });
      prisma.telemetryReading.create.mockResolvedValue({});
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue({
        animalId: 'animal-1',
        animal: { farmId: 'farm-1' },
      });
      prisma.animal.findUnique.mockResolvedValue({ sex: 'FEMALE' });
      prisma.telemetryReading.findMany.mockResolvedValue([]);
      prisma.alert.findFirst.mockResolvedValue(null);

      const result = await customService.handleTelemetry({
        collar_id: 1,
        lat: -34.15,
        lng: -58.15,
        temp: 38.5,
      } as any);

      expect(result.downlink).toBe('NONE');
    });
  });

  describe('timestamp simulado (solo con ALLOW_SIMULATED_TIMESTAMPS=true)', () => {
    const original = process.env.ALLOW_SIMULATED_TIMESTAMPS;
    afterEach(() => {
      process.env.ALLOW_SIMULATED_TIMESTAMPS = original;
    });

    const setup = () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1 });
      prisma.telemetryReading.create.mockImplementation(({ data }: any) => Promise.resolve(data));
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue(null);
    };

    it('rechaza un timestamp en el payload si el backend no está en modo simulación', async () => {
      delete process.env.ALLOW_SIMULATED_TIMESTAMPS;
      setup();

      await expect(
        service.handleTelemetry({
          collar_id: 1,
          lat: -34,
          lng: -58,
          temp: 38,
          timestamp: '2026-10-12T10:00:00Z',
        } as any)
      ).rejects.toThrow(BadRequestException);
      expect(prisma.telemetryReading.create).not.toHaveBeenCalled();
    });

    it('guarda la lectura con el timestamp indicado cuando la simulación está habilitada', async () => {
      process.env.ALLOW_SIMULATED_TIMESTAMPS = 'true';
      setup();

      await service.handleTelemetry({
        collar_id: 1,
        lat: -34,
        lng: -58,
        temp: 38,
        timestamp: '2026-10-12T10:00:00Z',
      } as any);

      expect(prisma.telemetryReading.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ timestamp: new Date('2026-10-12T10:00:00Z') }),
      });
      expect(prisma.collar.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastTelemetryDate: new Date('2026-10-12T10:00:00Z') },
      });
    });
  });

  describe('checkPredictiveHealth (via handleTelemetry, en segundo plano)', () => {
    const BLOCK_MS = 30 * 60 * 1000;
    // 15:10 UTC = 12:10 hora local (UTC-3): el último bloque completo termina a las 12:00 local = 15:00 UTC
    const anchor = new Date('2026-10-13T15:10:00Z');
    const windowEnd = new Date('2026-10-13T15:00:00Z');

    /** Una lectura cada 30 min (5 min después del inicio de cada bloque), para los últimos `blocks` bloques. */
    const makeReadings = (blocks: number, overrides: Partial<{ temperature: number }> = {}) =>
      Array.from({ length: blocks }, (_, i) => ({
        temperature: overrides.temperature ?? 38.5,
        latitude: -34 + i * 0.001, // ~111 m por bloque
        longitude: -58,
        timestamp: new Date(windowEnd.getTime() - (blocks - i) * BLOCK_MS + 5 * 60 * 1000),
      }));

    const baseSetup = () => {
      prisma.collar.findUnique.mockResolvedValue({ id: 1 });
      prisma.telemetryReading.create.mockResolvedValue({ timestamp: anchor });
      prisma.collar.update.mockResolvedValue({});
      prisma.animalCollar.findFirst.mockResolvedValue({
        animalId: 'animal-1',
        animal: { farmId: 'farm-1' },
      });
      prisma.animalGeofence.findFirst.mockResolvedValue(null);
      prisma.animal.findUnique.mockResolvedValue({ sex: 'FEMALE' });
      prisma.alert.findFirst.mockResolvedValue(null);
    };

    const runTelemetry = async () => {
      await service.handleTelemetry({ collar_id: 1, lat: -34, lng: -58, temp: 38 } as any);
      await service.predictiveHealthRun;
    };

    it('does not call ml-service when the window has fewer blocks with data than the minimum', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_MIN_BLOCKS_WITH_DATA - 1));

      await runTelemetry();

      expect(mlHealthService.predict).not.toHaveBeenCalled();
    });

    it('sends 48 blocks of 30 min in farm local time, chronological, with distance per block', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_WINDOW_BLOCKS));
      mlHealthService.predict.mockResolvedValue({ ready: false, events: {} });

      await runTelemetry();

      expect(mlHealthService.predict).toHaveBeenCalledTimes(1);
      const [animalId, sex, blocks] = mlHealthService.predict.mock.calls[0];
      expect(animalId).toBe('animal-1');
      expect(sex).toBe('FEMALE');
      expect(blocks).toHaveLength(ML_WINDOW_BLOCKS);
      // primer bloque: 24 h antes del fin de la ventana, en hora local con offset explícito
      expect(blocks[0].timestamp).toBe('2026-10-12T12:00:00-03:00');
      expect(blocks[ML_WINDOW_BLOCKS - 1].timestamp).toBe('2026-10-13T11:30:00-03:00');
      expect(blocks[0].distance_m).toBe(0); // no hay lectura previa a la ventana
      expect(blocks[1].distance_m).toBeGreaterThan(100); // ~111 m entre bloques consecutivos
    });

    it('creates a HEALTH alert with an [IA:EVENT] prefix and stores every prediction with its window', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_WINDOW_BLOCKS));
      mlHealthService.predict.mockResolvedValue({
        ready: true,
        events: {
          fiebre: { probability: 0.91, threshold: 0.3, detected: true },
          celo: { probability: 0.1, threshold: 0.4, detected: false },
        },
      });
      prisma.alert.create.mockResolvedValue({ id: 'alert-123' });

      await runTelemetry();

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('HEALTH');
      expect(data.message).toContain('[IA:FIEBRE]');
      expect(data.message).toContain('91%');

      // CU014: Ambas predicciones (alta certeza y baja certeza) se persisten
      expect(prisma.healthPrediction.create).toHaveBeenCalledTimes(2);
      expect(prisma.healthPrediction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          animalId: 'animal-1',
          predictedEvent: 'fiebre',
          detected: true,
          alertId: 'alert-123',
          windowEndAt: windowEnd,
          windowReadingsCount: ML_WINDOW_BLOCKS,
        }),
      });
      expect(prisma.healthPrediction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ predictedEvent: 'celo', detected: false, alertId: null }),
      });
    });

    it('does not predict twice for the same window', async () => {
      baseSetup();
      prisma.healthPrediction.findFirst.mockResolvedValue({ id: 'already' });
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_WINDOW_BLOCKS));

      await runTelemetry();

      expect(prisma.healthPrediction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { animalId: 'animal-1', windowEndAt: windowEnd } })
      );
      expect(mlHealthService.predict).not.toHaveBeenCalled();
    });

    it('does not create a duplicate alert when an unresolved one with the same dedupeKey already exists', async () => {
      baseSetup();
      prisma.alert.findFirst.mockResolvedValue({ id: 'existing-alert' });
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_WINDOW_BLOCKS));
      mlHealthService.predict.mockResolvedValue({
        ready: true,
        events: { fiebre: { probability: 0.9, threshold: 0.3, detected: true } },
      });

      await runTelemetry();

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('does not delay the downlink response: telemetry returns even if ml-service never answers', async () => {
      baseSetup();
      prisma.telemetryReading.findMany.mockResolvedValue(makeReadings(ML_WINDOW_BLOCKS));
      mlHealthService.predict.mockReturnValue(new Promise(() => {})); // nunca responde

      const result = await service.handleTelemetry({ collar_id: 1, lat: -34, lng: -58, temp: 38 } as any);

      expect(result).toEqual({ downlink: 'NONE' });
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
