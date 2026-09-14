import { Controller, Get, Post, Body, Patch, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { UpdateCollarStatusDto } from './dto/update-collar-status.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { JwtPayload } from '@/auth/current-user.decorator';
import { GlobalRole } from '@generated/prisma';

@Controller('collars')
@UseGuards(JwtAuthGuard)
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  create(@Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(createCollarDto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.collarsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.collarsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCollarDto: UpdateCollarDto) {
    return this.collarsService.update(id, updateCollarDto);
  }

  @Patch(':id/status')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollarStatusDto) {
    return this.collarsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.collarsService.remove(id);
  }
}
