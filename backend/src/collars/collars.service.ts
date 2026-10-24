import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CollarStatus, GlobalRole, Prisma } from '@generated/prisma';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { JwtPayload } from '@/auth/current-user.decorator';
import { FARM_WRITE_ROLES } from '@/auth/farm-roles';

@Injectable()
export class CollarsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withAssignment(collar: {
    id: number;
    identifier: string;
    status: CollarStatus;
    isArchived?: boolean;
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

  /** Granjas donde el usuario puede modificar datos (ADMIN u OPERATOR); un VIEWER no puede tocar collares. */
  private async getUserWritableFarmIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.farmUser.findMany({
      where: { userId, isActive: true, role: { name: { in: [...FARM_WRITE_ROLES] } } },
      select: { farmId: true },
    });
    return memberships.map((m) => m.farmId);
  }

  async create(dto: CreateCollarDto) {
    if (dto.farmId) {
      await this.assertCollarQuota(dto.farmId);
    }

    if (dto.id) {
      const existing = await this.prisma.collar.findUnique({ where: { id: dto.id } });
      if (existing) {
        throw new ConflictException(`Ya existe un collar con el ID numérico ${dto.id}`);
      }
    }

    const resolvedIdentifier = dto.identifier?.trim()
      ? dto.identifier.trim()
      : dto.id
        ? `COLLAR-${dto.id}`
        : `COLLAR-TEMP-${Date.now()}`;

    try {
      const collar = await this.prisma.collar.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          identifier: resolvedIdentifier,
          ...(dto.farmId ? { farmId: dto.farmId } : {}),
        },
        include: {
          farm: { select: { id: true, name: true } },
        },
      });

      // Si no se proveyó identifier ni id al crear, actualizar identifier con el id generado
      if (!dto.identifier?.trim() && !dto.id) {
        return await this.prisma.collar.update({
          where: { id: collar.id },
          data: { identifier: `COLLAR-${collar.id}` },
          include: { farm: { select: { id: true, name: true } } },
        });
      }

      return collar;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Ya existe un collar con el identificador "${resolvedIdentifier}"`);
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
          farm: {
            select: {
              id: true,
              name: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
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
    const existing = await this.getOrThrow(id);

    const targetId = dto.id !== undefined ? dto.id : id;

    if (dto.id !== undefined && dto.id !== id) {
      const alreadyExists = await this.prisma.collar.findUnique({ where: { id: dto.id } });
      if (alreadyExists) {
        throw new ConflictException(`Ya existe un collar con el ID numérico ${dto.id}`);
      }
    }

    if (dto.farmId) {
      await this.assertCollarQuota(dto.farmId, id);
    }

    // Si se cambia de granja o se pasa a stock libre, liberar animal activo si lo hubiera
    if (dto.farmId !== undefined && dto.farmId !== existing.farmId) {
      await this.prisma.animalCollar.updateMany({
        where: { collarId: id, endAt: null },
        data: { endAt: new Date() },
      });
    }

    // Actualizar el ID en PostgreSQL si cambió (las FKs de animal_collars, telemetry_readings y collar_claims tienen ON UPDATE CASCADE)
    if (dto.id !== undefined && dto.id !== id) {
      await this.prisma.$executeRaw`UPDATE collars SET id = ${dto.id} WHERE id = ${id}`;
    }

    let targetIdentifier = dto.identifier?.trim();
    if (targetIdentifier === undefined && dto.id !== undefined && dto.id !== id) {
      if (existing.identifier === `COLLAR-${id}`) {
        targetIdentifier = `COLLAR-${dto.id}`;
      }
    }

    try {
      return await this.prisma.collar.update({
        where: { id: targetId },
        data: {
          ...(targetIdentifier !== undefined ? { identifier: targetIdentifier } : {}),
          ...(dto.farmId !== undefined ? { farmId: dto.farmId } : {}),
        },
        include: {
          farm: {
            select: {
              id: true,
              name: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A collar with identifier "${targetIdentifier || dto.identifier}" already exists`);
      }
      throw err;
    }
  }

  async updateStatus(id: number, status: CollarStatus, user?: JwtPayload) {
    const collar = await this.getOrThrow(id);

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo el superadministrador puede modificar el estado de un collar');
    }

    if (status !== CollarStatus.AVAILABLE) {
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

  async archive(id: number, user?: JwtPayload) {
    const collar = await this.getOrThrow(id);

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;
    if (!isSuperAdmin && user?.sub) {
      const farmIds = await this.getUserWritableFarmIds(user.sub);
      const belongsToFarm = collar.farmId && farmIds.includes(collar.farmId);
      if (!belongsToFarm) {
        throw new ForbiddenException('No tienes permisos para archivar este collar');
      }
    }

    // 1. Liberar asignación activa en ganado si la tuviera
    await this.prisma.animalCollar.updateMany({
      where: { collarId: id, endAt: null },
      data: { endAt: new Date() },
    });

    // 2. Dar de baja lógica: fuera de servicio, archivado y desvinculado de campo para no consumir cupo
    return this.prisma.collar.update({
      where: { id },
      data: {
        isArchived: true,
        status: CollarStatus.OUT_OF_SERVICE,
        farmId: null,
      },
      include: {
        farm: { select: { id: true, name: true } },
      },
    });
  }

  async restore(id: number) {
    await this.getOrThrow(id);

    return this.prisma.collar.update({
      where: { id },
      data: {
        isArchived: false,
        status: CollarStatus.AVAILABLE,
      },
      include: {
        farm: { select: { id: true, name: true } },
      },
    });
  }

  async syncFence(id: number, user?: JwtPayload) {
    const collar = await this.getOrThrow(id);

    if (collar.isArchived) {
      throw new BadRequestException(`El collar #${id} está archivado / fuera de servicio.`);
    }

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN && !user?.isEmulated;
    if (!isSuperAdmin && user?.sub) {
      const farmIds = await this.getUserWritableFarmIds(user.sub);
      const belongsToFarm = collar.farmId && farmIds.includes(collar.farmId);
      if (!belongsToFarm) {
        throw new ForbiddenException('No tienes acceso a este collar');
      }
    }

    // Verificar que el collar esté colocado en un animal
    const activeAssignment = await this.prisma.animalCollar.findFirst({
      where: { collarId: id, endAt: null },
      include: {
        animal: {
          select: {
            id: true,
            tag: true,
            farmId: true,
            animalGeofences: {
              where: { endAt: null, geofence: { active: true } },
              include: { geofence: true },
            },
          },
        },
      },
    });

    if (!activeAssignment) {
      throw new BadRequestException(
        `El collar #${id} (${collar.identifier}) no está colocado en ningún animal para sincronizar cerco.`
      );
    }

    // Verificar si el animal tiene cerco activo o si el campo tiene plan de rotación activo
    const hasGeofence = activeAssignment.animal.animalGeofences.length > 0;
    const hasRotationPlan = await this.prisma.rotationPlan.findFirst({
      where: { farmId: activeAssignment.animal.farmId, status: 'ACTIVE' },
    });

    if (!hasGeofence && !hasRotationPlan) {
      throw new BadRequestException(
        `El animal ${activeAssignment.animal.tag || activeAssignment.animal.id} no posee ningún cerco virtual activo ni plan de rotación asignado. Asignale un cerco antes de sincronizar.`
      );
    }

    return this.prisma.collar.update({
      where: { id },
      data: {
        fenceNotificationPending: true,
      },
      include: {
        farm: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: number, forceArchive = false) {
    const collar = await this.getOrThrow(id);

    // Contar historial asociado (asignaciones a ganado y telemetrías)
    const [assignmentCount, telemetryCount] = await Promise.all([
      this.prisma.animalCollar.count({ where: { collarId: id } }),
      this.prisma.telemetryReading.count({ where: { collarId: id } }),
    ]);

    const totalRelations = assignmentCount + telemetryCount;
    if (totalRelations > 0) {
      if (forceArchive) {
        return this.archive(id);
      }

      const reasons: string[] = [];
      if (assignmentCount > 0) reasons.push(`${assignmentCount} asignación(es) a animales`);
      if (telemetryCount > 0) reasons.push(`${telemetryCount} lectura(s) de telemetría`);

      throw new BadRequestException(
        `No se puede eliminar permanentemente el collar #${id} (${collar.identifier}) porque posee historial registrado (${reasons.join(', ')}). Utilizá la opción "Archivar / Dar de baja" para retirarlo del inventario conservando los datos de trazabilidad.`
      );
    }

    return this.prisma.collar.delete({ where: { id } });
  }

  async assertAvailableForAssignment(id: number, targetFarmId?: string) {
    const collar = await this.prisma.collar.findUnique({ where: { id } });
    if (!collar) {
      throw new NotFoundException(`El collar con ID ${id} no existe.`);
    }
    if (collar.isArchived) {
      throw new BadRequestException(`El collar ${collar.identifier} está archivado / fuera de servicio.`);
    }
    if (targetFarmId) {
      if (!collar.farmId) {
        throw new BadRequestException(
          `El collar ${collar.identifier} se encuentra en Stock Central. Debe ser asignado a este establecimiento por el Superadministrador antes de colocarlo en ganado.`
        );
      }
      if (collar.farmId !== targetFarmId) {
        throw new BadRequestException(
          `El collar ${collar.identifier} pertenece a otro establecimiento. No puede ser colocado en ganado de este campo.`
        );
      }
    }
    const activeAssignment = await this.prisma.animalCollar.findFirst({
      where: { collarId: id, endAt: null },
    });
    if (activeAssignment) {
      throw new BadRequestException(`El collar ${collar.identifier} ya está asignado a otro animal.`);
    }
    return collar;
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
        isArchived: false,
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
