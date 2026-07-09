# Epic 13 & 4: Ingesta de Telemetría IoT y Simulación de Dispositivos

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic define la arquitectura para recibir lecturas de sensores GPS y de temperatura/batería de los dispositivos collares IoT. Dado que los dispositivos físicos aún no están terminados, se implementó un script simulador que actúa como Gateway y reporta datos simulados al backend.

* **Prisma Schema**:
  * Se creó la entidad `TelemetryReading` (id, collar_id, latitude, longitude, temperature, battery_level, timestamp).
  * Se agregó la columna `last_telemetry_date` al modelo `Collar` para guardar la marca temporal de su última transmisión.
* **Backend (NestJS + Prisma)**:
  * `IotModule`: Expone la ruta pública de ingesta `POST /api/iot/telemetry`.
  * Valida que el `mac_id` enviado pertenezca a un collar registrado.
  * Verifica si el collar tiene una vinculación activa con un animal (en `AnimalCollar` con `endAt: null`). Si no está asignado, descarta la telemetría para evitar almacenar datos sin sentido.
  * Registra la lectura en `TelemetryReading` y actualiza la fecha `lastTelemetryDate` en el collar.
* **Script Simulador (`scripts/iot_simulator.js`)**:
  * Simula el comportamiento de un Gateway físico transmitiendo datos cada 8 segundos mediante peticiones `POST` al endpoint del backend.
  * Genera una ruta aleatoria (drift/random walk) y simula el drenaje de la batería y fluctuaciones normales de temperatura en el animal.
* **Frontend (Visualización)**:
  * El listado de **Hacienda** (`/animals`) incluye ahora el estado del dispositivo actualizando un bloque con las últimas lecturas (`🌡️ Temperatura` y `🔋 Batería`) tomadas de la base de datos real.

---

## 2. Contrato de Ingesta (API del Gateway)
* **Endpoint**: `POST http://localhost:3001/api/iot/telemetry`
* **Request Body (JSON)**:
  ```json
  {
    "mac_id": "00:1B:44:11:3A:B7",
    "lat": -34.6037,
    "lng": -58.3816,
    "temp": 38.6,
    "battery": 92.5
  }
  ```
* **Respuesta Exitosa (201 Created)**:
  ```json
  {
    "status": "success",
    "message": "Telemetry registered successfully",
    "readingId": "UUID_DE_LECTURA",
    "animalId": "UUID_DEL_ANIMAL"
  }
  ```

---

## 3. Mapa del Código (Dónde buscar)

* **Ingestor de Telemetría (NestJS)**:
  * Servicio: [iot.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/iot/iot.service.ts)
  * Controlador: [iot.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/iot/iot.controller.ts)
  * DTO: [telemetry-payload.dto.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/iot/dto/telemetry-payload.dto.ts)
* **Script Simulador**: [iot_simulator.js](file:///c:/Users/catal/Desktop/Repos/damp/scripts/iot_simulator.js)
* **Visualización en Tarjeta de Animal**: [animals/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animals/page.tsx)

---

## 4. Instrucciones de Prueba Rápida y Simulación
1. Registra un animal en el panel de Hacienda y asígnale un collar con la dirección MAC: `00:1B:44:11:3A:B7`.
2. En la raíz del proyecto, corre el simulador indicando esa MAC:
   ```bash
   node scripts/iot_simulator.js 00:1B:44:11:3A:B7
   ```
3. El simulador mostrará logs en la consola enviando telemetría cada 8 segundos.
4. Refresca la vista de **Monitoreo de Hacienda** (`/animals`) y comprueba que la tarjeta de ese animal muestra ahora la temperatura real e indicador de batería actualizándose.

---

## 5. Notas de Implementación (Migración a Dispositivos Físicos)
Cuando se introduzcan los collares físicos en producción, se deben realizar los siguientes cambios sobre esta estructura simulada:
1. **Configuración de Red / IP del Servidor**: Los gateways o collares deben configurarse para apuntar al host de producción del backend en la ruta `/api/iot/telemetry`.
2. **Seguridad (Autenticación del Gateway)**: El endpoint actualmente es abierto para agilizar la integración de pruebas. En producción, se debe añadir un token de autorización en la cabecera (ej: `X-Gateway-Auth: [KEY]`) y verificarlo con un Guard de NestJS.
3. **Optimización de Base de Datos**: Debido a la alta frecuencia de envío (5-10 segundos por dispositivo), la tabla `telemetry_reading` crecerá sumamente rápido. Se aconseja programar un servicio de purga cron o mover las lecturas a un motor de base de datos de series temporales (como TimescaleDB o InfluxDB) para evitar degradar el rendimiento de PostgreSQL.
