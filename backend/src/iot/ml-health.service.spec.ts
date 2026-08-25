import { ConfigService } from '@nestjs/config';
import { MlHealthService } from './ml-health.service';

describe('MlHealthService', () => {
  let service: MlHealthService;
  let configService: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('http://ml-service.test') };
    service = new MlHealthService(configService as unknown as ConfigService);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('posts to {baseUrl}/predict/health with animal_id, sex and readings', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: true, events: { fiebre: { probability: 0.9, threshold: 0.3, detected: true } } }),
    });

    const readings = [{ temperature: 38.5, lat: 1, lng: 2, timestamp: '2026-08-25T00:00:00.000Z' }];
    const result = await service.predict('animal-1', 'MALE', readings);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ml-service.test/predict/health',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ animal_id: 'animal-1', sex: 'MALE', readings }),
      })
    );
    expect(result).toEqual({ ready: true, events: { fiebre: { probability: 0.9, threshold: 0.3, detected: true } } });
  });

  it('returns null (does not throw) when ml-service responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const result = await service.predict('animal-1', 'MALE', []);
    expect(result).toBeNull();
  });

  it('returns null (does not throw) when ml-service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await service.predict('animal-1', 'MALE', []);
    expect(result).toBeNull();
  });

  it('falls back to http://localhost:8000 when ML_SERVICE_URL is not configured', async () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);
    const localService = new MlHealthService(configService as unknown as ConfigService);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ready: false, events: {} }) });

    await localService.predict('animal-1', null, []);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/predict/health', expect.anything());
  });
});
