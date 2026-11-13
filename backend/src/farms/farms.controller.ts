import { Controller, Get, Post, Body, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('farms')
@UseGuards(JwtAuthGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  create(@Body() createFarmDto: CreateFarmDto, @CurrentUser('sub') userId: string) {
    return this.farmsService.create(createFarmDto, userId);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query('includeInactive') includeInactive?: string) {
    return this.farmsService.findAll(userId, {
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.farmsService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFarmDto: Partial<CreateFarmDto>, @CurrentUser('sub') userId: string) {
    return this.farmsService.update(id, updateFarmDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @Query('permanent') permanent?: string) {
    return this.farmsService.remove(id, userId, permanent === 'true' || permanent === '1');
  }
}
