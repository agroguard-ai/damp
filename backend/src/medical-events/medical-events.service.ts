import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMedicalEventDto } from './dto/create-medical-event.dto';

@Injectable()
export class MedicalEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedAnimal(animalId: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        farm: {
          include: {
            farmUsers: {
              where: { userId, isActive: true },
            },
          },
        },
      },
    });
    if (!animal) {
      throw new NotFoundException(`El animal con ID ${animalId} no existe.`);
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (dbUser?.globalRole === 'SUPER_ADMIN') {
      return animal;
    }

    const isOwner = animal.farm.userId === userId;
    const isMember = animal.farm.farmUsers && animal.farm.farmUsers.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('No tienes acceso a este animal.');
    }
    return animal;
  }

  async create(dto: CreateMedicalEventDto, userId: string) {
    await this.getOwnedAnimal(dto.animalId, userId);

    const event = await this.prisma.medicalEvent.create({
      data: {
        animalId: dto.animalId,
        type: dto.type,
        description: dto.description,
        value: dto.value,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });

    // El registro de pesaje actualiza el peso vigente del animal (dato acumulativo, no solo histórico).
    if (dto.type === 'WEIGHING' && dto.value !== undefined) {
      await this.prisma.animal.update({
        where: { id: dto.animalId },
        data: { weightKg: dto.value },
      });
    }

    return event;
  }

  async findAllByAnimal(animalId: string, userId: string) {
    await this.getOwnedAnimal(animalId, userId);

    return this.prisma.medicalEvent.findMany({
      where: { animalId },
      orderBy: { occurredAt: 'desc' },
    });
  }
}
