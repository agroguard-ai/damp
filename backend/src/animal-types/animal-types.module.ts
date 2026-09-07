import { Module } from '@nestjs/common';
import { AnimalTypesService } from './animal-types.service';
import { AnimalTypesController } from './animal-types.controller';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnimalTypesController],
  providers: [AnimalTypesService],
  exports: [AnimalTypesService],
})
export class AnimalTypesModule {}
