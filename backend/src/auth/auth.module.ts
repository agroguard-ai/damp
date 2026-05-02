import { Module } from '@nestjs/common';
import { ClerkClientProvider } from '@/providers/clerk.provider';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';

@Module({
  controllers: [],
  providers: [ClerkClientProvider, ClerkAuthGuard],
  exports: ['ClerkClient', ClerkAuthGuard],
})
export class AuthModule {}
