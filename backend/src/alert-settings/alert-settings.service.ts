import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

const DEFAULTS = {
  feverThreshold: 39.5,
  hypothermiaThreshold: 37.0,
  inactivityMinutes: 120,
  emailOnEscape: false,
  emailOnHealth: false,
};

@Injectable()
export class AlertSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException(`La granja con ID ${farmId} no existe.`);
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este establecimiento.');
    }
    return farm;
  }

  async findByFarm(farmId: string, userId: string) {
    await this.getOwnedFarm(farmId, userId);
    const settings = await this.prisma.alertSettings.findUnique({ where: { farmId } });
    return settings ?? { farmId, ...DEFAULTS };
  }

  async upsert(farmId: string, dto: UpdateAlertSettingsDto, userId: string) {
    await this.getOwnedFarm(farmId, userId);

    return this.prisma.alertSettings.upsert({
      where: { farmId },
      create: { farmId, ...DEFAULTS, ...dto },
      update: dto,
    });
  }

  /** Umbrales efectivos de una granja para uso interno (ej. iot.service). Nunca lanza: usa defaults si no hay config. */
  async getEffective(farmId: string) {
    const settings = await this.prisma.alertSettings.findUnique({ where: { farmId } });
    return settings ?? DEFAULTS;
  }
}
