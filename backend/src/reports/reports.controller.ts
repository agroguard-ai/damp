import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

// Todos los reportes son de solo lectura -> cualquier miembro de la granja (VIEWER incluido,
// CU017 lo pide explícitamente), sin @RequireFarmRole.
@Controller('reports')
@UseGuards(JwtAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private sendPdf(res: Response, filename: string, buffer: Buffer) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  private sendExcel(res: Response, filename: string, buffer: Buffer) {
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('animals/:animalId/medical-history')
  @ResolveFarmIdFrom('animal', 'animalId')
  async animalMedicalHistory(
    @Param('animalId') animalId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response
  ) {
    const buffer = await this.reportsService.animalMedicalHistoryPdf(animalId, userId);
    this.sendPdf(res, `historial-medico-${animalId}.pdf`, buffer);
  }

  @Get('farms/:farmId/animals')
  async farmAnimals(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string, @Res() res: Response) {
    const buffer = await this.reportsService.farmAnimalsExcel(farmId, userId);
    this.sendExcel(res, `animales-${farmId}.xlsx`, buffer);
  }

  @Get('farms/:farmId/telemetry')
  async farmTelemetry(
    @Param('farmId') farmId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsService.farmTelemetryExcel(farmId, userId, { from, to });
    this.sendExcel(res, `lecturas-${farmId}.xlsx`, buffer);
  }

  @Get('farms/:farmId/escapes')
  async farmEscapes(
    @Param('farmId') farmId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsService.farmEscapesPdf(farmId, userId, { from, to });
    this.sendPdf(res, `escapes-${farmId}.pdf`, buffer);
  }

  @Get('farms/:farmId/alerts')
  async farmAlerts(
    @Param('farmId') farmId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const parsedFormat = this.reportsService.parseFormat(format);
    const buffer = await this.reportsService.farmAlertsReport(farmId, userId, parsedFormat, { from, to });
    if (parsedFormat === 'xlsx') {
      this.sendExcel(res, `alertas-${farmId}.xlsx`, buffer);
    } else {
      this.sendPdf(res, `alertas-${farmId}.pdf`, buffer);
    }
  }

  @Get('farms/:farmId/summary')
  async farmSummary(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string, @Res() res: Response) {
    const buffer = await this.reportsService.farmSummaryPdf(farmId, userId);
    this.sendPdf(res, `resumen-${farmId}.pdf`, buffer);
  }
}
