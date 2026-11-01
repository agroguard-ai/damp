import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import type { Farm } from '@generated/prisma';
import { isPointInPolygon } from '@/iot/utils/geofencing.utils';
import { ONLY_WITH_GPS_FIX } from '@/common/gps';

@Injectable()
export class GeofencesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedFarm(farmId: string, userId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm || !farm.isActive) {
      throw new NotFoundException('Campo no encontrado o inactivo');
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this farm');
    }
    return farm;
  }

  /** Valida que el polígono del cerco quede 100% dentro del perímetro del campo (si el campo lo tiene). */
  private assertInsideFarm(farm: Farm, polygon: [number, number][]) {
    if (!farm.polygonCoordinates || !Array.isArray(polygon) || polygon.length < 3) return;

    let farmCoords: [number, number][] = [];
    try {
      farmCoords =
        typeof farm.polygonCoordinates === 'string'
          ? JSON.parse(farm.polygonCoordinates)
          : (farm.polygonCoordinates as [number, number][]);
    } catch {
      farmCoords = [];
    }

    if (!Array.isArray(farmCoords) || farmCoords.length < 3) return;

    for (const pt of polygon) {
      if (Array.isArray(pt) && pt.length === 2) {
        const inside = isPointInPolygon([pt[0], pt[1]], farmCoords);
        if (!inside) {
          throw new BadRequestException(
            `La coordenada [${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}] del cerco eléctrico está fuera de los límites del campo "${farm.name ?? ''}". El cerco debe estar completamente contenido dentro del perímetro del campo.`
          );
        }
      }
    }
  }

  private parsePolygon(value: unknown): [number, number][] {
    if (!value) return [];
    try {
      const coords: unknown = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(coords) ? (coords as [number, number][]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Impide achicar/mover el cerco de modo que algún animal asignado quede afuera.
   * Se evalúa la telemetría de la última hora: si un animal estaba dentro del trazado
   * anterior y con el nuevo trazado quedaría fuera, se rechaza la edición.
   */
  private async assertAnimalsStayInside(
    geofenceId: string,
    previousPolygon: [number, number][],
    nextPolygon: [number, number][]
  ) {
    const assignments = await this.prisma.animalGeofence.findMany({
      where: { geofenceId, endAt: null },
      select: { animalId: true, animal: { select: { tag: true } } },
    });
    if (assignments.length === 0) return;

    const activeCollars = await this.prisma.animalCollar.findMany({
      where: { animalId: { in: assignments.map((a) => a.animalId) }, endAt: null },
      select: { collarId: true, animalId: true },
    });
    if (activeCollars.length === 0) return;

    const animalIdByCollar = new Map(activeCollars.map((c) => [c.collarId, c.animalId]));
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: activeCollars.map((c) => c.collarId) },
        timestamp: { gte: since },
        ...ONLY_WITH_GPS_FIX,
      },
      select: { collarId: true, latitude: true, longitude: true },
    });

    const tagByAnimal = new Map(assignments.map((a) => [a.animalId, a.animal.tag ?? a.animalId]));
    const offenders = new Set<string>();

    for (const reading of readings) {
      const animalId = animalIdByCollar.get(reading.collarId);
      if (!animalId || offenders.has(animalId)) continue;

      const point: [number, number] = [reading.latitude, reading.longitude];
      const wasInside = previousPolygon.length < 3 || isPointInPolygon(point, previousPolygon);
      const willBeInside = isPointInPolygon(point, nextPolygon);

      if (wasInside && !willBeInside) {
        offenders.add(animalId);
      }
    }

    if (offenders.size > 0) {
      const labels = [...offenders].map((id) => tagByAnimal.get(id) ?? id);
      throw new BadRequestException(
        `No se puede modificar el cerco virtual: en la última hora hubo animales que quedarían fuera de los nuevos límites (${labels.join(', ')}). Esperá a que vuelvan a entrar al cerco o ajustá el polígono.`
      );
    }
  }

  /**
   * Al reactivar un cerco que todavía tiene animales asignados, cada uno debe estar
   * dentro del polígono según su última lectura GPS de la última hora.
   */
  private async assertAssignedAnimalsInside(geofenceId: string, polygon: [number, number][]) {
    if (polygon.length < 3) return;

    const assignments = await this.prisma.animalGeofence.findMany({
      where: { geofenceId, endAt: null },
      select: { animalId: true, animal: { select: { tag: true } } },
    });
    if (assignments.length === 0) return;

    const activeCollars = await this.prisma.animalCollar.findMany({
      where: { animalId: { in: assignments.map((a) => a.animalId) }, endAt: null },
      select: { collarId: true, animalId: true },
    });
    if (activeCollars.length === 0) return;

    const animalIdByCollar = new Map(activeCollars.map((c) => [c.collarId, c.animalId]));
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const readings = await this.prisma.telemetryReading.findMany({
      where: {
        collarId: { in: activeCollars.map((c) => c.collarId) },
        timestamp: { gte: since },
        ...ONLY_WITH_GPS_FIX,
      },
      orderBy: { timestamp: 'desc' },
      select: { collarId: true, latitude: true, longitude: true },
    });

    const latestByAnimal = new Map<string, { latitude: number; longitude: number }>();
    for (const reading of readings) {
      const animalId = animalIdByCollar.get(reading.collarId);
      if (!animalId || latestByAnimal.has(animalId)) continue;
      latestByAnimal.set(animalId, reading);
    }

    const offenders = [...latestByAnimal.entries()]
      .filter(([, reading]) => !isPointInPolygon([reading.latitude, reading.longitude], polygon))
      .map(([animalId]) => assignments.find((a) => a.animalId === animalId)?.animal.tag ?? animalId);

    if (offenders.length > 0) {
      throw new BadRequestException(
        `No se puede reactivar el cerco virtual: en la última hora los animales (${offenders.join(', ')}) quedaron fuera de sus límites. Mové los animales dentro del cerco o ampliá el área del cerco para poder reactivarlo.`
      );
    }
  }

  async create(dto: CreateGeofenceDto, userId: string) {
    const farm = await this.getOwnedFarm(dto.farmId, userId);

    // Validate that the geofence coordinates are strictly within the farm polygon boundary
    this.assertInsideFarm(farm, dto.polygonCoordinates);

    if (dto.animalIds.length > 0) {
      const animals = await this.prisma.animal.findMany({
        where: { id: { in: dto.animalIds } },
        include: {
          animalCollars: {
            where: { endAt: null },
          },
        },
      });
      if (animals.length !== dto.animalIds.length) {
        throw new NotFoundException('One or more animals were not found');
      }
      const outsideFarm = animals.filter((a) => a.farmId !== dto.farmId);
      if (outsideFarm.length > 0) {
        throw new BadRequestException(
          `Animals not assigned to this farm: ${outsideFarm.map((a) => a.tag ?? a.id).join(', ')}`
        );
      }
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

    // An animal can only be actively fenced by one geofence at a time.
    await this.prisma.animalGeofence.updateMany({
      where: { animalId: { in: dto.animalIds }, endAt: null },
      data: { endAt: now },
    });

    const createdGeofence = await this.prisma.geofence.create({
      data: {
        farmId: dto.farmId,
        name: dto.name,
        pastureType: dto.pastureType?.trim() || null,
        polygonCoordinates: dto.polygonCoordinates as any,
        active: true,
        activatedAt: now,
        animalGeofences: {
          create: dto.animalIds.map((animalId) => ({
            animalId,
            startAt: now,
          })),
        },
      },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });

    // Marcar los collares activos de los animales asignados como pendientes de notificación de cerco
    if (dto.animalIds.length > 0) {
      const activeAnimalCollars = await this.prisma.animalCollar.findMany({
        where: { animalId: { in: dto.animalIds }, endAt: null },
        select: { collarId: true },
      });
      const collarIds = activeAnimalCollars.map((ac) => ac.collarId);
      if (collarIds.length > 0) {
        await this.prisma.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { fenceNotificationPending: true },
        });
      }
    }

    return createdGeofence;
  }

  async findAllByFarm(farmId: string, userId: string) {
    await this.getOwnedFarm(farmId, userId);

    return this.prisma.geofence.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });
  }

  /**
   * Edita nombre, pastura y/o polígono de un cerco. Si cambia el polígono, los collares
   * de los animales que contiene quedan pendientes de recibir las coordenadas nuevas.
   */
  async update(id: string, dto: UpdateGeofenceDto, userId: string) {
    const geofence = await this.prisma.geofence.findUnique({
      where: { id },
      include: { farm: true },
    });
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }
    if (geofence.farm.userId !== userId) {
      const membership = await this.prisma.farmUser.findFirst({
        where: { farmId: geofence.farmId, userId, isActive: true },
      });
      if (!membership) {
        throw new ForbiddenException('You do not have access to this geofence');
      }
    }

    if (dto.polygonCoordinates) {
      this.assertInsideFarm(geofence.farm, dto.polygonCoordinates);
      await this.assertAnimalsStayInside(id, this.parsePolygon(geofence.polygonCoordinates), dto.polygonCoordinates);
    }

    const updated = await this.prisma.geofence.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.pastureType !== undefined ? { pastureType: dto.pastureType?.trim() || null } : {}),
        ...(dto.polygonCoordinates ? { polygonCoordinates: dto.polygonCoordinates as any } : {}),
      },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });

    if (dto.polygonCoordinates && updated.animalGeofences.length > 0) {
      const activeAnimalCollars = await this.prisma.animalCollar.findMany({
        where: { animalId: { in: updated.animalGeofences.map((ag) => ag.animalId) }, endAt: null },
        select: { collarId: true },
      });
      const collarIds = activeAnimalCollars.map((ac) => ac.collarId);
      if (collarIds.length > 0) {
        await this.prisma.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { fenceNotificationPending: true },
        });
      }
    }

    return updated;
  }

  async deactivate(id: string, userId: string) {
    const geofence = await this.prisma.geofence.findUnique({
      where: { id },
      include: { farm: true },
    });
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }
    if (geofence.farm.userId !== userId) {
      const membership = await this.prisma.farmUser.findFirst({
        where: { farmId: geofence.farmId, userId, isActive: true },
      });
      if (!membership) {
        throw new ForbiddenException('You do not have access to this geofence');
      }
    }

    const now = new Date();

    // Notificar a los collares de los animales asignados que el cerco ya no rige
    const activeAnimalGeofences = await this.prisma.animalGeofence.findMany({
      where: { geofenceId: id, endAt: null },
      select: { animalId: true },
    });
    const animalIds = activeAnimalGeofences.map((ag) => ag.animalId);
    if (animalIds.length > 0) {
      const activeAnimalCollars = await this.prisma.animalCollar.findMany({
        where: { animalId: { in: animalIds }, endAt: null },
        select: { collarId: true },
      });
      const collarIds = activeAnimalCollars.map((ac) => ac.collarId);
      if (collarIds.length > 0) {
        await this.prisma.collar.updateMany({
          where: { id: { in: collarIds } },
          data: { fenceNotificationPending: true },
        });
      }
    }

    await this.prisma.animalGeofence.updateMany({
      where: { geofenceId: id, endAt: null },
      data: { endAt: now },
    });

    return this.prisma.geofence.update({
      where: { id },
      data: { active: false, deactivatedAt: now },
    });
  }

  async activate(id: string, userId: string) {
    const geofence = await this.prisma.geofence.findUnique({
      where: { id },
      include: { farm: true },
    });
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }
    if (geofence.farm.userId !== userId) {
      const membership = await this.prisma.farmUser.findFirst({
        where: { farmId: geofence.farmId, userId, isActive: true },
      });
      if (!membership) {
        throw new ForbiddenException('You do not have access to this geofence');
      }
    }

    if (geofence.polygonCoordinates) {
      let coords: [number, number][] = [];
      try {
        coords =
          typeof geofence.polygonCoordinates === 'string'
            ? JSON.parse(geofence.polygonCoordinates)
            : (geofence.polygonCoordinates as [number, number][]);
      } catch {
        coords = [];
      }
      if (Array.isArray(coords) && coords.length >= 3) {
        this.assertInsideFarm(geofence.farm, coords);
        await this.assertAssignedAnimalsInside(id, coords);
      }
    }

    const now = new Date();

    return this.prisma.geofence.update({
      where: { id },
      data: {
        active: true,
        activatedAt: now,
        deactivatedAt: null,
      },
      include: {
        animalGeofences: {
          where: { endAt: null },
          include: { animal: true },
        },
      },
    });
  }
}
