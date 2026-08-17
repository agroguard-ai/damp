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
import { IotModule } from './iot/iot.module';
import { AlertsModule } from './alerts/alerts.module';
import { AdminUsersModule } from './admin/admin-users.module';
import { FarmUsersModule } from './farm-users/farm-users.module';

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
    IotModule,
    AlertsModule,
    AdminUsersModule,
    FarmUsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
