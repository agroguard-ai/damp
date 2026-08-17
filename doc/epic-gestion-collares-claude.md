# Epic: Gestión de Collares (CU009)

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 17/08/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica

Antes de esta sesión, `Collar` solo tenía `id` (Int autoincremental) y `lastTelemetryDate` — no existía ningún endpoint para darlo de alta, no había forma de saber si estaba dañado, y el frontend usaba campos (`serialNumber`, `status`, `batteryLevel`) que **nunca existieron en el backend real** (eran remanentes de un cliente Prisma viejo, ya desincronizado). Esto significaba que en cuanto hubiera telemetría real fluyendo, el mapa en vivo y el listado de animales iban a crashear con `TypeError` al intentar leer esos campos inexistentes.

* **Prisma Schema**: se agregó `identifier` (código físico único, escaneable/QR — distinto del `id` interno que usa el firmware como `collar_id`) y `status: CollarStatus` (`AVAILABLE` / `DAMAGED` / `OUT_OF_SERVICE`). El estado "asignado" **no se guarda** — se calcula en cada consulta a partir de si existe un `AnimalCollar` activo (`endAt: null`), para que nunca quede desincronizado del dato real.
* **Backend**: `backend/src/collars/` — alta (rechaza `identifier` duplicado con 409), listado con última telemetría y animal asignado, detalle con historial completo de asignaciones, edición, y cambio de estado. Marcar un collar como `DAMAGED`/`OUT_OF_SERVICE` libera automáticamente al animal que lo tuviera puesto (cierra el `AnimalCollar` activo).
* **`animals.service.ts` ahora valida disponibilidad real antes de asignar un collar** (`CollarsService.assertAvailableForAssignment`): rechaza si el collar está dañado/fuera de servicio o si ya está asignado a otro animal. Antes de esta sesión no había ningún chequeo — solo se validaba que el collar existiera.
* **Bug de datos corregido en el camino**: el modal de alta de animal (y el formulario huérfano `animals/new`) mandaban un campo `collarMacAddress` que el DTO del backend nunca declaró. Con `forbidNonWhitelisted: true` en el `ValidationPipe` global, completar ese campo hacía fallar la creación del animal completa con 400. Se reemplazó por un `<select>` de collares `AVAILABLE` que manda `collarId` (lo que el backend realmente espera).

## 2. Contrato de Integración y Consumo

* **`POST /collars`** — registra un collar físico nuevo.
  ```json
  { "identifier": "COLLAR-0042" }
  ```
  Respuesta 409 si el identificador ya existe.

* **`GET /collars`** — lista todos los collares del sistema (catálogo global, no por granja — así está modelado hoy, sin ownership por usuario).
  ```json
  [
    {
      "id": 1,
      "identifier": "COLLAR-0001",
      "status": "AVAILABLE",
      "lastTelemetryDate": "2026-08-17T19:12:09.601Z",
      "createdAt": "2026-08-17T19:00:00.000Z",
      "telemetryReadings": [{ "temperature": 38.5, "timestamp": "..." }],
      "assignedAnimal": { "id": "uuid", "tag": "Vaca 12" }
    }
  ]
  ```

* **`GET /collars/:id`** — detalle con historial completo de asignaciones (`animalCollars`, incluye animales pasados y presente).

* **`PATCH /collars/:id`** — corrige `identifier`.

* **`PATCH /collars/:id/status`** — cambia el estado.
  ```json
  { "status": "DAMAGED" }
  ```
  Si el collar estaba asignado, la asignación se cierra automáticamente (`endAt: now()`).

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Schema | `backend/prisma/schema.prisma` | Enum `CollarStatus`, campos `identifier`/`status`/`createdAt` en `Collar` |
| Backend | `backend/src/collars/collars.service.ts` | `create`, `findAll`, `findOne`, `update`, `updateStatus`, `assertAvailableForAssignment` |
| Backend | `backend/src/collars/collars.controller.ts` | Rutas REST |
| Backend | `backend/src/animals/animals.service.ts` | `create()` usa `CollarsService.assertAvailableForAssignment` en vez del chequeo de solo-existencia anterior |
| Frontend | `frontend/src/app/(dashboard)/collares/page.tsx` | Listado, alta, cambio de estado, historial expandible por collar |
| Frontend | `frontend/src/lib/api/collars.ts` | Cliente |
| Frontend | `frontend/src/app/(dashboard)/animals/page.tsx`, `animals/new/page.tsx` | `<select>` de collares disponibles en vez del campo `collarMacAddress` roto |

## 4. Instrucciones de Prueba Rápida

```bash
# Registrar un collar (necesita token de Clerk; más simple desde /collares en el navegador)
curl -X POST http://localhost:3001/collars \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"identifier":"COLLAR-0042"}'

# Marcarlo dañado y verificar que libera al animal asignado
curl -X PATCH http://localhost:3001/collars/1/status \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"status":"DAMAGED"}'
```

Desde la UI: `/collares` para alta/estado, modal "Añadir Animal" en `/animals` para ver el `<select>` de collares disponibles en acción (los `DAMAGED`/`OUT_OF_SERVICE`/ya-asignados no aparecen en la lista).
