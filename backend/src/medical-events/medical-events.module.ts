import { Module } from '@nestjs/common';
import { MedicalEventsService } from './medical-events.service';
import { MedicalEventsController } from './medical-events.controller';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MedicalEventsController],
  providers: [MedicalEventsService],
  exports: [MedicalEventsService],
})
export class MedicalEventsModule {}
