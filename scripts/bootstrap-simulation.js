/**
 * ============================================================
 *  DAMP — Bootstrap de la granja de simulación
 *  ------------------------------------------
 *  Crea de una todo lo que necesita fleet-simulator.js: una zona
 *  de prueba, un gateway, 20 collares, 20 animales (uno por
 *  collar) y un geofence que los agrupa a todos. Al final escribe
 *  scripts/fleet-simulator.config.json ya completo.
 *
 *  Usa tu propio token de sesión de Clerk (no hace falta X-API-Key
 *  ni nada del lado IoT para esto — son las mismas rutas que usa
 *  el frontend, autenticadas como vos).
 *
 *  Cómo conseguir el token (dura ~60s, hay que usarlo rápido):
 *    1. Entrá a la app de DAMP en el navegador, ya logueado.
 *    2. Abrí la consola de DevTools (F12 → Console).
 *    3. Corré:  await window.Clerk.session.getToken()
 *    4. Copiá el string que te devuelve (empieza con "eyJ...").
 *
 *  Uso:
 *    node scripts/bootstrap-simulation.js <TOKEN>
 *      → sin farmId, lista tus granjas y sus IDs, no crea nada.
 *    node scripts/bootstrap-simulation.js <TOKEN> <FARM_ID>
 *      → crea todo dentro de esa granja.
 *
 *  Opcional: CENTER_LAT / CENTER_LNG (env vars) para elegir dónde
 *  queda el cerco de prueba. Por defecto usa un punto arbitrario.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://damp-api.geiko.cloud';
const TOKEN = process.argv[2];
const FARM_ID = process.argv[3];

if (!TOKEN) {
  console.error('Uso: node scripts/bootstrap-simulation.js <TOKEN> [FARM_ID]');
  console.error('Ver el comentario al inicio del archivo para cómo sacar el TOKEN.');
  process.exit(1);
}

async function api(method, apiPath, body) {
  const res = await fetch(`${BASE_URL}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
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
  if (!FARM_ID) {
    const farms = await api('GET', '/farms');
    console.log('Pasame el farmId como segundo argumento. Tus granjas:');
    farms.forEach((f) => console.log(`  ${f.id}  ${f.name ?? '(sin nombre)'}`));
    return;
  }

  console.log('Creando zona de prueba...');
  const zone = await api('POST', '/zones', { name: 'Zona Simulación', farmId: FARM_ID });

  console.log('Creando gateway...');
  const gateway = await api('POST', '/gateways', { name: 'Gateway Simulación', farmId: FARM_ID, zoneId: zone.id });

  console.log('Registrando 20 collares...');
  const collars = [];
  for (let i = 1; i <= 20; i++) {
    const identifier = `COLLAR-SIM-${String(i).padStart(2, '0')}`;
    const collar = await api('POST', '/collars', { identifier });
    collars.push({ collarId: collar.id, identifier });
    process.stdout.write(`  ${identifier} (id=${collar.id})\n`);
  }

  console.log('Creando 20 animales y asignándoles un collar a cada uno...');
  const animalIds = [];
  for (const c of collars) {
    const animal = await api('POST', '/animals', {
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
  await api('POST', '/geofences', {
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
