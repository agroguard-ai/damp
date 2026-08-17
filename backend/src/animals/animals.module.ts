import { Module } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { AnimalsController } from './animals.controller';
import { ApiAnimalsController } from './api-animals.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnimalsController, ApiAnimalsController],
  providers: [AnimalsService],
})
export class AnimalsModule {}
