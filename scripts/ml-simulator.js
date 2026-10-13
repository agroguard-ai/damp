/**
 * ============================================================
 *  DAMP — Simulador de escenarios de salud para la IA
 *  ------------------------------------------------------------
 *  Manda telemetría a POST /api/iot/telemetry como un gateway real (X-API-Key), con
 *  patrones de temperatura y movimiento que imitan los del dataset con el que se entrenó
 *  el modelo (damp-ml-api/machine-learning/data-generator/generador.py), para poder probar
 *  de punta a punta: lecturas → ventana de 24 h → predicción → alertas → front.
 *
 *  Escenarios (por collar):
 *    sano         temperatura ~38,5 °C con ciclo diario, ~25 m recorridos cada 30 min
 *    fiebre       la temperatura sube ~1,8 °C en 4 h y se mueve ~2,2 veces más
 *    inactividad  la distancia por bloque queda casi constante (así la ve el modelo
 *                 entrenado: sin acelerómetro, la "inactividad" es falta de variación) y la
 *                 temperatura baja ~0,2 °C
 *    celo         +0,3 °C y menos distancia recorrida (solo tiene efecto en hembras)
 *    anomalia     se mueve ~4,5 veces más de lo normal
 *  Los eventos arrancan `eventStartHoursAgo` horas antes del final del historial.
 *
 *  Modos:
 *    1. Historial (por defecto): carga las últimas `historyHours` horas en segundos, con
 *       timestamps del pasado. Requiere que el backend tenga ALLOW_SIMULATED_TIMESTAMPS=true
 *       (en backend/.env) — sin eso rechaza el campo timestamp con 400.
 *    2. En vivo (--live): después del historial sigue mandando lecturas reales cada
 *       `--tick` segundos (sin timestamp), con el mismo escenario.
 *
 *  Configuración: usa scripts/ml-simulator.config.json si existe; si no, reutiliza
 *  scripts/fleet-simulator.config.json (mismos campos: baseUrl, gatewayId, apiKey,
 *  geofencePolygon, collars). Cada collar puede traer su "scenario"; si no, se reparten
 *  en orden: fiebre, inactividad, anomalia, celo, sano, ...
 *  Los collares tienen que estar asignados a animales en la app.
 *
 *  Uso:
 *    node scripts/ml-simulator.js                       # 26 h de historial
 *    node scripts/ml-simulator.js --live                # historial + en vivo
 *    node scripts/ml-simulator.js --scenario=fiebre     # todos los collares con fiebre
 *    node scripts/ml-simulator.js --history-hours=30 --interval-min=5 --event-start-hours=8
 *    node scripts/ml-simulator.js --config=otra-config.json
 * ============================================================
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- config
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const configPath = args.config
  ? path.resolve(args.config)
  : ['ml-simulator.config.json', 'fleet-simulator.config.json']
      .map((f) => path.join(__dirname, f))
      .find((f) => fs.existsSync(f));
if (!configPath) {
  console.error('❌ No hay config: copiá fleet-simulator.config.example.json a ml-simulator.config.json y completala.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const { baseUrl, gatewayId, apiKey, geofencePolygon = [], collars = [] } = config;
if (!baseUrl || !apiKey || collars.length === 0) {
  console.error(`❌ Config incompleta en ${path.basename(configPath)}: hacen falta baseUrl, apiKey y collars.`);
  process.exit(1);
}

const HISTORY_HOURS = Number(args['history-hours'] ?? config.historyHours ?? 26);
const INTERVAL_MIN = Number(args['interval-min'] ?? config.readingIntervalMinutes ?? 5);
const EVENT_START_HOURS = Number(args['event-start-hours'] ?? config.eventStartHoursAgo ?? 8);
const LIVE = Boolean(args.live);
const TICK_SECONDS = Number(args.tick ?? 5);
const SCENARIOS = ['sano', 'fiebre', 'inactividad', 'celo', 'anomalia'];
const DEFAULT_ORDER = ['fiebre', 'inactividad', 'anomalia', 'celo', 'sano'];

if (args.scenario && !SCENARIOS.includes(args.scenario)) {
  console.error(`❌ Escenario "${args.scenario}" desconocido. Opciones: ${SCENARIOS.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------- utilidades
const BLOCK_SECONDS = 30 * 60;
const FARM_UTC_OFFSET_HOURS = -3; // el modelo se entrenó en hora local argentina

function gauss(mean = 0, std = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function localHour(date) {
  const h = date.getUTCHours() + FARM_UTC_OFFSET_HOURS + date.getUTCMinutes() / 60;
  return (h + 24) % 24;
}

/** Ciclo diario de temperatura del generador: pico a las 15 h, amplitud 0,4 °C. */
function circadian(hour) {
  return 0.4 * Math.sin((2 * Math.PI * (hour - 15 + 6)) / 24);
}

/** Intensidad del evento (0 → 1) con una rampa de `rampHours` desde que arranca. */
function intensity(t, eventStart, rampHours) {
  const hours = (t - eventStart) / 3_600_000;
  if (hours <= 0) return 0;
  return Math.min(1, hours / rampHours);
}

const METERS_PER_DEG_LAT = 111_320;
function moveMeters([lat, lng], meters, bearing) {
  const dLat = (meters * Math.cos(bearing)) / METERS_PER_DEG_LAT;
  const dLng = (meters * Math.sin(bearing)) / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}
function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = (lat2 - lat1) * METERS_PER_DEG_LAT;
  const dLng = (lng2 - lng1) * METERS_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const center =
  config.center ??
  (geofencePolygon.length > 0
    ? geofencePolygon.reduce(([a, b], [lat, lng]) => [a + lat / geofencePolygon.length, b + lng / geofencePolygon.length], [0, 0])
    : null);
if (!center) {
  console.error('❌ Falta "center": [lat, lng] o "geofencePolygon" en la config para saber dónde ubicar a los animales.');
  process.exit(1);
}
// Radio de pastoreo: dentro del cerco (para no disparar alertas de escape mientras se prueba la IA)
const roamRadius = geofencePolygon.length
  ? Math.max(20, Math.min(...geofencePolygon.map((p) => distanceMeters(center, p))) * 0.6)
  : 150;

// ---------------------------------------------------------------- estado por collar
const now = Date.now();
const historyStart = now - HISTORY_HOURS * 3_600_000;
const eventStart = now - EVENT_START_HOURS * 3_600_000;

const animals = collars.map((c, i) => ({
  collarId: c.collarId,
  identifier: c.identifier ?? `collar ${c.collarId}`,
  scenario: args.scenario ?? c.scenario ?? DEFAULT_ORDER[i % DEFAULT_ORDER.length],
  tempBase: gauss(38.45, 0.15),
  distBase: Math.max(8, gauss(25, 5)),
  pos: moveMeters(center, Math.random() * roamRadius * 0.5, Math.random() * 2 * Math.PI),
  bearing: Math.random() * 2 * Math.PI,
  lastBlockDistance: null,
  currentBlock: null,
}));

/** Valores objetivo del bloque de 30 min en curso (temperatura y metros a recorrer en el bloque). */
function blockTargets(a, t) {
  const hour = localHour(new Date(t));
  let temp = a.tempBase + circadian(hour) + gauss(0, 0.15);
  let dist = Math.max(0, gauss(a.distBase, 5));

  switch (a.scenario) {
    case 'fiebre': {
      const k = intensity(t, eventStart, 4);
      temp += gauss(1.8, 0.2) * k;
      dist = dist * (1 - k) + a.distBase * 2.2 * k;
      break;
    }
    case 'inactividad': {
      const k = intensity(t, eventStart, 1);
      temp += -0.2 * k;
      if (k > 0 && a.lastBlockDistance !== null) {
        // distancia casi constante entre bloques, como en el dataset de entrenamiento
        dist = gauss(a.lastBlockDistance, 5 * (1 - k) + 0.25 * k);
      }
      break;
    }
    case 'celo': {
      const k = intensity(t, eventStart, 3);
      temp += 0.3 * k;
      dist = dist * (1 - k) + a.distBase * 0.4 * k;
      break;
    }
    case 'anomalia': {
      const k = intensity(t, eventStart, 1);
      dist = dist * (1 - k) + a.distBase * Math.max(1.5, gauss(4.5, 1.2)) * k;
      break;
    }
  }
  return { temp, dist: Math.max(0, dist) };
}

/** Avanza al animal `seconds` segundos y devuelve la lectura a mandar. */
function nextReading(a, t, seconds) {
  const blockId = Math.floor(t / (BLOCK_SECONDS * 1000));
  if (!a.currentBlock || a.currentBlock.id !== blockId) {
    if (a.currentBlock) a.lastBlockDistance = a.currentBlock.dist;
    a.currentBlock = { id: blockId, ...blockTargets(a, t) };
  }
  const step = a.currentBlock.dist * (seconds / BLOCK_SECONDS);
  a.bearing += gauss(0, 0.8);
  let next = moveMeters(a.pos, step, a.bearing);
  if (distanceMeters(center, next) > roamRadius) {
    // rebota hacia el centro para quedarse dentro del cerco
    a.bearing = Math.atan2(center[1] - a.pos[1], center[0] - a.pos[0]) + gauss(0, 0.5);
    next = moveMeters(a.pos, step, a.bearing);
  }
  a.pos = next;
  return {
    collar_id: a.collarId,
    lat: Number(next[0].toFixed(6)),
    lng: Number(next[1].toFixed(6)),
    temp: Number((a.currentBlock.temp + gauss(0, 0.08)).toFixed(2)),
    ...(gatewayId ? { gateway_id: gatewayId } : {}),
  };
}

async function send(body) {
  const res = await fetch(`${baseUrl}/api/iot/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && text.includes('ALLOW_SIMULATED_TIMESTAMPS')) {
      console.error('\n❌ El backend no acepta timestamps simulados.');
      console.error('   Agregá ALLOW_SIMULATED_TIMESTAMPS=true en backend/.env y reiniciá el backend.\n');
      process.exit(1);
    }
    throw new Error(`HTTP ${res.status} (collar ${body.collar_id}): ${text}`);
  }
}

// ---------------------------------------------------------------- ejecución
async function loadHistory() {
  const stepMs = INTERVAL_MIN * 60 * 1000;
  const total = Math.floor((now - historyStart) / stepMs);
  console.log(`\n⏪ Cargando ${HISTORY_HOURS} h de historial (${total} lecturas por collar, una cada ${INTERVAL_MIN} min)...`);

  let sent = 0;
  let errors = 0;
  for (let i = 1; i <= total; i++) {
    const t = historyStart + i * stepMs;
    for (const a of animals) {
      try {
        await send({ ...nextReading(a, t, INTERVAL_MIN * 60), timestamp: new Date(t).toISOString() });
        sent++;
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`   ⚠️  ${err.message}`);
      }
    }
    if (i % 24 === 0 || i === total) {
      process.stdout.write(`\r   ${Math.round((i / total) * 100)}% — ${sent} lecturas enviadas${errors ? `, ${errors} con error` : ''}   `);
    }
  }
  console.log('\n✅ Historial cargado.');
}

async function live() {
  console.log(`\n▶️  Modo en vivo: una lectura por collar cada ${TICK_SECONDS} s (Ctrl+C para cortar).`);
  setInterval(async () => {
    for (const a of animals) {
      const reading = nextReading(a, Date.now(), TICK_SECONDS);
      try {
        await send(reading);
        console.log(`[${new Date().toLocaleTimeString()}] ${a.identifier.padEnd(16)} ${a.scenario.padEnd(11)} ${reading.temp} °C`);
      } catch (err) {
        console.error(`   ⚠️  ${err.message}`);
      }
    }
  }, TICK_SECONDS * 1000);
}

(async () => {
  console.log('🧠 DAMP — simulador de escenarios de salud para la IA');
  console.log(`   Backend: ${baseUrl}   Config: ${path.basename(configPath)}`);
  console.log(`   Eventos desde hace ${EVENT_START_HOURS} h. Collares:`);
  animals.forEach((a) => console.log(`   ↳ ${a.identifier} (collar_id=${a.collarId}) → ${a.scenario}`));

  await loadHistory();
  console.log('\n👉 Las predicciones se calculan en segundo plano: en unos segundos aparecen en');
  console.log('   Alertas → "Salud Predictiva". Recordá que el collar tiene que estar asignado a un animal');
  console.log('   (y que "celo" solo tiene efecto en hembras).');

  if (LIVE) await live();
})();
