import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAnimalDto: CreateAnimalDto, userId: string) {
    const { farmId, tag, breed, weightKg, ageMonths, collarId, animalTypeId, zoneId } = createAnimalDto;

    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - ageMonths);

    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException(`La granja con ID ${farmId} no existe.`);
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este establecimiento.');
    }

    if (collarId) {
      const collar = await this.prisma.collar.findUnique({ where: { id: collarId } });
      if (!collar) {
        throw new NotFoundException(`El collar con ID ${collarId} no existe.`);
      }
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
      sectorId?: string;
      animalType?: string;
      healthStatus?: string;
      status?: string;
    },
    userId: string,
  ) {
    const { farmId, sectorId, animalType, healthStatus, status } = query;
    const whereClause: any = {};

    // Filtrado por establecimiento (farmId) obligatoriamente del usuario autenticado
    if (farmId) {
      const farm = await this.prisma.farm.findFirst({
        where: { id: farmId, userId },
      });
      if (!farm) {
        throw new ForbiddenException('No tienes acceso a este establecimiento.');
      }
      whereClause.farmId = farmId;
    } else {
      // Si no se especifica farmId, traer solo animales de granjas del usuario
      const userFarms = await this.prisma.farm.findMany({
        where: { userId },
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

    if (sectorId) {
      whereClause.animalGeofences = {
        some: {
          geofence: {
            sectorId: sectorId,
          },
          endAt: null,
        },
      };
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

    return this.prisma.animal.findMany({
      where: whereClause,
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
            geofence: {
              include: {
                sector: true,
              },
            },
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
          include: {
            geofence: {
              include: { sector: true },
            },
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

    // Validar propiedad
    if (animal.farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este animal.');
    }

    return animal;
  }

  async archive(id: string, status: string, userId: string) {
    // 1. Verificar existencia y propiedad
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

    if (animal.farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este animal.');
    }

    // 2. Liberar el collar activo
    if (animal.animalCollars.length > 0) {
      await this.prisma.animalCollar.updateMany({
        where: {
          animalId: id,
          endAt: null,
        },
        data: {
          endAt: new Date(),
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
          endAt: new Date(),
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

    // 5. Registrar en el historial de eventos médicos
    await this.prisma.medicalEvent.create({
      data: {
        animalId: id,
        type: 'TREATMENT',
        description: `Baja del animal del sistema. Motivo: ${status === 'SOLD' ? 'Vendido' : 'Fallecido'}.`,
        occurredAt: new Date(),
      },
    });

    return {
      message: `Animal archivado con éxito. Estado: ${status}`,
      animal: updatedAnimal,
    };
  }

  async getLiveLocations(userId: string, farmId?: string) {
    let farmIds: string[] = [];
    if (farmId) {
      const farm = await this.prisma.farm.findFirst({
        where: { id: farmId, userId },
      });
      if (!farm) {
        throw new ForbiddenException('No tienes acceso a este establecimiento.');
      }
      farmIds = [farmId];
    } else {
      const userFarms = await this.prisma.farm.findMany({
        where: { userId },
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
        animalType: animal.animalType ? {
          id: animal.animalType.id,
          name: animal.animalType.name,
          species: animal.animalType.species,
        } : null,
        zone: animal.zone ? {
          id: animal.zone.id,
          name: animal.zone.name,
          polygonCoordinates: animal.zone.polygonCoordinates,
        } : null,
        collar: collar ? {
          id: collar.id,
        } : null,
        latestReading: latestReading ? {
          id: latestReading.id,
          latitude: latestReading.latitude,
          longitude: latestReading.longitude,
          temperature: latestReading.temperature,
          timestamp: latestReading.timestamp,
        } : null,
      };
    });
  }
}
