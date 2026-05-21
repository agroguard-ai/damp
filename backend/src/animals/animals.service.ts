import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAnimalDto: CreateAnimalDto) {
    const { farmId, tag, breed, weightKg, ageMonths, collarMacAddress } = createAnimalDto;

    // Calcular fecha de nacimiento en base a la edad en meses
    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - ageMonths);

    // 1. Validar que la granja exista
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException(`La granja con ID ${farmId} no existe.`);
    }

    // 2. Si se proporcionó un collar, verificar que exista o crearlo
    let collarId: string | null = null;
    if (collarMacAddress) {
      let collar = await this.prisma.collar.findUnique({
        where: { serialNumber: collarMacAddress },
      });

      if (!collar) {
        collar = await this.prisma.collar.create({
          data: {
            serialNumber: collarMacAddress,
            status: 'ACTIVE',
          },
        });
      }
      collarId = collar.id;
    }

    // 3. Crear el registro del animal (Vaca)
    const animal = await this.prisma.animal.create({
      data: {
        farmId,
        tag,
        breed,
        weightKg,
        birthDate,
        animalType: 'COW', // Hardcodeado como Vaca según US 2.1
        status: 'ACTIVE',
      },
    });

    // 4. Vincular el collar al animal
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

  async findAll(query: {
    farmId?: string;
    sectorId?: string;
    animalType?: string;
    collarStatus?: string;
    healthStatus?: string;
    status?: string;
  }) {
    const { farmId, sectorId, animalType, collarStatus, healthStatus, status } = query;
    const whereClause: any = {};

    if (farmId) {
      whereClause.farmId = farmId;
    }

    // Por defecto mostramos solo los activos si no se pide un estado específico
    whereClause.status = status ? status : 'ACTIVE';

    if (animalType) {
      whereClause.animalType = animalType;
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

    if (collarStatus) {
      whereClause.animalCollars = {
        some: {
          collar: {
            status: collarStatus,
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
        animalCollars: {
          where: { endAt: null },
          include: {
            collar: true,
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

  findOne(id: string) {
    return this.prisma.animal.findUnique({
      where: { id },
      include: {
        animalCollars: {
          include: { collar: true }
        },
        animalGeofences: {
          include: {
            geofence: {
              include: { sector: true }
            }
          }
        },
        medicalEvents: {
          orderBy: { occurredAt: 'desc' }
        }
      }
    });
  }

  async archive(id: string, status: string) {
    // 1. Verificar existencia del animal y relaciones activas
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

    // 2. Liberar el collar activo (si tuviera uno)
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

    // 4. Cambiar el estado del animal
    const updatedAnimal = await this.prisma.animal.update({
      where: { id },
      data: {
        status,
      },
    });

    // 5. Registrar en el historial de eventos médicos el archivo del animal
    await this.prisma.medicalEvent.create({
      data: {
        animalId: id,
        type: 'TREATMENT', // Ocupamos un tipo genérico del enum para registrar la baja
        description: `Baja del animal del sistema. Motivo: ${status === 'SOLD' ? 'Vendido' : 'Fallecido'}.`,
        occurredAt: new Date(),
      },
    });

    return {
      message: `Animal archivado con éxito. Estado: ${status}`,
      animal: updatedAnimal,
    };
  }
}
