import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CollarStatus, GlobalRole, Prisma, CollarClaimStatus, CollarRequestStatus } from '@generated/prisma';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { CreateCollarClaimDto } from './dto/create-collar-claim.dto';
import { UpdateCollarClaimDto } from './dto/update-collar-claim.dto';
import { CreateCollarRequestDto } from './dto/create-collar-request.dto';
import { UpdateCollarRequestDto } from './dto/update-collar-request.dto';
import { JwtPayload } from '@/auth/current-user.decorator';

@Injectable()
export class CollarsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withAssignment(collar: {
    id: number;
    identifier: string;
    status: CollarStatus;
    lastTelemetryDate: Date | null;
    createdAt: Date;
    farmId?: string | null;
    farm?: { id: string; name: string | null } | null;
  }) {
    const activeAssignment = await this.prisma.animalCollar.findFirst({
      where: { collarId: collar.id, endAt: null },
      include: { animal: { select: { id: true, tag: true, farmId: true } } },
    });

    return {
      ...collar,
      assignedAnimal: activeAssignment?.animal ?? null,
    };
  }

  private async getUserFarmIds(userId: string): Promise<string[]> {
    const userFarms = await this.prisma.farm.findMany({
      where: {
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
      select: { id: true },
    });
    return userFarms.map((f) => f.id);
  }

  async create(dto: CreateCollarDto) {
    if (dto.farmId) {
      await this.assertCollarQuota(dto.farmId);
    }

    try {
      return await this.prisma.collar.create({
        data: {
          identifier: dto.identifier,
          ...(dto.farmId ? { farmId: dto.farmId } : {}),
        },
        include: {
          farm: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A collar with identifier "${dto.identifier}" already exists`);
      }
      throw err;
    }
  }

  async findAll(user?: JwtPayload) {
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;

    if (isSuperAdmin) {
      const collars = await this.prisma.collar.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          farm: { select: { id: true, name: true } },
          telemetryReadings: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });
      return Promise.all(collars.map((c) => this.withAssignment(c)));
    }

    const userId = user?.sub;
    if (!userId) {
      return [];
    }

    const farmIds = await this.getUserFarmIds(userId);

    const collars = await this.prisma.collar.findMany({
      where: {
        OR: [
          { farmId: { in: farmIds } },
          { animalCollars: { some: { endAt: null, animal: { farmId: { in: farmIds } } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        farm: { select: { id: true, name: true } },
        telemetryReadings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return Promise.all(collars.map((c) => this.withAssignment(c)));
  }

  async findOne(id: number, user?: JwtPayload) {
    const collar = await this.prisma.collar.findUnique({
      where: { id },
      include: {
        farm: { select: { id: true, name: true } },
        telemetryReadings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        animalCollars: {
          orderBy: { startAt: 'desc' },
          include: { animal: { select: { id: true, tag: true, farmId: true } } },
        },
      },
    });

    if (!collar) {
      throw new NotFoundException(`Collar with id ${id} not found`);
    }

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;
    if (!isSuperAdmin && user?.sub) {
      const farmIds = await this.getUserFarmIds(user.sub);

      const belongsToFarm = collar.farmId && farmIds.includes(collar.farmId);
      const assignedToFarmAnimal = collar.animalCollars.some(
        (ac) => ac.endAt === null && farmIds.includes(ac.animal.farmId)
      );

      if (!belongsToFarm && !assignedToFarmAnimal) {
        throw new ForbiddenException('No tienes acceso a este collar');
      }
    }

    return this.withAssignment(collar);
  }

  async update(id: number, dto: UpdateCollarDto) {
    await this.getOrThrow(id);

    if (dto.farmId) {
      await this.assertCollarQuota(dto.farmId, id);
    }

    try {
      return await this.prisma.collar.update({
        where: { id },
        data: {
          ...(dto.identifier !== undefined ? { identifier: dto.identifier } : {}),
          ...(dto.farmId !== undefined ? { farmId: dto.farmId } : {}),
        },
        include: {
          farm: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A collar with identifier "${dto.identifier}" already exists`);
      }
      throw err;
    }
  }

  async updateStatus(id: number, status: CollarStatus, user?: JwtPayload) {
    const collar = await this.getOrThrow(id);

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;
    if (!isSuperAdmin && user?.sub) {
      const farmIds = await this.getUserFarmIds(user.sub);
      const belongsToFarm = collar.farmId && farmIds.includes(collar.farmId);
      if (!belongsToFarm) {
        throw new ForbiddenException('No tienes permisos para modificar el estado de este collar');
      }
    }

    if (status !== 'AVAILABLE') {
      // Marking a collar damaged/out of service releases whatever animal is currently wearing it.
      await this.prisma.animalCollar.updateMany({
        where: { collarId: id, endAt: null },
        data: { endAt: new Date() },
      });
    }

    return this.prisma.collar.update({
      where: { id },
      data: { status },
      include: {
        farm: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    await this.prisma.animalCollar.updateMany({
      where: { collarId: id, endAt: null },
      data: { endAt: new Date() },
    });
    return this.prisma.collar.delete({ where: { id } });
  }

  async assertAvailableForAssignment(id: number) {
    const collar = await this.prisma.collar.findUnique({ where: { id } });
    if (!collar) {
      throw new NotFoundException(`El collar con ID ${id} no existe.`);
    }
    if (collar.status !== 'AVAILABLE') {
      throw new BadRequestException(`El collar ${collar.identifier} no está disponible (estado: ${collar.status}).`);
    }
    const activeAssignment = await this.prisma.animalCollar.findFirst({
      where: { collarId: id, endAt: null },
    });
    if (activeAssignment) {
      throw new BadRequestException(`El collar ${collar.identifier} ya está asignado a otro animal.`);
    }
    return collar;
  }

  // --- RECLAMOS (CU009: Iniciar y gestionar reclamos por rotura o falla) ---
  async createClaim(collarId: number, dto: CreateCollarClaimDto, user: JwtPayload) {
    const collar = await this.getOrThrow(collarId);

    const isSuperAdmin = user.globalRole === GlobalRole.SUPER_ADMIN && !user.isEmulated;
    if (!isSuperAdmin) {
      const farmIds = await this.getUserFarmIds(user.sub);
      const belongsToFarm = collar.farmId && farmIds.includes(collar.farmId);
      if (!belongsToFarm) {
        throw new ForbiddenException('No puedes iniciar un reclamo sobre un collar de otro establecimiento');
      }
    }

    if (dto.markAsDamaged) {
      await this.updateStatus(collarId, CollarStatus.DAMAGED, user);
    }

    return this.prisma.collarClaim.create({
      data: {
        collarId,
        farmId: collar.farmId,
        userId: user.sub,
        reason: dto.reason.trim(),
        description: dto.description?.trim(),
      },
      include: {
        collar: { select: { id: true, identifier: true, status: true } },
        farm: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAllClaims(user: JwtPayload) {
    const isSuperAdmin = user.globalRole === GlobalRole.SUPER_ADMIN && !user.isEmulated;

    let whereClause: Prisma.CollarClaimWhereInput = {};
    if (!isSuperAdmin) {
      const farmIds = await this.getUserFarmIds(user.sub);
      whereClause = {
        OR: [
          { farmId: { in: farmIds } },
          { userId: user.sub },
        ],
      };
    }

    return this.prisma.collarClaim.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        collar: { select: { id: true, identifier: true, status: true } },
        farm: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateClaim(claimId: string, dto: UpdateCollarClaimDto) {
    const claim = await this.prisma.collarClaim.findUnique({ where: { id: claimId } });
    if (!claim) {
      throw new NotFoundException(`Reclamo con ID "${claimId}" no encontrado`);
    }

    const isResolvedOrRejected = dto.status === 'RESOLVED' || dto.status === 'REJECTED';

    return this.prisma.collarClaim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        ...(dto.resolutionNotes !== undefined ? { resolutionNotes: dto.resolutionNotes } : {}),
        resolvedAt: isResolvedOrRejected ? new Date() : null,
      },
      include: {
        collar: { select: { id: true, identifier: true, status: true } },
        farm: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // --- SOLICITUDES (CU009: Solicitar más collares y ampliar cuota) ---
  async createRequest(dto: CreateCollarRequestDto, user: JwtPayload) {
    const farm = await this.prisma.farm.findUnique({ where: { id: dto.farmId } });
    if (!farm) {
      throw new NotFoundException(`Establecimiento con ID "${dto.farmId}" no encontrado`);
    }

    const isSuperAdmin = user.globalRole === GlobalRole.SUPER_ADMIN && !user.isEmulated;
    if (!isSuperAdmin) {
      const farmIds = await this.getUserFarmIds(user.sub);
      if (!farmIds.includes(dto.farmId)) {
        throw new ForbiddenException('No tienes permisos para solicitar collares para este campo');
      }
    }

    return this.prisma.collarRequest.create({
      data: {
        farmId: dto.farmId,
        userId: user.sub,
        requestedCount: dto.requestedCount,
        notes: dto.notes?.trim(),
      },
      include: {
        farm: { select: { id: true, name: true } },
      },
    });
  }

  async findAllRequests(user: JwtPayload) {
    const isSuperAdmin = user.globalRole === GlobalRole.SUPER_ADMIN && !user.isEmulated;

    let whereClause: Prisma.CollarRequestWhereInput = {};
    if (!isSuperAdmin) {
      const farmIds = await this.getUserFarmIds(user.sub);
      whereClause = { farmId: { in: farmIds } };
    }

    return this.prisma.collarRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        farm: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateRequest(requestId: string, dto: UpdateCollarRequestDto) {
    const request = await this.prisma.collarRequest.findUnique({
      where: { id: requestId },
      include: { farm: true },
    });
    if (!request) {
      throw new NotFoundException(`Solicitud con ID "${requestId}" no encontrada`);
    }

    if (dto.status === 'APPROVED' && dto.incrementMaxCollars && request.farm.userId) {
      await this.prisma.user.update({
        where: { id: request.farm.userId },
        data: {
          maxCollars: { increment: request.requestedCount },
        },
      });
    }

    return this.prisma.collarRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        ...(dto.responseNotes !== undefined ? { responseNotes: dto.responseNotes } : {}),
        resolvedAt: new Date(),
      },
      include: {
        farm: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  private async assertCollarQuota(farmId: string, excludeCollarId?: number) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            maxCollars: true,
          },
        },
      },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with id "${farmId}" not found`);
    }

    if (!farm.user) {
      return;
    }

    const owner = farm.user;
    const currentAssigned = await this.prisma.collar.count({
      where: {
        farm: { userId: owner.id },
        ...(excludeCollarId ? { id: { not: excludeCollarId } } : {}),
      },
    });

    if (currentAssigned + 1 > owner.maxCollars) {
      throw new BadRequestException(
        `El cliente "${owner.name || owner.email}" ha alcanzado su límite contratado de collares (${owner.maxCollars}). Actualmente tiene ${currentAssigned} collares asignados. Incremente su cupo contratado para asignar más.`
      );
    }
  }

  private async getOrThrow(id: number) {
    const collar = await this.prisma.collar.findUnique({ where: { id } });
    if (!collar) {
      throw new NotFoundException(`Collar with id ${id} not found`);
    }
    return collar;
  }
}
