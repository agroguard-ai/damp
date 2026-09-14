import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}
