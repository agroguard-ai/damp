import { Module } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CollarsController } from './collars.controller';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CollarsController],
  providers: [CollarsService],
  exports: [CollarsService],
})
export class CollarsModule {}
