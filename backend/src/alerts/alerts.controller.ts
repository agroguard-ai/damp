import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertType } from '@generated/prisma';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
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
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('alert')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  resolveAlert(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.alertsService.resolveAlert(id, userId);
  }
}
