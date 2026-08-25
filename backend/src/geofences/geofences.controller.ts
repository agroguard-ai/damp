import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('geofences')
@UseGuards(ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Post()
  @ResolveFarmIdFrom('zone', 'zoneId')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  create(@Body() createGeofenceDto: CreateGeofenceDto, @CurrentUser('sub') userId: string) {
    return this.geofencesService.create(createGeofenceDto, userId);
  }

  @Get()
  @ResolveFarmIdFrom('zone', 'zoneId')
  findAllByZone(@Query('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    if (!zoneId) {
      throw new BadRequestException('zoneId query parameter is required');
    }
    return this.geofencesService.findAllByZone(zoneId, userId);
  }

  @Patch(':id/deactivate')
  @ResolveFarmIdFrom('geofence')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.geofencesService.deactivate(id, userId);
  }
}
