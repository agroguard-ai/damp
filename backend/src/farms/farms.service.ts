import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFarmDto: CreateFarmDto) {
    return this.prisma.farm.create({
      data: createFarmDto,
    });
  }

  async findAll() {
    return this.prisma.farm.findMany();
  }

  async findOne(id: string) {
    return this.prisma.farm.findUnique({
      where: { id },
    });
  }
}
