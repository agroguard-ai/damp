import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AnimalsModule } from './animals/animals.module';
import { FarmsModule } from './farms/farms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnimalsModule,
    FarmsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
