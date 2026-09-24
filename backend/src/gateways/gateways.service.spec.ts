import { GatewaysService } from './gateways.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn() },
    farmUser: { findUnique: jest.fn() },
    farm: { findUnique: jest.fn() },
    zone: { findUnique: jest.fn() },
    gateway: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}

describe('GatewaysService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: GatewaysService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new GatewaysService(prisma as any);
  });

  describe('create', () => {
    it('genera un apiKey aleatorio distinto en cada gateway y lo persiste', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.zone.findUnique.mockResolvedValue({ id: 'zone-1', farmId: 'farm-1' });
      prisma.gateway.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'gw-1', ...data, lastSeenAt: null })
      );

      const result1 = await service.create({ name: 'A', farmId: 'farm-1', zoneId: 'zone-1' }, 'user-1');
      const result2 = await service.create({ name: 'B', farmId: 'farm-1', zoneId: 'zone-1' }, 'user-1');

      expect(result1.apiKey).toBeDefined();
      expect(result1.apiKey).toHaveLength(64); // 32 bytes en hex
      expect(result1.apiKey).not.toEqual(result2.apiKey);
    });
  });

  describe('findByFarm', () => {
    it('nunca devuelve el apiKey en el listado (omit)', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.gateway.findMany.mockResolvedValue([{ id: 'gw-1', name: 'A', lastSeenAt: null }]);

      await service.findByFarm('farm-1', 'user-1');

      expect(prisma.gateway.findMany).toHaveBeenCalledWith(expect.objectContaining({ omit: { apiKey: true } }));
    });
  });

  describe('validateApiKey', () => {
    it('devuelve true cuando la clave coincide exactamente', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ apiKey: 'secret-key-123' });
      await expect(service.validateApiKey('gw-1', 'secret-key-123')).resolves.toBe(true);
    });

    it('devuelve false cuando la clave no coincide', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ apiKey: 'secret-key-123' });
      await expect(service.validateApiKey('gw-1', 'wrong-key')).resolves.toBe(false);
    });

    it('devuelve false cuando el gateway no existe', async () => {
      prisma.gateway.findUnique.mockResolvedValue(null);
      await expect(service.validateApiKey('gw-inexistente', 'any-key')).resolves.toBe(false);
    });

    it('devuelve false sin tirar excepción cuando las claves tienen distinta longitud', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ apiKey: 'short' });
      await expect(service.validateApiKey('gw-1', 'a-much-longer-provided-key')).resolves.toBe(false);
    });
  });
});
