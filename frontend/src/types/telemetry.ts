export interface TelemetryReading {
  id: string;
  collarId: string;
  latitude: number;
  longitude: number;
  temperature: number;
  batteryLevel: number;
  timestamp: string;
}
