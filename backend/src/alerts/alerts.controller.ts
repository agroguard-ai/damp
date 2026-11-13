import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
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
    @Query('source') source?: 'ML' | 'THRESHOLD' | 'ESCAPE',
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.alertsService.findAll(userId, {
      farmId,
      animalId,
      type,
      resolved: resolved === undefined ? undefined : resolved === 'true',
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

  /** CU014 - Estado del servicio de IA (online / modelo cargado). */
  @Get('ml-status')
  getMlStatus() {
    return this.alertsService.getMlStatus();
  }

  /** CU014 - Riesgo actual por animal según las predicciones recientes del modelo. */
  @Get('predictions/current-risk')
  getCurrentMlRisk(@CurrentUser('sub') userId: string, @Query('farmId') farmId: string) {
    return this.alertsService.getCurrentMlRisk(userId, farmId);
  }

  /** CU014 - Fuerza una predicción inmediata de salud para un animal específico. */
  @Post('predictions/run')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal', 'animalId')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  runAnimalPrediction(@CurrentUser('sub') userId: string, @Body('animalId') animalId: string) {
    return this.alertsService.triggerAnimalPrediction(userId, animalId);
  }

  /** Proyección futura a 48 h (tramos de 12 h) para un animal específico. */
  @Get('predictions/trajectory-48h')
  getAnimalTrajectory48h(@CurrentUser('sub') userId: string, @Query('animalId') animalId: string) {
    return this.alertsService.getAnimalTrajectory48h(userId, animalId);
  }

  /** CU014 - Datos de entrada (ventana de 24 h) que analizó el modelo para una predicción. */
  @Get('predictions/:id/inputs')
  getPredictionInputs(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.alertsService.getPredictionInputs(userId, id);
  }

  /**
   * Métricas del modelo ML en campo.
   */
  @Get('ml-metrics')
  getMlPerformanceMetrics(@CurrentUser('sub') userId: string, @Query('farmId') farmId: string) {
    return this.alertsService.getMlPerformanceMetrics(userId, farmId);
  }

  @Patch(':id/resolve')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('alert')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  resolveAlert(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.alertsService.resolveAlert(id, userId);
  }
}
