import { MedicalEventsService } from './medical-events.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MedicalEventType } from '@generated/prisma';

function makePrismaMock() {
  return {
    animal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    medicalEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('MedicalEventsService', () => {
  let service: MedicalEventsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new MedicalEventsService(prisma as any);
  });

  describe('create', () => {
    it('permite registrar un evento si el usuario es el dueño de la granja', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farm: { userId: 'owner-1', farmUsers: [] },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', globalRole: 'USER' });
      prisma.medicalEvent.create.mockResolvedValue({
        id: 'event-1',
        animalId: 'animal-1',
        type: MedicalEventType.VACCINATION,
        description: 'Antirrábica',
        occurredAt: new Date(),
      });

      const res = await service.create(
        {
          animalId: 'animal-1',
          type: MedicalEventType.VACCINATION,
          description: 'Antirrábica',
        },
        'owner-1'
      );

      expect(res.id).toBe('event-1');
      expect(prisma.medicalEvent.create).toHaveBeenCalled();
      expect(prisma.animal.update).not.toHaveBeenCalled();
    });

    it('permite registrar un evento si el usuario es un empleado activo (operario) de la granja', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farm: {
          userId: 'owner-1',
          farmUsers: [{ userId: 'operator-1', isActive: true }],
        },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'operator-1', globalRole: 'USER' });
      prisma.medicalEvent.create.mockResolvedValue({
        id: 'event-2',
        animalId: 'animal-1',
        type: MedicalEventType.TREATMENT,
        description: 'Antibiótico',
        occurredAt: new Date(),
      });

      const res = await service.create(
        {
          animalId: 'animal-1',
          type: MedicalEventType.TREATMENT,
          description: 'Antibiótico',
        },
        'operator-1'
      );

      expect(res.id).toBe('event-2');
      expect(prisma.medicalEvent.create).toHaveBeenCalled();
    });

    it('al registrar un pesaje (WEIGHING), actualiza el peso vigente del animal', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farm: { userId: 'owner-1', farmUsers: [] },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', globalRole: 'USER' });
      prisma.medicalEvent.create.mockResolvedValue({
        id: 'event-3',
        animalId: 'animal-1',
        type: MedicalEventType.WEIGHING,
        value: 450.5,
        occurredAt: new Date(),
      });

      await service.create(
        {
          animalId: 'animal-1',
          type: MedicalEventType.WEIGHING,
          value: 450.5,
        },
        'owner-1'
      );

      expect(prisma.animal.update).toHaveBeenCalledWith({
        where: { id: 'animal-1' },
        data: { weightKg: 450.5 },
      });
    });

    it('rechaza con NotFoundException si el animal no existe', async () => {
      prisma.animal.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            animalId: 'non-existent',
            type: MedicalEventType.VACCINATION,
          },
          'user-1'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza con ForbiddenException si el usuario no pertenece a la granja del animal', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farm: { userId: 'other-owner', farmUsers: [] },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'stranger-1', globalRole: 'USER' });

      await expect(
        service.create(
          {
            animalId: 'animal-1',
            type: MedicalEventType.VACCINATION,
          },
          'stranger-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByAnimal', () => {
    it('retorna los registros ordenados descendentemente por fecha', async () => {
      prisma.animal.findUnique.mockResolvedValue({
        id: 'animal-1',
        farm: { userId: 'owner-1', farmUsers: [] },
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', globalRole: 'USER' });
      prisma.medicalEvent.findMany.mockResolvedValue([
        { id: 'ev-2', occurredAt: new Date('2026-09-20') },
        { id: 'ev-1', occurredAt: new Date('2026-09-10') },
      ]);

      const res = await service.findAllByAnimal('animal-1', 'owner-1');

      expect(res).toHaveLength(2);
      expect(prisma.medicalEvent.findMany).toHaveBeenCalledWith({
        where: { animalId: 'animal-1' },
        orderBy: { occurredAt: 'desc' },
      });
    });
  });
});
