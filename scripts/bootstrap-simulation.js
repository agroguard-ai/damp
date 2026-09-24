/**
 * ============================================================
 *  DAMP — Bootstrap de la granja de simulación
 *  ------------------------------------------
 *  Crea de una todo lo que necesita fleet-simulator.js: una zona
 *  de prueba, un gateway, 20 collares, 20 animales (uno por
 *  collar) y un geofence que los agrupa a todos. Al final escribe
 *  scripts/fleet-simulator.config.json ya completo.
 *
 *  Se loguea solo contra POST /auth/login (usuario/contraseña, ya no Clerk)
 *  y usa el JWT que devuelve — dura 7 días por defecto, así que no hay
 *  apuro de token expirando a mitad de script como antes.
 *
 *  IMPORTANTE: ZonesService (y algún otro service más) tiene su propio
 *  chequeo de dueño (`farm.userId !== userId`) que NO respeta el rol
 *  SUPER_ADMIN ni la membresía FarmUser — así que crear la zona/gateway/
 *  animales/geofence hay que hacerlo logueado como el DUEÑO real de la
 *  granja, no como SUPER_ADMIN. Solo el alta de collares (`POST /collars`)
 *  exige sí o sí SUPER_ADMIN. Por eso este script pide dos logins.
 *
 *  Uso:
 *    node scripts/bootstrap-simulation.js <ADMIN_EMAIL> <ADMIN_PASSWORD>
 *      → sin más argumentos, lista las granjas del sistema (requiere
 *        SUPER_ADMIN) y no crea nada.
 *    node scripts/bootstrap-simulation.js <ADMIN_EMAIL> <ADMIN_PASSWORD> <FARM_ID> <OWNER_EMAIL> <OWNER_PASSWORD>
 *      → crea todo dentro de esa granja (OWNER_EMAIL tiene que ser el
 *        dueño real de FARM_ID, o el paso de zona va a fallar con 403).
 *
 *  Opcional: CENTER_LAT / CENTER_LNG (env vars) para elegir dónde
 *  queda el cerco de prueba. Por defecto usa un punto arbitrario.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://damp-api.geiko.cloud';
const ADMIN_EMAIL = process.argv[2];
const ADMIN_PASSWORD = process.argv[3];
const FARM_ID = process.argv[4];
const OWNER_EMAIL = process.argv[5];
const OWNER_PASSWORD = process.argv[6];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Uso: node scripts/bootstrap-simulation.js <ADMIN_EMAIL> <ADMIN_PASSWORD> [FARM_ID] [OWNER_EMAIL] [OWNER_PASSWORD]');
  process.exit(1);
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login de ${email} falló: HTTP ${res.status} ${await res.text()}`);
  }
  const { accessToken } = await res.json();
  return accessToken;
}

async function api(token, method, apiPath, body) {
  const res = await fetch(`${BASE_URL}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${method} ${apiPath} -> HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`Logueando como ${ADMIN_EMAIL}...`);
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  if (!FARM_ID) {
    const farms = await api(adminToken, 'GET', '/admin/farms');
    console.log('Pasame el farmId (+ credenciales del dueño) como argumentos. Granjas del sistema:');
    farms.forEach((f) => console.log(`  ${f.id}  ${f.name ?? '(sin nombre)'}  (dueño: ${f.user?.email ?? '—'})`));
    return;
  }

  if (!OWNER_EMAIL || !OWNER_PASSWORD) {
    throw new Error('Con FARM_ID hacen falta también OWNER_EMAIL y OWNER_PASSWORD (dueño real de esa granja).');
  }

  console.log(`Logueando como ${OWNER_EMAIL} (dueño de la granja)...`);
  const ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);

  console.log('Creando zona de prueba...');
  const zone = await api(ownerToken, 'POST', '/zones', { name: 'Zona Simulación', farmId: FARM_ID });

  console.log('Creando gateway...');
  const gateway = await api(ownerToken, 'POST', '/gateways', {
    name: 'Gateway Simulación',
    farmId: FARM_ID,
    zoneId: zone.id,
  });

  console.log('Registrando 20 collares...');
  const collars = [];
  for (let i = 1; i <= 20; i++) {
    const identifier = `COLLAR-SIM-${String(i).padStart(2, '0')}`;
    const collar = await api(adminToken, 'POST', '/collars', { identifier });
    collars.push({ collarId: collar.id, identifier });
    process.stdout.write(`  ${identifier} (id=${collar.id})\n`);
  }

  console.log('Creando 20 animales y asignándoles un collar a cada uno...');
  const animalIds = [];
  for (const c of collars) {
    const animal = await api(ownerToken, 'POST', '/animals', {
      farmId: FARM_ID,
      breed: 'Simulado',
      weightKg: 400,
      ageMonths: 24,
      collarId: c.collarId,
      zoneId: zone.id,
    });
    animalIds.push(animal.id);
  }

  const centerLat = parseFloat(process.env.CENTER_LAT || '-34.6037');
  const centerLng = parseFloat(process.env.CENTER_LNG || '-58.3816');
  const d = 0.0015; // ~150m de lado
  const geofencePolygon = [
    [centerLat - d, centerLng - d],
    [centerLat + d, centerLng - d],
    [centerLat + d, centerLng + d],
    [centerLat - d, centerLng + d],
  ];

  console.log('Creando geofence y asignando los 20 animales...');
  await api(ownerToken, 'POST', '/geofences', {
    zoneId: zone.id,
    name: 'Cerco Simulación',
    polygonCoordinates: geofencePolygon,
    animalIds,
  });

  const config = {
    baseUrl: BASE_URL,
    gatewayId: gateway.id,
    apiKey: gateway.apiKey,
    geofencePolygon,
    collars,
    escapeCount: 3,
    feverCount: 1,
    tickIntervalMs: 5000,
  };

  const configPath = path.join(__dirname, 'fleet-simulator.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Listo. Se escribió ${configPath} con todo cargado.`);
  console.log('Ahora corré: node scripts/fleet-simulator.js');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
