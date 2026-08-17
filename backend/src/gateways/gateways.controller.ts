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
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('gateways')
@UseGuards(ClerkAuthGuard)
export class GatewaysController {
  constructor(private readonly gatewaysService: GatewaysService) {}

  @Post()
  create(@Body() createGatewayDto: CreateGatewayDto, @CurrentUser('sub') userId: string) {
    return this.gatewaysService.create(createGatewayDto, userId);
  }

  @Get()
  findByFarm(@Query('farmId') farmId: string, @CurrentUser('sub') userId: string) {
    if (!farmId) {
      throw new BadRequestException('farmId query parameter is required');
    }
    return this.gatewaysService.findByFarm(farmId, userId);
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
