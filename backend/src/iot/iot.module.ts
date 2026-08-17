import { Module } from '@nestjs/common';
import { IotService } from './iot.service';
import { IotController } from './iot.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { GatewaysModule } from '@/gateways/gateways.module';
import { AlertSettingsModule } from '@/alert-settings/alert-settings.module';

@Module({
  imports: [PrismaModule, GatewaysModule, AlertSettingsModule],
  controllers: [IotController],
  providers: [IotService],
  exports: [IotService],
})
export class IotModule {}
