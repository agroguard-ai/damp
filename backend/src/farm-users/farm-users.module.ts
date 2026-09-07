import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { FarmUsersController } from './farm-users.controller';
import { FarmUsersService } from './farm-users.service';

@Module({
  imports: [AuthModule],
  controllers: [FarmUsersController],
  providers: [FarmUsersService],
  exports: [FarmUsersService],
})
export class FarmUsersModule {}
