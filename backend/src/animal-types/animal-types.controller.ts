import { Controller, Get, Post, Body, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AnimalTypesService } from './animal-types.service';
import { CreateAnimalTypeDto } from './dto/create-animal-type.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';

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
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.animalTypesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.animalTypesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateAnimalTypeDto: Partial<CreateAnimalTypeDto> & { isActive?: boolean }) {
    return this.animalTypesService.update(id, updateAnimalTypeDto);
  }

  @Delete(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.animalTypesService.remove(id);
  }

  @Patch(':id/reactivate')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  reactivate(@Param('id') id: string) {
    return this.animalTypesService.reactivate(id);
  }
}
