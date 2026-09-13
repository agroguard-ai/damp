import { Global, Module } from '@nestjs/common';
import { ClerkClientProvider } from '@/providers/clerk.provider';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';

// @Global(): ClerkAuthGuard ahora inyecta 'ClerkClient' (ver ensureDbUser), y varios módulos que
// lo usan vía @UseGuards(ClerkAuthGuard) — FarmsModule, AnimalsModule — no importan AuthModule
// (antes les alcanzaba porque ClerkAuthGuard solo dependía de ConfigService, que ya es global).
// Sin este decorador, Nest no puede resolver esa dependencia ahí y el bootstrap entero falla.
@Global()
@Module({
  controllers: [],
  providers: [ClerkClientProvider, ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
  exports: ['ClerkClient', ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard],
})
export class AuthModule {}
