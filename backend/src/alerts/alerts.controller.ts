import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertType } from '@generated/prisma';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('alerts')
@UseGuards(ClerkAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId?: string,
    @Query('animalId') animalId?: string,
    @Query('type') type?: AlertType,
    @Query('resolved') resolved?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.alertsService.findAll(userId, {
      farmId,
      animalId,
      type,
      resolved: resolved === undefined ? undefined : resolved === 'true',
      from,
      to,
    });
  }

  @Patch(':id/resolve')
  resolveAlert(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.alertsService.resolveAlert(id, userId);
  }
}
