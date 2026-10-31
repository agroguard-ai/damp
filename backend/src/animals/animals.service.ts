import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { startOfDay, endOfDay } from '@/common/date-range';
import { ONLY_WITH_GPS_FIX } from '@/common/gps';
import { CollarsService } from '@/collars/collars.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { BulkAssignGeofenceDto } from './dto/bulk-assign-geofence.dto';
import { BulkTransferFarmDto } from './dto/bulk-transfer-farm.dto';
import { BulkAssignFarmDto } from './dto/bulk-assign-farm.dto';
import { GlobalRole, Prisma } from '@generated/prisma';

@Injectable()
export class AnimalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collarsService: CollarsService
  ) {}

  private async checkFarmAccess(
    farmId: string | null,
    userId: string,
    requireAdmin: boolean = false,
    allowArchived: boolean = false
  ) {
    if (!farmId) {
      throw new NotFoundException('Campo no encontrado');
    }

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        farmUsers: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    if (!farm) {
      throw new NotFoundException('Campo no encontrado');
    }

    if (!farm.isActive && !allowArchived) {
      throw new NotFoundException('Campo no encontrado o inactivo');
    }

    const isOwner = farm.userId === userId;
    const activeMember = farm.farmUsers?.find((fu) => (farm.isActive ? fu.isActive : true));
    const userRole = activeMember?.role?.name;
    const isAdmin = isOwner || userRole === 'ADMIN';

    if (requireAdmin && !isAdmin) {
      throw new ForbiddenException('Se requieren permisos de administrador del campo para realizar esta acción');
    }

    if (!isOwner && (!farm.farmUsers || farm.farmUsers.length === 0)) {
      throw new ForbiddenException('No tenés acceso a este campo');
    }

    return { farm, isAdmin, isOwner, canWrite: isAdmin || userRole === 'OPERATOR' };
  }

  /** Acceso a un animal: por su campo actual o, si quedó libre, por su dueño. */
  private async checkAnimalAccess(
    animal: { farmId: string | null; ownerId?: string | null },
    userId: string,
    allowArchived: boolean = false,
    requireAdmin: boolean = false
  ) {
    if (animal.farmId) {
      return this.checkFarmAccess(animal.farmId, userId, requireAdmin, allowArchived);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;
    if (!isSuperAdmin && animal.ownerId !== userId) {
      throw new ForbiddenException('No tenés acceso a este animal');
    }

    return { farm: null, isAdmin: true, isOwner: true, canWrite: true };
  }

  async create(createAnimalDto: CreateAnimalDto, userId: string) {
    const { farmId, tag, breed, weightKg, ageMonths, collarId, animalTypeId } = createAnimalDto;

    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - ageMonths);

    const { farm } = await this.checkFarmAccess(farmId, userId);

    if (collarId) {
      await this.collarsService.assertAvailableForAssignment(collarId, farmId);
    }

    const animal = await this.prisma.animal.create({
      data: {
        farmId,
        ownerId: farm.userId ?? userId,
        tag,
        breed,
        weightKg,
        birthDate,
        animalTypeId: animalTypeId || null,
        status: 'ACTIVE',
        isArchived: false,
      },
    });

    if (collarId) {
      await this.prisma.animalCollar.create({
        data: {
          animalId: animal.id,
          collarId: collarId,
          startAt: new Date(),
        },
      });

      // Asegurar que el collar quede con notificación pendiente de cerco para recibirlo en su próximo reporte
      await this.prisma.collar.update({
        where: { id: collarId },
        data: {
          fenceNotificationPending: true,
        },
      });
    }

    return {
      message: 'Animal creado exitosamente',
      animal,
      collarLinked: !!collarId,
    };
  }

  async findAll(
    query: {
      farmId?: string;
      geofenceId?: string;
      animalType?: string;
      healthStatus?: string;
      status?: string;
      hasActiveAlert?: string;
      hasCollar?: string;
      unassigned?: string;
    },
    userId: string
  ) {
    const { farmId, geofenceId, animalType, healthStatus, status, hasActiveAlert, hasCollar, unassigned } =
      query;
    const whereClause: any = {};

    // Filtrado por campo activo del usuario autenticado (dueño o empleado)
    if (farmId) {
      await this.checkFarmAccess(farmId, userId);
      whereClause.farmId = farmId;
    } else if (unassigned === 'true') {
      // Animales libres: sin campo, pero con dueño para no mezclar tenants.
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      whereClause.farmId = null;
      if (user?.globalRole !== GlobalRole.SUPER_ADMIN) {
        whereClause.ownerId = userId;
      }
    } else {
      const userFarms = await this.prisma.farm.findMany({
        where: {
          OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
          isActive: true,
        },
        select: { id: true },
      });
      const farmIds = userFarms.map((f) => f.id);
      whereClause.farmId = { in: farmIds };
    }

    // Manejo de borrado lógico (isArchived)
    if (status === 'ACTIVE' || !status) {
      whereClause.isArchived = false;
    } else if (status === 'SOLD' || status === 'DEAD') {
      whereClause.isArchived = true;
      whereClause.status = status;
    }

    if (animalType) {
      whereClause.animalTypeId = animalType;
    }

    if (geofenceId) {
      whereClause.animalGeofences = { some: { geofenceId, endAt: null } };
    }

    if (healthStatus) {
      if (['TREATMENT', 'VACCINATION', 'SURGERY'].includes(healthStatus)) {
        whereClause.medicalEvents = {
          some: {
            type: healthStatus,
          },
        };
      }
    }

    if (hasActiveAlert === 'true') {
      whereClause.alerts = { some: { isResolved: false } };
    }

    if (hasCollar === 'true') {
      whereClause.animalCollars = { some: { endAt: null } };
    } else if (hasCollar === 'false') {
      whereClause.animalCollars = { none: { endAt: null } };
    }

    return this.prisma.animal.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        animalType: true,
        animalCollars: {
          where: { endAt: null },
          include: {
            collar: {
              include: {
                telemetryReadings: {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        animalGeofences: {
          where: { endAt: null },
          include: {
            geofence: true,
          },
        },
        medicalEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        farm: true,
        animalType: true,
        animalCollars: {
          where: { endAt: null },
          include: {
            collar: {
              include: {
                telemetryReadings: {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        animalGeofences: {
          where: { endAt: null },
          include: {
            geofence: true,
          },
        },
        medicalEvents: {
          orderBy: { occurredAt: 'desc' },
        },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);

    return animal;
  }

  async update(id: string, updateAnimalDto: UpdateAnimalDto, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        animalCollars: { where: { endAt: null } },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);

    // 1. Verificación de caravana duplicada en el mismo campo
    if (updateAnimalDto.tag && updateAnimalDto.tag !== animal.tag) {
      const existingWithTag = await this.prisma.animal.findFirst({
        where: {
          ...(animal.farmId ? { farmId: animal.farmId } : { farmId: null, ownerId: animal.ownerId }),
          tag: updateAnimalDto.tag,
          isArchived: false,
          id: { not: id },
        },
      });
      if (existingWithTag) {
        throw new ConflictException(
          `Ya existe un animal activo con la caravana "${updateAnimalDto.tag}" en este campo.`
        );
      }
    }

    // 2. Verificación de tipo de animal si fue provisto
    if (updateAnimalDto.animalTypeId) {
      const typeExists = await this.prisma.animalType.findUnique({
        where: { id: updateAnimalDto.animalTypeId },
      });
      if (!typeExists) {
        throw new NotFoundException('El tipo de animal especificado no existe.');
      }
    }

    // 3. Calcular fecha de nacimiento estimada si se especificó ageMonths
    let birthDate: Date | undefined = undefined;
    if (updateAnimalDto.ageMonths !== undefined && updateAnimalDto.ageMonths !== null) {
      birthDate = new Date();
      birthDate.setMonth(birthDate.getMonth() - updateAnimalDto.ageMonths);
    }

    // 4. Registro automático de pesaje en historial clínico si cambió el peso
    const weightChanged =
      updateAnimalDto.weightKg !== undefined &&
      updateAnimalDto.weightKg !== null &&
      updateAnimalDto.weightKg !== animal.weightKg;

    if (weightChanged) {
      await this.prisma.medicalEvent.create({
        data: {
          animalId: id,
          type: 'WEIGHING',
          value: updateAnimalDto.weightKg,
          description: `Actualización de peso registrado: ${updateAnimalDto.weightKg} kg (peso previo: ${animal.weightKg ?? 'N/A'} kg).`,
          occurredAt: new Date(),
        },
      });
    }

    // 5. Manejo de vinculación / desvinculación de collar si viene en el payload
    if (updateAnimalDto.collarId !== undefined) {
      const currentCollarId = animal.animalCollars[0]?.collarId;
      if (updateAnimalDto.collarId && updateAnimalDto.collarId !== currentCollarId) {
        await this.linkCollar(id, updateAnimalDto.collarId, userId);
      } else if (updateAnimalDto.collarId === null && currentCollarId) {
        await this.unlinkCollar(id, userId);
      }
    }

    // 6. Preparar datos para actualización
    const dataToUpdate: any = {};
    if (updateAnimalDto.tag !== undefined) dataToUpdate.tag = updateAnimalDto.tag;
    if (updateAnimalDto.breed !== undefined) dataToUpdate.breed = updateAnimalDto.breed;
    if (updateAnimalDto.weightKg !== undefined) dataToUpdate.weightKg = updateAnimalDto.weightKg;
    if (birthDate !== undefined) dataToUpdate.birthDate = birthDate;
    if (updateAnimalDto.animalTypeId !== undefined) dataToUpdate.animalTypeId = updateAnimalDto.animalTypeId || null;

    const updatedAnimal = await this.prisma.animal.update({
      where: { id },
      data: dataToUpdate,
      include: {
        animalType: true,
        animalCollars: {
          where: { endAt: null },
          include: { collar: true },
        },
        animalGeofences: {
          where: { endAt: null },
          include: { geofence: true },
        },
      },
    });

    return {
      message: 'Animal actualizado exitosamente',
      animal: updatedAnimal,
    };
  }

  async archive(id: string, status: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        farm: true,
        animalCollars: { where: { endAt: null } },
        animalGeofences: { where: { endAt: null } },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);

    const now = new Date();

    // 2. Liberar el collar activo
    if (animal.animalCollars.length > 0) {
      await this.prisma.animalCollar.updateMany({
        where: {
          animalId: id,
          endAt: null,
        },
        data: {
          endAt: now,
        },
      });
    }

    // 3. Quitar de las geocercas activas
    if (animal.animalGeofences.length > 0) {
      await this.prisma.animalGeofence.updateMany({
        where: {
          animalId: id,
          endAt: null,
        },
        data: {
          endAt: now,
        },
      });
    }

    // 4. Cambiar el estado y archivar
    const updatedAnimal = await this.prisma.animal.update({
      where: { id },
      data: {
        status,
        isArchived: true,
      },
    });

    // 5. Registrar en el historial del animal
    await this.prisma.medicalEvent.create({
      data: {
        animalId: id,
        type: null,
        description: `Baja del animal del sistema. Motivo: ${status === 'SOLD' ? 'Vendido' : 'Fallecido'}.`,
        occurredAt: now,
      },
    });

    return {
      message: `Animal archivado con éxito. Estado: ${status}`,
      animal: updatedAnimal,
    };
  }

  /**
   * Asigna (o quita, con geofenceId null) varios animales a un cerco del campo.
   * Igual que la asignación individual: el cerco tiene que estar activo y cada animal
   * necesita un collar activo para poder ser contenido.
   */
  async bulkAssignGeofence(dto: BulkAssignGeofenceDto, userId: string) {
    const { farmId, animalIds, geofenceId } = dto;
    await this.checkFarmAccess(farmId, userId);

    if (geofenceId) {
      const geofence = await this.prisma.geofence.findFirst({
        where: { id: geofenceId, farmId, active: true },
      });
      if (!geofence) {
        throw new NotFoundException('El cerco seleccionado no existe, no está activo o no pertenece a este campo.');
      }
    }

    const animals = await this.prisma.animal.findMany({
      where: { id: { in: animalIds }, farmId },
      include: { animalCollars: { where: { endAt: null } } },
    });

    if (animals.length === 0) {
      return { count: 0, message: 'No se encontraron animales para actualizar' };
    }

    if (geofenceId) {
      const withoutCollar = animals.filter((a) => a.animalCollars.length === 0);
      if (withoutCollar.length > 0) {
        throw new BadRequestException(
          `No se pueden asignar animales a un cerco virtual sin collar activo: ${withoutCollar
            .map((a) => a.tag ?? a.id)
            .join(', ')}`
        );
      }
    }

    const now = new Date();
    const targetAnimalIds = animals.map((a) => a.id);
    const collarIds = animals.flatMap((a) => a.animalCollars.map((ac) => ac.collarId));

    await this.prisma.$transaction(async (tx) => {
      // Un animal solo puede estar contenido por un cerco a la vez
      await tx.animalGeofence.updateMany({
        where: { animalId: { in: targetAnimalIds }, endAt: null },
        data: { endAt: now },
      });

      if (geofenceId) {
        await tx.animalGeofence.createMany({
          data: targetAnimalIds.map((animalId) => ({ animalId, geofenceId, startAt: now })),
        });

        if (collarIds.length > 0) {
          await tx.collar.updateMany({
            where: { id: { in: collarIds } },
            data: { fenceNotificationPending: true },
          });
        }
      }
    });

    return {
      count: targetAnimalIds.length,
      message: geofenceId
        ? `Se asignaron ${targetAnimalIds.length} animales al cerco seleccionado.`
        : `Se quitaron ${targetAnimalIds.length} animales de su cerco.`,
    };
  }

  async bulkTransferFarm(dto: BulkTransferFarmDto, userId: string) {
    const { sourceFarmId, targetFarmId, animalIds } = dto;

    if (sourceFarmId === targetFarmId) {
      throw new BadRequestException('El campo de origen y destino deben ser distintos.');
    }

    // El guard solo puede validar un campo; acá se exige rol de escritura en origen y destino.
    const [source, target] = await Promise.all([
      this.checkFarmAccess(sourceFarmId, userId),
      this.checkFarmAccess(targetFarmId, userId),
    ]);
    if (!source.canWrite || !target.canWrite) {
      throw new ForbiddenException('Se requiere rol de administrador u operador en ambos campos.');
    }

    const animals = await this.prisma.animal.findMany({
      where: { id: { in: animalIds }, farmId: sourceFarmId },
      include: {
        animalCollars: { where: { endAt: null } },
      },
    });

    if (animals.length === 0) {
      return { count: 0, message: 'No se encontraron animales para transferir' };
    }

    const targetAnimalIds = animals.map((a) => a.id);
    const collarIds = animals.flatMap((a) => a.animalCollars.map((ac) => ac.collarId));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Cerrar cercos virtuales activos (pertenecían al campo origen)
      await tx.animalGeofence.updateMany({
        where: { animalId: { in: targetAnimalIds }, endAt: null },
        data: { endAt: now },
      });

      // 2. Transferir animales al nuevo campo (y su dueño, si cambia de administrador)
      await tx.animal.updateMany({
        where: { id: { in: targetAnimalIds } },
        data: { farmId: targetFarmId, ownerId: target.farm.userId ?? userId },
      });

      // 3. Mantener collares alineados al nuevo campo
      if (collarIds.length > 0) {
        await tx.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { farmId: targetFarmId },
        });
      }

      // 4. Registrar en historial del animal
      for (const animal of animals) {
        await tx.medicalEvent.create({
          data: {
            animalId: animal.id,
            type: null,
            description: 'Traslado hacia nuevo campo.',
            occurredAt: now,
          },
        });
      }
    });

    return {
      count: targetAnimalIds.length,
      message: `Se trasladaron ${targetAnimalIds.length} animales al nuevo campo exitosamente.`,
    };
  }

  /** Asigna al campo indicado un lote de animales que quedaron sin campo (farmId = null). */
  async bulkAssignFarm(dto: BulkAssignFarmDto, userId: string) {
    const { targetFarmId, animalIds } = dto;

    const { farm: target } = await this.checkFarmAccess(targetFarmId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;

    const animals = await this.prisma.animal.findMany({
      where: {
        id: { in: animalIds },
        farmId: null,
        ...(isSuperAdmin ? {} : { ownerId: userId }),
      },
      include: {
        animalCollars: { where: { endAt: null } },
      },
    });

    if (animals.length === 0) {
      return { count: 0, message: 'No se encontraron animales libres para asignar' };
    }

    const targetAnimalIds = animals.map((a) => a.id);
    const collarIds = animals.flatMap((a) => a.animalCollars.map((ac) => ac.collarId));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.animalGeofence.updateMany({
        where: { animalId: { in: targetAnimalIds }, endAt: null },
        data: { endAt: now },
      });

      await tx.animal.updateMany({
        where: { id: { in: targetAnimalIds } },
        data: { farmId: targetFarmId, ownerId: target.userId ?? userId },
      });

      if (collarIds.length > 0) {
        await tx.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { farmId: targetFarmId },
        });
      }

      for (const animal of animals) {
        await tx.medicalEvent.create({
          data: {
            animalId: animal.id,
            type: null,
            description: 'Asignación a nuevo campo.',
            occurredAt: now,
          },
        });
      }
    });

    return {
      count: targetAnimalIds.length,
      message: `Se asignaron ${targetAnimalIds.length} animales al campo exitosamente.`,
    };
  }

  async linkCollar(id: string, collarId: number, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: { animalCollars: { where: { endAt: null } } },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);
    await this.collarsService.assertAvailableForAssignment(collarId, animal.farmId ?? undefined);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Cerrar collar previo si hubiera
      if (animal.animalCollars.length > 0) {
        await tx.animalCollar.updateMany({
          where: { animalId: id, endAt: null },
          data: { endAt: now },
        });
      }

      // Vincular nuevo collar
      await tx.animalCollar.create({
        data: {
          animalId: id,
          collarId,
          startAt: now,
        },
      });

      // Asegurar que el collar quede con notificación pendiente de cerco para recibirlo en su próximo reporte
      await tx.collar.update({
        where: { id: collarId },
        data: {
          fenceNotificationPending: true,
        },
      });
    });

    return { message: 'Collar vinculado exitosamente', collarId };
  }

  async unlinkCollar(id: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        animalCollars: { where: { endAt: null } },
        animalGeofences: { where: { endAt: null } },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Desvincular collar
      await tx.animalCollar.updateMany({
        where: { animalId: id, endAt: null },
        data: { endAt: now },
      });

      // REGLA ESTRICTA: El cerco virtual REQUIERE collar.
      // Al desvincular el collar, se desvincula automáticamente de cualquier cerco activo.
      if (animal.animalGeofences.length > 0) {
        await tx.animalGeofence.updateMany({
          where: { animalId: id, endAt: null },
          data: { endAt: now },
        });
      }
    });

    return { message: 'Collar desvinculado exitosamente y cerco virtual cerrado.' };
  }

  async assignGeofence(id: string, geofenceId: string | null, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        animalCollars: { where: { endAt: null } },
        animalGeofences: { where: { endAt: null } },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkAnimalAccess(animal, userId);

    const now = new Date();

    if (!geofenceId) {
      await this.prisma.animalGeofence.updateMany({
        where: { animalId: id, endAt: null },
        data: { endAt: now },
      });
      return { message: 'Animal removido del cerco virtual.' };
    }

    // REGLA ESTRICTA: Cerco Eléctrico Virtual REQUIERE collar activo
    if (animal.animalCollars.length === 0) {
      throw new BadRequestException(
        'No se puede asignar un animal a un cerco eléctrico virtual sin tener un collar activo vinculado.'
      );
    }

    const geofence = await this.prisma.geofence.findUnique({
      where: { id: geofenceId },
    });

    if (!geofence || !geofence.active) {
      throw new NotFoundException('El cerco virtual especificado no existe o no está activo.');
    }

    if (geofence.farmId !== animal.farmId) {
      throw new ForbiddenException('El cerco virtual pertenece a otro campo.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.animalGeofence.updateMany({
        where: { animalId: id, endAt: null },
        data: { endAt: now },
      });

      await tx.animalGeofence.create({
        data: {
          animalId: id,
          geofenceId,
          startAt: now,
        },
      });

      // Marcar el collar activo del animal como pendiente de notificación de cerco
      if (animal.animalCollars.length > 0) {
        const collarIds = animal.animalCollars.map((ac) => ac.collarId);
        await tx.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { fenceNotificationPending: true },
        });
      }
    });

    return { message: 'Animal asignado al cerco virtual exitosamente.' };
  }

  async getLiveLocations(userId: string, farmId?: string) {
    let farmIds: string[] = [];
    if (farmId) {
      const { farm } = await this.checkFarmAccess(farmId, userId);
      farmIds = [farm.id];
    } else {
      const userFarms = await this.prisma.farm.findMany({
        where: {
          OR: [{ userId }, { farmUsers: { some: { userId, isActive: true } } }],
          isActive: true,
        },
        select: { id: true },
      });
      farmIds = userFarms.map((f) => f.id);
    }

    const animals = await this.prisma.animal.findMany({
      where: {
        farmId: { in: farmIds },
        isArchived: false,
      },
      include: {
        animalType: true,
        alerts: {
          where: {
            type: 'ESCAPE',
            isResolved: false,
          },
          take: 1,
        },
        animalCollars: {
          where: { endAt: null },
          include: {
            collar: {
              include: {
                telemetryReadings: {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        animalGeofences: {
          where: { endAt: null },
          select: { geofence: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });

    return animals.map((animal) => {
      const collar = animal.animalCollars[0]?.collar;
      const latestReading = collar?.telemetryReadings?.[0] || null;

      return {
        id: animal.id,
        tag: animal.tag,
        breed: animal.breed,
        weightKg: animal.weightKg,
        status: animal.status,
        hasActiveAlert: animal.alerts.length > 0,
        animalType: animal.animalType
          ? {
              id: animal.animalType.id,
              name: animal.animalType.name,
              species: animal.animalType.species,
            }
          : null,
        geofence: animal.animalGeofences[0]?.geofence ?? null,
        collar: collar
          ? {
              id: collar.id,
            }
          : null,
        latestReading: latestReading
          ? {
              id: latestReading.id,
              latitude: latestReading.latitude,
              longitude: latestReading.longitude,
              temperature: latestReading.temperature,
              timestamp: latestReading.timestamp,
            }
          : null,
      };
    });
  }

  async getAnimalTrajectory(animalId: string, userId: string, from?: string, to?: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        animalType: { select: { id: true, name: true, species: true } },
        animalCollars: {
          select: {
            collarId: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });

    if (!animal) {
      throw new NotFoundException(`Animal con ID "${animalId}" no encontrado`);
    }

    // Los recorridos históricos también deben poder consultarse desde un animal sin campo.
    await this.checkAnimalAccess(animal, userId, true);

    const collarIds = animal.animalCollars.map((ac) => ac.collarId);
    if (collarIds.length === 0) {
      return {
        points: [],
        totalPoints: 0,
        animal: {
          id: animal.id,
          tag: animal.tag,
          breed: animal.breed,
          animalType: animal.animalType,
        },
      };
    }

    const timestampFilter: Prisma.DateTimeFilter = {};
    if (from) {
      timestampFilter.gte = startOfDay(from);
    }
    if (to) {
      timestampFilter.lte = endOfDay(to);
    }

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: collarIds },
        ...(from || to ? { timestamp: timestampFilter } : {}),
        // Sin fix GPS el collar manda 0,0: no se dibuja en el recorrido
        ...ONLY_WITH_GPS_FIX,
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        temperature: true,
        timestamp: true,
      },
      take: 1000,
    });

    return {
      points: readings,
      totalPoints: readings.length,
      animal: {
        id: animal.id,
        tag: animal.tag,
        breed: animal.breed,
        animalType: animal.animalType,
      },
    };
  }

  /**
   * Atribuye on-demand las lecturas históricas que todavía tienen `farmId = null`.
   * Solo considera vínculos Animal–Collar de animales del campo y respeta la ventana
   * startAt/endAt del vínculo: una vez atribuida, la lectura queda asociada a ese campo
   * aunque el animal luego se traslade o el campo se archive.
   */
  private async attributeOrphanTelemetry(farmId: string, timestampFilter: Prisma.DateTimeFilter) {
    const links = await this.prisma.animalCollar.findMany({
      where: { animal: { farmId, isArchived: false } },
      select: { collarId: true, startAt: true, endAt: true },
    });

    if (links.length === 0) return;

    const intervalsByCollar = new Map<number, { startAt: Date; endAt: Date | null }[]>();
    for (const link of links) {
      const intervals = intervalsByCollar.get(link.collarId) ?? [];
      intervals.push({ startAt: link.startAt, endAt: link.endAt });
      intervalsByCollar.set(link.collarId, intervals);
    }

    const candidates = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: [...intervalsByCollar.keys()] },
        farmId: null,
        timestamp: timestampFilter,
        ...ONLY_WITH_GPS_FIX,
      },
      select: { id: true, collarId: true, timestamp: true },
      take: 10000,
    });

    const ids = candidates
      .filter((reading) =>
        intervalsByCollar
          .get(reading.collarId)!
          .some(
            (interval) =>
              reading.timestamp >= interval.startAt &&
              (!interval.endAt || reading.timestamp <= interval.endAt)
          )
      )
      .map((reading) => reading.id);

    if (ids.length > 0) {
      await this.prisma.telemetryReading.updateMany({
        where: { id: { in: ids }, farmId: null },
        data: { farmId },
      });
    }
  }

  async getFarmHeatmap(farmId: string, userId: string, days = 7, from?: string, to?: string) {
    // El mapa de calor histórico de un campo archivado sigue siendo consultable (solo lectura).
    await this.checkFarmAccess(farmId, userId, false, true);

    const timestampFilter: Prisma.DateTimeFilter = {};
    if (from || to) {
      if (from) timestampFilter.gte = startOfDay(from);
      if (to) timestampFilter.lte = endOfDay(to);
    } else {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      timestampFilter.gte = since;
    }

    // Lecturas previas a esta migración: se sellan con el campo en la primera consulta.
    await this.attributeOrphanTelemetry(farmId, timestampFilter);

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        farmId,
        timestamp: timestampFilter,
        // Sin fix GPS el collar manda 0,0: no se dibuja en el mapa de calor
        ...ONLY_WITH_GPS_FIX,
      },
      orderBy: { timestamp: 'desc' },
      select: {
        latitude: true,
        longitude: true,
      },
      take: 10000,
    });

    return {
      points: readings,
      totalPoints: readings.length,
    };
  }
}
