import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAnimalTypeDto } from './dto/create-animal-type.dto';

@Injectable()
export class AnimalTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAnimalTypeDto: CreateAnimalTypeDto) {
    const existing = await this.prisma.animalType.findUnique({
      where: { name: createAnimalTypeDto.name },
    });
    if (existing) {
      if (!existing.isActive) {
        return this.prisma.animalType.update({
          where: { id: existing.id },
          data: {
            species: createAnimalTypeDto.species,
            description: createAnimalTypeDto.description ?? null,
            isActive: true,
          },
          include: {
            _count: { select: { animals: true } },
          },
        });
      }
      throw new ConflictException(`Ya existe un tipo de animal registrado con el nombre "${createAnimalTypeDto.name}".`);
    }

    return this.prisma.animalType.create({
      data: {
        name: createAnimalTypeDto.name,
        species: createAnimalTypeDto.species,
        description: createAnimalTypeDto.description ?? null,
        isActive: true,
      },
      include: {
        _count: { select: { animals: true } },
      },
    });
  }

  async findAll(includeInactive: boolean = false) {
    return this.prisma.animalType.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: { animals: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const animalType = await this.prisma.animalType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { animals: true },
        },
      },
    });
    if (!animalType) {
      throw new NotFoundException('Tipo de animal no encontrado');
    }
    return animalType;
  }

  async update(id: string, updateAnimalTypeDto: Partial<CreateAnimalTypeDto> & { isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.animalType.update({
      where: { id },
      data: updateAnimalTypeDto,
      include: {
        _count: {
          select: { animals: true },
        },
      },
    });
  }

  async remove(id: string) {
    const animalType = await this.findOne(id);
    const assignedAnimalsCount = animalType._count?.animals ?? 0;

    // Regla de negocio CU006:
    // Si tiene animales existentes asignados, se realiza una BAJA LÓGICA (isActive: false)
    // para que nuevos animales no puedan usar este tipo, pero conservando el historial.
    const updated = await this.prisma.animalType.update({
      where: { id },
      data: { isActive: false },
      include: { _count: { select: { animals: true } } },
    });

    if (assignedAnimalsCount > 0) {
      return {
        message: `El tipo de animal "${animalType.name}" posee ${assignedAnimalsCount} animal(es) asignados. Se realizó la baja lógica para conservar su historial.`,
        animalType: updated,
        isArchived: true,
      };
    }

    return {
      message: `Tipo de animal "${animalType.name}" dado de baja correctamente.`,
      animalType: updated,
      isArchived: true,
    };
  }

  async reactivate(id: string) {
    await this.findOne(id);
    const updated = await this.prisma.animalType.update({
      where: { id },
      data: { isActive: true },
      include: { _count: { select: { animals: true } } },
    });
    return {
      message: `Tipo de animal "${updated.name}" reactivado exitosamente. Ya está disponible para nuevos animales.`,
      animalType: updated,
    };
  }
}
