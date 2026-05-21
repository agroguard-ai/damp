import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';

@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  create(@Body() createFarmDto: CreateFarmDto) {
    return this.farmsService.create(createFarmDto);
  }

  @Get()
  findAll() {
    return this.farmsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.farmsService.findOne(id);
  }
}
