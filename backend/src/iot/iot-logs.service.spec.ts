import { Test, TestingModule } from '@nestjs/testing';
import { IotLogsService } from './iot-logs.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('IotLogsService', () => {
  let service: IotLogsService;
  let prisma: {
    iotRequestLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      iotRequestLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IotLogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IotLogsService>(IotLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordLog', () => {
    it('debe registrar una petición exitosa y enmascarar la API Key', async () => {
      await service.recordLog({
        endpoint: '/api/iot/telemetry',
        method: 'POST',
        ipAddress: '192.168.1.50',
        headers: {
          'x-api-key': 'gw_live_1234567890abcdef',
          'content-type': 'application/json',
        },
        payload: {
          collar_id: 3,
          lat: -34.6037,
          lng: -58.3816,
          temp: 38.5,
          rssi: -75.2,
          snr: 8.5,
        },
        statusCode: 204,
        durationMs: 15,
        gateway: {
          id: 'gw-100',
          name: 'Gateway Principal',
          farmId: 'farm-1',
          farm: { id: 'farm-1', name: 'Granja Norte' },
        },
      });

      expect(prisma.iotRequestLog.create).toHaveBeenCalledTimes(1);
      const callData = prisma.iotRequestLog.create.mock.calls[0][0].data;
      expect(callData.collarId).toBe(3);
      expect(callData.statusCode).toBe(204);
      expect(callData.status).toBe('SUCCESS');
      expect(callData.apiKeyUsed).toContain('gw_liv...');
      expect(callData.gatewayName).toBe('Gateway Principal');
      expect(callData.farmName).toBe('Granja Norte');
      expect(callData.lat).toBe(-34.6037);
    });

    it('debe registrar un rechazo 401 por falta de autenticación', async () => {
      await service.recordLog({
        endpoint: '/api/iot/telemetry',
        statusCode: 401,
        errorMessage: 'Missing X-API-Key header',
        payload: { collar_id: 5 },
      });

      expect(prisma.iotRequestLog.create).toHaveBeenCalledTimes(1);
      const callData = prisma.iotRequestLog.create.mock.calls[0][0].data;
      expect(callData.statusCode).toBe(401);
      expect(callData.status).toBe('REJECTED_AUTH');
      expect(callData.errorMessage).toBe('Missing X-API-Key header');
    });
  });

  describe('findAll', () => {
    it('debe filtrar logs por collarId y estado', async () => {
      prisma.iotRequestLog.findMany.mockResolvedValueOnce([{ id: 'log-1', collarId: 7 }]);
      prisma.iotRequestLog.count.mockResolvedValueOnce(1);

      const result = await service.findAll({
        collarId: 7,
        status: 'SUCCESS',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.iotRequestLog.findMany).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('debe retornar métricas globales agregadas', async () => {
      prisma.iotRequestLog.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // success
        .mockResolvedValueOnce(10)  // rejected
        .mockResolvedValueOnce(5);  // other errors

      prisma.iotRequestLog.findMany.mockResolvedValueOnce([
        { collarId: 1, gatewayId: 'gw-1' },
        { collarId: 2, gatewayId: 'gw-1' },
        { collarId: 1, gatewayId: 'gw-2' },
      ]);

      const summary = await service.getSummary();
      expect(summary.totalRequests).toBe(100);
      expect(summary.successRequests).toBe(85);
      expect(summary.rejectedRequests).toBe(10);
      expect(summary.errorRequests).toBe(5);
      expect(summary.activeCollars24h).toBe(2);
      expect(summary.activeGateways24h).toBe(2);
    });
  });

  describe('clearLogs', () => {
    it('debe vaciar la tabla de logs', async () => {
      const res = await service.clearLogs();
      expect(res.success).toBe(true);
      expect(res.count).toBe(5);
    });
  });
});
