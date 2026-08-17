import { Module } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { AnimalsController } from './animals.controller';
import { ApiAnimalsController } from './api-animals.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { CollarsModule } from '@/collars/collars.module';

@Module({
  imports: [PrismaModule, CollarsModule],
  controllers: [AnimalsController, ApiAnimalsController],
  providers: [AnimalsService],
})
export class AnimalsModule {}
