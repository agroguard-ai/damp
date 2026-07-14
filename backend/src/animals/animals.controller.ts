import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { ArchiveAnimalDto } from './dto/archive-animal.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('animals')
@UseGuards(ClerkAuthGuard)
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  create(
    @Body() createAnimalDto: CreateAnimalDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.animalsService.create(createAnimalDto, userId);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId?: string,
    @Query('sectorId') sectorId?: string,
    @Query('animalType') animalType?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('status') status?: string,
  ) {
    return this.animalsService.findAll(
      {
        farmId,
        sectorId,
        animalType,
        healthStatus,
        status,
      },
      userId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.animalsService.findOne(id, userId);
  }

  @Patch(':id/archive')
  archive(
    @Param('id') id: string,
    @Body() archiveAnimalDto: ArchiveAnimalDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.animalsService.archive(id, archiveAnimalDto.status, userId);
  }
}
