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
    gatewaysService.validateApiKey.mockResolvedValue(true);
    const context = makeContext({ 'x-api-key': 'valid-key' }, { gateway_id: 'gw-1', collar_id: 1 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(gatewaysService.validateApiKey).toHaveBeenCalledWith('gw-1', 'valid-key');
  });

  it('rechaza si falta el header X-API-Key', async () => {
    const context = makeContext({}, { gateway_id: 'gw-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(gatewaysService.validateApiKey).not.toHaveBeenCalled();
  });

  it('rechaza si falta gateway_id en el body', async () => {
    const context = makeContext({ 'x-api-key': 'valid-key' }, {});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(gatewaysService.validateApiKey).not.toHaveBeenCalled();
  });

  it('rechaza si la combinación gateway_id/X-API-Key no matchea', async () => {
    gatewaysService.validateApiKey.mockResolvedValue(false);
    const context = makeContext({ 'x-api-key': 'wrong-key' }, { gateway_id: 'gw-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
