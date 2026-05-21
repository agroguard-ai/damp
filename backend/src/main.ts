import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  const frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');
  const port = configService.getOrThrow<number>('PORT');

  // Enable CORS for frontend connection
  app.enableCors({ origin: frontendUrl, credentials: true });

  // Enable Validation globally for DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(port);
}
bootstrap();
