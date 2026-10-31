import 'dotenv/config';
import {
  PrismaClient,
  GlobalRole,
  Sex,
  CollarStatus,
  MedicalEventType,
  AlertType,
} from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/damp_db?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BLOCK_MS = 30 * 60 * 1000;
const FARM_UTC_OFFSET_MS = -180 * 60 * 1000; // UTC-3 Argentina

/** Inicio (UTC) del bloque de 30 min alineado a hora local argentina */
function blockStartFor(date: Date): Date {
  const localMs = date.getTime() + FARM_UTC_OFFSET_MS;
  return new Date(Math.floor(localMs / BLOCK_MS) * BLOCK_MS - FARM_UTC_OFFSET_MS);
}

/** Generador pseudoaleatorio determinístico para reproducibilidad */
function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Ciclo circadiano térmico bovino (~38.45°C base, pico a las 15hs local) */
function circadianTempOffset(date: Date): number {
  const localHour = ((date.getUTCHours() - 3 + 24) % 24) + date.getUTCMinutes() / 60;
  return 0.38 * Math.sin((2 * Math.PI * (localHour - 9)) / 24);
}

/**
 * Calcula la posición GPS [lat, lng] y temperatura de un animal en el instante `tMs`.
 * En cada bloque de 15 días los 10 animales dan vueltas de forma aleatoria dentro de la
 * esquina correspondiente, y al cumplirse los ~15 días se trasladan hacia la siguiente
 * esquina en sentido horario:
 *   1) Esquina Superior Izquierda (Noroeste)  -> primeros 15 días
 *   2) Esquina Superior Derecha (Noreste)     -> siguientes 15 días
 *   3) Esquina Inferior Derecha (Sureste)     -> siguientes 15 días
 *   4) Esquina Inferior Izquierda (Suroeste)  -> siguientes 15 días
 */
function computeAnimalTelemetryAt(
  animalIdx: number,
  tMs: number,
  startMs: number,
  nowMs: number,
  rng: () => number,
  posState: { lat: number; lng: number }
): { latitude: number; longitude: number; temperature: number } {
  // Las 4 esquinas internas del cerco virtual "Potrero Central - Pastura Alfalfa"
  // Cerco: lat [-32.9885, -32.9815], lng [-58.6542, -58.6458]
  const corners: [number, number][] = [
    [-32.9827, -58.6526], // 0: Esquina Superior Izquierda (Noroeste)
    [-32.9827, -58.6474], // 1: Esquina Superior Derecha (Noreste)
    [-32.9873, -58.6474], // 2: Esquina Inferior Derecha (Sureste)
    [-32.9873, -58.6526], // 3: Esquina Inferior Izquierda (Suroeste)
  ];

  const elapsedDays = Math.max(0, (tMs - startMs) / DAY_MS);
  const hoursBeforeNow = (nowMs - tMs) / HOUR_MS;

  // Rotación uniforme cada 15 días por las 4 esquinas en sentido horario
  const PERIOD_DAYS = 15;
  const STAY_DAYS = 13.2; // ~13.2 días dando vueltas de forma random en la esquina + ~1.8 días trasladándose a la siguiente
  const periodIndex = Math.floor(elapsedDays / PERIOD_DAYS);
  const dayInPeriod = elapsedDays - periodIndex * PERIOD_DAYS;

  const currentCornerIdx = periodIndex % corners.length;
  const nextCornerIdx = (currentCornerIdx + 1) % corners.length;

  const [cLat, cLng] = corners[currentCornerIdx];
  const [nLat, nLng] = corners[nextCornerIdx];

  if (dayInPeriod <= STAY_DAYS) {
    // Caminata aleatoria (random walk) dentro del área de la esquina actual (~75m alrededor del centro de la esquina)
    const nextLat = posState.lat + (cLat - posState.lat) * 0.28 + (rng() - 0.5) * 0.00065;
    const nextLng = posState.lng + (cLng - posState.lng) * 0.28 + (rng() - 0.5) * 0.00075;

    posState.lat = Math.max(cLat - 0.00075, Math.min(cLat + 0.00075, nextLat));
    posState.lng = Math.max(cLng - 0.00085, Math.min(cLng + 0.00085, nextLng));
  } else {
    // Traslado hacia la siguiente esquina con variación aleatoria natural en el camino
    const moveProgress = (dayInPeriod - STAY_DAYS) / (PERIOD_DAYS - STAY_DAYS); // 0 -> 1
    const targetLat = cLat * (1 - moveProgress) + nLat * moveProgress;
    const targetLng = cLng * (1 - moveProgress) + nLng * moveProgress;

    posState.lat = targetLat + (rng() - 0.5) * 0.00038;
    posState.lng = targetLng + (rng() - 0.5) * 0.00042;
  }

  // Asegurar que permanezcan dentro del cerco virtual
  const lat = Math.max(-32.9882, Math.min(-32.9818, posState.lat));
  const lng = Math.max(-58.6539, Math.min(-58.6461, posState.lng));

  // Temperatura base individual
  const baseTemp = 38.35 + (animalIdx % 5) * 0.06;
  let temp = baseTemp + circadianTempOffset(new Date(tMs)) + (rng() - 0.5) * 0.14;

  // Caso especial 1: Animal #2 (ER-1003, índice 2) cursa cuadro febril en las últimas 10 horas
  if (animalIdx === 2 && hoursBeforeNow <= 10) {
    const feverIntensity = Math.min(1, (10 - hoursBeforeNow) / 5);
    temp = 38.6 + feverIntensity * 1.45 + (rng() - 0.5) * 0.12; // Sube hasta ~40.05 °C
  }

  // Caso especial 2: Animal #5 (ER-1006, índice 5, hembra) presenta patrón de celo en las últimas 14 horas
  if (animalIdx === 5 && hoursBeforeNow <= 14) {
    temp += 0.35;
  }

  // Caso especial 3: Animal #7 (ER-1008, índice 7) tuvo un episodio febril hace 12 días (ya resuelto)
  if (animalIdx === 7 && Math.abs(hoursBeforeNow - 12 * 24) <= 8) {
    temp = 39.85 + (rng() - 0.5) * 0.15;
  }

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    temperature: Number(temp.toFixed(2)),
  };
}

async function main() {
  console.log('--- Iniciando Seed DAMP ---');

  // 1. Crear roles estándar de campo
  const roleNames = ['ADMIN', 'OPERATOR', 'VIEWER'];
  const rolesMap: Record<string, string> = {};
  for (const name of roleNames) {
    const r = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    rolesMap[name] = r.id;
  }
  console.log('Roles estándar verificados: ADMIN, OPERATOR, VIEWER');

  // 2. Crear usuario SUPER_ADMIN por defecto si no existe
  const superAdminEmail = 'admin@damp.com';
  const adminPasswordHash = await bcrypt.hash('Admin1234!', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      globalRole: GlobalRole.SUPER_ADMIN,
      mustChangePassword: false,
      isActive: true,
    },
    create: {
      email: superAdminEmail,
      name: 'Super Administrador',
      passwordHash: adminPasswordHash,
      globalRole: GlobalRole.SUPER_ADMIN,
      mustChangePassword: false,
      isActive: true,
    },
  });
  console.log(`Usuario SuperAdmin verificado: ${superAdmin.email} (pass: Admin1234!)`);

  // 3. Crear catálogo de tipos de animal (razas más frecuentes de Argentina)
  const argentineAnimalTypes = [
    {
      name: 'Aberdeen Angus',
      species: 'Bovino',
      description:
        'Raza británica carnicera líder en la pampa húmeda. Precocidad, fertilidad y alta calidad de carne con óptimo marmoleado.',
    },
    {
      name: 'Hereford / Polled Hereford',
      species: 'Bovino',
      description:
        'Raza británica tradicional, gran mansedumbre, rusticidad y excelente conversión forrajera pastoril.',
    },
    {
      name: 'Braford',
      species: 'Bovino',
      description:
        'Sintética 3/8 Cebú y 5/8 Hereford. Gran adaptación al calor, monte y garrapata del NEA, Mesopotamia y NOA argentino.',
    },
    {
      name: 'Brangus',
      species: 'Bovino',
      description:
        'Sintética 3/8 Cebú y 5/8 Angus. Alta rusticidad, fertilidad y calidad carnicera en zonas subtropicales y mesopotámicas.',
    },
    {
      name: 'Holando Argentino',
      species: 'Bovino',
      description:
        'Principal raza lechera argentina, base productiva de las cuencas lecheras de Santa Fe, Córdoba, Entre Ríos y Buenos Aires.',
    },
    {
      name: 'Criollo Argentino',
      species: 'Bovino',
      description:
        'Raza histórica de máxima rusticidad, longevidad y capacidad de pastoreo en ambientes extremos y semiáridos.',
    },
    {
      name: 'Limousin',
      species: 'Bovino',
      description:
        'Raza carnicera de origen francés de notable musculatura, alto rendimiento al gancho y bajo contenido graso.',
    },
    {
      name: 'Nelore / Brahman (Cebú)',
      species: 'Bovino',
      description:
        'Bovino cebuino de alta resistencia a temperaturas extremas, parásitos y forrajes duros del norte argentino.',
    },
    {
      name: 'Caballo Criollo',
      species: 'Equino',
      description:
        'Caballo nacional de trabajo de campo por excelencia en Argentina. Sobresaliente rusticidad, resistencia y docilidad para faenas ganaderas.',
    },
    {
      name: 'Cuarto de Milla',
      species: 'Equino',
      description:
        'Equino versátil de gran aceleración y agilidad, óptimo para labores en corrales y aparte de hacienda.',
    },
    {
      name: 'Corriedale',
      species: 'Ovino',
      description:
        'Raza doble propósito (carne y lana media/gruesa) dominante en la provincia de Buenos Aires y la mesopotamia.',
    },
    {
      name: 'Merino Argentino',
      species: 'Ovino',
      description:
        'Raza lanera por excelencia de fibra extrafina, de amplia adaptación a la meseta y estepa patagónica.',
    },
    {
      name: 'Hampshire Down',
      species: 'Ovino',
      description:
        'Raza ovina carnicera ("cara negra") precoz, de rápido engorde y excelente conformación muscular.',
    },
    {
      name: 'Yorkshire / Large White',
      species: 'Porcino',
      description:
        'Raza porcina prolífica de destacada aptitud maternal, docilidad y producción de carne magra.',
    },
    {
      name: 'Duroc Jersey',
      species: 'Porcino',
      description:
        'Raza porcina rústica con excelente tasa de crecimiento, resistencia y óptimo veteado de grasa intramuscular.',
    },
    {
      name: 'Caprino Criollo',
      species: 'Caprino',
      description:
        'Raza caprina rústica multipropósito adaptada a pastizales naturales y zonas secas de Cuyo, Sierras y NOA.',
    },
    {
      name: 'Boer',
      species: 'Caprino',
      description:
        'Raza caprina carnicera especializada de gran porte, rápido desarrollo y alta conformación cárnica.',
    },
  ];

  const animalTypesByName: Record<string, string> = {};
  for (const t of argentineAnimalTypes) {
    const record = await prisma.animalType.upsert({
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
    animalTypesByName[t.name] = record.id;
  }
  console.log(`Catálogo de ${argentineAnimalTypes.length} razas argentinas verificado.`);

  // =========================================================================
  // 4. PRODUCTOR: JUAN PÉREZ Y CAMPO EN ENTRE RÍOS (FLUJO COMPLETO + 90 DÍAS)
  // =========================================================================
  console.log('\n--- Configurando productor Juan Pérez y su campo en Entre Ríos ---');

  const juanEmail = 'juan.perez@damp.com';
  const juanPasswordHash = await bcrypt.hash('Juan1234!', 10);

  const juanUser = await prisma.user.upsert({
    where: { email: juanEmail },
    update: {
      name: 'Juan Pérez',
      passwordHash: juanPasswordHash,
      globalRole: GlobalRole.FARM_ADMIN,
      mustChangePassword: false,
      isActive: true,
      maxCollars: 30,
    },
    create: {
      email: juanEmail,
      name: 'Juan Pérez',
      passwordHash: juanPasswordHash,
      globalRole: GlobalRole.FARM_ADMIN,
      mustChangePassword: false,
      isActive: true,
      maxCollars: 30,
    },
  });
  console.log(`Productor verificado: ${juanUser.name} (${juanUser.email} / pass: Juan1234!)`);

  const collarIdentifiers = Array.from({ length: 10 }, (_, i) => `COLLAR-ER-${String(i + 1).padStart(2, '0')}`);
  const gatewayApiKey = 'damp_gw_entrerios_juan_perez_2026_key_01';

  // Limpieza previa idempotente de datos del campo de Juan Pérez si ya existían
  const existingFarms = await prisma.farm.findMany({
    where: {
      OR: [{ userId: juanUser.id }, { name: 'Estancia El Palmar - Juan Pérez' }],
    },
    select: { id: true },
  });
  const existingFarmIds = existingFarms.map((f) => f.id);

  if (existingFarmIds.length > 0) {
    console.log('Limpiando datos previos del campo de Juan Pérez para regenerar seed limpio...');
    await prisma.iotRequestLog.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.healthPrediction.deleteMany({ where: { animal: { farmId: { in: existingFarmIds } } } });
    await prisma.alert.deleteMany({ where: { animal: { farmId: { in: existingFarmIds } } } });
    await prisma.medicalEvent.deleteMany({ where: { animal: { farmId: { in: existingFarmIds } } } });
    await prisma.animalGeofence.deleteMany({ where: { animal: { farmId: { in: existingFarmIds } } } });
    await prisma.animalCollar.deleteMany({ where: { animal: { farmId: { in: existingFarmIds } } } });
    await prisma.telemetryReading.deleteMany({
      where: { collar: { OR: [{ farmId: { in: existingFarmIds } }, { identifier: { in: collarIdentifiers } }] } },
    });
    await prisma.collar.deleteMany({
      where: { OR: [{ farmId: { in: existingFarmIds } }, { identifier: { in: collarIdentifiers } }] },
    });
    await prisma.animal.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.rotationPlan.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.geofence.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.gateway.deleteMany({
      where: { OR: [{ farmId: { in: existingFarmIds } }, { apiKey: gatewayApiKey }] },
    });
    await prisma.alertSettings.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.farmUser.deleteMany({ where: { farmId: { in: existingFarmIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: existingFarmIds } } });
  } else {
    // Asegurar limpieza de collares o gateway si quedaron huérfanos
    await prisma.telemetryReading.deleteMany({ where: { collar: { identifier: { in: collarIdentifiers } } } });
    await prisma.animalCollar.deleteMany({ where: { collar: { identifier: { in: collarIdentifiers } } } });
    await prisma.collar.deleteMany({ where: { identifier: { in: collarIdentifiers } } });
    await prisma.gateway.deleteMany({ where: { apiKey: gatewayApiKey } });
  }

  const now = new Date();
  const nowMs = now.getTime();
  const ninetyFiveDaysAgo = new Date(nowMs - 95 * DAY_MS);
  const ninetyTwoDaysAgo = new Date(nowMs - 92 * DAY_MS);
  const ninetyDaysAgo = new Date(nowMs - 90 * DAY_MS);
  const oneHundredTwentyDaysAgo = new Date(nowMs - 120 * DAY_MS);

  // Perímetro del campo en zona rural ganadera de Gualeguaychú, Entre Ríos (~148.35 Ha)
  const farmPolygon: [number, number][] = [
    [-32.9795, -58.6565], // Noroeste
    [-32.9795, -58.6435], // Noreste
    [-32.9905, -58.6435], // Sureste
    [-32.9905, -58.6565], // Suroeste
  ];

  // Cerco virtual activo contenido 100% dentro del perímetro del campo (~61.2 Ha)
  const geofencePolygon: [number, number][] = [
    [-32.9815, -58.6542], // Noroeste
    [-32.9815, -58.6458], // Noreste
    [-32.9885, -58.6458], // Sureste
    [-32.9885, -58.6542], // Suroeste
  ];

  // 5. Crear el Campo de Juan Pérez en Entre Ríos
  const farm = await prisma.farm.create({
    data: {
      name: 'Estancia El Palmar - Juan Pérez',
      province: 'Entre Ríos',
      location: 'Gualeguaychú',
      address: 'Ruta Nacional 14 Km 72, Gualeguaychú, Entre Ríos',
      totalAreaHa: 148.35,
      polygonCoordinates: farmPolygon,
      userId: juanUser.id,
      isActive: true,
      createdAt: ninetyFiveDaysAgo,
    },
  });

  // Vincular a Juan Pérez como ADMIN en FarmUser
  await prisma.farmUser.create({
    data: {
      farmId: farm.id,
      userId: juanUser.id,
      roleId: rolesMap['ADMIN'],
      isActive: true,
    },
  });

  // Configurar umbrales de alertas del campo
  await prisma.alertSettings.create({
    data: {
      farmId: farm.id,
      feverThreshold: 39.5,
      hypothermiaThreshold: 37.0,
      inactivityMinutes: 120,
      emailOnEscape: true,
      emailOnHealth: true,
    },
  });

  // 6. Crear Gateway LoRaWAN activo en el campo
  const gateway = await prisma.gateway.create({
    data: {
      name: 'Gateway LoRaWAN - Estancia El Palmar (ER)',
      farmId: farm.id,
      apiKey: gatewayApiKey,
      lastSeenAt: now,
      lastRssi: -67.4,
      lastSnr: 9.6,
      createdAt: ninetyFiveDaysAgo,
    },
  });

  // 7. Crear el Cerco Virtual Activo (y un cerco histórico inactivo para trazabilidad previa)
  const historicalGeofence = await prisma.geofence.create({
    data: {
      farmId: farm.id,
      name: 'Lote Sur - Pastizal Natural (Descanso)',
      pastureType: 'Pastizal Natural Mesopotámico',
      polygonCoordinates: [
        [-32.9886, -58.6552],
        [-32.9886, -58.6448],
        [-32.9901, -58.6448],
        [-32.9901, -58.6552],
      ],
      active: false,
      activatedAt: oneHundredTwentyDaysAgo,
      deactivatedAt: ninetyTwoDaysAgo,
      createdAt: oneHundredTwentyDaysAgo,
    },
  });

  const activeGeofence = await prisma.geofence.create({
    data: {
      farmId: farm.id,
      name: 'Potrero Central - Pastura Alfalfa',
      pastureType: 'Alfalfa y Festuca Consociada',
      polygonCoordinates: geofencePolygon,
      active: true,
      activatedAt: ninetyTwoDaysAgo,
      createdAt: ninetyTwoDaysAgo,
    },
  });

  console.log(
    `Campo creado: "${farm.name}" (${farm.province} - ${farm.location}) con Cerco Virtual activo "${activeGeofence.name}".`
  );

  // 8. Crear los 10 Collares y los 10 Ganados (todos de raza Aberdeen Angus) con sus asignaciones completas
  const cattleSpecs = [
    {
      tag: 'ER-1001',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 445,
      ageMonths: 28,
    },
    {
      tag: 'ER-1002',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 432,
      ageMonths: 26,
    },
    {
      tag: 'ER-1003',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 460,
      ageMonths: 30,
    },
    {
      tag: 'ER-1004',
      breed: 'Aberdeen Angus',
      sex: Sex.MALE,
      weightKg: 512,
      ageMonths: 34,
    },
    {
      tag: 'ER-1005',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 418,
      ageMonths: 24,
    },
    {
      tag: 'ER-1006',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 438,
      ageMonths: 27,
    },
    {
      tag: 'ER-1007',
      breed: 'Aberdeen Angus',
      sex: Sex.MALE,
      weightKg: 495,
      ageMonths: 32,
    },
    {
      tag: 'ER-1008',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 450,
      ageMonths: 29,
    },
    {
      tag: 'ER-1009',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 425,
      ageMonths: 25,
    },
    {
      tag: 'ER-1010',
      breed: 'Aberdeen Angus',
      sex: Sex.MALE,
      weightKg: 508,
      ageMonths: 35,
    },
  ];

  const createdAnimals: { id: string; tag: string; breed: string; weightKg: number; sex: Sex; collarId: number }[] = [];

  // Sincronizar la secuencia de IDs de collares por si se insertaron IDs manuales previamente
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('collars', 'id'), COALESCE((SELECT MAX(id) FROM collars), 0) + 1, false);`
  );

  for (let i = 0; i < cattleSpecs.length; i++) {
    const spec = cattleSpecs[i];
    const collarIdentifier = collarIdentifiers[i];

    const collar = await prisma.collar.create({
      data: {
        identifier: collarIdentifier,
        status: CollarStatus.AVAILABLE,
        isArchived: false,
        fenceNotificationPending: false,
        lastFenceSyncedAt: new Date(nowMs - 2 * HOUR_MS),
        lastTelemetryDate: now,
        farmId: farm.id,
        createdAt: ninetyFiveDaysAgo,
      },
    });

    const birthDate = new Date(nowMs - spec.ageMonths * 30 * DAY_MS);

    const animal = await prisma.animal.create({
      data: {
        farmId: farm.id,
        ownerId: farm.userId,
        tag: spec.tag,
        sex: spec.sex,
        birthDate,
        breed: spec.breed,
        weightKg: spec.weightKg,
        animalTypeId: animalTypesByName[spec.breed] ?? null,
        status: 'ACTIVE',
        isArchived: false,
        createdAt: ninetyFiveDaysAgo,
      },
    });

    // Asignación activa de collar (desde hace más de 3 meses)
    await prisma.animalCollar.create({
      data: {
        collarId: collar.id,
        animalId: animal.id,
        startAt: ninetyTwoDaysAgo,
        endAt: null,
      },
    });

    // Trazabilidad de cercos: estuvo en Lote Sur hace >92 días y pasó al Potrero Central hace 92 días
    await prisma.animalGeofence.createMany({
      data: [
        {
          animalId: animal.id,
          geofenceId: historicalGeofence.id,
          startAt: oneHundredTwentyDaysAgo,
          endAt: ninetyTwoDaysAgo,
        },
        {
          animalId: animal.id,
          geofenceId: activeGeofence.id,
          startAt: ninetyTwoDaysAgo,
          endAt: null,
        },
      ],
    });

    createdAnimals.push({
      id: animal.id,
      tag: spec.tag,
      breed: spec.breed,
      weightKg: spec.weightKg,
      sex: spec.sex,
      collarId: collar.id,
    });
  }

  console.log(
    `10 ganados (${createdAnimals.map((a) => a.tag).join(', ')}) y 10 collares creados y vinculados al cerco virtual.`
  );

  // =========================================================================
  // 9. GENERACIÓN DE 3 MESES (90 DÍAS) DE REGISTROS GPS Y BIOMÉTRICOS
  // =========================================================================
  // - Desde hace 90 días hasta hace 48 horas: 1 lectura cada 3 horas (8 por día * 88 días = 704 lecturas/animal)
  // - Últimas 48 horas hasta ahora: 1 lectura cada 30 minutos (96 lecturas/animal)
  // Total: 800 lecturas por animal (8.000 registros GPS en total), cubriendo los 90 días completos
  // y completando el 100% de los 48 bloques de 30 min requeridos por la ventana de 24h del modelo IA.
  console.log('Generando 3 meses (90 días) de mediciones GPS y temperatura para los 10 ganados...');

  const timestamps: number[] = [];
  const start90DaysMs = nowMs - 90 * DAY_MS;
  const last48HoursMs = nowMs - 2 * DAY_MS;
  const step3HoursMs = 3 * HOUR_MS;
  const step30MinMs = 30 * 60 * 1000;

  for (let t = start90DaysMs; t < last48HoursMs; t += step3HoursMs) {
    timestamps.push(t);
  }
  // Alinear las últimas 48 horas a bloques de 30 minutos hasta el presente
  const aligned48hStart = blockStartFor(new Date(last48HoursMs)).getTime();
  for (let t = aligned48hStart; t <= nowMs; t += step30MinMs) {
    if (timestamps.length === 0 || t > timestamps[timestamps.length - 1]) {
      timestamps.push(t);
    }
  }
  // Asegurar una lectura final exactamente en `nowMs` para posición en vivo inmediata
  if (timestamps[timestamps.length - 1] < nowMs) {
    timestamps.push(nowMs);
  }

  const allTelemetryReadings: {
    collarId: number;
    latitude: number;
    longitude: number;
    temperature: number;
    timestamp: Date;
  }[] = [];

  for (let i = 0; i < createdAnimals.length; i++) {
    const animal = createdAnimals[i];
    const rng = createSeededRng(20261024 + i * 997);
    const posState = {
      lat: -32.9827 + (rng() - 0.5) * 0.0006,
      lng: -58.6526 + (rng() - 0.5) * 0.0006,
    };

    for (const tMs of timestamps) {
      const point = computeAnimalTelemetryAt(i, tMs, start90DaysMs, nowMs, rng, posState);
      allTelemetryReadings.push({
        collarId: animal.collarId,
        latitude: point.latitude,
        longitude: point.longitude,
        temperature: point.temperature,
        timestamp: new Date(tMs),
      });
    }
  }

  // Insertar en lotes para máxima velocidad en PostgreSQL / Neon
  const BATCH_SIZE = 2000;
  for (let offset = 0; offset < allTelemetryReadings.length; offset += BATCH_SIZE) {
    const chunk = allTelemetryReadings.slice(offset, offset + BATCH_SIZE);
    await prisma.telemetryReading.createMany({ data: chunk });
  }

  console.log(
    `Insertadas ${allTelemetryReadings.length} mediciones GPS/biométricas (${timestamps.length} por animal a lo largo de 90 días).`
  );

  // =========================================================================
  // 10. HISTORIAL DE MEDICIONES CLÍNICAS Y PESAJES (3 MESES)
  // =========================================================================
  const medicalEventsData: {
    animalId: string;
    type: MedicalEventType;
    description: string;
    value: number | null;
    occurredAt: Date;
  }[] = [];

  const weighingDaysAgo = [90, 68, 45, 22, 2];

  for (let i = 0; i < createdAnimals.length; i++) {
    const animal = createdAnimals[i];
    const finalWeight = animal.weightKg;

    // 5 pesajes evolutivos mostrando ganancia diaria promedio (~0.75 kg/día en pastura de alfalfa)
    for (let wIdx = 0; wIdx < weighingDaysAgo.length; wIdx++) {
      const daysAgo = weighingDaysAgo[wIdx];
      const historicalWeight = Math.round((finalWeight - daysAgo * 0.72 + (i % 3) * 1.5) * 10) / 10;
      const prevWeight =
        wIdx > 0
          ? Math.round((finalWeight - weighingDaysAgo[wIdx - 1] * 0.72 + (i % 3) * 1.5) * 10) / 10
          : historicalWeight - 14;

      medicalEventsData.push({
        animalId: animal.id,
        type: MedicalEventType.WEIGHING,
        value: wIdx === weighingDaysAgo.length - 1 ? finalWeight : historicalWeight,
        description:
          wIdx === 0
            ? `Pesaje de ingreso a Potrero Central (balanza electrónica en manga): ${historicalWeight} kg.`
            : `Control de evolución de peso en pastura de alfalfa: ${
                wIdx === weighingDaysAgo.length - 1 ? finalWeight : historicalWeight
              } kg (peso previo: ${prevWeight} kg).`,
        occurredAt: new Date(nowMs - daysAgo * DAY_MS),
      });
    }

    // Vacunaciones y tratamientos sanitarios durante los 3 meses
    medicalEventsData.push(
      {
        animalId: animal.id,
        type: MedicalEventType.VACCINATION,
        value: null,
        description: 'Campaña oficial SENASA: Vacunación Antiaftosa bivalente (2 ml vía subcutánea).',
        occurredAt: new Date(nowMs - 84 * DAY_MS),
      },
      {
        animalId: animal.id,
        type: MedicalEventType.TREATMENT,
        value: 1,
        description:
          'Desparasitación estratégica de invierno-primavera: Ivermectina 1% + Ricobendazol (control gastrointestinal).',
        occurredAt: new Date(nowMs - 62 * DAY_MS),
      },
      {
        animalId: animal.id,
        type: MedicalEventType.VACCINATION,
        value: null,
        description: 'Vacuna Clostridial Polivalente (Mancha, Gangrena Gaseosa y Enterotoxemia - 5 ml SC).',
        occurredAt: new Date(nowMs - 40 * DAY_MS),
      },
      {
        animalId: animal.id,
        type: MedicalEventType.TREATMENT,
        value: 10,
        description: 'Suplementación parenterales complejo mineral-vitamínico (Cobre, Zinc, Selenio y Vitamina A-D-E).',
        occurredAt: new Date(nowMs - 18 * DAY_MS),
      }
    );

    if (i === 7) {
      // ER-1008 tuvo fiebre hace 12 días y recibió tratamiento
      medicalEventsData.push({
        animalId: animal.id,
        type: MedicalEventType.TREATMENT,
        value: 39.9,
        description:
          'Atención clínica por alerta térmica en collar: Oxitetraciclina LA + Meglumina de Flunixin. Evolución favorable.',
        occurredAt: new Date(nowMs - 12 * DAY_MS + 3 * HOUR_MS),
      });
    }
  }

  await prisma.medicalEvent.createMany({ data: medicalEventsData });
  console.log(`Insertados ${medicalEventsData.length} eventos médicos y pesajes históricos.`);

  // =========================================================================
  // 11. ALERTAS Y PREDICCIONES DE SALUD IA (HISTÓRICAS Y ACTIVAS)
  // =========================================================================
  const latestWindowEnd = blockStartFor(now);

  // 11.1 Alerta activa de ESCAPE en ER-1004 (índice 3)
  await prisma.alert.create({
    data: {
      animalId: createdAnimals[3].id,
      type: AlertType.ESCAPE,
      message: `El animal salió del cerco virtual "${activeGeofence.name}".`,
      isResolved: false,
      createdAt: new Date(nowMs - 2 * HOUR_MS),
    },
  });

  // 11.2 Alerta activa por UMBRAL de FIEBRE en ER-1003 (índice 2)
  await prisma.alert.create({
    data: {
      animalId: createdAnimals[2].id,
      type: AlertType.HEALTH,
      message: '[UMBRAL:FIEBRE] Temperatura elevada detectada: 40.0°C (posible fiebre).',
      isResolved: false,
      createdAt: new Date(nowMs - 3 * HOUR_MS),
    },
  });

  // 11.3 Alerta activa IA de FIEBRE en ER-1003 (índice 2)
  const mlFeverAlert = await prisma.alert.create({
    data: {
      animalId: createdAnimals[2].id,
      type: AlertType.HEALTH,
      message: '[IA:FIEBRE] Modelo predictivo: posible fiebre en las próximas 6hs (confianza 91%).',
      isResolved: false,
      createdAt: new Date(nowMs - 3.5 * HOUR_MS),
    },
  });

  // 11.4 Alerta activa IA de CELO en ER-1006 (índice 5, hembra)
  const mlEstrusAlert = await prisma.alert.create({
    data: {
      animalId: createdAnimals[5].id,
      type: AlertType.HEALTH,
      message: '[IA:CELO] Modelo predictivo: posible celo en las próximas 6hs (confianza 86%).',
      isResolved: false,
      createdAt: new Date(nowMs - 4 * HOUR_MS),
    },
  });

  // 11.5 Alertas históricas resueltas y falso positivo con feedback (para métricas de reportes y últimos 14 días)
  const historicalAlertSpecs = [
    {
      animalIdx: 7, // ER-1008
      type: AlertType.HEALTH,
      message: '[IA:FIEBRE] Modelo predictivo: posible fiebre en las próximas 6hs (confianza 88%).',
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 12,
    },
    {
      animalIdx: 7, // ER-1008
      type: AlertType.HEALTH,
      message: '[UMBRAL:FIEBRE] Temperatura elevada detectada: 39.9°C (posible fiebre).',
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 12,
    },
    {
      animalIdx: 0, // ER-1001
      type: AlertType.ESCAPE,
      message: `El animal salió del cerco virtual "${activeGeofence.name}".`,
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 9,
    },
    {
      animalIdx: 4, // ER-1005
      type: AlertType.HEALTH,
      message: '[IA:INACTIVIDAD] Modelo predictivo: posible inactividad prolongada en las próximas 6hs (confianza 76%).',
      isResolved: true,
      isFalsePositive: true,
      feedbackNote: 'El rodeo estaba descansando bajo la sombra del monte en hora de calor intenso.',
      daysAgo: 6,
    },
    {
      animalIdx: 1, // ER-1002
      type: AlertType.HEALTH,
      message: '[IA:CELO] Modelo predictivo: posible celo en las próximas 6hs (confianza 84%).',
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 4,
    },
    {
      animalIdx: 9, // ER-1010
      type: AlertType.ESCAPE,
      message: `El animal salió del cerco virtual "${activeGeofence.name}".`,
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 25,
    },
    {
      animalIdx: 6, // ER-1007
      type: AlertType.HEALTH,
      message: '[UMBRAL:INACTIVIDAD] El animal no registra movimiento significativo hace más de 120 minutos.',
      isResolved: true,
      isFalsePositive: false,
      feedbackNote: null,
      daysAgo: 48,
    },
  ];

  const historicalAlertsData = historicalAlertSpecs.map((h) => {
    const alertDate = new Date(nowMs - h.daysAgo * DAY_MS);
    return {
      animalId: createdAnimals[h.animalIdx].id,
      type: h.type,
      message: h.message,
      isResolved: h.isResolved,
      isFalsePositive: h.isFalsePositive,
      feedbackNote: h.feedbackNote,
      feedbackAt: h.isFalsePositive ? new Date(alertDate.getTime() + HOUR_MS) : null,
      feedbackUserId: h.isFalsePositive ? juanUser.id : null,
      createdAt: alertDate,
    };
  });
  await prisma.alert.createMany({ data: historicalAlertsData });

  // 11.6 Predicciones del modelo de IA (HealthPrediction) para la ventana actual de 24h (48 bloques)
  const healthPredictionsData: {
    animalId: string;
    predictedEvent: string;
    probability: number;
    threshold: number;
    detected: boolean;
    horizonHours: number;
    windowReadingsCount: number;
    windowEndAt: Date;
    alertId: string | null;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < createdAnimals.length; i++) {
    const animal = createdAnimals[i];
    const isFeverAnimal = i === 2; // ER-1003
    const isEstrusAnimal = i === 5; // ER-1006

    const predictionsForAnimal = [
      {
        predictedEvent: 'fiebre',
        probability: isFeverAnimal ? 0.91 : 0.08 + (i % 3) * 0.03,
        threshold: 0.65,
        detected: isFeverAnimal,
        alertId: isFeverAnimal ? mlFeverAlert.id : null,
      },
      {
        predictedEvent: 'celo',
        probability: isEstrusAnimal ? 0.86 : animal.sex === Sex.FEMALE ? 0.14 + (i % 4) * 0.04 : 0.01,
        threshold: 0.6,
        detected: isEstrusAnimal,
        alertId: isEstrusAnimal ? mlEstrusAlert.id : null,
      },
      {
        predictedEvent: 'inactividad',
        probability: 0.11 + (i % 4) * 0.03,
        threshold: 0.65,
        detected: false,
        alertId: null,
      },
      {
        predictedEvent: 'anomalia',
        probability: i === 3 ? 0.58 : 0.09 + (i % 3) * 0.02,
        threshold: 0.7,
        detected: false,
        alertId: null,
      },
    ];

    for (const pred of predictionsForAnimal) {
      healthPredictionsData.push({
        animalId: animal.id,
        predictedEvent: pred.predictedEvent,
        probability: pred.probability,
        threshold: pred.threshold,
        detected: pred.detected,
        horizonHours: 6,
        windowReadingsCount: 48,
        windowEndAt: latestWindowEnd,
        alertId: pred.alertId,
        createdAt: new Date(nowMs - 20 * 60 * 1000),
      });
    }
  }

  await prisma.healthPrediction.createMany({ data: healthPredictionsData });

  // 12. Logs recientes de paquetes IoT en el Gateway de Entre Ríos
  const iotLogsData = createdAnimals.map((animal, idx) => {
    const lastReading = allTelemetryReadings.filter((r) => r.collarId === animal.collarId).slice(-1)[0];
    return {
      createdAt: new Date(nowMs - (10 - idx) * 60 * 1000),
      endpoint: '/api/iot/telemetry',
      method: 'POST',
      ipAddress: '181.15.142.88',
      gatewayId: gateway.id,
      gatewayName: gateway.name,
      farmId: farm.id,
      farmName: farm.name,
      apiKeyUsed: `${gatewayApiKey.slice(0, 12)}...`,
      collarId: animal.collarId,
      headers: { 'x-api-key': '***', 'user-agent': 'DAMP-LoRa-Gateway/3.2' },
      payload: {
        collar_id: animal.collarId,
        gateway_id: gateway.id,
        lat: lastReading.latitude,
        lng: lastReading.longitude,
        temp: lastReading.temperature,
        rssi: -65 - idx,
        snr: 9.8 - idx * 0.2,
      },
      lat: lastReading.latitude,
      lng: lastReading.longitude,
      temp: lastReading.temperature,
      rssi: -65 - idx,
      snr: 9.8 - idx * 0.2,
      statusCode: 201,
      status: 'SUCCESS',
      responseBody: { downlink: 'NONE' },
      downlinkSent: 'NONE',
      durationMs: 24 + idx * 3,
    };
  });

  await prisma.iotRequestLog.createMany({ data: iotLogsData });

  console.log('\n============================================================');
  console.log('✅ SEED COMPLETADO EXITOSAMENTE');
  console.log('============================================================');
  console.log(`👤 Productor:       Juan Pérez (${juanUser.email} / clave: Juan1234!)`);
  console.log(`🔑 SuperAdmin:      ${superAdmin.email} (clave: Admin1234!)`);
  console.log(`🌾 Campo:           ${farm.name} (${farm.province} - ${farm.location}, ${farm.totalAreaHa} Ha)`);
  console.log(`⚡ Cerco Virtual:   ${activeGeofence.name} (Activo desde hace 92 días)`);
  console.log(`📡 Gateway LoRa:    ${gateway.name} (ONLINE)`);
  console.log(`🐄 Ganados:         ${createdAnimals.length} cabezas (ER-1001 a ER-1010) con 10 collares asignados`);
  console.log(`📍 Registros GPS:   ${allTelemetryReadings.length} lecturas (${timestamps.length} por animal en 90 días)`);
  console.log(`🩺 Eventos Médicos: ${medicalEventsData.length} registros clínicos y de evolución de peso`);
  console.log('============================================================\n');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
