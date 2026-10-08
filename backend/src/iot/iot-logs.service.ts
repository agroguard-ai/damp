import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueryIotLogsDto } from './dto/query-iot-logs.dto';
import { Prisma } from '@generated/prisma';

export interface IncomingIotLogData {
  endpoint?: string;
  method?: string;
  ipAddress?: string | null;
  headers?: Record<string, any>;
  payload?: any;
  statusCode: number;
  responseBody?: any;
  durationMs?: number;
  gateway?: {
    id: string;
    name?: string | null;
    farmId: string | null;
    farm?: { id: string; name: string | null } | null;
  } | null;
  errorMessage?: string | null;
}

@Injectable()
export class IotLogsService {
  private readonly logger = new Logger(IotLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra de forma asíncrona y segura una petición IoT en la base de datos.
   * Diseñado para nunca lanzar excepciones ni interrumpir la respuesta al dispositivo.
   */
  async recordLog(data: IncomingIotLogData): Promise<void> {
    try {
      const payload = data.payload || {};
      const collarIdRaw = payload.collar_id !== undefined ? Number(payload.collar_id) : null;
      const collarId = !isNaN(collarIdRaw as number) ? collarIdRaw : null;

      const lat = typeof payload.lat === 'number' ? payload.lat : parseFloat(payload.lat) || null;
      const lng = typeof payload.lng === 'number' ? payload.lng : parseFloat(payload.lng) || null;
      const temp = typeof payload.temp === 'number' ? payload.temp : parseFloat(payload.temp) || null;
      const rssi = typeof payload.rssi === 'number' ? payload.rssi : parseFloat(payload.rssi) || null;
      const snr = typeof payload.snr === 'number' ? payload.snr : parseFloat(payload.snr) || null;

      const rawApiKey =
        data.headers?.['x-api-key'] ||
        data.headers?.['X-API-KEY'] ||
        data.headers?.['X-Api-Key'] ||
        null;

      // Enmascarar API Key para proteger la clave sin perder la referencia
      let maskedApiKey: string | null = null;
      if (typeof rawApiKey === 'string' && rawApiKey.length > 0) {
        if (rawApiKey.length > 8) {
          maskedApiKey = `${rawApiKey.slice(0, 6)}...${rawApiKey.slice(-4)}`;
        } else {
          maskedApiKey = '***';
        }
      }

      // Determinar estado semántico
      let status = 'SUCCESS';
      if (data.statusCode === 401) {
        status = 'REJECTED_AUTH';
      } else if (data.statusCode === 403) {
        status = 'FORBIDDEN';
      } else if (data.statusCode === 404) {
        status = 'NOT_FOUND';
      } else if (data.statusCode >= 400 && data.statusCode < 500) {
        status = 'BAD_REQUEST';
      } else if (data.statusCode >= 500) {
        status = 'SERVER_ERROR';
      }

      // Extraer mensaje de error si existiese
      let errorMessage = data.errorMessage || null;
      if (!errorMessage && data.statusCode >= 400 && data.responseBody) {
        if (typeof data.responseBody === 'object') {
          errorMessage = data.responseBody.message || data.responseBody.error || JSON.stringify(data.responseBody);
        } else if (typeof data.responseBody === 'string') {
          errorMessage = data.responseBody;
        }
      }

      // Extraer downlink si se respondió al collar
      let downlinkSent: string | null = null;
      if (data.responseBody && typeof data.responseBody === 'object' && data.responseBody.downlink) {
        downlinkSent = String(data.responseBody.downlink);
      }

      const gatewayId = data.gateway?.id || (typeof payload.gateway_id === 'string' ? payload.gateway_id : null);
      const gatewayName = data.gateway?.name || null;
      const farmId = data.gateway?.farmId || null;
      const farmName = data.gateway?.farm?.name || null;

      // Sanitizar headers para el log
      const safeHeaders: Record<string, any> = {};
      if (data.headers) {
        for (const [key, val] of Object.entries(data.headers)) {
          if (['host', 'user-agent', 'content-type', 'content-length', 'accept'].includes(key.toLowerCase())) {
            safeHeaders[key] = val;
          } else if (key.toLowerCase() === 'x-api-key') {
            safeHeaders[key] = maskedApiKey;
          }
        }
      }

      await this.prisma.iotRequestLog.create({
        data: {
          endpoint: data.endpoint || '/api/iot/telemetry',
          method: data.method || 'POST',
          ipAddress: data.ipAddress || null,
          gatewayId,
          gatewayName,
          farmId,
          farmName,
          apiKeyUsed: maskedApiKey,
          collarId,
          headers: safeHeaders,
          payload: typeof payload === 'object' ? payload : { raw: payload },
          lat,
          lng,
          temp,
          rssi,
          snr,
          statusCode: data.statusCode,
          status,
          responseBody: data.responseBody !== undefined ? (typeof data.responseBody === 'object' ? data.responseBody : { body: data.responseBody }) : null,
          errorMessage,
          downlinkSent,
          durationMs: data.durationMs || 0,
        },
      });
    } catch (err) {
      this.logger.error('Error al persistir log de telemetría IoT:', err);
    }
  }

  /**
   * Consulta paginada de logs para la vista de auditoría del SuperAdmin.
   */
  async findAll(query: QueryIotLogsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.IotRequestLogWhereInput = {};

    if (query.collarId !== undefined) {
      where.collarId = query.collarId;
    }

    if (query.gatewayId) {
      where.gatewayId = query.gatewayId;
    }

    if (query.farmId) {
      where.farmId = query.farmId;
    }

    if (query.statusCode !== undefined) {
      where.statusCode = query.statusCode;
    }

    if (query.status && query.status !== 'ALL') {
      if (query.status === 'SUCCESS') {
        where.statusCode = { in: [200, 204] };
      } else if (query.status === 'REJECTED_AUTH') {
        where.statusCode = 401;
      } else if (query.status === 'NOT_FOUND') {
        where.statusCode = 404;
      } else if (query.status === 'FORBIDDEN') {
        where.statusCode = 403;
      } else if (query.status === 'ERROR') {
        where.statusCode = { gte: 400 };
      } else {
        where.status = query.status;
      }
    }

    if (query.search) {
      const s = query.search.trim();
      const numSearch = Number(s);
      where.OR = [
        { gatewayName: { contains: s, mode: 'insensitive' } },
        { farmName: { contains: s, mode: 'insensitive' } },
        { gatewayId: { contains: s, mode: 'insensitive' } },
        { errorMessage: { contains: s, mode: 'insensitive' } },
        { ipAddress: { contains: s, mode: 'insensitive' } },
        ...(!isNaN(numSearch) ? [{ collarId: numSearch }] : []),
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.iotRequestLog.count({ where }),
      this.prisma.iotRequestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Resumen y KPIs de tráfico IoT para el dashboard del SuperAdmin.
   */
  async getSummary() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalRequests, successRequests, rejectedRequests, errorRequests, recentLogs] = await Promise.all([
      this.prisma.iotRequestLog.count(),
      this.prisma.iotRequestLog.count({ where: { statusCode: { in: [200, 204] } } }),
      this.prisma.iotRequestLog.count({ where: { statusCode: 401 } }),
      this.prisma.iotRequestLog.count({ where: { statusCode: { gte: 400, not: 401 } } }),
      this.prisma.iotRequestLog.findMany({
        where: { createdAt: { gte: last24h } },
        select: { collarId: true, gatewayId: true },
      }),
    ]);

    const activeCollars24h = new Set(
      recentLogs.map((l) => l.collarId).filter((id): id is number => id !== null)
    ).size;

    const activeGateways24h = new Set(
      recentLogs.map((l) => l.gatewayId).filter((id): id is string => id !== null)
    ).size;

    return {
      totalRequests,
      successRequests,
      rejectedRequests,
      errorRequests,
      activeCollars24h,
      activeGateways24h,
    };
  }

  /**
   * Elimina registros de logs para limpieza administrativa.
   */
  async clearLogs() {
    const deleted = await this.prisma.iotRequestLog.deleteMany();
    return { success: true, count: deleted.count };
  }
}
