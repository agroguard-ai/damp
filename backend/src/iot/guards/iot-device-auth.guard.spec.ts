import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IotDeviceAuthGuard } from './iot-device-auth.guard';

function makeContext(headers: Record<string, string>, body: Record<string, unknown>): ExecutionContext {
  const request = { headers, body };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('IotDeviceAuthGuard', () => {
  let gatewaysService: { validateApiKey: jest.Mock };
  let guard: IotDeviceAuthGuard;

  beforeEach(() => {
    gatewaysService = { validateApiKey: jest.fn() };
    guard = new IotDeviceAuthGuard(gatewaysService as any);
  });

  it('permite el acceso cuando gateway_id y X-API-Key son válidos', async () => {
    gatewaysService.validateApiKey.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1' });
    const context = makeContext({ 'x-api-key': 'valid-key' }, { gateway_id: 'gw-1', collar_id: 1 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(gatewaysService.validateApiKey).toHaveBeenCalledWith('valid-key', 'gw-1');
  });

  it('permite el acceso cuando solo se provee X-API-Key y deduce gateway_id', async () => {
    gatewaysService.validateApiKey.mockResolvedValue({ id: 'gw-1', farmId: 'farm-1', zoneId: 'zone-1' });
    const body: Record<string, unknown> = { collar_id: 1 };
    const context = makeContext({ 'x-api-key': 'valid-key' }, body);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(gatewaysService.validateApiKey).toHaveBeenCalledWith('valid-key', undefined);
    expect(body.gateway_id).toBe('gw-1');
  });

  it('rechaza si falta el header X-API-Key', async () => {
    const context = makeContext({}, { gateway_id: 'gw-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(gatewaysService.validateApiKey).not.toHaveBeenCalled();
  });

  it('rechaza si el apiKey no existe o no matchea', async () => {
    gatewaysService.validateApiKey.mockResolvedValue(null);
    const context = makeContext({ 'x-api-key': 'wrong-key' }, { gateway_id: 'gw-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
