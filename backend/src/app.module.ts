import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { WebhookModule } from '@/webhook/webhook.module';
import { AnimalsModule } from './animals/animals.module';
import { FarmsModule } from './farms/farms.module';
import { ZonesModule } from './zones/zones.module';
import { AnimalTypesModule } from './animal-types/animal-types.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WebhookModule,
    AnimalsModule,
    FarmsModule,
    ZonesModule,
    AnimalTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
