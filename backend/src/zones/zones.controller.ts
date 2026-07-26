import { Controller, Get, Post, Body, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('zones')
@UseGuards(ClerkAuthGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  create(@Body() createZoneDto: CreateZoneDto, @CurrentUser('sub') userId: string) {
    return this.zonesService.create(createZoneDto, userId);
  }

  @Get()
  findByFarm(@Query('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.findByFarm(farmId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateZoneDto: Partial<CreateZoneDto>, @CurrentUser('sub') userId: string) {
    return this.zonesService.update(id, updateZoneDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.zonesService.remove(id, userId);
  }
}
