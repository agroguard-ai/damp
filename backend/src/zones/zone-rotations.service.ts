import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateZoneRotationDto } from './dto/create-zone-rotation.dto';
import { PostponeRotationDto } from './dto/postpone-rotation.dto';

@Injectable()
export class ZoneRotationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZoneRotationsService.name);
  private autoRotateInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Revisa cada 60 segundos si algún plan de rotación activo cumplió su ciclo programado
    this.autoRotateInterval = setInterval(() => {
      this.checkAllActiveRotations().catch((err) => {
        this.logger.error('Error durante la verificación automática de rotaciones:', err);
      });
    }, 60000);
  }

  onModuleDestroy() {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
    }
  }

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

  private async getZoneWithAccess(zoneId: string, userId: string, requireAdmin: boolean = false) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: { farm: true },
    });

    if (!zone) {
      throw new NotFoundException(`La zona con ID ${zoneId} no existe.`);
    }

    await this.checkFarmAccess(zone.farmId, userId, requireAdmin);
    return zone;
  }

  /**
   * Crea e inicia un plan de rotación de perímetros dentro de una zona (CU012).
   */
  async createRotation(zoneId: string, dto: CreateZoneRotationDto, userId: string) {
    const zone = await this.getZoneWithAccess(zoneId, userId, false);

    // Precondición 1: Debe haber animales asignados a la zona
    const animalsInZone = await this.prisma.animal.findMany({
      where: { zoneId, isArchived: false },
      include: {
        animalCollars: { where: { endAt: null } },
      },
    });

    if (animalsInZone.length === 0) {
      throw new BadRequestException(
        'Debe existir al menos un animal asignado a la zona para poder iniciar una rotación de perímetros.'
      );
    }

    // Precondición 2 / Camino Alternativo 1: Mínimo 2 perímetros
    if (!dto.geofenceIds || dto.geofenceIds.length < 2) {
      throw new BadRequestException(
        'Se requieren al menos dos cercos virtuales dentro de la zona para poder configurar una rotación de pastoreo.'
      );
    }

    // Verificar que los cercos pertenezcan a la zona
    const geofences = await this.prisma.geofence.findMany({
      where: { id: { in: dto.geofenceIds }, zoneId },
    });

    if (geofences.length !== dto.geofenceIds.length) {
      throw new BadRequestException(
        'Uno o más cercos virtuales especificados no existen o no pertenecen a esta zona.'
      );
    }

    const now = new Date();
    const nextRotation = new Date(now.getTime() + dto.frequencyHours * 3600 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cancelar cualquier plan de rotación previo que esté activo en esta zona
      await tx.zoneRotationPlan.updateMany({
        where: { zoneId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', completedAt: now },
      });

      // 2. Crear el nuevo plan con sus pasos ordenados
      const plan = await tx.zoneRotationPlan.create({
        data: {
          zoneId,
          name: dto.name?.trim() || `Rotación de Pastoreo - ${zone.name}`,
          status: 'ACTIVE',
          frequencyHours: dto.frequencyHours,
          currentStepIndex: 0,
          totalSteps: dto.geofenceIds.length,
          autoRotate: dto.autoRotate ?? true,
          startedAt: now,
          lastRotatedAt: now,
          nextRotationAt: nextRotation,
          steps: {
            create: dto.geofenceIds.map((geofenceId, index) => ({
              geofenceId,
              orderIndex: index,
              status: index === 0 ? 'ACTIVE' : 'PENDING',
              activatedAt: index === 0 ? now : null,
            })),
          },
        },
        include: {
          steps: {
            include: { geofence: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      // 3. Activar el cerco inicial (Paso 0) y desactivar los otros cercos incluidos en la rotación
      const initialGeofenceId = dto.geofenceIds[0];
      await tx.geofence.update({
        where: { id: initialGeofenceId },
        data: { active: true, activatedAt: now },
      });

      const otherGeofenceIds = dto.geofenceIds.slice(1);
      if (otherGeofenceIds.length > 0) {
        await tx.geofence.updateMany({
          where: { id: { in: otherGeofenceIds } },
          data: { active: false },
        });
      }

      // 4. Asignar los animales de la zona que poseen collar activo al cerco inicial
      const animalsWithCollar = animalsInZone.filter((a) => a.animalCollars.length > 0);
      const animalIds = animalsWithCollar.map((a) => a.id);

      if (animalIds.length > 0) {
        // Cerrar cualquier cerco virtual previo
        await tx.animalGeofence.updateMany({
          where: { animalId: { in: animalIds }, endAt: null },
          data: { endAt: now },
        });

        // Abrir asignación al cerco inicial
        await tx.animalGeofence.createMany({
          data: animalIds.map((animalId) => ({
            animalId,
            geofenceId: initialGeofenceId,
            startAt: now,
          })),
        });
      }

      return plan;
    });
  }

  /**
   * Obtiene el estado actual de la rotación de la zona, incluyendo:
   * - Cerco de partida (fromGeofence)
   * - Cerco actual activo (currentGeofence)
   * - Próximo cerco programado (nextGeofence)
   * - Tiempo restante hasta el próximo cambio
   * - Lecturas de telemetría de los animales para evaluar puntos calientes (heatmap)
   */
  async getRotation(zoneId: string, userId: string) {
    const zone = await this.getZoneWithAccess(zoneId, userId, false);

    // Revisar y ejecutar rotación automática si correspondiera
    await this.checkAndPerformAutoRotation(zoneId);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: {
          include: { geofence: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!plan) {
      return {
        plan: null,
        message: 'No hay planes de rotación configurados para esta zona.',
      };
    }

    const now = Date.now();
    const nextTime = new Date(plan.nextRotationAt).getTime();
    const timeRemainingMinutes =
      plan.status === 'ACTIVE' ? Math.max(0, Math.round((nextTime - now) / 60000)) : 0;

    const fromStep = plan.currentStepIndex > 0 ? plan.steps[plan.currentStepIndex - 1] : null;
    const currentStep = plan.steps[plan.currentStepIndex] || null;
    const nextStep =
      plan.currentStepIndex + 1 < plan.steps.length ? plan.steps[plan.currentStepIndex + 1] : null;

    // Animales activos en la zona
    const animalsInZone = await this.prisma.animal.findMany({
      where: { zoneId, isArchived: false },
      select: {
        id: true,
        tag: true,
        breed: true,
        animalCollars: {
          where: { endAt: null },
          select: { collarId: true },
        },
      },
    });

    const collarIds = animalsInZone.flatMap((a) => a.animalCollars.map((ac) => ac.collarId));

    // Lecturas telemétricas para puntos calientes acumulados durante la rotación
    let heatmapPoints: { latitude: number; longitude: number }[] = [];
    if (collarIds.length > 0) {
      const readings = await this.prisma.telemetryReading.findMany({
        where: {
          collarId: { in: collarIds },
          timestamp: { gte: plan.startedAt },
        },
        select: {
          latitude: true,
          longitude: true,
        },
        take: 3000,
      });
      heatmapPoints = readings;
    }

    // Cálculo del polígono de transición activo para sincronizar la vista del productor
    // con las coordenadas exactas que los collares reciben en cada reporte telemétrico (~cada 5 min).
    let activeTransitionPolygon: [number, number][] | null = null;
    let transition: {
      isTransitioning: boolean;
      current5MinStep: number;
      total5MinSteps: number;
      progressPercent: number;
      stepIntervalMinutes: number;
    } | null = null;

    if (
      plan.status === 'ACTIVE' &&
      currentStep?.geofence?.polygonCoordinates &&
      nextStep?.geofence?.polygonCoordinates
    ) {
      try {
        const cPoly =
          typeof currentStep.geofence.polygonCoordinates === 'string'
            ? JSON.parse(currentStep.geofence.polygonCoordinates)
            : (currentStep.geofence.polygonCoordinates as [number, number][]);
        const nPoly =
          typeof nextStep.geofence.polygonCoordinates === 'string'
            ? JSON.parse(nextStep.geofence.polygonCoordinates)
            : (nextStep.geofence.polygonCoordinates as [number, number][]);

        if (Array.isArray(cPoly) && Array.isArray(nPoly) && cPoly.length >= 3 && nPoly.length >= 3) {
          const elapsedMs = Math.max(0, now - new Date(plan.lastRotatedAt).getTime());
          const stepIntervalMinutes = 5;
          const elapsedMinutes = elapsedMs / (60 * 1000);
          const totalMinutes = plan.frequencyHours * 60;
          const total5MinSteps = Math.max(1, Math.round(totalMinutes / stepIntervalMinutes));
          const current5MinStep = Math.min(
            total5MinSteps,
            Math.floor(elapsedMinutes / stepIntervalMinutes)
          );
          const fraction = Math.min(1, Math.max(0, current5MinStep / total5MinSteps));
          const progressPercent = Math.min(100, Math.round(fraction * 100));

          activeTransitionPolygon = interpolatePolygon(cPoly, nPoly, fraction);
          transition = {
            isTransitioning: true,
            current5MinStep: current5MinStep + 1,
            total5MinSteps,
            progressPercent,
            stepIntervalMinutes,
          };
        }
      } catch {
        // Fallback silencioso ante formato irregular
      }
    }

    return {
      plan,
      fromGeofence: fromStep ? fromStep.geofence : null,
      currentGeofence: currentStep ? currentStep.geofence : null,
      nextGeofence: nextStep ? nextStep.geofence : null,
      activeTransitionPolygon,
      transition,
      timeRemainingMinutes,
      totalAnimalsInZone: animalsInZone.length,
      animalsWithCollarCount: collarIds.length,
      heatmapPoints,
    };
  }

  /**
   * Camino Alternativo 2: Adelanta manualmente la rotación al siguiente cerco sin romper el calendario.
   */
  async advanceRotation(zoneId: string, userId: string) {
    await this.getZoneWithAccess(zoneId, userId, false);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId, status: 'ACTIVE' },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!plan) {
      throw new BadRequestException('No hay un plan de rotación activo para esta zona.');
    }

    return this.executeStepAdvance(plan.id);
  }

  /**
   * Camino Alternativo 2: Pospone manualmente la rotación (+X horas) sin romper el calendario definido.
   */
  async postponeRotation(zoneId: string, dto: PostponeRotationDto, userId: string) {
    await this.getZoneWithAccess(zoneId, userId, false);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId, status: 'ACTIVE' },
    });

    if (!plan) {
      throw new BadRequestException('No hay un plan de rotación activo para esta zona.');
    }

    const hours = dto.hours ?? 1;
    const currentNext = new Date(plan.nextRotationAt);
    const newNext = new Date(currentNext.getTime() + hours * 3600 * 1000);

    const updated = await this.prisma.zoneRotationPlan.update({
      where: { id: plan.id },
      data: { nextRotationAt: newNext },
    });

    return {
      message: `Rotación pospuesta por ${hours} hora(s) exitosamente.`,
      nextRotationAt: updated.nextRotationAt,
    };
  }

  /**
   * Pausa la rotación automática.
   */
  async pauseRotation(zoneId: string, userId: string) {
    await this.getZoneWithAccess(zoneId, userId, false);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId, status: 'ACTIVE' },
    });

    if (!plan) {
      throw new BadRequestException('No hay un plan de rotación activo para esta zona.');
    }

    const updated = await this.prisma.zoneRotationPlan.update({
      where: { id: plan.id },
      data: { status: 'PAUSED' },
    });

    return {
      message: 'Plan de rotación pausado.',
      plan: updated,
    };
  }

  /**
   * Reanuda un plan de rotación pausado.
   */
  async resumeRotation(zoneId: string, userId: string) {
    await this.getZoneWithAccess(zoneId, userId, false);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId, status: 'PAUSED' },
    });

    if (!plan) {
      throw new BadRequestException('No hay un plan de rotación pausado para esta zona.');
    }

    const now = new Date();
    const nextRotation = new Date(now.getTime() + plan.frequencyHours * 3600 * 1000);

    const updated = await this.prisma.zoneRotationPlan.update({
      where: { id: plan.id },
      data: {
        status: 'ACTIVE',
        nextRotationAt: nextRotation,
      },
    });

    return {
      message: 'Plan de rotación reanudado exitosamente.',
      plan: updated,
    };
  }

  /**
   * Cancela o finaliza un plan de rotación.
   */
  async cancelRotation(zoneId: string, userId: string) {
    await this.getZoneWithAccess(zoneId, userId, false);

    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: { zoneId, status: { in: ['ACTIVE', 'PAUSED'] } },
    });

    if (!plan) {
      throw new BadRequestException('No hay un plan de rotación activo o pausado para esta zona.');
    }

    const updated = await this.prisma.zoneRotationPlan.update({
      where: { id: plan.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    return {
      message: 'Plan de rotación finalizado/cancelado exitosamente.',
      plan: updated,
    };
  }

  /**
   * Ejecuta el avance interno de un paso de rotación (tanto automático como manual).
   */
  private async executeStepAdvance(planId: string) {
    const plan = await this.prisma.zoneRotationPlan.findUnique({
      where: { id: planId },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        zone: true,
      },
    });

    if (!plan || plan.status !== 'ACTIVE') return null;

    const now = new Date();
    const currentIndex = plan.currentStepIndex;
    const currentStep = plan.steps[currentIndex];
    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= plan.steps.length;

    return this.prisma.$transaction(async (tx) => {
      // 1. Cerrar paso actual
      if (currentStep) {
        await tx.zoneRotationStep.update({
          where: { id: currentStep.id },
          data: { status: 'COMPLETED', completedAt: now },
        });

        // Desactivar cerco previo
        await tx.geofence.update({
          where: { id: currentStep.geofenceId },
          data: { active: false, deactivatedAt: now },
        });
      }

      if (isCompleted) {
        // La rotación completó todos los perímetros del ciclo
        await tx.zoneRotationPlan.update({
          where: { id: plan.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            lastRotatedAt: now,
          },
        });

        return {
          message: 'Ciclo completo de rotación finalizado con éxito.',
          completed: true,
        };
      }

      // 2. Activar siguiente paso
      const nextStep = plan.steps[nextIndex];
      await tx.zoneRotationStep.update({
        where: { id: nextStep.id },
        data: { status: 'ACTIVE', activatedAt: now },
      });

      // Activar el nuevo cerco virtual
      await tx.geofence.update({
        where: { id: nextStep.geofenceId },
        data: { active: true, activatedAt: now, deactivatedAt: null },
      });

      // 3. Reasignar animales de la zona al nuevo cerco activo
      const animalsInZone = await tx.animal.findMany({
        where: { zoneId: plan.zoneId, isArchived: false },
        include: { animalCollars: { where: { endAt: null } } },
      });

      const animalIds = animalsInZone
        .filter((a) => a.animalCollars.length > 0)
        .map((a) => a.id);

      if (animalIds.length > 0) {
        // Cerrar cercos virtuales previos
        await tx.animalGeofence.updateMany({
          where: { animalId: { in: animalIds }, endAt: null },
          data: { endAt: now },
        });

        // Abrir en el nuevo cerco
        await tx.animalGeofence.createMany({
          data: animalIds.map((animalId) => ({
            animalId,
            geofenceId: nextStep.geofenceId,
            startAt: now,
          })),
        });

        // Marcar todos los collares de los animales de la zona como pendientes de recibir el nuevo cerco
        const collarIds = animalsInZone.flatMap((a) => a.animalCollars.map((ac) => ac.collarId));
        if (collarIds.length > 0) {
          await tx.collar.updateMany({
            where: { id: { in: collarIds } },
            data: { fenceNotificationPending: true },
          });
        }
      }

      // 4. Actualizar plan con nuevo índice y próxima fecha
      const nextRotation = new Date(now.getTime() + plan.frequencyHours * 3600 * 1000);
      const updatedPlan = await tx.zoneRotationPlan.update({
        where: { id: plan.id },
        data: {
          currentStepIndex: nextIndex,
          lastRotatedAt: now,
          nextRotationAt: nextRotation,
        },
        include: {
          steps: { include: { geofence: true }, orderBy: { orderIndex: 'asc' } },
        },
      });

      return {
        message: `Rotación avanzada al paso ${nextIndex + 1} (${nextStep.geofenceId}) exitosamente.`,
        plan: updatedPlan,
      };
    });
  }

  /**
   * Chequea si corresponde rotar automáticamente la zona.
   */
  private async checkAndPerformAutoRotation(zoneId: string) {
    const plan = await this.prisma.zoneRotationPlan.findFirst({
      where: {
        zoneId,
        status: 'ACTIVE',
        autoRotate: true,
        nextRotationAt: { lte: new Date() },
      },
    });

    if (plan) {
      await this.executeStepAdvance(plan.id);
    }
  }

  /**
   * Chequea todos los planes activos del sistema para la tarea en segundo plano.
   */
  private async checkAllActiveRotations() {
    const plansDue = await this.prisma.zoneRotationPlan.findMany({
      where: {
        status: 'ACTIVE',
        autoRotate: true,
        nextRotationAt: { lte: new Date() },
      },
      select: { id: true, zoneId: true },
    });

    for (const plan of plansDue) {
      try {
        await this.executeStepAdvance(plan.id);
        this.logger.log(`Rotación automática ejecutada para plan ${plan.id} en zona ${plan.zoneId}`);
      } catch (err) {
        this.logger.error(`Error al ejecutar rotación automática en plan ${plan.id}:`, err);
      }
    }
  }

  /**
   * Resuelve las coordenadas del cerco virtual activo para un animal.
   * Si la zona del animal tiene un plan de rotación activo (CU012):
   * - Verifica si corresponde rotar automáticamente o calcular las coordenadas de rotación incremental hora a hora.
   * - Devuelve las coordenadas actualizadas para que el gateway las transmita en el downlink al collar.
   * Si no hay rotación, devuelve el cerco virtual estándar asignado al animal en AnimalGeofence.
   */
  async resolveActiveCoordinatesForAnimal(
    animalId: string,
    zoneId?: string | null
  ): Promise<{
    polygon: [number, number][];
    geofenceName: string;
    transition?: {
      isTransitioning: boolean;
      fromGeofenceName?: string;
      toGeofenceName?: string;
      current5MinStep: number;
      total5MinSteps: number;
      fraction: number;
      progressPercent: number;
      stepIntervalMinutes: number;
    };
  } | null> {
    if (zoneId) {
      const activePlan = await this.prisma.zoneRotationPlan.findFirst({
        where: { zoneId, status: 'ACTIVE' },
        include: {
          steps: {
            include: { geofence: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      if (activePlan && activePlan.steps.length >= 2) {
        const now = new Date();

        // 1. Si se cumplió el tiempo de rotación automática, avanzar el paso
        if (activePlan.autoRotate && activePlan.nextRotationAt && now >= activePlan.nextRotationAt) {
          await this.executeStepAdvance(activePlan.id);
          // Recargar el plan actualizado
          return this.resolveActiveCoordinatesForAnimal(animalId, zoneId);
        }

        const currentStep = activePlan.steps[activePlan.currentStepIndex];
        const nextStep = activePlan.steps[activePlan.currentStepIndex + 1];

        // 2. Si hay un próximo paso y ambos cercos tienen coordenadas, calcular la rotación incremental hora a hora
        if (
          currentStep &&
          nextStep &&
          currentStep.geofence.polygonCoordinates &&
          nextStep.geofence.polygonCoordinates
        ) {
          let currentPoly: [number, number][] = [];
          let nextPoly: [number, number][] = [];
          try {
            currentPoly =
              typeof currentStep.geofence.polygonCoordinates === 'string'
                ? JSON.parse(currentStep.geofence.polygonCoordinates)
                : (currentStep.geofence.polygonCoordinates as [number, number][]);

            nextPoly =
              typeof nextStep.geofence.polygonCoordinates === 'string'
                ? JSON.parse(nextStep.geofence.polygonCoordinates)
                : (nextStep.geofence.polygonCoordinates as [number, number][]);
          } catch {
            currentPoly = [];
            nextPoly = [];
          }

          if (
            Array.isArray(currentPoly) &&
            Array.isArray(nextPoly) &&
            currentPoly.length >= 3 &&
            nextPoly.length >= 3
          ) {
            const elapsedMs = Math.max(0, now.getTime() - activePlan.lastRotatedAt.getTime());
            const stepIntervalMinutes = 5;
            const elapsedMinutes = elapsedMs / (60 * 1000);
            const totalMinutes = activePlan.frequencyHours * 60;
            const total5MinSteps = Math.max(1, Math.round(totalMinutes / stepIntervalMinutes));
            const current5MinStep = Math.min(
              total5MinSteps,
              Math.floor(elapsedMinutes / stepIntervalMinutes)
            );

            // Fracción calculada para la ventana de ~5 minutos actual (devolución gradual para la telemetría)
            const fraction = Math.min(1, Math.max(0, current5MinStep / total5MinSteps));
            const progressPercent = Math.min(100, Math.round(fraction * 100));

            // Interpolación incremental de vértices entre Cerco 1 y Cerco 2
            const interpolatedPoly = interpolatePolygon(currentPoly, nextPoly, fraction);

            return {
              polygon: interpolatedPoly,
              geofenceName: `${currentStep.geofence.name} → ${nextStep.geofence.name} (Paso ${current5MinStep + 1}/${total5MinSteps} • ${progressPercent}%)`,
              transition: {
                isTransitioning: true,
                fromGeofenceName: currentStep.geofence.name,
                toGeofenceName: nextStep.geofence.name,
                current5MinStep: current5MinStep + 1,
                total5MinSteps,
                fraction,
                progressPercent,
                stepIntervalMinutes,
              },
            };
          }
        }

        // Si no hay siguiente paso o no se puede interpolar, usar el cerco del paso actual
        if (currentStep && currentStep.geofence.polygonCoordinates) {
          let poly: [number, number][] = [];
          try {
            poly =
              typeof currentStep.geofence.polygonCoordinates === 'string'
                ? JSON.parse(currentStep.geofence.polygonCoordinates)
                : (currentStep.geofence.polygonCoordinates as [number, number][]);
          } catch {
            poly = [];
          }

          if (Array.isArray(poly) && poly.length >= 3) {
            return {
              polygon: poly,
              geofenceName: currentStep.geofence.name,
            };
          }
        }
      }
    }

    // Fallback: Cerco virtual estándar asignado al animal
    const animalGeofence = await this.prisma.animalGeofence.findFirst({
      where: { animalId, endAt: null, geofence: { active: true } },
      include: { geofence: true },
    });

    if (!animalGeofence?.geofence.polygonCoordinates) {
      return null;
    }

    let poly: [number, number][] = [];
    try {
      poly =
        typeof animalGeofence.geofence.polygonCoordinates === 'string'
          ? JSON.parse(animalGeofence.geofence.polygonCoordinates)
          : (animalGeofence.geofence.polygonCoordinates as [number, number][]);
    } catch {
      poly = [];
    }

    if (!Array.isArray(poly) || poly.length < 3) {
      return null;
    }

    return {
      polygon: poly,
      geofenceName: animalGeofence.geofence.name,
    };
  }
}

/**
 * Interpola linealmente los vértices de dos polígonos según la fracción transcurrida (0 a 1).
 * Alinea previamente la orientación y corrimiento de vértices para garantizar transiciones suaves
 * sin torsiones, auto-intersecciones ni cruces de bordes.
 */
export function interpolatePolygon(
  poly1: [number, number][],
  poly2: [number, number][],
  fraction: number
): [number, number][] {
  if (fraction <= 0) return poly1;
  if (fraction >= 1) return poly2;
  if (!poly1 || poly1.length === 0) return poly2;
  if (!poly2 || poly2.length === 0) return poly1;

  const { p1, p2 } = alignPolygons(poly1, poly2);

  return p1.map((pt1, i) => {
    const pt2 = p2[i];
    const lat = pt1[0] + fraction * (pt2[0] - pt1[0]);
    const lng = pt1[1] + fraction * (pt2[1] - pt1[1]);
    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
  });
}

/**
 * Alinea dos polígonos:
 * 1. Los remuestrea al mismo número de vértices n = max(len1, len2).
 * 2. Prueba las orientaciones (horaria y antihoraria) y los corrimientos cíclicos
 *    para encontrar la correspondencia de vértices que minimiza la distancia euclidiana total.
 */
export function alignPolygons(
  poly1: [number, number][],
  poly2: [number, number][]
): { p1: [number, number][]; p2: [number, number][] } {
  const n = Math.max(poly1.length, poly2.length);
  const p1 = resamplePolygon(poly1, n);
  const p2 = resamplePolygon(poly2, n);

  let bestP2 = p2;
  let minTotalDist = Infinity;

  const orderings = [p2, [...p2].reverse()];
  for (const candidate of orderings) {
    for (let shift = 0; shift < n; shift++) {
      const shifted = [...candidate.slice(shift), ...candidate.slice(0, shift)];
      let totalDist = 0;
      for (let i = 0; i < n; i++) {
        const dLat = p1[i][0] - shifted[i][0];
        const dLng = p1[i][1] - shifted[i][1];
        totalDist += dLat * dLat + dLng * dLng;
      }
      if (totalDist < minTotalDist) {
        minTotalDist = totalDist;
        bestP2 = shifted as [number, number][];
      }
    }
  }

  return { p1, p2: bestP2 };
}

export function resamplePolygon(poly: [number, number][], count: number): [number, number][] {
  if (poly.length === count) return poly;
  const result: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * poly.length;
    const index = Math.floor(t);
    const nextIndex = (index + 1) % poly.length;
    const weight = t - index;
    const p1 = poly[index];
    const p2 = poly[nextIndex];
    result.push([
      Number((p1[0] + weight * (p2[0] - p1[0])).toFixed(6)),
      Number((p1[1] + weight * (p2[1] - p1[1])).toFixed(6)),
    ]);
  }
  return result;
}
