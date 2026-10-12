import { Controller, Get, Post, Body, Patch, Delete, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { UpdateCollarStatusDto } from './dto/update-collar-status.dto';
import { CreateCollarClaimDto } from './dto/create-collar-claim.dto';
import { UpdateCollarClaimDto } from './dto/update-collar-claim.dto';
import { CreateCollarRequestDto } from './dto/create-collar-request.dto';
import { UpdateCollarRequestDto } from './dto/update-collar-request.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { GlobalRolesGuard } from '@/auth/guards/global-roles.guard';
import { GlobalRoles } from '@/auth/decorators/global-roles.decorator';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { JwtPayload } from '@/auth/current-user.decorator';
import { GlobalRole } from '@generated/prisma';

@Controller('collars')
@UseGuards(JwtAuthGuard)
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  create(@Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(createCollarDto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.collarsService.findAll(user);
  }

  // --- RECLAMOS (CU009: Reclamos de collares) ---
  @Get('claims')
  findAllClaims(@CurrentUser() user: JwtPayload) {
    return this.collarsService.findAllClaims(user);
  }

  @Post(':id/claims')
  createClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCollarClaimDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.createClaim(id, dto, user);
  }

  @Patch('claims/:claimId')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  updateClaim(
    @Param('claimId') claimId: string,
    @Body() dto: UpdateCollarClaimDto,
  ) {
    return this.collarsService.updateClaim(claimId, dto);
  }

  // --- SOLICITUDES (CU009: Solicitar más collares) ---
  @Get('requests')
  findAllRequests(@CurrentUser() user: JwtPayload) {
    return this.collarsService.findAllRequests(user);
  }

  @Post('requests')
  createRequest(
    @Body() dto: CreateCollarRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.createRequest(dto, user);
  }

  @Patch('requests/:requestId')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  updateRequest(
    @Param('requestId') requestId: string,
    @Body() dto: UpdateCollarRequestDto,
  ) {
    return this.collarsService.updateRequest(requestId, dto);
  }

  // --- DETALLE, EDICIÓN Y ESTADOS DE COLLAR ---
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.collarsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCollarDto: UpdateCollarDto) {
    return this.collarsService.update(id, updateCollarDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollarStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.updateStatus(id, dto.status, user);
  }

  @Patch(':id/archive')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  archive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.archive(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.collarsService.restore(id);
  }

  @Patch(':id/sync-fence')
  syncFence(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.syncFence(id, user);
  }

  @Post(':id/sync-fence')
  syncFencePost(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collarsService.syncFence(id, user);
  }

  @Delete(':id')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('forceArchive') forceArchive?: string,
  ) {
    return this.collarsService.remove(id, forceArchive === 'true');
  }
}
