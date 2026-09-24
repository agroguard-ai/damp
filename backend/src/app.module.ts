import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { AnimalsModule } from './animals/animals.module';
import { FarmsModule } from './farms/farms.module';
import { ZonesModule } from './zones/zones.module';
import { AnimalTypesModule } from './animal-types/animal-types.module';
import { IotModule } from './iot/iot.module';
import { AlertsModule } from './alerts/alerts.module';
import { AdminUsersModule } from './admin/admin-users.module';
import { FarmUsersModule } from './farm-users/farm-users.module';
import { GeofencesModule } from './geofences/geofences.module';
import { CollarsModule } from './collars/collars.module';
import { MedicalEventsModule } from './medical-events/medical-events.module';
import { GatewaysModule } from './gateways/gateways.module';
import { AlertSettingsModule } from './alert-settings/alert-settings.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AnimalsModule,
    FarmsModule,
    ZonesModule,
    AnimalTypesModule,
    IotModule,
    AlertsModule,
    AdminUsersModule,
    FarmUsersModule,
    GeofencesModule,
    CollarsModule,
    MedicalEventsModule,
    GatewaysModule,
    AlertSettingsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
