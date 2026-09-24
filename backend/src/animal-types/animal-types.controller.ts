import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards } from '@nestjs/common';
import { AnimalTypesService } from './animal-types.service';
import { CreateAnimalTypeDto } from './dto/create-animal-type.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';

// AnimalType es un catálogo global (nombre único, sin farmId) compartido por toda la
// plataforma, no un recurso de una granja puntual -> altas/bajas/ediciones se restringen a
// SUPER_ADMIN para que una granja no pueda romper el catálogo de otra. Lectura abierta.
@Controller('animal-types')
@UseGuards(JwtAuthGuard)
export class AnimalTypesController {
  constructor(private readonly animalTypesService: AnimalTypesService) {}

  @Post()
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
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
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateAnimalTypeDto: Partial<CreateAnimalTypeDto>) {
    return this.animalTypesService.update(id, updateAnimalTypeDto);
  }

  @Delete(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.animalTypesService.remove(id);
  }
}
