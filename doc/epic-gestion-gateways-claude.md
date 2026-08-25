# Epic: Gestión y Monitoreo de Gateways (CU013)

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 17/08/2026
* **Última actualización**: 25/08/2026
* **Estado**: CRUD, cálculo de estado y envío real de `gateway_id`/`rssi`/`snr` desde el firmware v4 ya escritos. **Sin probar contra hardware físico** — no hay un gateway ESP32 a mano en esta sesión, ver sección 5.

## 1. Resumen de la Solución Técnica

`Gateway` no existía en el schema — confirmado como hueco real tanto en el diagnóstico inicial como en el doc de Casos de Uso. Se modeló y se construyó el CRUD.

**Actualización 25/08/2026**: un compañero (Matías) escribió `agroguard-firmware/src/v4/receptor.cpp`, que reemplaza el WiFi hardcodeado de v3 por un portal cautivo (`WiFiManager`) — te conectás desde el celular a la red "AgroGuard-Setup" y cargás SSID/password + URL de la API, persistido en NVS. Buena resolución del ítem de credenciales hardcodeadas, pero **v4 seguía sin mandar `gateway_id`/`rssi`/`snr`** (capturaba `rssi`/`snr` del paquete LoRa pero nunca los incluía en el POST). Se agregó en esta sesión:

- `gateway_id`/`rssi`/`snr` ahora van en el JSON que arma `sendTelemetryToApi()`.
- El UUID del gateway (el que matchea `recordHeartbeat()` en el backend — es el `id` real de la tabla `gateways`, no un nombre inventado) se agregó como **otro campo del mismo portal cautivo**, junto a la URL de la API — mismo patrón que ya existía, no uno nuevo. Se guarda en NVS como `gateway_id`.
- **Flujo de aprovisionamiento correspondiente**: primero registrar el gateway en la app (`/gateways`, `POST /gateways`) para obtener su UUID, después flashear/configurar el dispositivo físico y cargar ese UUID en el portal. Si no se carga, el gateway sigue mandando telemetría normal (no rompe nada) pero sin `gateway_id` — mismo comportamiento que v3, el heartbeat simplemente no se actualiza.

**Sigue sin probarse contra un gateway físico real** — no hubo acceso a hardware en esta sesión. El código compila conceptualmente (mismo patrón que el resto del archivo, ya en uso para `api_url`) pero no se flasheó ni se corrió en un ESP32.

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
| Firmware | `agroguard-firmware/src/v4/receptor.cpp` | Manda `gateway_id`/`rssi`/`snr` (25/08) — UUID configurable por el portal cautivo, sin probar en hardware real |
| Firmware (obsoleto) | `agroguard-firmware/src/v3/receptor.cpp` | Reemplazado por v4 (WiFi hardcodeado, sin `gateway_id`) — no se tocó, queda como referencia histórica |

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

**Probar `agroguard-firmware/src/v4/receptor.cpp` contra un gateway ESP32 físico** — flashearlo, registrar un gateway real en `/gateways`, cargar su UUID en el portal cautivo, y confirmar en la DB (`SELECT last_seen_at, last_rssi, last_snr FROM gateways WHERE id = '<uuid>'`) que el heartbeat se actualiza con telemetría real, no simulada. Nada de esto se verificó con hardware — es el mismo tipo de limitación que ya existía con v3, ahora un escalón más adelante (el código está, falta la prueba física).
