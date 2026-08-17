import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';
import { AdminUsersService } from './admin-users.service';
import { UpdateGlobalRoleDto } from './dto/update-global-role.dto';

@Controller('admin/users')
@UseGuards(ClerkAuthGuard, GlobalRolesGuard)
@GlobalRoles(GlobalRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findAll() {
    return this.adminUsersService.findAll();
  }

  @Patch(':userId/role')
  updateGlobalRole(@Param('userId') userId: string, @Body() updateGlobalRoleDto: UpdateGlobalRoleDto) {
    return this.adminUsersService.updateGlobalRole(userId, updateGlobalRoleDto);
  }
}
