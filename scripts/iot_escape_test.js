/**
 * ============================================================
 *  IoT Escape Test Simulator
 *  --------------------------
 *  Simulates a collar that starts INSIDE a paddock (zone) and
 *  then drifts OUTSIDE, triggering a geofencing ESCAPE alert.
 *
 *  Usage:
 *    node scripts/iot_escape_test.js <MAC_ID>
 *
 *  Example:
 *    node scripts/iot_escape_test.js sasas
 *
 *  The script auto-detects the paddock polygon from the server's
 *  response and plans a path from the center of the polygon
 *  to a point clearly outside it.
 * ============================================================
 */

const http = require('http');

const MAC_ID = process.argv[2] || 'sasas';
const API_HOST = 'localhost';
const API_PORT = 3001;
const LORA_INTERVAL_MS = 3000;    // Collect a reading every 3s
const GATEWAY_INTERVAL_MS = 10000; // Upload batch every 10s (faster for testing)

let telemetryBuffer = [];
let phase = 'INSIDE'; // Phases: INSIDE → CROSSING → OUTSIDE
let tickCount = 0;

// We'll compute these after first server response
let centerLat = null;
let centerLng = null;
let escapeLat = null;
let escapeLng = null;
let currentLat = null;
let currentLng = null;

// Calculate centroid of a polygon
function centroid(polygon) {
  let latSum = 0, lngSum = 0;
  for (const [lat, lng] of polygon) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / polygon.length, lngSum / polygon.length];
}

// Calculate a point clearly outside the polygon
function escapePoint(polygon) {
  let maxLat = -Infinity, maxLng = -Infinity;
  for (const [lat, lng] of polygon) {
    if (lat > maxLat) maxLat = lat;
    if (lng > maxLng) maxLng = lng;
  }
  // Go well beyond the NE corner of the polygon
  return [maxLat + 0.005, maxLng + 0.005];
}

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function generateReading() {
  tickCount++;

  // Phase transitions based on tick count
  // ~30s inside (10 ticks @ 3s), then ~30s crossing, then outside
  if (tickCount <= 10) {
    phase = 'INSIDE';
  } else if (tickCount <= 20) {
    phase = 'CROSSING';
  } else {
    phase = 'OUTSIDE';
  }

  if (currentLat !== null && currentLng !== null) {
    if (phase === 'INSIDE') {
      // Small random walk near center
      currentLat += (Math.random() - 0.5) * 0.0002;
      currentLng += (Math.random() - 0.5) * 0.0002;
    } else if (phase === 'CROSSING') {
      // Linear interpolation toward escape point
      const progress = (tickCount - 10) / 10;
      currentLat = centerLat + (escapeLat - centerLat) * progress;
      currentLng = centerLng + (escapeLng - centerLng) * progress;
      // Add small jitter
      currentLat += (Math.random() - 0.5) * 0.0001;
      currentLng += (Math.random() - 0.5) * 0.0001;
    } else {
      // OUTSIDE: drift further away
      currentLat += (Math.random() * 0.0003);
      currentLng += (Math.random() * 0.0003);
    }
  }

  const temp = 37.5 + (Math.random() * 2.5);
  const battery = Math.max(0, 95 - tickCount * 0.2);

  const reading = {
    mac_id: MAC_ID,
    lat: currentLat || -34.6037,
    lng: currentLng || -58.3816,
    temp: parseFloat(temp.toFixed(1)),
    battery: parseFloat(battery.toFixed(1)),
  };

  const phaseEmoji = phase === 'INSIDE' ? '🟢' : phase === 'CROSSING' ? '🟡' : '🔴';
  log(`${phaseEmoji} [${phase}] Tick #${tickCount} → lat: ${reading.lat.toFixed(6)}, lng: ${reading.lng.toFixed(6)}`);

  return reading;
}

function uploadBatch() {
  if (telemetryBuffer.length === 0) return;

  const payload = JSON.stringify(telemetryBuffer);
  const batch = [...telemetryBuffer];
  telemetryBuffer = [];

  log(`📡 Uploading batch of ${batch.length} readings...`);

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/iot/telemetry',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      log(`📬 Server response: ${res.statusCode} - ${data}`);

      try {
        const responseObj = JSON.parse(data);

        // Auto-detect polygon coordinates from suggestedLocations
        if (responseObj.suggestedLocations && responseObj.suggestedLocations[MAC_ID] && centerLat === null) {
          const suggestion = responseObj.suggestedLocations[MAC_ID];
          log(`🗺️  Got suggested location from server: ${suggestion.lat}, ${suggestion.lng}`);
          log(`🗺️  This is the first vertex of your paddock. Using it as approximate center.`);
          
          // Use the suggestion as starting point — the server returns the first
          // coordinate of the polygon, which is close enough to the centroid
          // for a small paddock.
          centerLat = suggestion.lat;
          centerLng = suggestion.lng;

          // Escape point: go ~500m north-east from the suggested location  
          escapeLat = centerLat + 0.005;
          escapeLng = centerLng + 0.005;

          currentLat = centerLat;
          currentLng = centerLng;

          log(`📌 Center set to: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`);
          log(`🏃 Escape target: ${escapeLat.toFixed(6)}, ${escapeLng.toFixed(6)}`);
          log(`\n⏱️  Timeline:`);
          log(`   0-30s   → 🟢 Animal inside paddock (small random walk)`);
          log(`   30-60s  → 🟡 Animal crossing boundary (linear drift out)`);
          log(`   60s+    → 🔴 Animal outside paddock (should trigger ESCAPE alert!)\n`);
        }
      } catch (e) {
        // ignore
      }
    });
  });

  req.on('error', (e) => {
    log(`❌ Upload error: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// --- Main ---

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         🐄 IoT ESCAPE TEST SIMULATOR                       ║');
console.log('║                                                              ║');
console.log(`║  Collar MAC: ${MAC_ID.padEnd(44)}║`);
console.log('║                                                              ║');
console.log('║  This script simulates an animal escaping its paddock.      ║');
console.log('║  Watch the console for phase changes:                       ║');
console.log('║    🟢 INSIDE  → Animal grazing normally inside zone         ║');
console.log('║    🟡 CROSSING → Animal drifting toward boundary            ║');
console.log('║    🔴 OUTSIDE → Animal escaped! Alert should fire!          ║');
console.log('║                                                              ║');
console.log('║  Refresh your browser map to see the marker turn red.       ║');
console.log('║  Check the Dashboard for the new ESCAPE alert.              ║');
console.log('║                                                              ║');
console.log('║  Press Ctrl+C to stop.                                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// Collect LoRa readings every 3s
setInterval(() => {
  const reading = generateReading();
  telemetryBuffer.push(reading);
  log(`📦 Buffer size: ${telemetryBuffer.length}`);
}, LORA_INTERVAL_MS);

// Upload batch every 10s
setInterval(() => {
  uploadBatch();
}, GATEWAY_INTERVAL_MS);

// Also upload immediately on first tick after 1s
setTimeout(() => {
  telemetryBuffer.push(generateReading());
  uploadBatch();
}, 1000);
