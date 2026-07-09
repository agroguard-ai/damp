import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards } from '@nestjs/common';
import { AnimalTypesService } from './animal-types.service';
import { CreateAnimalTypeDto } from './dto/create-animal-type.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';

@Controller('animal-types')
@UseGuards(ClerkAuthGuard)
export class AnimalTypesController {
  constructor(private readonly animalTypesService: AnimalTypesService) {}

  @Post()
  create(@Body() createAnimalTypeDto: CreateAnimalTypeDto) {
    return this.animalTypesService.create(createAnimalTypeDto);
  }

  @Get()
  findAll() {
    return this.animalTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.animalTypesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAnimalTypeDto: Partial<CreateAnimalTypeDto>) {
    return this.animalTypesService.update(id, updateAnimalTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.animalTypesService.remove(id);
  }
}
