/**
 * ============================================================
 *  DAMP — Simulador de flota de collares IoT
 *  ------------------------------------------
 *  Simula N collares reales enviando telemetría a
 *  POST /api/iot/telemetry, tal como lo haría un gateway LoRa
 *  físico: header X-API-Key + body { collar_id, lat, lng, temp,
 *  gateway_id, rssi, snr }. No requiere sesión de usuario ni
 *  Clerk — usa las mismas credenciales que un gateway real
 *  (ver backend/src/iot/guards/iot-device-auth.guard.ts).
 *
 *  De los N collares configurados, algunos se comportan como
 *  "pastando" (caminata aleatoria acotada, rebotan si se acercan
 *  al borde del cerco), unos pocos hacen un recorrido
 *  INSIDE → CROSSING → OUTSIDE deliberado para disparar la
 *  alerta ESCAPE, y opcionalmente uno sube de temperatura para
 *  disparar una alerta HEALTH (fiebre).
 *
 *  Uso:
 *    1. Copiar fleet-simulator.config.example.json a
 *       fleet-simulator.config.json y completar los datos reales
 *       (ver damp/scripts/README-fleet-simulator.md o el chat
 *       donde se armó esto para el paso a paso).
 *    2. node scripts/fleet-simulator.js
 *    3. Ctrl+C para detener.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'fleet-simulator.config.json');
const EXAMPLE_PATH = path.join(__dirname, 'fleet-simulator.config.example.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`\n❌ No existe ${CONFIG_PATH}`);
  console.error(`   Copiá ${path.basename(EXAMPLE_PATH)} a ${path.basename(CONFIG_PATH)} y completá tus datos reales.\n`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const {
  baseUrl,
  gatewayId,
  apiKey,
  geofencePolygon,
  collars,
  escapeCount = 2,
  feverCount = 1,
  tickIntervalMs = 5000,
} = config;

if (!baseUrl || !gatewayId || !apiKey || !Array.isArray(geofencePolygon) || geofencePolygon.length < 3) {
  console.error('❌ Config incompleta: revisá baseUrl, gatewayId, apiKey y geofencePolygon.');
  process.exit(1);
}
if (!Array.isArray(collars) || collars.length === 0) {
  console.error('❌ Config incompleta: "collars" tiene que ser una lista con al menos un { collarId, identifier }.');
  process.exit(1);
}

// Misma implementación que backend/src/iot/utils/geofencing.utils.ts — usada acá SOLO para
// que el simulador sepa localmente si un punto quedó adentro/afuera (loguear, decidir rumbos).
// La decisión real de disparar la alerta ESCAPE la toma el backend con su propia copia.
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function centroidOf(polygon) {
  const [latSum, lngSum] = polygon.reduce(([la, ln], [lat, lng]) => [la + lat, ln + lng], [0, 0]);
  return [latSum / polygon.length, lngSum / polygon.length];
}

function boundingRadius(polygon, center) {
  return Math.max(...polygon.map(([lat, lng]) => Math.hypot(lat - center[0], lng - center[1])));
}

const center = centroidOf(geofencePolygon);
const radius = boundingRadius(geofencePolygon, center);
// Punto bien afuera del polígono, en diagonal opuesta al centro — usado como destino de "fuga".
const escapeTarget = [center[0] + radius * 3, center[1] + radius * 3];

function log(tag, msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${tag} ${msg}`);
}

// --- Asignación de roles ---
const shuffled = [...collars].sort(() => Math.random() - 0.5);
const wanderers = new Set(shuffled.slice(0, escapeCount).map((c) => c.collarId));
const feverish = new Set(shuffled.slice(escapeCount, escapeCount + feverCount).map((c) => c.collarId));

const states = collars.map((c) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius * 0.5;
  return {
    ...c,
    lat: center[0] + Math.cos(angle) * dist,
    lng: center[1] + Math.sin(angle) * dist,
    role: wanderers.has(c.collarId) ? 'wanderer' : feverish.has(c.collarId) ? 'feverish' : 'grazer',
    phase: 'INSIDE', // solo aplica a wanderers: INSIDE -> CROSSING -> OUTSIDE -> RETURNING
    tick: 0,
  };
});

log('🐄', `Simulando ${states.length} collares — ${wanderers.size} van a "escaparse", ${feverish.size} van a simular fiebre.`);
states.forEach((s) => log('  ↳', `${s.identifier} (collar_id=${s.collarId}) → rol: ${s.role}`));

function stepGrazer(s) {
  const nextLat = s.lat + (Math.random() - 0.5) * (radius * 0.08);
  const nextLng = s.lng + (Math.random() - 0.5) * (radius * 0.08);
  // Si el paso lo saca del polígono, lo descartamos y probamos moverlo hacia el centro en su lugar
  // (simula un animal que "rebota" del cerco eléctrico en vez de cruzarlo).
  if (isPointInPolygon([nextLat, nextLng], geofencePolygon)) {
    s.lat = nextLat;
    s.lng = nextLng;
  } else {
    s.lat += (center[0] - s.lat) * 0.15;
    s.lng += (center[1] - s.lng) * 0.15;
  }
  return 37.5 + Math.random() * 1.2; // temperatura normal con ruido
}

function stepWanderer(s) {
  s.tick += 1;
  // ~8 ticks adentro, ~8 ticks cruzando, después queda afuera alejándose un poco más cada vez.
  if (s.tick <= 8) {
    s.phase = 'INSIDE';
    s.lat += (Math.random() - 0.5) * (radius * 0.05);
    s.lng += (Math.random() - 0.5) * (radius * 0.05);
  } else if (s.tick <= 16) {
    s.phase = 'CROSSING';
    const progress = (s.tick - 8) / 8;
    s.lat = center[0] + (escapeTarget[0] - center[0]) * progress;
    s.lng = center[1] + (escapeTarget[1] - center[1]) * progress;
  } else {
    s.phase = 'OUTSIDE';
    s.lat += (Math.random() - 0.3) * (radius * 0.03);
    s.lng += (Math.random() - 0.3) * (radius * 0.03);
  }
  return 37.5 + Math.random() * 1.2;
}

function stepFeverish(s) {
  stepGrazer(s); // se mueve como un animal normal, solo cambia la temperatura
  s.tick += 1;
  // Fiebre en oleadas: ~6 ticks con temperatura elevada, ~10 ticks normal, se repite.
  const inFeverWindow = s.tick % 16 < 6;
  return inFeverWindow ? 39.8 + Math.random() * 0.8 : 37.5 + Math.random() * 1.0;
}

async function sendReading(s) {
  const temp =
    s.role === 'wanderer' ? stepWanderer(s) : s.role === 'feverish' ? stepFeverish(s) : stepGrazer(s);

  const inside = isPointInPolygon([s.lat, s.lng], geofencePolygon);
  const body = {
    collar_id: s.collarId,
    lat: parseFloat(s.lat.toFixed(6)),
    lng: parseFloat(s.lng.toFixed(6)),
    temp: parseFloat(temp.toFixed(1)),
    gateway_id: gatewayId,
    rssi: Math.round(-60 - Math.random() * 40),
    snr: parseFloat((Math.random() * 10 - 5).toFixed(1)),
  };

  const phaseTag = s.role === 'wanderer' ? `[${s.phase}]` : '';
  const zoneTag = inside ? '🟢 IN' : '🔴 OUT';

  try {
    const res = await fetch(`${baseUrl}/api/iot/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    log(zoneTag, `${s.identifier} ${phaseTag} temp=${body.temp}°C lat=${body.lat} lng=${body.lng} → HTTP ${res.status} ${res.ok ? '' : text}`);
  } catch (err) {
    log('❌', `${s.identifier} error de red: ${err.message}`);
  }
}

log('▶️', `Arrancando — un tick cada ${tickIntervalMs}ms por collar. Ctrl+C para detener.`);
const interval = setInterval(() => {
  states.forEach((s) => sendReading(s));
}, tickIntervalMs);

process.on('SIGINT', () => {
  clearInterval(interval);
  log('⏹️', 'Simulación detenida.');
  process.exit(0);
});
