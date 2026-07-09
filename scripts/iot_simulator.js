const http = require('http');

// Parse CLI arguments
let startLat = null;
let startLng = null;
const macArgs = [];

process.argv.slice(2).forEach((arg) => {
  const num = parseFloat(arg);
  // If it's a number and has a decimal point (coordinates), treat as lat/lng
  if (!isNaN(num) && arg.includes('.')) {
    if (startLat === null) {
      startLat = num;
    } else if (startLng === null) {
      startLng = num;
    }
  } else {
    macArgs.push(arg);
  }
});

const MAC_IDS = macArgs.length > 0 ? macArgs : ['00:1B:44:11:3A:B7'];

console.log(`Starting IoT LoRa Gateway Simulator...`);
console.log(`Simulating collars:`, MAC_IDS);
if (startLat !== null && startLng !== null) {
  console.log(`Explicit start coordinates: ${startLat}, ${startLng}`);
} else {
  console.log(`No starting coordinates specified. Will auto-snap to the farm's zone coordinates returned by the server.`);
}
console.log('Press Ctrl+C to stop simulation.');

// Keep track of device states in memory to do random walks
const states = MAC_IDS.map((mac) => ({
  mac_id: mac,
  lat: startLat !== null ? startLat : -34.6037 + (Math.random() - 0.5) * 0.01,
  lng: startLng !== null ? startLng : -58.3816 + (Math.random() - 0.5) * 0.01,
  battery: 100.0,
  hasSnapped: startLat !== null, // Do not snap if coordinates were explicitly specified
}));

// Buffer in memory
let telemetryBuffer = [];

// Generate telemetry reading for a device
function generateReading(state) {
  // Move slightly (random walk)
  state.lat += (Math.random() - 0.5) * 0.0005;
  state.lng += (Math.random() - 0.5) * 0.0005;

  // Temperature between 37.5 and 39.5
  const temp = 37.5 + Math.random() * 2.0;

  // Decrease battery slightly
  state.battery -= 0.05;
  if (state.battery <= 5.0) state.battery = 100.0;

  return {
    mac_id: state.mac_id,
    lat: parseFloat(state.lat.toFixed(6)),
    lng: parseFloat(state.lng.toFixed(6)),
    temp: parseFloat(temp.toFixed(1)),
    battery: parseFloat(state.battery.toFixed(1)),
  };
}

// Generate readings for all devices every 5 seconds and add to buffer
setInterval(() => {
  states.forEach((state) => {
    const reading = generateReading(state);
    telemetryBuffer.push(reading);
  });
  console.log(`[${new Date().toLocaleTimeString()}] Collected LoRa packets from nodes. Buffer size: ${telemetryBuffer.length}`);
}, 5000);

// Upload batch payload every 30 seconds
function uploadBatch() {
  if (telemetryBuffer.length === 0) {
    console.log(`[${new Date().toLocaleTimeString()}] Telemetry buffer is empty. Skipping upload.`);
    return;
  }

  const payload = JSON.stringify(telemetryBuffer);
  // Clear the buffer immediately to prevent duplicates if requests take long
  const currentBatch = [...telemetryBuffer];
  telemetryBuffer = [];

  console.log(`[${new Date().toLocaleTimeString()}] Gateway uploading batch of ${currentBatch.length} readings...`);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/iot/telemetry',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`[${new Date().toLocaleTimeString()}] Upload response: ${res.statusCode} - ${data}`);
      try {
        const responseObj = JSON.parse(data);
        if (responseObj.suggestedLocations) {
          Object.keys(responseObj.suggestedLocations).forEach((mac) => {
            const state = states.find((s) => s.mac_id === mac);
            if (state && !state.hasSnapped) {
              const suggestion = responseObj.suggestedLocations[mac];
              console.log(`[${new Date().toLocaleTimeString()}] Auto-snapping collar ${mac} to user's farm lot coordinates: ${suggestion.lat}, ${suggestion.lng}`);
              state.lat = suggestion.lat;
              state.lng = suggestion.lng;
              state.hasSnapped = true;
            }
          });
        }
      } catch (e) {
        // Silently ignore if not JSON
      }
    });
  });

  req.on('error', (e) => {
    console.error(`[${new Date().toLocaleTimeString()}] Gateway upload error: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// Start batch uploading every 30 seconds
setInterval(uploadBatch, 30000);

// Generate initial batch readings immediately so first tick isn't empty
states.forEach((state) => {
  telemetryBuffer.push(generateReading(state));
});
