import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { MedicalEventsService } from './medical-events.service';
import { CreateMedicalEventDto } from './dto/create-medical-event.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('medical-events')
@UseGuards(ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class MedicalEventsController {
  constructor(private readonly medicalEventsService: MedicalEventsService) {}

  @Post()
  @ResolveFarmIdFrom('animal', 'animalId')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  create(@Body() createMedicalEventDto: CreateMedicalEventDto, @CurrentUser('sub') userId: string) {
    return this.medicalEventsService.create(createMedicalEventDto, userId);
  }

  @Get()
  @ResolveFarmIdFrom('animal', 'animalId')
  findAllByAnimal(@Query('animalId') animalId: string, @CurrentUser('sub') userId: string) {
    if (!animalId) {
      throw new BadRequestException('animalId query parameter is required');
    }
    return this.medicalEventsService.findAllByAnimal(animalId, userId);
  }
}
