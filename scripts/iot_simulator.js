const http = require('http');

// MAC Address to simulate
const MAC_ID = process.argv[2] || '00:1B:44:11:3A:B7';

// Initial coordinates (somewhere in Argentina's Pampas)
let lat = -34.6037;
let lng = -58.3816;
let battery = 100.0;

console.log(`Starting IoT Telemetry Simulator for MAC: ${MAC_ID}...`);
console.log('Press Ctrl+C to stop simulation.');

function sendTelemetry() {
  // Move slightly (random walk)
  lat += (Math.random() - 0.5) * 0.0005;
  lng += (Math.random() - 0.5) * 0.0005;

  // Temperature between 37.5 and 39.5
  const temp = 37.5 + Math.random() * 2.0;

  // Decrease battery slightly, reset if empty
  battery -= 0.1;
  if (battery <= 5.0) battery = 100.0;

  const payload = JSON.stringify({
    mac_id: MAC_ID,
    lat: parseFloat(lat.toFixed(6)),
    lng: parseFloat(lng.toFixed(6)),
    temp: parseFloat(temp.toFixed(1)),
    battery: parseFloat(battery.toFixed(1)),
  });

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
      console.log(`[${new Date().toLocaleTimeString()}] Sent: Temp=${temp.toFixed(1)}°C, Lat=${lat.toFixed(6)}, Lng=${lng.toFixed(6)}, Bat=${battery.toFixed(1)}% | Response: ${res.statusCode} - ${data}`);
    });
  });

  req.on('error', (e) => {
    console.error(`[${new Date().toLocaleTimeString()}] Error connecting to gateway API: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// Send every 8 seconds
setInterval(sendTelemetry, 8000);
sendTelemetry();
