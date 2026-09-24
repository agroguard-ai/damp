import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CollarsService } from '@/collars/collars.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { BulkAssignZoneDto } from './dto/bulk-assign-zone.dto';
import { BulkTransferFarmDto } from './dto/bulk-transfer-farm.dto';
import { Prisma } from '@generated/prisma';

@Injectable()
export class AnimalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collarsService: CollarsService
  ) {}

  private async checkFarmAccess(farmId: string, userId: string, requireAdmin: boolean = false) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        farmUsers: {
          where: { userId, isActive: true },
          include: { role: true },
        },
      },
    });

    if (!farm || farm.isActive === false) {
      throw new NotFoundException('Establecimiento no encontrado o inactivo');
    }

    const isOwner = farm.userId === userId;
    const userRole = farm.farmUsers?.[0]?.role?.name;
    const isAdmin = isOwner || userRole === 'ADMIN';

    if (requireAdmin && !isAdmin) {
      throw new ForbiddenException('Se requieren permisos de administrador de la granja para realizar esta acción');
    }

    if (!isOwner && (!farm.farmUsers || farm.farmUsers.length === 0)) {
      throw new ForbiddenException('No tenés acceso a este establecimiento');
    }

    return { farm, isAdmin, isOwner };
  }

  async create(createAnimalDto: CreateAnimalDto, userId: string) {
    const { farmId, tag, breed, weightKg, ageMonths, collarId, animalTypeId, zoneId } = createAnimalDto;

    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - ageMonths);

    await this.checkFarmAccess(farmId, userId);

    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, farmId },
      });
      if (!zone) {
        throw new NotFoundException(`La zona con ID ${zoneId} no pertenece a este establecimiento.`);
      }
    }

    if (collarId) {
      await this.collarsService.assertAvailableForAssignment(collarId);
    }

    const animal = await this.prisma.animal.create({
      data: {
        farmId,
        tag,
        breed,
        weightKg,
        birthDate,
        animalTypeId: animalTypeId || null,
        zoneId: zoneId || null,
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

      // Asegurar que el collar quede asignado al farmId de este animal
      await this.prisma.collar.update({
        where: { id: collarId },
        data: { farmId },
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
      zoneId?: string;
      animalType?: string;
      healthStatus?: string;
      status?: string;
      hasActiveAlert?: string;
      hasCollar?: string;
    },
    userId: string
  ) {
    const { farmId, zoneId, animalType, healthStatus, status, hasActiveAlert, hasCollar } = query;
    const whereClause: any = {};

    // Filtrado por establecimiento del usuario autenticado (dueño o empleado activo)
    if (farmId) {
      await this.checkFarmAccess(farmId, userId);
      whereClause.farmId = farmId;
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

    if (zoneId) {
      whereClause.zoneId = zoneId;
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
        zone: true,
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
        zone: true,
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

    await this.checkFarmAccess(animal.farmId, userId);

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

    await this.checkFarmAccess(animal.farmId, userId);

    // 1. Verificación de caravana duplicada en el mismo establecimiento
    if (updateAnimalDto.tag && updateAnimalDto.tag !== animal.tag) {
      const existingWithTag = await this.prisma.animal.findFirst({
        where: {
          farmId: animal.farmId,
          tag: updateAnimalDto.tag,
          isArchived: false,
          id: { not: id },
        },
      });
      if (existingWithTag) {
        throw new ConflictException(
          `Ya existe un animal activo con la caravana "${updateAnimalDto.tag}" en este establecimiento.`
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

    // 3. Verificación de potrero / zona si fue provista
    if (updateAnimalDto.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: updateAnimalDto.zoneId, farmId: animal.farmId },
      });
      if (!zone) {
        throw new NotFoundException(`La zona con ID ${updateAnimalDto.zoneId} no pertenece a este establecimiento.`);
      }
    }

    // 4. Calcular fecha de nacimiento estimada si se especificó ageMonths
    let birthDate: Date | undefined = undefined;
    if (updateAnimalDto.ageMonths !== undefined && updateAnimalDto.ageMonths !== null) {
      birthDate = new Date();
      birthDate.setMonth(birthDate.getMonth() - updateAnimalDto.ageMonths);
    }

    // 5. Registro automático de pesaje en historial clínico si cambió el peso
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

    // 6. Manejo de vinculación / desvinculación de collar si viene en el payload
    if (updateAnimalDto.collarId !== undefined) {
      const currentCollarId = animal.animalCollars[0]?.collarId;
      if (updateAnimalDto.collarId && updateAnimalDto.collarId !== currentCollarId) {
        await this.linkCollar(id, updateAnimalDto.collarId, userId);
      } else if (updateAnimalDto.collarId === null && currentCollarId) {
        await this.unlinkCollar(id, userId);
      }
    }

    // 7. Preparar datos para actualización
    const dataToUpdate: any = {};
    if (updateAnimalDto.tag !== undefined) dataToUpdate.tag = updateAnimalDto.tag;
    if (updateAnimalDto.breed !== undefined) dataToUpdate.breed = updateAnimalDto.breed;
    if (updateAnimalDto.weightKg !== undefined) dataToUpdate.weightKg = updateAnimalDto.weightKg;
    if (birthDate !== undefined) dataToUpdate.birthDate = birthDate;
    if (updateAnimalDto.animalTypeId !== undefined) dataToUpdate.animalTypeId = updateAnimalDto.animalTypeId || null;
    if (updateAnimalDto.zoneId !== undefined) dataToUpdate.zoneId = updateAnimalDto.zoneId || null;

    const updatedAnimal = await this.prisma.animal.update({
      where: { id },
      data: dataToUpdate,
      include: {
        animalType: true,
        zone: true,
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

    await this.checkFarmAccess(animal.farmId, userId);

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

  async updateZone(id: string, zoneId: string | null, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { geofence: true },
        },
      },
    });

    if (!animal) {
      throw new NotFoundException(`El animal con ID ${id} no existe.`);
    }

    await this.checkFarmAccess(animal.farmId, userId);

    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, farmId: animal.farmId },
      });
      if (!zone) {
        throw new NotFoundException(`La zona con ID ${zoneId} no existe en este establecimiento.`);
      }
    }

    const now = new Date();

    // Si la zona cambia y el animal estaba en un cerco que no pertenece a la nueva zona, se cierra
    if (animal.animalGeofences.length > 0) {
      const geofencesToClose = animal.animalGeofences
        .filter((ag) => ag.geofence.zoneId !== zoneId)
        .map((ag) => ag.id);

      if (geofencesToClose.length > 0) {
        await this.prisma.animalGeofence.updateMany({
          where: { id: { in: geofencesToClose } },
          data: { endAt: now },
        });
      }
    }

    return this.prisma.animal.update({
      where: { id },
      data: { zoneId: zoneId || null },
      include: {
        zone: true,
        animalGeofences: { where: { endAt: null }, include: { geofence: true } },
        animalCollars: { where: { endAt: null }, include: { collar: true } },
      },
    });
  }

  async bulkAssignZone(dto: BulkAssignZoneDto, userId: string) {
    const { farmId, animalIds, zoneId } = dto;
    await this.checkFarmAccess(farmId, userId);

    if (zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, farmId },
      });
      if (!zone) {
        throw new NotFoundException('La zona seleccionada no pertenece a este establecimiento.');
      }
    }

    const animals = await this.prisma.animal.findMany({
      where: { id: { in: animalIds }, farmId },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { geofence: true },
        },
      },
    });

    if (animals.length === 0) {
      return { count: 0, message: 'No se encontraron animales para actualizar' };
    }

    const now = new Date();
    const targetAnimalIds = animals.map((a) => a.id);

    const geofencesToClose = animals.flatMap((a) =>
      a.animalGeofences.filter((ag) => ag.geofence.zoneId !== zoneId).map((ag) => ag.id)
    );

    await this.prisma.$transaction(async (tx) => {
      if (geofencesToClose.length > 0) {
        await tx.animalGeofence.updateMany({
          where: { id: { in: geofencesToClose } },
          data: { endAt: now },
        });
      }

      await tx.animal.updateMany({
        where: { id: { in: targetAnimalIds } },
        data: { zoneId: zoneId || null },
      });
    });

    return {
      count: targetAnimalIds.length,
      message: `Se actualizaron ${targetAnimalIds.length} animales a la zona ${zoneId ? 'seleccionada' : 'campo abierto'}.`,
    };
  }

  async bulkTransferFarm(dto: BulkTransferFarmDto, userId: string) {
    const { sourceFarmId, targetFarmId, animalIds } = dto;

    if (sourceFarmId === targetFarmId) {
      throw new BadRequestException('El establecimiento de origen y destino deben ser distintos.');
    }

    await this.checkFarmAccess(sourceFarmId, userId);
    await this.checkFarmAccess(targetFarmId, userId);

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
      // 1. Cerrar cercos virtuales activos (pertenecían a zonas del campo origen)
      await tx.animalGeofence.updateMany({
        where: { animalId: { in: targetAnimalIds }, endAt: null },
        data: { endAt: now },
      });

      // 2. Transferir animales al nuevo campo y resetear zona
      await tx.animal.updateMany({
        where: { id: { in: targetAnimalIds } },
        data: {
          farmId: targetFarmId,
          zoneId: null,
        },
      });

      // 3. Mantener collares alineados al nuevo establecimiento
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
            description: 'Traslado de establecimiento hacia nuevo campo.',
            occurredAt: now,
          },
        });
      }
    });

    return {
      count: targetAnimalIds.length,
      message: `Se trasladaron ${targetAnimalIds.length} animales al nuevo establecimiento exitosamente.`,
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

    await this.checkFarmAccess(animal.farmId, userId);
    await this.collarsService.assertAvailableForAssignment(collarId);

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

      // Asegurar farmId en el collar
      await tx.collar.update({
        where: { id: collarId },
        data: { farmId: animal.farmId },
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

    await this.checkFarmAccess(animal.farmId, userId);

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

    await this.checkFarmAccess(animal.farmId, userId);

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
      include: { zone: true },
    });

    if (!geofence || !geofence.active) {
      throw new NotFoundException('El cerco virtual especificado no existe o no está activo.');
    }

    if (geofence.zone.farmId !== animal.farmId) {
      throw new ForbiddenException('El cerco virtual pertenece a otro establecimiento.');
    }

    if (animal.zoneId && geofence.zoneId !== animal.zoneId) {
      throw new BadRequestException(
        `El cerco virtual pertenece a la zona "${geofence.zone.name}", pero el animal está en otra zona.`
      );
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

      // Si el animal no tenía zona asignada, se alinea automáticamente a la zona del cerco
      if (!animal.zoneId) {
        await tx.animal.update({
          where: { id },
          data: { zoneId: geofence.zoneId },
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
        zone: true,
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
        zone: animal.zone
          ? {
              id: animal.zone.id,
              name: animal.zone.name,
              polygonCoordinates: animal.zone.polygonCoordinates,
            }
          : null,
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

    await this.checkFarmAccess(animal.farmId, userId);

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
      timestampFilter.gte = new Date(from);
    }
    if (to) {
      const toDate = new Date(to);
      if (to.length === 10) {
        toDate.setHours(23, 59, 59, 999);
      }
      timestampFilter.lte = toDate;
    }

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: collarIds },
        ...(from || to ? { timestamp: timestampFilter } : {}),
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

  async getFarmHeatmap(farmId: string, userId: string, days = 7, from?: string, to?: string) {
    await this.checkFarmAccess(farmId, userId);

    const animalCollars = await this.prisma.animalCollar.findMany({
      where: {
        animal: { farmId, isArchived: false },
      },
      select: { collarId: true },
    });

    const collarIds = Array.from(new Set(animalCollars.map((ac) => ac.collarId)));
    if (collarIds.length === 0) {
      return { points: [], totalPoints: 0 };
    }

    const timestampFilter: Prisma.DateTimeFilter = {};
    if (from || to) {
      if (from) timestampFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        if (to.length === 10) toDate.setHours(23, 59, 59, 999);
        timestampFilter.lte = toDate;
      }
    } else {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      timestampFilter.gte = since;
    }

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: collarIds },
        timestamp: timestampFilter,
      },
      select: {
        latitude: true,
        longitude: true,
      },
      take: 2000,
    });

    return {
      points: readings,
      totalPoints: readings.length,
    };
  }
}

