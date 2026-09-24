import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CollarStatus, GlobalRole, Prisma } from '@generated/prisma';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
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

  async create(dto: CreateCollarDto) {
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

    // Granjero o SuperAdmin emulando a un granjero:
    // Solo puede ver los collares contratados/asignados a sus granjas
    const userId = user?.sub;
    if (!userId) {
      return [];
    }

    const userFarms = await this.prisma.farm.findMany({
      where: {
        OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
      },
      select: { id: true },
    });
    const farmIds = userFarms.map((f) => f.id);

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
      const userFarms = await this.prisma.farm.findMany({
        where: {
          OR: [{ userId: user.sub }, { farmUsers: { some: { userId: user.sub, isActive: true } } }],
        },
        select: { id: true },
      });
      const farmIds = userFarms.map((f) => f.id);

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

  async updateStatus(id: number, status: CollarStatus) {
    await this.getOrThrow(id);

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

  private async getOrThrow(id: number) {
    const collar = await this.prisma.collar.findUnique({ where: { id } });
    if (!collar) {
      throw new NotFoundException(`Collar with id ${id} not found`);
    }
    return collar;
  }
}
