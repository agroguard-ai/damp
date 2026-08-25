import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { UpdateCollarStatusDto } from './dto/update-collar-status.dto';
import { ClerkAuthGuard } from '@/auth/clerk-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { GlobalRole } from '@generated/prisma';

// Collar no tiene farmId en el schema: es inventario global (la flota de collares del sistema,
// no de una granja puntual), así que no aplica FarmRoleGuard acá — el alta/baja/estado de un
// collar físico es gestión de flota, se restringe a SUPER_ADMIN. Ver/listar queda abierto a
// cualquier usuario autenticado (necesario para elegir un collar disponible al dar de alta un animal).
@Controller('collars')
@UseGuards(ClerkAuthGuard)
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  create(@Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(createCollarDto);
  }

  @Get()
  findAll() {
    return this.collarsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.collarsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCollarDto: UpdateCollarDto) {
    return this.collarsService.update(id, updateCollarDto);
  }

  // Marcar un collar dañado/fuera de servicio es una acción de campo rutinaria, no de
  // gestión de flota -> se deja abierta a cualquier usuario autenticado (a diferencia de
  // create/update, que sí son decisiones de inventario).
  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollarStatusDto) {
    return this.collarsService.updateStatus(id, dto.status);
  }
}
