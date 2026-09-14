import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { GlobalRolesGuard } from './guards/global-roles.guard';
import { FarmRoleGuard } from './guards/farm-role.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'damp-super-secret-jwt-key-change-in-production',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard, ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
})
export class AuthModule {}
