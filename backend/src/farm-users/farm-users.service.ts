import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GlobalRole, Prisma } from '@generated/prisma';
import * as bcrypt from 'bcryptjs';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Personal de un administrador de campos (CU018). El personal son usuarios USER con rol OPERATOR o
 * VIEWER en uno o varios campos del administrador, con el mismo rol en todos ellos. Cada persona
 * pertenece a un único administrador: nunca tiene membresías activas en campos de otro.
 */
@Injectable()
export class FarmUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Busca el rol por nombre; los DTOs ya restringen el nombre a STAFF_ROLES, así que crearlo si falta el seed es seguro. */
  private getRole(name: string) {
    return this.prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  /** Campos activos donde el usuario es ADMIN. Solo un FARM_ADMIN gestiona personal. */
  private async getAdminFarms(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.globalRole !== GlobalRole.FARM_ADMIN) {
      throw new ForbiddenException('Solo un administrador de campos puede gestionar personal.');
    }

    return this.prisma.farm.findMany({
      where: {
        isActive: true,
        farmUsers: { some: { userId: adminId, isActive: true, role: { name: 'ADMIN' } } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private assertOwnFarms(farmIds: string[], adminFarmIds: Set<string>) {
    const unique = [...new Set(farmIds)];
    if (unique.some((id) => !adminFarmIds.has(id))) {
      throw new ForbiddenException('Solo podés asignar personal a campos que administrás.');
    }
    return unique;
  }

  /**
   * Trae a la persona si es personal de este administrador: un USER cuyas membresías activas están
   * todas en campos del administrador. Si no, 404 (no se revela si existe o de quién es).
   */
  private async getOwnStaff(userId: string, adminFarmIds: Set<string>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { farmUsers: { where: { isActive: true }, include: { role: true } } },
    });

    const isOwnStaff =
      user?.globalRole === GlobalRole.USER &&
      user.farmUsers.length > 0 &&
      user.farmUsers.every((fu) => adminFarmIds.has(fu.farmId) && fu.role.name !== 'ADMIN');

    if (!user || !isOwnStaff) {
      throw new NotFoundException('La persona no forma parte de tu personal.');
    }
    return user;
  }

  /** Deja a la persona con `role` exactamente en `farmIds`: activa/crea esas membresías y da de baja el resto. */
  private async syncMemberships(
    tx: Prisma.TransactionClient,
    userId: string,
    roleId: string,
    farmIds: string[]
  ) {
    await tx.farmUser.updateMany({
      where: { userId, isActive: true, farmId: { notIn: farmIds } },
      data: { isActive: false, removedAt: new Date() },
    });

    for (const farmId of farmIds) {
      await tx.farmUser.upsert({
        where: { farmId_userId: { farmId, userId } },
        create: { farmId, userId, roleId },
        update: { roleId, isActive: true, removedAt: null },
      });
    }
  }

  async findStaff(adminId: string) {
    const farms = await this.getAdminFarms(adminId);
    const farmIds = farms.map((f) => f.id);

    const users = await this.prisma.user.findMany({
      where: {
        globalRole: GlobalRole.USER,
        farmUsers: { some: { farmId: { in: farmIds }, isActive: true } },
      },
      select: {
        ...STAFF_SELECT,
        farmUsers: {
          where: { farmId: { in: farmIds }, isActive: true },
          select: { role: { select: { name: true } }, farm: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const staff = users.map(({ farmUsers, ...u }) => ({
      ...u,
      roleName: farmUsers[0]?.role.name,
      farms: farmUsers.map((fu) => fu.farm),
    }));

    return { farms, staff };
  }

  async createStaff(adminId: string, dto: CreateStaffDto) {
    const adminFarms = await this.getAdminFarms(adminId);
    const farmIds = this.assertOwnFarms(dto.farmIds, new Set(adminFarms.map((f) => f.id)));
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { farmUsers: true },
    });

    // Un email ya registrado solo se reutiliza para reincorporar a alguien que fue personal de este
    // mismo administrador y se dio de baja; si no, se rechaza sin revelar a quién pertenece.
    const adminFarmIds = new Set(adminFarms.map((f) => f.id));
    const isRehire =
      existing?.globalRole === GlobalRole.USER &&
      !existing.isActive &&
      existing.farmUsers.length > 0 &&
      existing.farmUsers.every((fu) => adminFarmIds.has(fu.farmId));

    if (existing && !isRehire) {
      throw new ConflictException('El correo electrónico ya está registrado en el sistema.');
    }

    const tempPassword = dto.initialPassword?.trim() || `Damp${Math.random().toString(36).substring(2, 8)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const role = await this.getRole(dto.roleName);

    const user = await this.prisma.$transaction(async (tx) => {
      const data = { name: dto.name.trim(), passwordHash, mustChangePassword: true, isActive: true };
      const saved = existing
        ? await tx.user.update({ where: { id: existing.id }, data })
        : await tx.user.create({ data: { ...data, email, globalRole: GlobalRole.USER, maxCollars: 0 } });

      await this.syncMemberships(tx, saved.id, role.id, farmIds);
      return saved;
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: true,
        mustChangePassword: true,
        createdAt: user.createdAt,
        roleName: dto.roleName,
        farms: adminFarms.filter((f) => farmIds.includes(f.id)),
      },
      temporaryPassword: tempPassword,
    };
  }

  async updateStaff(adminId: string, userId: string, dto: UpdateStaffDto) {
    const adminFarms = await this.getAdminFarms(adminId);
    const adminFarmIds = new Set(adminFarms.map((f) => f.id));
    const user = await this.getOwnStaff(userId, adminFarmIds);

    const farmIds = dto.farmIds
      ? this.assertOwnFarms(dto.farmIds, adminFarmIds)
      : user.farmUsers.map((fu) => fu.farmId);
    const roleName = dto.roleName ?? user.farmUsers[0].role.name;
    const role = await this.getRole(roleName);

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { name: dto.name.trim() } });
      }
      await this.syncMemberships(tx, userId, role.id, farmIds);
    });

    return {
      id: user.id,
      email: user.email,
      name: dto.name?.trim() ?? user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      roleName,
      farms: adminFarms.filter((f) => farmIds.includes(f.id)),
    };
  }

  /**
   * Baja del personal (CU002/CU018): baja lógica de todas sus membresías y desactivación de la
   * cuenta. Sin campos, una cuenta activa no tendría ningún uso y quedaría como acceso suelto.
   */
  async removeStaff(adminId: string, userId: string) {
    const adminFarms = await this.getAdminFarms(adminId);
    await this.getOwnStaff(userId, new Set(adminFarms.map((f) => f.id)));

    await this.prisma.$transaction([
      this.prisma.farmUser.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, removedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
    ]);

    return { id: userId, removed: true };
  }

  /** El administrador le genera una nueva contraseña temporal a alguien de su personal (no hay envío de mails). */
  async resetStaffPassword(adminId: string, userId: string) {
    const adminFarms = await this.getAdminFarms(adminId);
    await this.getOwnStaff(userId, new Set(adminFarms.map((f) => f.id)));

    const tempPassword = `Damp${Math.random().toString(36).substring(2, 8)}!`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true },
    });

    return { temporaryPassword: tempPassword };
  }
}
