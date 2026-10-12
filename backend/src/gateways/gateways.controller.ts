import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { GatewaysService } from './gateways.service';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { FarmRoleGuard } from '@/auth/guards/farm-role.guard';
import { RequireFarmRole } from '@/auth/decorators/require-farm-role.decorator';
import { ResolveFarmIdFrom } from '@/auth/decorators/resolve-farm-id-from.decorator';

@Controller('gateways')
@UseGuards(JwtAuthGuard, GlobalRolesGuard)
export class GatewaysController {
  constructor(private readonly gatewaysService: GatewaysService) {}

  @Post()
  create(@Body() createGatewayDto: CreateGatewayDto, @CurrentUser('sub') userId: string) {
    return this.gatewaysService.create(createGatewayDto, userId);
  }

  @Get()
  find(@Query('farmId') farmId: string | undefined, @CurrentUser('sub') userId: string) {
    if (farmId) {
      return this.gatewaysService.findByFarm(farmId, userId);
    }
    return this.gatewaysService.findAll(userId);
  }

  @Get(':id/api-key')
  getApiKey(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.gatewaysService.getApiKey(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGatewayDto: UpdateGatewayDto, @CurrentUser('sub') userId: string) {
    return this.gatewaysService.update(id, updateGatewayDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.gatewaysService.remove(id, userId);
  }
}

