# Epic 13 & 4: Ingesta de Telemetría IoT

* **Autor**: Antigravity (versión original) — actualizado por Claude (sesión con Santino)
* **Fecha de Creación**: 09/07/2026
* **Última actualización**: 17/08/2026
* **Estado**: Completado — pipeline verificado de punta a punta contra el firmware real

> **Aviso**: la versión anterior de este documento describía un contrato (`mac_id`, arrays batch, `battery`, tabla `BoundaryUpdate`) que **nunca coincidió con el código real** del backend ni con lo que el firmware `agroguard-firmware` efectivamente envía. Esta versión documenta el contrato tal como está implementado y verificado hoy.

## 1. Resumen de la Solución Técnica

El endpoint `POST /api/iot/telemetry` recibe **una lectura individual** (no batch) enviada por el gateway LoRa (`agroguard-firmware/src/v3/receptor.cpp`), la persiste, y devuelve el cerco virtual activo del animal como downlink para que el collar lo evalúe localmente.

Durante esta sesión se encontraron y corrigieron varios problemas que impedían que el pipeline funcionara de punta a punta:

* **Puerto incorrecto en el firmware**: `agroguard-firmware/src/v3/receptor.cpp` apuntaba a `http://<ip>:3000/...` (puerto del frontend) en vez de `:3001` (puerto real del backend, confirmado en `backend/.env`). Corregido.
* **Cliente Prisma desincronizado**: `backend/generated/prisma` tenía un schema viejo (`Collar.id: String`, modelo `TelemetryRecord` fantasma) que no coincidía con `prisma/schema.prisma`. Se regeneró con `prisma generate`.
* **Historial de migraciones roto**: las 8 migraciones de Prisma crean todas las tablas en singular (`farm_user`, `role`, etc.) pero `schema.prisma` las mapea en plural (`@@map("farm_users")`, etc.). `prisma migrate deploy/reset` falla siempre desde cero — nadie lo nota porque todo el equipo sincroniza con `prisma db push` (que sí funciona, difiere pero no versiona el DDL). **No se corrigió** el historial de migraciones en sí (reescribir 8 archivos es trabajo aparte); se documenta como deuda conocida.
* **DB local completamente desactualizada**: solo tenía 2 tablas viejas. Se resincronizó con `prisma db push` y se sembró el collar `id=1` que el gateway trae hardcodeado (`#define COLLAR_ID 1` en `receptor.cpp`).

## 2. Contrato de Ingesta (verificado contra el firmware real)

* **Endpoint**: `POST http://localhost:3001/api/iot/telemetry`
* **Sin autenticación** (endpoint de dispositivo, no de usuario — sigue siendo un punto abierto, ver Notas de Seguridad más abajo).
* **Request Body (JSON — objeto único, no array)**:
  ```json
  {
    "collar_id": 1,
    "lat": -31.42,
    "lng": -64.18,
    "temp": 38.5,
    "gateway_id": "uuid-del-gateway (opcional)",
    "rssi": -72,
    "snr": 9.5
  }
  ```
  * `collar_id`, `lat`, `lng`, `temp`: **requeridos**, es exactamente lo que manda `agroguard-firmware/src/v3/receptor.cpp` hoy.
  * `gateway_id`, `rssi`, `snr`: **opcionales**, agregados en esta sesión como punto de extensión — el firmware v3 actual **no los envía todavía** (ver `epic-gateways-claude.md`). El `ValidationPipe` global usa `forbidNonWhitelisted: true`, así que cualquier campo que mande el firmware que no esté en el DTO hace fallar el request completo con 400 — importante tenerlo presente si se agregan campos nuevos al firmware sin actualizar `TelemetryPayloadDto`.
* **Respuesta (200/201)**:
  ```json
  { "downlink": "-31.4,-64.2;-31.4,-64.15;-31.45,-64.15;-31.45,-64.2" }
  ```
  o `{ "downlink": "NONE" }` si el animal no tiene cerco virtual activo. El downlink se calcula ahora a partir del `Geofence` real asignado al animal (ver `epic-4-cerco-electrico-virtual-alertas.md`) — ya **no** es un rectángulo hardcodeado.
* **No hay concepto de `BoundaryUpdate`** en el código actual — ese flujo descripto en la versión anterior de este doc nunca se implementó; el downlink de cerco resuelve el mismo problema de forma más simple (se recalcula en cada lectura, no hay estado PENDING/INFORMED que sincronizar).

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| DTO | `backend/src/iot/dto/telemetry-payload.dto.ts` | Contrato de entrada real (`collar_id`, `lat`, `lng`, `temp` + `gateway_id`/`rssi`/`snr` opcionales) |
| Backend | `backend/src/iot/iot.service.ts` | `handleTelemetry()`: persiste la lectura, actualiza heartbeat del gateway si vino `gateway_id`, resuelve el cerco activo del animal, evalúa fiebre/hipotermia/inactividad (ver `epic-4`), calcula el downlink real |
| Firmware (gateway) | `agroguard-firmware/src/v3/receptor.cpp` | Arma el JSON y hace el `POST`. **Es la versión vigente** — `src/emisor`/`src/receptor` (v1) y `src/v2` son versiones anteriores, no se usan |
| Firmware (collar) | `agroguard-firmware/src/v3/emisor.cpp` | Envía por LoRa `ID:<n>,T:<temp>,LAT:<lat>,LON:<lng>,SAT:<n>` al gateway; recibe el downlink y evalúa el cerco localmente (ray-casting) |
| Scripts de prueba | `damp/scripts/iot_simulator.js`, `damp/scripts/iot_escape_test.js` | **Desactualizados** — usan `mac_id`, batch arrays y `battery`, un contrato que no es el real. No confiar en ellos sin actualizarlos primero |

## 4. Instrucciones de Prueba Rápida

```bash
# 1. Levantar el backend (con la DB local sincronizada, ver estructura-damp.md sección 5)
cd damp/backend && pnpm run start:dev

# 2. Mandar una lectura con el shape real
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.42,"lng":-64.18,"temp":38.5}'

# Respuesta esperada: {"downlink":"NONE"} si el animal del collar 1 no tiene cerco activo,
# o las coordenadas del cerco si sí lo tiene.
```

Para probar con el firmware real: flashear `agroguard-firmware/src/v3` (collar + gateway), confirmar que `API_URL` en `receptor.cpp` apunta a la IP y puerto (`:3001`) reales del backend en la red local, y que existe un `Collar` en la DB con `id` igual al valor de `#define COLLAR_ID` del gateway.

## 5. Notas de Seguridad (deuda conocida, sin resolver)

El endpoint sigue sin ningún mecanismo de autenticación de dispositivo (API key, HMAC). Cualquiera que conozca un `collar_id` válido puede inyectar telemetría falsa. Sumado a que `agroguard-firmware` tiene las credenciales WiFi commiteadas en texto plano en el repo. Ninguno de los dos puntos se tocó en esta sesión — quedan para una tarea de seguridad aparte.
