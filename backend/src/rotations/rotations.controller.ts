import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RotationsService } from './rotations.service';
import { CreateRotationDto } from './dto/create-rotation.dto';
import { PostponeRotationDto } from './dto/postpone-rotation.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';

@Controller('farms/:farmId/rotation')
@UseGuards(JwtAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class RotationsController {
  constructor(private readonly rotationsService: RotationsService) {}

  @Post()
  @RequireFarmRole('ADMIN', 'OPERATOR')
  createRotation(@Param('farmId') farmId: string, @Body() dto: CreateRotationDto, @CurrentUser('sub') userId: string) {
    return this.rotationsService.createRotation(farmId, dto, userId);
  }

  @Get()
  getRotation(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.rotationsService.getRotation(farmId, userId);
  }

  @Post('advance')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  advanceRotation(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.rotationsService.advanceRotation(farmId, userId);
  }

  @Post('postpone')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  postponeRotation(
    @Param('farmId') farmId: string,
    @Body() dto: PostponeRotationDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.rotationsService.postponeRotation(farmId, dto, userId);
  }

  @Post('pause')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  pauseRotation(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.rotationsService.pauseRotation(farmId, userId);
  }

  @Post('resume')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  resumeRotation(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.rotationsService.resumeRotation(farmId, userId);
  }

  @Delete()
  @RequireFarmRole('ADMIN', 'OPERATOR')
  cancelRotation(@Param('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    return this.rotationsService.cancelRotation(farmId, userId);
  }
}
