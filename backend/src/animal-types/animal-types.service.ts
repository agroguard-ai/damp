import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalTypeDto } from './dto/create-animal-type.dto';

@Injectable()
export class AnimalTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAnimalTypeDto: CreateAnimalTypeDto) {
    return this.prisma.animalType.create({
      data: {
        name: createAnimalTypeDto.name,
        species: createAnimalTypeDto.species,
        description: createAnimalTypeDto.description ?? null,
      },
    });
  }

  async findAll() {
    return this.prisma.animalType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const animalType = await this.prisma.animalType.findUnique({
      where: { id },
    });
    if (!animalType) {
      throw new NotFoundException('AnimalType not found');
    }
    return animalType;
  }

  async update(id: string, updateAnimalTypeDto: Partial<CreateAnimalTypeDto>) {
    await this.findOne(id);
    return this.prisma.animalType.update({
      where: { id },
      data: updateAnimalTypeDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.animalType.delete({
      where: { id },
    });
  }
}
