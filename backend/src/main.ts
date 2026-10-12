// Force full rebuild & deployment trigger
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';

import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  // Solo logs de error y warn de Nest para silenciar el mapeo de rutas y carga de módulos al iniciar
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn'],
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('HTTP');

  const frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');
  const port = configService.getOrThrow<number>('PORT');

  // Registrar cada petición entrante con método, ruta, código y tiempo de respuesta
  app.use((req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    });

    next();
  });

  // Enable CORS for frontend connection (supports localhost and local network access)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman, IoT devices)
      if (!origin) return callback(null, true);
      if (origin === frontendUrl || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // En desarrollo permitir orígenes locales
    },
    credentials: true,
  });

  // Enable Validation globally for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(port, '0.0.0.0');
  console.log(`\n🚀 Backend corriendo en el puerto ${port} (http://localhost:${port} / http://0.0.0.0:${port})\n`);
}
bootstrap();
