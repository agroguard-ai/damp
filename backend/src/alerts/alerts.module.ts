import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MlHealthService } from '@/iot/ml-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsService, MlHealthService],
  exports: [AlertsService],
})
export class AlertsModule {}
