import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('geofences')
@UseGuards(ClerkAuthGuard)
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Post()
  create(@Body() createGeofenceDto: CreateGeofenceDto, @CurrentUser('sub') userId: string) {
    return this.geofencesService.create(createGeofenceDto, userId);
  }

  @Get()
  findAllByZone(@Query('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    if (!zoneId) {
      throw new BadRequestException('zoneId query parameter is required');
    }
    return this.geofencesService.findAllByZone(zoneId, userId);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.geofencesService.deactivate(id, userId);
  }
}
