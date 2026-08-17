# Epic: Gestión y Monitoreo de Gateways (CU013)

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 17/08/2026
* **Estado**: Parcialmente completado — CRUD y cálculo de estado listos; el estado "en línea" real depende de un cambio en el firmware que todavía no se hizo

## 1. Resumen de la Solución Técnica

`Gateway` no existía en el schema — confirmado como hueco real tanto en el diagnóstico inicial como en el doc de Casos de Uso. Se modeló y se construyó el CRUD, pero hay una limitación de fondo que hay que entender antes de dar esto por "terminado" en el sentido pleno del CU:

**El gateway físico (firmware v3, `agroguard-firmware/src/v3/receptor.cpp`) hoy le pega a `/api/iot/telemetry` sin mandar ningún identificador propio** — solo `{collar_id, lat, lng, temp}`. No hay forma de saber, a partir de una lectura real, cuál gateway la retransmitió. Por lo tanto "verificar que esté funcionando correctamente" (requerimiento del CU) no se puede completar solo con software del lado del backend/frontend.

Lo que se hizo: se agregaron `gateway_id`, `rssi` y `snr` como campos **opcionales** al DTO de telemetría (`backend/src/iot/dto/telemetry-payload.dto.ts`) — el firmware actual, que no los manda, sigue funcionando exactamente igual, no se rompió nada. Cuando estén presentes, `iot.service.ts` actualiza el heartbeat del gateway (`lastSeenAt`, `lastRssi`, `lastSnr`). Se verificó con datos de prueba que el heartbeat se actualiza correctamente cuando esos campos llegan.

**Para que el estado "en línea" sea real en producción**, alguien tiene que tocar `agroguard-firmware/src/v3/receptor.cpp` para que el gateway mande su propio ID (y el RSSI/SNR que ya lee del radio LoRa pero hoy solo loguea por Serial, nunca lo envía) en el JSON — eso requiere el hardware físico para probarlo, no se hizo en esta sesión por no tener acceso a un dispositivo real.

* **Prisma Schema**: modelo `Gateway` (`name`, `farmId`, `zoneId`, `lastSeenAt`, `lastRssi`, `lastSnr`), asociado a una granja y una zona (dentro de esa granja) como pide el CU.
* **Estado calculado, no guardado**: `NO_DATA` (nunca reportó — nunca confundir con "fuera de línea", como pide explícitamente el alt path del CU) / `ONLINE` (última señal hace ≤15 minutos) / `OFFLINE` (más vieja). 15 minutos porque el firmware v3 manda telemetría cada 5 minutos (`SEND_INTERVAL`), da margen a 2-3 ciclos perdidos antes de considerarlo caído.

## 2. Contrato de Integración y Consumo

* **`POST /gateways`** — registra un gateway. Valida que la zona pertenezca a la granja indicada.
  ```json
  { "name": "Gateway Potrero Norte", "farmId": "uuid", "zoneId": "uuid" }
  ```

* **`GET /gateways?farmId=xxx`** — lista los gateways de una granja con estado calculado.
  ```json
  [
    {
      "id": "uuid",
      "name": "Gateway Potrero Norte",
      "zone": { "id": "uuid", "name": "Potrero Norte" },
      "status": "NO_DATA",
      "lastSeenAt": null,
      "lastRssi": null,
      "lastSnr": null
    }
  ]
  ```

* **`PATCH /gateways/:id`** — corrige `name`/`zoneId`.
* **`DELETE /gateways/:id`** — elimina (hard delete; el CU no pide baja lógica para gateways).

* **Extensión del contrato de telemetría** (ver también `epic-13-4-recepcion-telemetria-iot.md`): si el payload de `POST /api/iot/telemetry` incluye `gateway_id`/`rssi`/`snr`, se actualiza el heartbeat de ese gateway automáticamente. No hace falta ningún otro endpoint para esto — reutiliza la ruta que el gateway ya llama.

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Schema | `backend/prisma/schema.prisma` | Modelo `Gateway`, relaciones en `Farm`/`Zone` |
| Backend | `backend/src/gateways/gateways.service.ts` | CRUD + `withStatus()` (cálculo de estado) + `recordHeartbeat()` |
| Backend | `backend/src/iot/dto/telemetry-payload.dto.ts` | Campos opcionales `gateway_id`/`rssi`/`snr` |
| Backend | `backend/src/iot/iot.service.ts` | Llama a `GatewaysService.recordHeartbeat()` si vino `gateway_id` |
| Frontend | `frontend/src/app/(dashboard)/gateways/page.tsx` | Registro + listado con badge de estado por granja |
| Frontend | `frontend/src/lib/api/gateways.ts` | Cliente |
| Firmware (pendiente) | `agroguard-firmware/src/v3/receptor.cpp` | **No modificado** — acá es donde habría que agregar el envío de `gateway_id`/`rssi`/`snr` cuando se tenga el hardware para probarlo |

## 4. Instrucciones de Prueba Rápida

```bash
# Sin gateway_id: la telemetría sigue funcionando igual que siempre, no rompe nada
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.42,"lng":-64.18,"temp":38.2}'

# Con gateway_id/rssi/snr: actualiza el heartbeat del gateway indicado
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.42,"lng":-64.18,"temp":38.2,"gateway_id":"<uuid-de-un-gateway-existente>","rssi":-72,"snr":9.5}'

# Verificar en la DB
# SELECT last_seen_at, last_rssi, last_snr FROM gateways WHERE id = '<uuid>';
```

## 5. Próximo paso real (fuera de alcance de esta sesión)

Modificar `agroguard-firmware/src/v3/receptor.cpp` para que incluya `gateway_id` (un identificador fijo por dispositivo, análogo a `#define COLLAR_ID` del collar) y los valores de `radio.getRSSI()`/`radio.getSNR()` (ya se leen, ver comentarios en el propio archivo) en el JSON que ya arma `sendTelemetryToApi()`. Requiere probarlo contra un gateway físico.
