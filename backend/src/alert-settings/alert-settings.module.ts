import { Module } from '@nestjs/common';
import { AlertSettingsService } from './alert-settings.service';
import { AlertSettingsController } from './alert-settings.controller';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AlertSettingsController],
  providers: [AlertSettingsService],
  exports: [AlertSettingsService],
})
export class AlertSettingsModule {}
