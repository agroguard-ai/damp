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
    let collarId = null;
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
  }) {
    const { farmId, sectorId, animalType, collarStatus, healthStatus } = query;
    const whereClause: any = {};

    if (farmId) {
      whereClause.farmId = farmId;
    }

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
      // Filtrar por eventos médicos activos o tipos de eventos
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
}
