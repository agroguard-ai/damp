import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AlertSettingsService } from './alert-settings.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';

@Controller('farms/:farmId/alert-settings')
@UseGuards(ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class AlertSettingsController {
  constructor(private readonly alertSettingsService: AlertSettingsService) {}

  @Get()
  findByFarm(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.alertSettingsService.findByFarm(farmId, userId);
  }

  @Put()
  @RequireFarmRole('ADMIN')
  upsert(
    @Param('farmId') farmId: string,
    @Body() updateAlertSettingsDto: UpdateAlertSettingsDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.alertSettingsService.upsert(farmId, updateAlertSettingsDto, userId);
  }
}
