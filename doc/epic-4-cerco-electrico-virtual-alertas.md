# Epic 4: Cerco Eléctrico Virtual y Sistema de Alertas

* **Autor**: Antigravity (versión original) — actualizado por Claude (sesión con Santino)
* **Fecha de Creación**: 09/07/2026
* **Última actualización**: 17/08/2026
* **Estado**: Completado — geocercas reales conectadas al collar, alertas de salud automáticas agregadas

## 1. Resumen de la Solución Técnica

### 1.1 Qué cambió en esta sesión

* **`Sector` se eliminó del modelo.** Convivían dos representaciones de área geográfica (`Zone` y el par `Sector`+`Geofence`); `Sector` no tenía CRUD propio y su único uso real era un filtro muerto en `animals.service.ts`. El doc de Casos de Uso actualizado (CU011) confirma que el flujo real es "elegir una Zona → dibujar un cerco dentro de ella", así que `Geofence` ahora cuelga de `Zone` (`Geofence.zoneId`), no de `Sector`.
* **`Geofence.geometry` (PostGIS `Unsupported`) → `Geofence.polygonCoordinates` (`Json`).** El campo PostGIS era inutilizable desde Prisma Client sin SQL crudo, y nada en el código lo usaba así. Ahora usa el mismo patrón que `Zone.polygonCoordinates`.
* **El downlink de cerco virtual dejó de estar hardcodeado.** `iot.service.ts` tenía un rectángulo fijo con el comentario `//HAY QUE AJUSTAR ESTO, ESTA HARDCODED PARA PROBAR EL FLUJO`. Ahora busca el animal del collar → su `Geofence` activo (vía `AnimalGeofence` con `endAt: null`) → calcula el downlink real desde `polygonCoordinates`.
* **`isPointInPolygon` (ray-casting) pasó de código muerto a estar realmente conectado**: se usa en el servidor para evaluar si la lectura entrante cae fuera del cerco y así generar la alerta `ESCAPE` — antes solo el collar hacía este chequeo localmente (v3 del firmware), el backend nunca lo evaluaba.
* **Alertas de salud (`HEALTH`) automáticas — antes no existían.** El enum `AlertType` ya tenía `HEALTH` desde el diseño original, pero nada la generaba (el `ml-service` que se suponía la generaría está desconectado del backend desde julio). Ahora `iot.service.ts` evalúa cada lectura contra umbrales configurables de fiebre, hipotermia e inactividad (ver sección 4) y crea la alerta si corresponde.
* **CRUD real de geocercas** (`backend/src/geofences/`): antes solo existía la lógica de evaluación, no había forma de crear/listar/desactivar un cerco desde la API. Ahora sí, con pantalla propia en el frontend.

### 1.2 Lo que ya existía y sigue igual

* Modelo `Alert` (`id`, `type`, `message`, `animal_id`, `is_resolved`, `created_at`).
* Anti-spam: antes de crear una alerta `ESCAPE` se verifica que no exista ya una sin resolver del mismo tipo para ese animal. Para `HEALTH` el chequeo es más fino desde el 25/08/2026 (ver `epic-5-ml-health-prediction.md`): se hace por prefijo del mensaje (`[UMBRAL:FIEBRE]`, `[IA:CELO]`, etc.), no por tipo a secas — si no, una alerta de fiebre por umbral bloquearía para siempre que se cree una de celo predicha por el modelo, por ejemplo.
* Resolución manual desde el centro de notificaciones (`PATCH /alerts/:id/resolve`).
* Algoritmo de Ray-Casting (`isPointInPolygon`, sin cambios) — ver sección 5 de la versión original de este documento para el detalle del algoritmo, sigue vigente.

---

## 2. Contratos de API

### 2.1 Geocercas (`backend/src/geofences/`, nuevo)

* **`POST /geofences`** — crea un cerco dentro de una zona y le asigna un grupo de animales (deben pertenecer a esa zona). Cierra automáticamente cualquier asignación activa previa de esos animales a otro cerco.
  ```json
  {
    "zoneId": "uuid",
    "name": "Cerco Norte - Grupo A",
    "polygonCoordinates": [[-31.40, -64.20], [-31.40, -64.15], [-31.45, -64.15], [-31.45, -64.20]],
    "animalIds": ["uuid-animal-1", "uuid-animal-2"]
  }
  ```
* **`GET /geofences?zoneId=xxx`** — lista los cercos de una zona (activos e inactivos) con los animales actualmente asignados a cada uno.
* **`PATCH /geofences/:id/deactivate`** — baja lógica: `active: false` + cierra las `AnimalGeofence` activas de ese cerco. El cerco sigue visible en el historial.

### 2.2 Telemetría → downlink (actualizado, ver también `epic-13-4`)

`POST /api/iot/telemetry` ahora:
1. Busca el animal del `collar_id`.
2. Busca su `Geofence` activo.
3. Si la lectura cae fuera del polígono → crea `Alert(type: ESCAPE)` (si no hay una sin resolver ya).
4. Evalúa fiebre/hipotermia/inactividad contra los umbrales de la granja → crea `Alert(type: HEALTH)` si corresponde.
5. Llama al modelo predictivo real (`damp/ml-service`) con las últimas 48 lecturas → crea `Alert(type: HEALTH)` por cada evento (fiebre/celo/inactividad/anomalía) que prediga por encima de su umbral. Ver `epic-5-ml-health-prediction.md` para el contrato completo — es un paso adicional a este, no un reemplazo.
6. Devuelve `{ downlink: "<polígono real>" }` o `{ downlink: "NONE" }`.

### 2.3 Alertas — filtros agregados (`backend/src/alerts/`)

`GET /alerts` ahora acepta filtros opcionales (antes solo devolvía las no resueltas, sin forma de ver el historial completo):
```
GET /alerts?farmId=xxx&animalId=xxx&type=ESCAPE|HEALTH|SYSTEM&resolved=true|false&from=2026-08-01&to=2026-08-17
```
Sin `resolved`, devuelve **todas** las alertas (resueltas y no resueltas). El dashboard sigue mostrando solo las activas porque ahora pide explícitamente `resolved=false`.

### 2.4 Configuración de umbrales (`backend/src/alert-settings/`, nuevo — CU016)

* **`GET /farms/:farmId/alert-settings`** — devuelve la config de la granja o los defaults si nunca se guardó una (`feverThreshold: 39.5`, `hypothermiaThreshold: 37.0`, `inactivityMinutes: 120`, `emailOnEscape/emailOnHealth: false`).
* **`PUT /farms/:farmId/alert-settings`** — crea/actualiza (upsert) la config.

> **Importante**: `emailOnEscape`/`emailOnHealth` se guardan pero **no disparan ningún email** — no hay proveedor SMTP configurado en el proyecto. Es una preferencia guardada, no una integración funcional. Está explicitado en la UI (`/alertas`) para no generar una expectativa falsa.

---

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Schema | `backend/prisma/schema.prisma` | `Geofence` (ahora sobre `Zone`), `AlertSettings` (nuevo). `Sector` eliminado. |
| Backend | `backend/src/geofences/*` | CRUD de cercos virtuales (nuevo) |
| Backend | `backend/src/alert-settings/*` | CRUD de umbrales por granja (nuevo) |
| Backend | `backend/src/iot/iot.service.ts` | Downlink real, `raiseEscapeAlert`, `checkHealthThresholds`, `checkInactivity`, `checkPredictiveHealth` (25/08, ver `epic-5`), `raiseHealthAlert` |
| Backend | `backend/src/iot/ml-health.service.ts` | Cliente HTTP hacia `damp/ml-service` (nuevo, 25/08/2026) |
| Backend | `backend/src/iot/utils/geofencing.utils.ts` | `isPointInPolygon` — sin cambios, ahora sí se usa |
| Backend | `backend/src/iot/utils/haversine.utils.ts` | Nuevo — distancia entre dos puntos GPS, usada para detectar inactividad |
| Backend | `backend/src/alerts/alerts.service.ts` | `findAll()` con filtros (antes `getUnresolvedAlerts()` sin filtros) |
| Backend | `backend/src/animals/animals.service.ts` | Filtro `sectorId` → `zoneId` (directo sobre `Animal.zoneId`, ya no vía `Geofence.sector`) |
| Frontend | `frontend/src/app/(dashboard)/zonas/[id]/cercos/page.tsx` | Nueva pantalla: dibujar cerco, elegir animales de la zona, ver/desactivar cercos existentes |
| Frontend | `frontend/src/app/(dashboard)/alertas/page.tsx` | Centro de notificaciones (CU015) + panel de configuración de umbrales (CU016) en la misma pantalla |
| Frontend | `frontend/src/lib/api/geofences.ts`, `alert-settings.ts` | Clientes nuevos |

---

## 4. Umbrales de salud — lógica de detección

* **Fiebre**: `temp >= feverThreshold` (default 39.5°C).
* **Hipotermia**: `temp <= hypothermiaThreshold` (default 37.0°C).
* **Inactividad**: sobre la ventana de `inactivityMinutes` (default 120), si hay ≥2 lecturas que cubren toda la ventana y ninguna se movió más de 15m (Haversine) respecto al origen de la ventana, dispara la alerta. 15m es un margen fijo pensado para absorber el jitter normal del GPS, no es configurable desde la UI.

Estos tres chequeos reemplazan, dentro del flujo real de ingesta, la lógica que el `ml-service` (`damp/ml-service/main.py`) implementaba como stub por reglas pero que nunca llegó a estar conectada al backend real (ver `epic-5-ml-health-prediction.md`). No es el modelo LSTM — es una heurística simple, configurable por granja, que sí corre en producción.

---

## 5. Algoritmo de Ray-Casting (Geofencing)

*(Sin cambios respecto a la versión original — se mantiene por referencia.)*

El algoritmo utilizado para determinar si un punto está dentro de un polígono es el **Ray-Casting** (también llamado **Even-Odd Rule**):

1. Se traza un rayo imaginario desde el punto evaluado hacia el infinito en una dirección arbitraria (eje X positivo).
2. Se cuenta cuántas veces el rayo cruza los lados del polígono.
3. Si el número de cruces es **impar**, el punto está **dentro** del polígono.
4. Si el número de cruces es **par**, el punto está **fuera** del polígono.

```typescript
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

---

## 6. Instrucciones de Prueba Rápida

```bash
# 1. Crear un cerco (necesita un token de Clerk real; desde el navegador es más simple)
#    UI: /zonas/[id]/cercos → dibujar polígono, elegir animales, "Crear Cerco Virtual"

# 2. Mandar telemetría del collar de un animal asignado a ese cerco, con coordenadas AFUERA del polígono
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.50,"lng":-64.18,"temp":38.2}'

# 3. Verificar que se creó la alerta ESCAPE
#    UI: /alertas — o directamente en la DB: SELECT * FROM alerts WHERE type='ESCAPE';

# 4. Probar fiebre: mandar temp por encima del umbral configurado (default 39.5)
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.42,"lng":-64.18,"temp":40.2}'
# → debería crear Alert(type: HEALTH, message: "Temperatura elevada...")
```

## 7. Notas de Diseño (heredadas, siguen vigentes)

* **Anti-Spam de Alertas**: no se crea una alerta nueva si ya existe una sin resolver del mismo tipo para el mismo animal.
* **Resolución Manual**: las alertas se resuelven manualmente (`PATCH /alerts/:id/resolve`), no hay auto-resolución cuando el animal vuelve a estar dentro del cerco o la temperatura vuelve a la normalidad — es una decisión deliberada: el operador revisa y cierra, no el sistema solo.
* **Extensibilidad**: `AlertType.SYSTEM` sigue sin usarse (reservado para alertas de infraestructura, ej. batería baja de collar — no implementado, no hay dato de batería real todavía).
