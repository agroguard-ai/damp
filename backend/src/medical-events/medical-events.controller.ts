import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { MedicalEventsService } from './medical-events.service';
import { CreateMedicalEventDto } from './dto/create-medical-event.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('medical-events')
@UseGuards(ClerkAuthGuard)
export class MedicalEventsController {
  constructor(private readonly medicalEventsService: MedicalEventsService) {}

  @Post()
  create(@Body() createMedicalEventDto: CreateMedicalEventDto, @CurrentUser('sub') userId: string) {
    return this.medicalEventsService.create(createMedicalEventDto, userId);
  }

  @Get()
  findAllByAnimal(@Query('animalId') animalId: string, @CurrentUser('sub') userId: string) {
    if (!animalId) {
      throw new BadRequestException('animalId query parameter is required');
    }
    return this.medicalEventsService.findAllByAnimal(animalId, userId);
  }
}
