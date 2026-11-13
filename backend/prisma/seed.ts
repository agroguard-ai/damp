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
import { buildMlWindow, type RawReading } from '../src/iot/ml-window';

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

/** Desplaza una coordenada (lat, lng) una distancia en metros en un ángulo aleatorio */
function moveByMeters(lat: number, lng: number, meters: number, angleRad: number): [number, number] {
  const dLat = (meters * Math.cos(angleRad)) / 111_111;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
  const dLng = (meters * Math.sin(angleRad)) / (111_111 * cosLat);
  return [lat + dLat, lng + dLng];
}

const ML_SEED_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SEED_THRESHOLDS: Record<string, number> = {
  fiebre: 0.35,
  celo: 0.5,
  inactividad: 0.4,
  anomalia: 0.4,
};
const ML_EVENT_LABELS: Record<string, string> = {
  fiebre: 'fiebre',
  celo: 'celo',
  inactividad: 'inactividad prolongada',
  anomalia: 'anomalía de comportamiento',
};

async function checkMlServiceOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_SEED_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const body = (await res.json()) as { model_loaded?: boolean };
    return Boolean(body.model_loaded);
  } catch {
    return false;
  }
}

async function predictWithMlService(
  animalId: string,
  sex: Sex,
  readings: RawReading[],
  windowEnd: Date
): Promise<Record<string, { probability: number; threshold: number; detected: boolean }> | null> {
  try {
    const window = buildMlWindow(readings, new Date(windowEnd.getTime() - 1));
    if (window.blocksWithData < 36) return null;
    const res = await fetch(`${ML_SEED_BASE_URL}/predict/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animal_id: animalId, sex, readings: window.blocks }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ready?: boolean;
      events?: Record<string, { probability: number; threshold?: number; detected?: boolean }>;
    };
    if (!body.ready || !body.events) return null;
    const out: Record<string, { probability: number; threshold: number; detected: boolean }> = {};
    for (const [k, v] of Object.entries(body.events)) {
      const threshold = v.threshold ?? ML_SEED_THRESHOLDS[k] ?? 0.5;
      out[k] = {
        probability: Number(v.probability.toFixed(4)),
        threshold,
        detected: v.detected ?? v.probability >= threshold,
      };
    }
    return out;
  } catch {
    return null;
  }
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
    await prisma.animalGeofence.deleteMany({
      where: {
        OR: [{ animal: { farmId: { in: existingFarmIds } } }, { geofence: { farmId: { in: existingFarmIds } } }],
      },
    });
    await prisma.animalCollar.deleteMany({
      where: {
        OR: [
          { animal: { farmId: { in: existingFarmIds } } },
          { collar: { farmId: { in: existingFarmIds } } },
          { collar: { identifier: { in: collarIdentifiers } } },
        ],
      },
    });
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
  const mlOnline = await checkMlServiceOnline();
  if (mlOnline) {
    console.log('ml-service detectado online: sembrando predicciones reales del modelo para consistencia con "Forzar predicción".');
  }

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

    const animalReadings: RawReading[] = mlOnline
      ? allTelemetryReadings
          .filter((r) => r.collarId === animal.collarId)
          .map((r) => ({
            temperature: r.temperature,
            latitude: r.latitude,
            longitude: r.longitude,
            timestamp: r.timestamp,
          }))
      : [];

    const mlEvents = mlOnline ? await predictWithMlService(animal.id, animal.sex, animalReadings, latestWindowEnd) : null;

    const fallbackPredictions = [
      {
        predictedEvent: 'fiebre',
        probability: isFeverAnimal ? 0.91 : 0.08 + (i % 3) * 0.03,
        threshold: 0.35,
        detected: isFeverAnimal,
      },
      {
        predictedEvent: 'celo',
        probability: isEstrusAnimal ? 0.86 : animal.sex === Sex.FEMALE ? 0.14 + (i % 4) * 0.04 : 0.01,
        threshold: 0.5,
        detected: isEstrusAnimal,
      },
      {
        predictedEvent: 'inactividad',
        probability: 0.11 + (i % 4) * 0.03,
        threshold: 0.4,
        detected: false,
      },
      {
        predictedEvent: 'anomalia',
        probability: i === 3 ? 0.34 : 0.05 + (i % 3) * 0.02,
        threshold: 0.4,
        detected: false,
      },
    ];

    const predictionsForAnimal = mlEvents
      ? Object.entries(mlEvents).map(([predictedEvent, ev]) => ({
          predictedEvent,
          probability: ev.probability,
          threshold: ev.threshold,
          detected: ev.detected,
        }))
      : fallbackPredictions;

    for (const pred of predictionsForAnimal) {
      let alertId: string | null = null;
      if (pred.detected) {
        if (isFeverAnimal && pred.predictedEvent === 'fiebre') {
          alertId = mlFeverAlert.id;
        } else if (isEstrusAnimal && pred.predictedEvent === 'celo') {
          alertId = mlEstrusAlert.id;
        }
      }
      healthPredictionsData.push({
        animalId: animal.id,
        predictedEvent: pred.predictedEvent,
        probability: pred.probability,
        threshold: pred.threshold,
        detected: pred.detected,
        horizonHours: 6,
        windowReadingsCount: 48,
        windowEndAt: latestWindowEnd,
        alertId,
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

  // =========================================================================
  // 13. PRODUCTOR: SANTIAGO MORÍN Y CAMPO EN MARCOS JUÁREZ, CÓRDOBA
  // =========================================================================
  console.log('\n--- Configurando productor Santiago Morín y su campo en Marcos Juárez ---');

  const santiagoEmail = 'santiago.morin@damp.com';
  const santiagoPasswordHash = await bcrypt.hash('Santiago1234!', 10);

  const santiagoUser = await prisma.user.upsert({
    where: { email: santiagoEmail },
    update: {
      name: 'Santiago Morín',
      passwordHash: santiagoPasswordHash,
      globalRole: GlobalRole.FARM_ADMIN,
      mustChangePassword: false,
      isActive: true,
      maxCollars: 15,
    },
    create: {
      email: santiagoEmail,
      name: 'Santiago Morín',
      passwordHash: santiagoPasswordHash,
      globalRole: GlobalRole.FARM_ADMIN,
      mustChangePassword: false,
      isActive: true,
      maxCollars: 15,
    },
  });
  console.log(`Productor verificado: ${santiagoUser.name} (${santiagoUser.email} / pass: Santiago1234!)`);

  const mjCollarIdentifiers = ['COLLAR-MJ-01', 'COLLAR-MJ-02', 'COLLAR-MJ-03', 'COLLAR-MJ-LIBRE-01'];
  const mjGatewayApiKey = 'damp_gw_marcos_juarez_santiago_2026_key_01';

  const existingMjFarms = await prisma.farm.findMany({
    where: {
      OR: [{ userId: santiagoUser.id }, { name: 'Estancia San Marcos - Santiago Morín' }],
    },
    select: { id: true },
  });
  const existingMjFarmIds = existingMjFarms.map((f) => f.id);

  if (existingMjFarmIds.length > 0) {
    console.log('Limpiando datos previos del campo de Santiago Morín para regenerar seed limpio...');
    await prisma.iotRequestLog.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.healthPrediction.deleteMany({ where: { animal: { farmId: { in: existingMjFarmIds } } } });
    await prisma.alert.deleteMany({ where: { animal: { farmId: { in: existingMjFarmIds } } } });
    await prisma.medicalEvent.deleteMany({ where: { animal: { farmId: { in: existingMjFarmIds } } } });
    await prisma.animalGeofence.deleteMany({
      where: {
        OR: [{ animal: { farmId: { in: existingMjFarmIds } } }, { geofence: { farmId: { in: existingMjFarmIds } } }],
      },
    });
    await prisma.animalCollar.deleteMany({
      where: {
        OR: [
          { animal: { farmId: { in: existingMjFarmIds } } },
          { collar: { farmId: { in: existingMjFarmIds } } },
          { collar: { identifier: { in: mjCollarIdentifiers } } },
        ],
      },
    });
    await prisma.telemetryReading.deleteMany({
      where: { collar: { OR: [{ farmId: { in: existingMjFarmIds } }, { identifier: { in: mjCollarIdentifiers } }] } },
    });
    await prisma.collar.deleteMany({
      where: { OR: [{ farmId: { in: existingMjFarmIds } }, { identifier: { in: mjCollarIdentifiers } }] },
    });
    await prisma.animal.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.rotationPlan.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.geofence.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.gateway.deleteMany({
      where: { OR: [{ farmId: { in: existingMjFarmIds } }, { apiKey: mjGatewayApiKey }] },
    });
    await prisma.alertSettings.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.farmUser.deleteMany({ where: { farmId: { in: existingMjFarmIds } } });
    await prisma.farm.deleteMany({ where: { id: { in: existingMjFarmIds } } });
  } else {
    await prisma.telemetryReading.deleteMany({ where: { collar: { identifier: { in: mjCollarIdentifiers } } } });
    await prisma.animalCollar.deleteMany({ where: { collar: { identifier: { in: mjCollarIdentifiers } } } });
    await prisma.collar.deleteMany({ where: { identifier: { in: mjCollarIdentifiers } } });
    await prisma.gateway.deleteMany({ where: { apiKey: mjGatewayApiKey } });
  }

  // Perímetro del campo en zona rural de Marcos Juárez, Córdoba (~124.5 Ha)
  const mjFarmPolygon: [number, number][] = [
    [-32.715, -62.13],
    [-32.715, -62.118],
    [-32.725, -62.118],
    [-32.725, -62.13],
  ];

  const mjActiveGeofencePolygon: [number, number][] = [
    [-32.7165, -62.128],
    [-32.7165, -62.12],
    [-32.7235, -62.12],
    [-32.7235, -62.128],
  ];

  const thirtyDaysAgo = new Date(nowMs - 30 * DAY_MS);

  const mjFarm = await prisma.farm.create({
    data: {
      name: 'Estancia San Marcos - Santiago Morín',
      province: 'Córdoba',
      location: 'Marcos Juárez',
      address: 'Ruta Nacional 9 Km 442, Marcos Juárez, Córdoba',
      totalAreaHa: 124.5,
      polygonCoordinates: mjFarmPolygon,
      userId: santiagoUser.id,
      isActive: true,
      createdAt: thirtyDaysAgo,
    },
  });

  await prisma.farmUser.create({
    data: {
      farmId: mjFarm.id,
      userId: santiagoUser.id,
      roleId: rolesMap['ADMIN'],
      isActive: true,
    },
  });

  await prisma.alertSettings.create({
    data: {
      farmId: mjFarm.id,
      feverThreshold: 39.5,
      hypothermiaThreshold: 37.0,
      inactivityMinutes: 120,
      emailOnEscape: true,
      emailOnHealth: true,
    },
  });

  const mjGateway = await prisma.gateway.create({
    data: {
      name: 'Gateway LoRaWAN - Estancia San Marcos (MJ)',
      farmId: mjFarm.id,
      apiKey: mjGatewayApiKey,
      lastSeenAt: now,
      lastRssi: -69.2,
      lastSnr: 9.1,
      createdAt: thirtyDaysAgo,
    },
  });

  const mjActiveGeofence = await prisma.geofence.create({
    data: {
      farmId: mjFarm.id,
      name: 'Potrero Este - Pastura Alfalfa',
      pastureType: 'Alfalfa Pura',
      polygonCoordinates: mjActiveGeofencePolygon,
      active: true,
      activatedAt: thirtyDaysAgo,
      createdAt: thirtyDaysAgo,
    },
  });

  // 3 animales monitoreados con evoluciones diferenciadas + 1 animal libre sin collar
  // Las curvas de fallback están calibradas con la salida real de ml-service para que al forzar predicción
  // solo haya un reajuste mínimo (~1-2%) sin saltos bruscos ni cambios de evento.
  const mjMonitoredSpecs = [
    {
      tag: 'MJ-201',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 430,
      ageMonths: 27,
      collarIdentifier: 'COLLAR-MJ-01',
      targetEvent: 'celo' as const,
      eventCurves: {
        fiebre: [0.06, 0.07, 0.08, 0.07, 0.08, 0.09, 0.08, 0.09],
        celo: [0.12, 0.17, 0.23, 0.29, 0.36, 0.42, 0.48, 0.54],
        inactividad: [0.14, 0.16, 0.19, 0.21, 0.24, 0.26, 0.27, 0.28],
        anomalia: [0.03, 0.04, 0.03, 0.05, 0.04, 0.03, 0.04, 0.03],
      } as Record<string, number[]>,
      alertMessage: '[IA:CELO] Modelo predictivo: posible celo en las próximas 6hs (confianza 54%).',
    },
    {
      tag: 'MJ-202',
      breed: 'Aberdeen Angus',
      sex: Sex.FEMALE,
      weightKg: 415,
      ageMonths: 25,
      collarIdentifier: 'COLLAR-MJ-02',
      targetEvent: 'fiebre' as const,
      eventCurves: {
        fiebre: [0.1, 0.16, 0.22, 0.29, 0.37, 0.45, 0.53, 0.61],
        celo: [0.05, 0.04, 0.05, 0.04, 0.03, 0.04, 0.03, 0.03],
        inactividad: [0.04, 0.03, 0.04, 0.03, 0.02, 0.03, 0.02, 0.02],
        anomalia: [0.08, 0.12, 0.17, 0.22, 0.28, 0.34, 0.4, 0.46],
      } as Record<string, number[]>,
      alertMessage: '[IA:FIEBRE] Modelo predictivo: posible fiebre en las próximas 6hs (confianza 61%).',
    },
    {
      tag: 'MJ-203',
      breed: 'Brangus',
      sex: Sex.MALE,
      weightKg: 490,
      ageMonths: 31,
      collarIdentifier: 'COLLAR-MJ-03',
      targetEvent: 'fiebre' as const,
      eventCurves: {
        fiebre: [0.1, 0.18, 0.27, 0.38, 0.5, 0.64, 0.8, 0.96],
        celo: [0.03, 0.04, 0.03, 0.05, 0.04, 0.03, 0.04, 0.04],
        inactividad: [0.02, 0.01, 0.02, 0.01, 0.01, 0.02, 0.01, 0.0],
        anomalia: [0.03, 0.02, 0.03, 0.02, 0.02, 0.01, 0.02, 0.01],
      } as Record<string, number[]>,
      alertMessage: '[IA:FIEBRE] Modelo predictivo: posible fiebre en las próximas 6hs (confianza 96%).',
    },
  ];

  // Bloques de 30 min para las últimas 72 horas (para respaldar ventanas de 24h y evolución)
  const mjStart72hMs = blockStartFor(new Date(nowMs - 72 * HOUR_MS)).getTime();
  const mjTimestamps: number[] = [];
  for (let t = mjStart72hMs; t <= nowMs; t += step30MinMs) {
    mjTimestamps.push(t);
  }
  if (mjTimestamps[mjTimestamps.length - 1] < nowMs) {
    mjTimestamps.push(nowMs);
  }

  const mjTelemetryData: {
    collarId: number;
    latitude: number;
    longitude: number;
    temperature: number;
    timestamp: Date;
  }[] = [];

  const mjPredictionsData: {
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

  // 8 ventanas cada 3 horas en las últimas 21 horas hasta `latestWindowEnd`
  const mjWindowEnds: Date[] = [];
  for (let k = 7; k >= 0; k--) {
    mjWindowEnds.push(new Date(latestWindowEnd.getTime() - k * 3 * HOUR_MS));
  }

  for (let idx = 0; idx < mjMonitoredSpecs.length; idx++) {
    const spec = mjMonitoredSpecs[idx];
    const collar = await prisma.collar.create({
      data: {
        identifier: spec.collarIdentifier,
        status: CollarStatus.AVAILABLE,
        isArchived: false,
        fenceNotificationPending: false,
        lastFenceSyncedAt: new Date(nowMs - HOUR_MS),
        lastTelemetryDate: now,
        farmId: mjFarm.id,
        createdAt: thirtyDaysAgo,
      },
    });

    const animal = await prisma.animal.create({
      data: {
        farmId: mjFarm.id,
        ownerId: santiagoUser.id,
        tag: spec.tag,
        sex: spec.sex,
        birthDate: new Date(nowMs - spec.ageMonths * 30 * DAY_MS),
        breed: spec.breed,
        weightKg: spec.weightKg,
        animalTypeId: animalTypesByName[spec.breed] ?? null,
        status: 'ACTIVE',
        isArchived: false,
        createdAt: thirtyDaysAgo,
      },
    });

    await prisma.animalCollar.create({
      data: {
        collarId: collar.id,
        animalId: animal.id,
        startAt: thirtyDaysAgo,
        endAt: null,
      },
    });

    await prisma.animalGeofence.create({
      data: {
        animalId: animal.id,
        geofenceId: mjActiveGeofence.id,
        startAt: thirtyDaysAgo,
        endAt: null,
      },
    });

    // Generar telemetría de 72h dentro de mjActiveGeofence acorde al patrón del animal (en metros reales por bloque)
    const rng = createSeededRng(20261112 + idx * 773);
    let lat = -32.72 + (idx - 1) * 0.0012;
    let lng = -62.124 + (idx - 1) * 0.0014;
    const animalReadings: RawReading[] = [];

    for (const tMs of mjTimestamps) {
      const hoursBeforeNow = (nowMs - tMs) / HOUR_MS;
      const isStagnantWindow = idx === 0 && hoursBeforeNow <= 18;
      let meters = 24 + (rng() - 0.5) * 6;
      if (isStagnantWindow) {
        meters = 3.5 + rng() * 2;
      } else if (idx === 1 && hoursBeforeNow <= 18) {
        meters = 58 + (rng() - 0.5) * 10;
      } else if (idx === 2 && hoursBeforeNow <= 18) {
        meters = 33 + (rng() - 0.5) * 6;
      }

      const [nextLat, nextLng] = moveByMeters(lat, lng, meters, rng() * Math.PI * 2);
      lat = Math.max(-32.723, Math.min(-32.717, nextLat));
      lng = Math.max(-62.1275, Math.min(-62.1205, nextLng));

      let temp = 38.4 + circadianTempOffset(new Date(tMs)) + (rng() - 0.5) * 0.12;
      if (isStagnantWindow) {
        temp -= 0.25;
      } else if (idx === 1 && hoursBeforeNow <= 18) {
        temp += 0.35;
      } else if (idx === 2 && hoursBeforeNow <= 18) {
        const feverIntensity = Math.min(1, (18 - hoursBeforeNow) / 10);
        temp = 38.65 + feverIntensity * 1.45 + (rng() - 0.5) * 0.1;
      }

      const reading = {
        collarId: collar.id,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        temperature: Number(temp.toFixed(2)),
        timestamp: new Date(tMs),
      };
      mjTelemetryData.push(reading);
      animalReadings.push(reading);
    }

    // Evolución de predicciones (8 ventanas * 4 eventos). Si ml-service está online, usa el modelo real.
    const allEvents = [
      { key: 'fiebre', threshold: 0.35 },
      { key: 'celo', threshold: 0.5 },
      { key: 'inactividad', threshold: 0.4 },
      { key: 'anomalia', threshold: 0.4 },
    ];

    const mlWindowPredictions: Array<{
      wEnd: Date;
      events: Record<string, { probability: number; threshold: number; detected: boolean }> | null;
    }> = [];

    for (let wIdx = 0; wIdx < mjWindowEnds.length; wIdx++) {
      const wEnd = mjWindowEnds[wIdx];
      const events = mlOnline ? await predictWithMlService(animal.id, spec.sex, animalReadings, wEnd) : null;
      mlWindowPredictions.push({ wEnd, events });
    }

    // Determinar alerta activa acorde a la última ventana
    const lastWindowPred = mlWindowPredictions[mlWindowPredictions.length - 1]?.events;
    const detectedEntries = lastWindowPred
      ? Object.entries(lastWindowPred)
          .filter(([, ev]) => ev.detected)
          .sort((a, b) => b[1].probability - a[1].probability)
      : [];

    const topDetected = detectedEntries[0];
    const alertMessage = topDetected
      ? `[IA:${topDetected[0].toUpperCase()}] Modelo predictivo: posible ${ML_EVENT_LABELS[topDetected[0]] ?? topDetected[0]} en las próximas 6hs (confianza ${Math.round(topDetected[1].probability * 100)}%).`
      : spec.alertMessage;

    const activeAlert =
      !lastWindowPred || topDetected
        ? await prisma.alert.create({
            data: {
              animalId: animal.id,
              type: AlertType.HEALTH,
              message: alertMessage,
              isResolved: false,
              createdAt: new Date(nowMs - 45 * 60 * 1000),
            },
          })
        : null;

    for (let wIdx = 0; wIdx < mlWindowPredictions.length; wIdx++) {
      const { wEnd, events } = mlWindowPredictions[wIdx];
      const isLastWindow = wIdx === mlWindowPredictions.length - 1;

      if (events) {
        for (const [key, ev] of Object.entries(events)) {
          const linkAlert = isLastWindow && topDetected && topDetected[0] === key ? activeAlert?.id ?? null : null;
          mjPredictionsData.push({
            animalId: animal.id,
            predictedEvent: key,
            probability: ev.probability,
            threshold: ev.threshold,
            detected: ev.detected,
            horizonHours: 6,
            windowReadingsCount: 48,
            windowEndAt: wEnd,
            alertId: linkAlert,
            createdAt: new Date(wEnd.getTime() + 5 * 60 * 1000),
          });
        }
      } else {
        for (const ev of allEvents) {
          const isTarget = ev.key === spec.targetEvent;
          const curve = spec.eventCurves[ev.key] ?? [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
          const probability = curve[wIdx] ?? 0.05;
          const detected = probability >= ev.threshold;

          mjPredictionsData.push({
            animalId: animal.id,
            predictedEvent: ev.key,
            probability,
            threshold: ev.threshold,
            detected,
            horizonHours: 6,
            windowReadingsCount: 48,
            windowEndAt: wEnd,
            alertId: isTarget && isLastWindow ? activeAlert?.id ?? null : null,
            createdAt: new Date(wEnd.getTime() + 5 * 60 * 1000),
          });
        }
      }
    }
  }

  await prisma.telemetryReading.createMany({ data: mjTelemetryData });
  await prisma.healthPrediction.createMany({ data: mjPredictionsData });

  // Animal libre y collar asignado pero con última lectura reciente POR FUERA del cerco virtual activo
  // Coordenadas: lat -32.7220, lng -62.1186 (dentro del campo, pero al este del cerco cuyo límite es -62.1200)
  // Esto permite probar en vivo la validación al intentar asignar este animal al cerco activo.
  const mjOutsideReadingDate = new Date(nowMs - 12 * 60 * 1000); // 12 minutos atrás (reciente)
  const mjFreeCollar = await prisma.collar.create({
    data: {
      identifier: 'COLLAR-MJ-LIBRE-01',
      status: CollarStatus.AVAILABLE,
      isArchived: false,
      fenceNotificationPending: false,
      lastFenceSyncedAt: null,
      lastTelemetryDate: mjOutsideReadingDate,
      farmId: mjFarm.id,
      createdAt: thirtyDaysAgo,
    },
  });

  const mjFreeAnimal = await prisma.animal.create({
    data: {
      farmId: mjFarm.id,
      ownerId: santiagoUser.id,
      tag: 'MJ-204',
      sex: Sex.FEMALE,
      birthDate: new Date(nowMs - 22 * 30 * DAY_MS),
      breed: 'Aberdeen Angus',
      weightKg: 405,
      animalTypeId: animalTypesByName['Aberdeen Angus'] ?? null,
      status: 'ACTIVE',
      isArchived: false,
      createdAt: thirtyDaysAgo,
    },
  });

  // Vincular collar a MJ-204
  await prisma.animalCollar.create({
    data: {
      animalId: mjFreeAnimal.id,
      collarId: mjFreeCollar.id,
      startAt: thirtyDaysAgo,
    },
  });

  // Generar lectura de telemetría reciente que sitúa al animal fuera del cerco activo (al este)
  await prisma.telemetryReading.create({
    data: {
      collarId: mjFreeCollar.id,
      latitude: -32.7220,
      longitude: -62.1186,
      temperature: 38.5,
      timestamp: mjOutsideReadingDate,
    },
  });

  console.log('\n============================================================');
  console.log('✅ SEED COMPLETADO EXITOSAMENTE');
  console.log('============================================================');
  console.log(`🔑 SuperAdmin:      ${superAdmin.email} (clave: Admin1234!)`);
  console.log('------------------------------------------------------------');
  console.log(`👤 Productor 1:     Juan Pérez (${juanUser.email} / clave: Juan1234!)`);
  console.log(`🌾 Campo 1:         ${farm.name} (${farm.province} - ${farm.location}, ${farm.totalAreaHa} Ha)`);
  console.log(`⚡ Cerco Virtual:   ${activeGeofence.name} (Activo desde hace 92 días)`);
  console.log(`📡 Gateway LoRa:    ${gateway.name} (ONLINE)`);
  console.log(`🐄 Ganados:         ${createdAnimals.length} cabezas (ER-1001 a ER-1010) con 10 collares asignados`);
  console.log(`📍 Registros GPS:   ${allTelemetryReadings.length} lecturas (${timestamps.length} por animal en 90 días)`);
  console.log(`🩺 Eventos Médicos: ${medicalEventsData.length} registros clínicos y de evolución de peso`);
  console.log('------------------------------------------------------------');
  console.log(`👤 Productor 2:     Santiago Morín (${santiagoUser.email} / clave: Santiago1234!)`);
  console.log(`🌾 Campo 2:         ${mjFarm.name} (${mjFarm.province} - ${mjFarm.location}, ${mjFarm.totalAreaHa} Ha)`);
  console.log(`⚡ Cerco:           ${mjActiveGeofence.name} (Activo)`);
  console.log(`📡 Gateway LoRa:    ${mjGateway.name} (ONLINE)`);
  console.log(`🐄 Ganados IA:      MJ-201 (Inactividad), MJ-202 (Celo), MJ-203 (Fiebre) con ${mjPredictionsData.length} predicciones`);
  console.log(`⚠️ Prueba Validación: Animal ${mjFreeAnimal.tag} con collar ${mjFreeCollar.identifier} ubicado fuera del cerco activo (lat: -32.7220, lng: -62.1186)`);
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
