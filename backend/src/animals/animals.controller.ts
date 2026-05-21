import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { ArchiveAnimalDto } from './dto/archive-animal.dto';

@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  create(@Body() createAnimalDto: CreateAnimalDto) {
    return this.animalsService.create(createAnimalDto);
  }

  @Get()
  findAll(
    @Query('farmId') farmId?: string,
    @Query('sectorId') sectorId?: string,
    @Query('animalType') animalType?: string,
    @Query('collarStatus') collarStatus?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('status') status?: string,
  ) {
    return this.animalsService.findAll({
      farmId,
      sectorId,
      animalType,
      collarStatus,
      healthStatus,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.animalsService.findOne(id);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Body() archiveAnimalDto: ArchiveAnimalDto) {
    return this.animalsService.archive(id, archiveAnimalDto.status);
  }
}
