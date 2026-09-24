import { Module } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';
import { ZoneRotationsService } from './zone-rotations.service';
import { ZoneRotationsController } from './zone-rotations.controller';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ZonesController, ZoneRotationsController],
  providers: [ZonesService, ZoneRotationsService],
  exports: [ZonesService, ZoneRotationsService],
})
export class ZonesModule {}
