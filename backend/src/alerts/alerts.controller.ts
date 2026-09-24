import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
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
    @Query('isFalsePositive') isFalsePositive?: string,
    @Query('source') source?: 'ML' | 'THRESHOLD' | 'ESCAPE',
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.alertsService.findAll(userId, {
      farmId,
      animalId,
      type,
      resolved: resolved === undefined ? undefined : resolved === 'true',
      isFalsePositive: isFalsePositive === undefined ? undefined : isFalsePositive === 'true',
      source,
      from,
      to,
    });
  }

  /**
   * CU014 - Camino alternativo 2:
   * Consulta las predicciones de salud del rodeo (incluyendo las de baja certeza guardadas para revisión).
   */
  @Get('predictions')
  getHealthPredictions(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId: string,
    @Query('animalId') animalId?: string,
    @Query('limit') limit?: string
  ) {
    return this.alertsService.getHealthPredictions(userId, farmId, animalId, limit ? Number(limit) : 50);
  }

  /**
   * CU014 - Métricas de precisión y falsos positivos del modelo ML en campo.
   */
  @Get('ml-metrics')
  getMlPerformanceMetrics(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId: string
  ) {
    return this.alertsService.getMlPerformanceMetrics(userId, farmId);
  }

  /**
   * CU014 - Dataset de feedback de operarios para reentrenamiento futuro del modelo.
   */
  @Get('feedback-dataset')
  getFeedbackDataset(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId?: string
  ) {
    return this.alertsService.getFeedbackDataset(userId, farmId);
  }

  @Patch(':id/resolve')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('alert')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  resolveAlert(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.alertsService.resolveAlert(id, userId);
  }

  /**
   * CU014 - Camino alternativo 3:
   * Permite que el usuario marque una alerta generada por el modelo como falso positivo,
   * guardando el feedback para el reentrenamiento futuro del modelo.
   */
  @Patch(':id/false-positive')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('alert')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  markFalsePositive(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body('feedbackNote') feedbackNote?: string
  ) {
    return this.alertsService.markFalsePositive(id, userId, feedbackNote);
  }
}
