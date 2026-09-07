import { Controller, Get, Post, Body, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('zones')
@UseGuards(ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @RequireFarmRole('ADMIN', 'OPERATOR')
  create(@Body() createZoneDto: CreateZoneDto, @CurrentUser('sub') userId: string) {
    return this.zonesService.create(createZoneDto, userId);
  }

  @Get()
  findByFarm(@Query('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.findByFarm(farmId, userId);
  }

  @Get(':id')
  @ResolveFarmIdFrom('zone')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.findOne(id, userId);
  }

  @Patch(':id')
  @ResolveFarmIdFrom('zone')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @Body() updateZoneDto: Partial<CreateZoneDto>, @CurrentUser('sub') userId: string) {
    return this.zonesService.update(id, updateZoneDto, userId);
  }

  @Delete(':id')
  @ResolveFarmIdFrom('zone')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.remove(id, userId);
  }
}
