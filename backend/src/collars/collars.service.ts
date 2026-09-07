import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CollarStatus, Prisma } from '@generated/prisma';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';

@Injectable()
export class CollarsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withAssignment(collar: {
    id: number;
    identifier: string;
    status: CollarStatus;
    lastTelemetryDate: Date | null;
    createdAt: Date;
  }) {
    const activeAssignment = await this.prisma.animalCollar.findFirst({
      where: { collarId: collar.id, endAt: null },
      include: { animal: { select: { id: true, tag: true } } },
    });

    return {
      ...collar,
      assignedAnimal: activeAssignment?.animal ?? null,
    };
  }

  async create(dto: CreateCollarDto) {
    try {
      return await this.prisma.collar.create({
        data: { identifier: dto.identifier },
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Prisma's generated error type doesn't narrow `code` cleanly here
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A collar with identifier "${dto.identifier}" already exists`);
      }
      throw err;
    }
  }

  async findAll() {
    const collars = await this.prisma.collar.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        telemetryReadings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return Promise.all(collars.map((c) => this.withAssignment(c)));
  }

  async findOne(id: number) {
    const collar = await this.prisma.collar.findUnique({
      where: { id },
      include: {
        telemetryReadings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        animalCollars: {
          orderBy: { startAt: 'desc' },
          include: { animal: { select: { id: true, tag: true } } },
        },
      },
    });

    if (!collar) {
      throw new NotFoundException(`Collar with id ${id} not found`);
    }

    return this.withAssignment(collar);
  }

  async update(id: number, dto: UpdateCollarDto) {
    await this.getOrThrow(id);
    try {
      return await this.prisma.collar.update({
        where: { id },
        data: { identifier: dto.identifier },
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Prisma's generated error type doesn't narrow `code` cleanly here
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
    });
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
