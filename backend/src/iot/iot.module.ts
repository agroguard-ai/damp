import { Module } from '@nestjs/common';
import { IotService } from './iot.service';
import { IotController } from './iot.controller';
import { MlHealthService } from './ml-health.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { AlertSettingsModule } from '@/alert-settings/alert-settings.module';
import { ZonesModule } from '@/zones/zones.module';

@Module({
  imports: [PrismaModule, GatewaysModule, AlertSettingsModule, ZonesModule],
  controllers: [IotController],
  providers: [IotService, MlHealthService],
  exports: [IotService],
})
export class IotModule {}
