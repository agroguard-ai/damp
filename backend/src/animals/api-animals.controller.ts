import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

@Controller('api/animals')
@UseGuards(ClerkAuthGuard)
export class ApiAnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get('locations')
  getLiveLocations(@CurrentUser('sub') userId: string, @Query('farmId') farmId?: string) {
    return this.animalsService.getLiveLocations(userId, farmId);
  }
}
