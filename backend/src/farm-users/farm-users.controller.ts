import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { FarmUsersService } from './farm-users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

// Personal del administrador de campos logueado (o del emulado por un SUPER_ADMIN): el servicio
// valida que sea FARM_ADMIN y que cada campo y cada persona sean suyos.
@Controller('staff')
@UseGuards(JwtAuthGuard)
export class FarmUsersController {
  constructor(private readonly farmUsersService: FarmUsersService) {}

  @Get()
  findStaff(@CurrentUser('sub') adminId: string) {
    return this.farmUsersService.findStaff(adminId);
  }

  @Post()
  createStaff(@CurrentUser('sub') adminId: string, @Body() dto: CreateStaffDto) {
    return this.farmUsersService.createStaff(adminId, dto);
  }

  @Patch(':userId')
  updateStaff(@CurrentUser('sub') adminId: string, @Param('userId') userId: string, @Body() dto: UpdateStaffDto) {
    return this.farmUsersService.updateStaff(adminId, userId, dto);
  }

  @Post(':userId/reset-password')
  resetStaffPassword(@CurrentUser('sub') adminId: string, @Param('userId') userId: string) {
    return this.farmUsersService.resetStaffPassword(adminId, userId);
  }

  @Delete(':userId')
  removeStaff(@CurrentUser('sub') adminId: string, @Param('userId') userId: string) {
    return this.farmUsersService.removeStaff(adminId, userId);
  }
}
