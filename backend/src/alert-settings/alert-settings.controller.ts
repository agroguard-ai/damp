import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AlertSettingsService } from './alert-settings.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('farms/:farmId/alert-settings')
@UseGuards(ClerkAuthGuard)
export class AlertSettingsController {
  constructor(private readonly alertSettingsService: AlertSettingsService) {}

  @Get()
  findByFarm(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.alertSettingsService.findByFarm(farmId, userId);
  }

  @Put()
  upsert(
    @Param('farmId') farmId: string,
    @Body() updateAlertSettingsDto: UpdateAlertSettingsDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.alertSettingsService.upsert(farmId, updateAlertSettingsDto, userId);
  }
}
