import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';
import { AdminUsersService } from './admin-users.service';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateMaxCollarsDto } from './dto/update-max-collars.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, GlobalRolesGuard)
@GlobalRoles(GlobalRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('users')
  findAllUsers() {
    return this.adminUsersService.findAll();
  }

  @Post('users')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminUsersService.createUser(createUserDto);
  }

  @Patch('users/:userId/role')
  updateGlobalRole(@Param('userId') userId: string, @Body() updateGlobalRoleDto: UpdateGlobalRoleDto) {
    return this.adminUsersService.updateGlobalRole(userId, updateGlobalRoleDto);
  }

  @Patch('users/:userId/status')
  updateStatus(@Param('userId') userId: string, @Body() updateUserStatusDto: UpdateUserStatusDto) {
    return this.adminUsersService.updateStatus(userId, updateUserStatusDto.isActive);
  }

  @Patch('users/:userId/max-collars')
  updateMaxCollars(@Param('userId') userId: string, @Body() updateMaxCollarsDto: UpdateMaxCollarsDto) {
    return this.adminUsersService.updateMaxCollars(userId, updateMaxCollarsDto.maxCollars);
  }

  @Get('farms')
  findAllFarms() {
    return this.adminUsersService.findAllFarms();
  }
}
