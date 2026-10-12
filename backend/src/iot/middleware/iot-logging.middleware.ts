import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { IotLogsService } from '../iot-logs.service';

@Injectable()
export class IotLoggingMiddleware implements NestMiddleware {
  constructor(private readonly iotLogsService: IotLogsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    let responseBody: any = null;

    // Interceptar res.json y res.send para registrar qué respuesta se devolvió al dispositivo
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = (body: any) => {
      responseBody = body;
      return originalJson(body);
    };

    res.send = (body: any) => {
      if (!responseBody && typeof body === 'string') {
        try {
          responseBody = JSON.parse(body);
        } catch {
          responseBody = body;
        }
      }
      return originalSend(body);
    };

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        null;

      // Persistir log de forma asíncrona (fire-and-forget)
      void this.iotLogsService.recordLog({
        endpoint: req.originalUrl || req.url,
        method: req.method,
        ipAddress,
        headers: req.headers,
        payload: req.body,
        statusCode: res.statusCode,
        responseBody,
        durationMs,
        gateway: (req as any).gateway || null,
      });
    });

    next();
  }
}
