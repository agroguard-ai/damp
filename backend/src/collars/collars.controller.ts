import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { UpdateCollarStatusDto } from './dto/update-collar-status.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';

@Controller('collars')
@UseGuards(ClerkAuthGuard)
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  create(@Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(createCollarDto);
  }

  @Get()
  findAll() {
    return this.collarsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.collarsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCollarDto: UpdateCollarDto) {
    return this.collarsService.update(id, updateCollarDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollarStatusDto) {
    return this.collarsService.updateStatus(id, dto.status);
  }
}
