import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ZoneRotationsService } from './zone-rotations.service';
import { CreateZoneRotationDto } from './dto/create-zone-rotation.dto';
import { PostponeRotationDto } from './dto/postpone-rotation.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('zones/:zoneId/rotation')
@UseGuards(JwtAuthGuard, GlobalRolesGuard, FarmRoleGuard)
@ResolveFarmIdFrom('zone', 'zoneId')
export class ZoneRotationsController {
  constructor(private readonly zoneRotationsService: ZoneRotationsService) {}

  @Post()
  @RequireFarmRole('ADMIN', 'OPERATOR')
  createRotation(
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateZoneRotationDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.zoneRotationsService.createRotation(zoneId, dto, userId);
  }

  @Get()
  getRotation(@Param('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    return this.zoneRotationsService.getRotation(zoneId, userId);
  }

  @Post('advance')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  advanceRotation(@Param('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    return this.zoneRotationsService.advanceRotation(zoneId, userId);
  }

  @Post('postpone')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  postponeRotation(
    @Param('zoneId') zoneId: string,
    @Body() dto: PostponeRotationDto,
    @CurrentUser('sub') userId: string
  ) {
    return this.zoneRotationsService.postponeRotation(zoneId, dto, userId);
  }

  @Post('pause')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  pauseRotation(@Param('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    return this.zoneRotationsService.pauseRotation(zoneId, userId);
  }

  @Post('resume')
  @RequireFarmRole('ADMIN', 'OPERATOR')
  resumeRotation(@Param('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    return this.zoneRotationsService.resumeRotation(zoneId, userId);
  }

  @Delete()
  @RequireFarmRole('ADMIN', 'OPERATOR')
  cancelRotation(@Param('zoneId') zoneId: string, @CurrentUser('sub') userId: string) {
    return this.zoneRotationsService.cancelRotation(zoneId, userId);
  }
}
