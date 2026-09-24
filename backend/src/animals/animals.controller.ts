import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { ArchiveAnimalDto } from './dto/archive-animal.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('animals')
@UseGuards(JwtAuthGuard)
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @RequireFarmRole('ADMIN', 'OPERATOR')
  create(@Body() createAnimalDto: CreateAnimalDto, @CurrentUser('sub') userId: string) {
    return this.animalsService.create(createAnimalDto, userId);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('animalType') animalType?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('status') status?: string,
    @Query('hasActiveAlert') hasActiveAlert?: string
  ) {
    return this.animalsService.findAll(
      {
        farmId,
        zoneId,
        animalType,
        healthStatus,
        status,
        hasActiveAlert,
      },
      userId
    );
  }

  @Get(':id')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.animalsService.findOne(id, userId);
  }

  @Patch(':id/archive')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  archive(@Param('id') id: string, @Body() archiveAnimalDto: ArchiveAnimalDto, @CurrentUser('sub') userId: string) {
    return this.animalsService.archive(id, archiveAnimalDto.status, userId);
  }
}
