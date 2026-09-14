import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { FarmUsersService } from './farm-users.service';
import { AssignFarmUserDto } from './dto/assign-farm-user.dto';
import { UpdateFarmUserDto } from './dto/update-farm-user.dto';

@Controller('farms/:farmId/users')
@UseGuards(JwtAuthGuard, GlobalRolesGuard, FarmRoleGuard)
export class FarmUsersController {
  constructor(private readonly farmUsersService: FarmUsersService) {}

  @Get()
  findAllInFarm(@Param('farmId') farmId: string) {
    return this.farmUsersService.findAllInFarm(farmId);
  }

  @Post()
  @RequireFarmRole('ADMIN')
  assignSubUser(@Param('farmId') farmId: string, @Body() assignFarmUserDto: AssignFarmUserDto) {
    return this.farmUsersService.assignSubUser(farmId, assignFarmUserDto);
  }

  @Patch(':userId')
  @RequireFarmRole('ADMIN')
  updateSubUserRole(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @Body() updateFarmUserDto: UpdateFarmUserDto
  ) {
    return this.farmUsersService.updateSubUserRole(farmId, userId, updateFarmUserDto);
  }

  @Delete(':userId')
  @RequireFarmRole('ADMIN')
  removeSubUser(@Param('farmId') farmId: string, @Param('userId') userId: string) {
    return this.farmUsersService.removeSubUser(farmId, userId);
  }
}
