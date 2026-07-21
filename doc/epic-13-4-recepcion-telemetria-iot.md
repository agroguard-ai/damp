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
  * **Nuevo**: Al recibir una lectura, busca el animal activo asociado al collar y devuelve coordenadas límite dummy (4 puntos cerca de Rosario) con estado `INFORMED`. A futuro se persistirá en una tabla `BoundaryUpdate` con estados PENDING/INFORMED.
* **Script Simulador (`scripts/iot_simulator.js`)**:
  * Simula el comportamiento de un Gateway físico transmitiendo datos cada 8 segundos mediante peticiones `POST` al endpoint del backend.
  * Genera una ruta aleatoria (drift/random walk) y simula el drenaje de la batería y fluctuaciones normales de temperatura en el animal.
* **Frontend (Visualización)**:
  * El listado de **Hacienda** (`/animals`) incluye ahora el estado del dispositivo actualizando un bloque con las últimas lecturas (`🌡️ Temperatura` y `🔋 Batería`) tomadas de la base de datos real.

---

## 2. Contrato de Ingesta (API del Gateway)
* **Endpoint**: `POST http://localhost:3001/api/iot/telemetry`
* **Request Body (JSON - Batch Array)**:
  ```json
  [
    {
      "mac_id": "00:1B:44:11:3A:B7",
      "lat": -34.6037,
      "lng": -58.3816,
      "temp": 38.6,
      "battery": 92.5
    },
    {
      "mac_id": "00:1B:44:11:3A:B8",
      "lat": -34.6045,
      "lng": -58.3820,
      "temp": 38.2,
      "battery": 91.0
    }
  ]
  ```
* **Respuesta Exitosa (201 Created)**:
  ```json
  [
    {
      "status": "success",
      "message": "Processed batch of 2 items. Inserted: 2 readings.",
      "inserted": 2,
      "ignored": 0
    }
  ]
  ```
  > **Nota:** El endpoint actual acepta un **array** de lecturas (batch) o un **objeto individual**. La respuesta varía según el input.

* **Respuesta Exitosa (individual - POST /api/iot/telemetry con objeto simple)**:
  ```json
  {
    "status": "success",
    "message": "Reading registered successfully",
    "animalId": "uuid-del-animal-asociado",
    "boundaryUpdates": [
      {
        "id": "uuid-del-boundary-update",
        "coordinates": [
          { "lat": -32.94, "lng": -60.67 },
          { "lat": -32.94, "lng": -60.65 },
          { "lat": -32.96, "lng": -60.65 },
          { "lat": -32.96, "lng": -60.67 }
        ],
        "status": "INFORMED",
        "informedAt": "2026-07-21T12:00:00.000Z"
      }
    ]
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

---

## 5. Flujo de Actualización de Límites (BoundaryUpdate)

### Concepto

Cuando los límites de una zona/geocerca son modificados en el sistema (ej: se agranda un potrero), el collar IoT debe ser **informado** de los nuevos límites para que pueda detectar fugas localmente. El concepto `BoundaryUpdate` gestiona este proceso mediante un estado `PENDING` → `INFORMED`.

### Flujo (a futuro, con persistencia)

1. **Administrador actualiza los límites** de una zona/potrero en el frontend.
2. El sistema crea un `BoundaryUpdate` con `status: PENDING` y las nuevas coordenadas, asociado al `collarId` y `animalId`.
3. El collar envía su próxima lectura de telemetría a `POST /api/iot/telemetry`.
4. El backend:
   - Persiste la telemetría normalmente.
   - Busca el animal activo para ese collar (`AnimalCollar` con `endAt IS NULL`).
   - Busca `BoundaryUpdate` con `status: PENDING` para ese collar.
   - Si encuentra uno, lo marca como `status: INFORMED` y setea `informedAt`.
   - Devuelve las coordenadas en la respuesta.
5. El collar recibe las coordenadas y actualiza sus límites locales.
6. En próximas lecturas, el `BoundaryUpdate` ya está `INFORMED` y no se devuelve.

### Estado actual (fase dummy — sin cambios en schema)

Por ahora no se persiste `BoundaryUpdate` en la base de datos. El backend **siempre devuelve** 4 coordenadas fijas cercanas a Rosario con `status: INFORMED` en cada lectura de telemetría. Esto permite:
- Probar el formato de respuesta con el collar/simulador.
- Validar que el collar procesa correctamente los límites.
- Tener la estrutura lista para cuando se implemente la persistencia.

### Próximos pasos

Cuando se implemente la actualización de límites:
1. Agregar modelo `BoundaryUpdate` y enum `BoundaryUpdateStatus` en Prisma.
2. Ejecutar migración.
3. Reemplazar la lógica dummy por consultas reales a la base de datos.
4. Solo devolver `boundaryUpdates` cuando haya cambios reales (PENDING).

---

## 6. Notas de Implementación (Migración a Dispositivos Físicos)
Cuando se introduzcan los collares físicos en producción, se deben realizar los siguientes cambios sobre esta estructura simulada:
1. **Configuración de Red / IP del Servidor**: Los gateways o collares deben configurarse para apuntar al host de producción del backend en la ruta `/api/iot/telemetry`.
2. **Seguridad (Autenticación del Gateway)**: El endpoint actualmente es abierto para agilizar la integración de pruebas. En producción, se debe autenticar cada gateway con una **API key única**:
   - Cada gateway/dispositivo tendrá su propia API key almacenada en la tabla `Gateway` (a crear).
   - El gateway envía la API key en el header `X-API-Key`.
   - Se creará un `ApiKeyGuard` de NestJS que valide la key contra la base de datos y asocie la request al gateway correspondiente.
   - Esto permite revocar keys individualmente y auditar qué gateway envió cada lectura.
3. **Optimización de Base de Datos**: Debido a la alta frecuencia de envío (5-10 segundos por dispositivo), la tabla `telemetry_reading` crecerá sumamente rápido. Se aconseja programar un servicio de purga cron o mover las lecturas a un motor de base de datos de series temporales (como TimescaleDB o InfluxDB) para evitar degradar el rendimiento de PostgreSQL.
