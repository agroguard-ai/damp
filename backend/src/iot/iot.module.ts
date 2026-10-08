import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { IotService } from './iot.service';
import { IotController } from './iot.controller';
import { AdminIotLogsController } from './admin-iot-logs.controller';
import { IotLogsService } from './iot-logs.service';
import { IotLoggingMiddleware } from './middleware/iot-logging.middleware';
import { MlHealthService } from './ml-health.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { AlertSettingsModule } from '@/alert-settings/alert-settings.module';
import { ZonesModule } from '@/zones/zones.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [PrismaModule, GatewaysModule, AlertSettingsModule, ZonesModule, AuthModule],
  controllers: [IotController, AdminIotLogsController],
  providers: [IotService, MlHealthService, IotLogsService],
  exports: [IotService, IotLogsService],
})
export class IotModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IotLoggingMiddleware).forRoutes('api/iot', 'api/iot/*');
  }
}
