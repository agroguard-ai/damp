import { PrismaClient, GlobalRole } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/damp_db?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Iniciando Seed DAMP ---');

  // 1. Crear roles estándar de granja
  const roles = ['ADMIN', 'OPERATOR', 'VIEWER'];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Roles estándar verificados: ADMIN, OPERATOR, VIEWER');

  // 2. Crear usuario SUPER_ADMIN por defecto si no existe
  const superAdminEmail = 'admin@damp.com';
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  const passwordHash = await bcrypt.hash('Admin1234!', 10);

  if (!existingSuperAdmin) {
    const adminUser = await prisma.user.create({
      data: {
        email: superAdminEmail,
        name: 'Super Administrador',
        passwordHash,
        globalRole: GlobalRole.SUPER_ADMIN,
        mustChangePassword: false,
      },
    });
    console.log(`Usuario SuperAdmin creado: ${adminUser.email} (Rol: SUPER_ADMIN)`);
  } else {
    // Asegurar que tenga rol SUPER_ADMIN y no requiera cambio de clave forzado
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        globalRole: GlobalRole.SUPER_ADMIN,
        mustChangePassword: false,
        name: existingSuperAdmin.name ?? 'Super Administrador',
      },
    });
    console.log(`Usuario SuperAdmin ya existía, rol SUPER_ADMIN verificado para: ${superAdminEmail}`);
  }

  console.log('--- Seed completado exitosamente ---');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
