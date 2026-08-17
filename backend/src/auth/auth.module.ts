import { Module } from '@nestjs/common';
import { ClerkClientProvider } from '@/providers/clerk.provider';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';

@Module({
  controllers: [],
  providers: [ClerkClientProvider, ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
  exports: ['ClerkClient', ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
})
export class AuthModule {}
