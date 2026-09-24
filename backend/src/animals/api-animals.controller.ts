import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@Controller('api/animals')
@UseGuards(JwtAuthGuard)
export class ApiAnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get('locations')
  getLiveLocations(@CurrentUser('sub') userId: string, @Query('farmId') farmId?: string) {
    return this.animalsService.getLiveLocations(userId, farmId);
  }

  @Get('heatmap')
  getFarmHeatmap(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    return this.animalsService.getFarmHeatmap(farmId, userId, parsedDays, from, to);
  }

  @Get(':id/trajectory')
  getAnimalTrajectory(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.animalsService.getAnimalTrajectory(id, userId, from, to);
  }
}
