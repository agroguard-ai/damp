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

  // 3. Crear catálogo de tipos de animal (razas más frecuentes de Argentina)
  const argentineAnimalTypes = [
    // Bovinos
    {
      name: 'Aberdeen Angus',
      species: 'Bovino',
      description: 'Raza británica carnicera líder en la pampa húmeda. Precocidad, fertilidad y alta calidad de carne con óptimo marmoleado.',
    },
    {
      name: 'Hereford / Polled Hereford',
      species: 'Bovino',
      description: 'Raza británica tradicional, gran mansedumbre, rusticidad y excelente conversión forrajera pastoril.',
    },
    {
      name: 'Braford',
      species: 'Bovino',
      description: 'Sintética 3/8 Cebú y 5/8 Hereford. Gran adaptación al calor, monte y garrapata del NEA y NOA argentino.',
    },
    {
      name: 'Brangus',
      species: 'Bovino',
      description: 'Sintética 3/8 Cebú y 5/8 Angus. Alta rusticidad, fertilidad y calidad carnicera en zonas subtropicales.',
    },
    {
      name: 'Holando Argentino',
      species: 'Bovino',
      description: 'Principal raza lechera argentina, base productiva de las cuencas lecheras de Santa Fe, Córdoba y Buenos Aires.',
    },
    {
      name: 'Criollo Argentino',
      species: 'Bovino',
      description: 'Raza histórica de máxima rusticidad, longevidad y capacidad de pastoreo en ambientes extremos y semiáridos.',
    },
    {
      name: 'Limousin',
      species: 'Bovino',
      description: 'Raza carnicera de origen francés de notable musculatura, alto rendimiento al gancho y bajo contenido graso.',
    },
    {
      name: 'Nelore / Brahman (Cebú)',
      species: 'Bovino',
      description: 'Bovino cebuino de alta resistencia a temperaturas extremas, parásitos y forrajes duros del norte argentino.',
    },
    // Equinos
    {
      name: 'Caballo Criollo',
      species: 'Equino',
      description: 'Caballo nacional de trabajo de campo por excelencia en Argentina. Sobresaliente rusticidad, resistencia y docilidad para faenas ganaderas.',
    },
    {
      name: 'Cuarto de Milla',
      species: 'Equino',
      description: 'Equino versátil de gran aceleración y agilidad, óptimo para labores en corrales y aparte de hacienda.',
    },
    // Ovinos
    {
      name: 'Corriedale',
      species: 'Ovino',
      description: 'Raza doble propósito (carne y lana media/gruesa) dominante en la provincia de Buenos Aires y la mesopotamia.',
    },
    {
      name: 'Merino Argentino',
      species: 'Ovino',
      description: 'Raza lanera por excelencia de fibra extrafina, de amplia adaptación a la meseta y estepa patagónica.',
    },
    {
      name: 'Hampshire Down',
      species: 'Ovino',
      description: 'Raza ovina carnicera ("cara negra") precoz, de rápido engorde y excelente conformación muscular.',
    },
    // Porcinos
    {
      name: 'Yorkshire / Large White',
      species: 'Porcino',
      description: 'Raza porcina prolífica de destacada aptitud maternal, docilidad y producción de carne magra.',
    },
    {
      name: 'Duroc Jersey',
      species: 'Porcino',
      description: 'Raza porcina rústica con excelente tasa de crecimiento, resistencia y óptimo veteado de grasa intramuscular.',
    },
    // Caprinos
    {
      name: 'Caprino Criollo',
      species: 'Caprino',
      description: 'Raza caprina rústica multipropósito adaptada a pastizales naturales y zonas secas de Cuyo, Sierras y NOA.',
    },
    {
      name: 'Boer',
      species: 'Caprino',
      description: 'Raza caprina carnicera especializada de gran porte, rápido desarrollo y alta conformación cárnica.',
    },
  ];

  for (const t of argentineAnimalTypes) {
    await prisma.animalType.upsert({
      where: { name: t.name },
      update: {
        species: t.species,
        description: t.description,
        isActive: true,
      },
      create: {
        name: t.name,
        species: t.species,
        description: t.description,
        isActive: true,
      },
    });
  }
  console.log(`Catálogo de ${argentineAnimalTypes.length} razas argentinas verificado y cargado.`);

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
