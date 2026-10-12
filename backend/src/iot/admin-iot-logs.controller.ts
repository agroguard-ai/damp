import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';
import { IotLogsService } from './iot-logs.service';
import { QueryIotLogsDto } from './dto/query-iot-logs.dto';

@Controller('admin/iot-logs')
@UseGuards(JwtAuthGuard, GlobalRolesGuard)
@GlobalRoles(GlobalRole.SUPER_ADMIN)
export class AdminIotLogsController {
  constructor(private readonly iotLogsService: IotLogsService) {}

  @Get()
  findAll(@Query() query: QueryIotLogsDto) {
    return this.iotLogsService.findAll(query);
  }

  @Get('summary')
  getSummary() {
    return this.iotLogsService.getSummary();
  }

  @Delete('clear')
  clearLogs() {
    return this.iotLogsService.clearLogs();
  }
}
