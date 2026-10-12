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

    it('respeta un apiKey personalizado si es provisto', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1', userId: 'user-1' });
      prisma.zone.findUnique.mockResolvedValue({ id: 'zone-1', farmId: 'farm-1' });
      prisma.gateway.findUnique.mockResolvedValue(null); // uniqueness check
      prisma.gateway.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'gw-1', ...data, lastSeenAt: null })
      );

      const result = await service.create(
        { name: 'Gateway Custom', farmId: 'farm-1', zoneId: 'zone-1', apiKey: 'custom-secret-key-123' },
        'user-1'
      );

      expect(result.apiKey).toBe('custom-secret-key-123');
    });
  });

  describe('getApiKey', () => {
    it('obtiene el apiKey del gateway si el usuario tiene acceso', async () => {
      prisma.gateway.findUnique.mockResolvedValue({
        id: 'gw-1',
        name: 'GW1',
        apiKey: 'super-secret-key',
        farmId: 'farm-1',
        farm: { userId: 'user-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', globalRole: 'FARMER' });

      const res = await service.getApiKey('gw-1', 'user-1');
      expect(res).toEqual({ apiKey: 'super-secret-key' });
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
    it('devuelve el gateway cuando la clave coincide exactamente con gatewayId', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1', apiKey: 'secret-key-123' });
      await expect(service.validateApiKey('secret-key-123', 'gw-1')).resolves.toEqual({
        id: 'gw-1',
        farmId: 'farm-1',
        zoneId: 'zone-1',
      });
    });

    it('devuelve el gateway cuando solo se provee apiKey', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1' });
      await expect(service.validateApiKey('secret-key-123')).resolves.toEqual({
        id: 'gw-1',
        farmId: 'farm-1',
        zoneId: 'zone-1',
      });
    });

    it('devuelve null cuando la clave no coincide', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1', apiKey: 'secret-key-123' });
      await expect(service.validateApiKey('wrong-key', 'gw-1')).resolves.toBeNull();
    });

    it('devuelve null cuando el gateway no existe', async () => {
      prisma.gateway.findUnique.mockResolvedValue(null);
      await expect(service.validateApiKey('any-key', 'gw-inexistente')).resolves.toBeNull();
    });

    it('devuelve null sin tirar excepción cuando las claves tienen distinta longitud', async () => {
      prisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1', apiKey: 'short' });
      await expect(service.validateApiKey('a-much-longer-provided-key', 'gw-1')).resolves.toBeNull();
    });
  });
});
