import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('alerts')
@UseGuards(ClerkAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getUnresolvedAlerts(@CurrentUser('sub') userId: string) {
    return this.alertsService.getUnresolvedAlerts(userId);
  }

  @Patch(':id/resolve')
  resolveAlert(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.alertsService.resolveAlert(id, userId);
  }
}
