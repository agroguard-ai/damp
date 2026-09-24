import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { ArchiveAnimalDto } from './dto/archive-animal.dto';
import { UpdateAnimalZoneDto } from './dto/update-animal-zone.dto';
import { LinkAnimalCollarDto } from './dto/link-animal-collar.dto';
import { AssignAnimalGeofenceDto } from './dto/assign-animal-geofence.dto';
import { BulkAssignZoneDto } from './dto/bulk-assign-zone.dto';
import { BulkTransferFarmDto } from './dto/bulk-transfer-farm.dto';
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

  @Post('bulk/zone')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @RequireFarmRole('ADMIN', 'OPERATOR')
  bulkAssignZone(@Body() dto: BulkAssignZoneDto, @CurrentUser('sub') userId: string) {
    return this.animalsService.bulkAssignZone(dto, userId);
  }

  @Post('bulk/transfer-farm')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @RequireFarmRole('ADMIN', 'OPERATOR')
  bulkTransferFarm(@Body() dto: BulkTransferFarmDto, @CurrentUser('sub') userId: string) {
    if (!dto.farmId) {
      dto.farmId = dto.sourceFarmId;
    }
    return this.animalsService.bulkTransferFarm(dto, userId);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('farmId') farmId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('animalType') animalType?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('status') status?: string,
    @Query('hasActiveAlert') hasActiveAlert?: string,
    @Query('hasCollar') hasCollar?: string
  ) {
    return this.animalsService.findAll(
      {
        farmId,
        zoneId,
        animalType,
        healthStatus,
        status,
        hasActiveAlert,
        hasCollar,
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

  @Patch(':id')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  update(
    @Param('id') id: string,
    @Body() updateAnimalDto: UpdateAnimalDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.animalsService.update(id, updateAnimalDto, userId);
  }

  @Patch(':id/archive')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  archive(@Param('id') id: string, @Body() archiveAnimalDto: ArchiveAnimalDto, @CurrentUser('sub') userId: string) {
    return this.animalsService.archive(id, archiveAnimalDto.status, userId);
  }

  @Patch(':id/zone')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateAnimalZoneDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.animalsService.updateZone(id, dto.zoneId ?? null, userId);
  }

  @Patch(':id/collar')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  updateCollar(
    @Param('id') id: string,
    @Body() dto: LinkAnimalCollarDto,
    @CurrentUser('sub') userId: string
  ) {
    if (dto.collarId === null || dto.collarId === undefined) {
      return this.animalsService.unlinkCollar(id, userId);
    }
    return this.animalsService.linkCollar(id, dto.collarId, userId);
  }

  @Patch(':id/geofence')
  @UseGuards(GlobalRolesGuard, FarmRoleGuard)
  @ResolveFarmIdFrom('animal')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  updateGeofence(
    @Param('id') id: string,
    @Body() dto: AssignAnimalGeofenceDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.animalsService.assignGeofence(id, dto.geofenceId ?? null, userId);
  }
}
