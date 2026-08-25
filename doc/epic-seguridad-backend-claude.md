# Epic: Seguridad de Backend — RBAC real, auth de dispositivo, migraciones e historial de acceso

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 25/08/2026
* **Estado**: Completado y verificado (39 tests backend en verde, boot real de la app sin errores de DI, `migrate deploy` probado contra una base de datos vacía)

## 1. Resumen de la Solución Técnica

Cuatro piezas de deuda técnica documentadas en `CLAUDE.md` ("Deuda técnica conocida") se resolvieron en esta sesión, con confirmación explícita del equipo antes de tocar cada una (afectan comportamiento de producción, no eran decisiones triviales):

### 1.1 RBAC real en los 12 controllers que solo tenían `ClerkAuthGuard`

El sistema de roles de dos niveles (`GlobalRolesGuard`/`FarmRoleGuard`, ver `sistema-roles-dos-niveles.md`) ya existía pero solo lo usaban `farm-users` y `admin/admin-users` — el resto de los controllers (animals, zones, geofences, gateways, medical-events, alert-settings, alerts, reports) solo verificaban "es dueño de la granja" a mano en el service, sin distinguir ADMIN/OPERATOR/VIEWER.

**El problema real al aplicar el guard donde ya estaba**: `FarmRoleGuard` resolvía el `farmId` desde `params.farmId ?? params.id ?? body.farmId ?? query.farmId`. El fallback a `params.id` es una trampa — en rutas como `PATCH /animals/:id`, `:id` es del animal, no de la granja. Aplicar el guard tal cual habría "encontrado" un farmId incorrecto (el id del animal) y devuelto 403 a usuarios legítimos, en vez de fallar de forma obvia. Se sacó ese fallback (`farm-role.guard.ts:84-86`) y se agregó un mecanismo explícito:

- **`@ResolveFarmIdFrom(resource, idKey?)`** (nuevo decorador, `auth/decorators/resolve-farm-id-from.decorator.ts`): declara de qué recurso y bajo qué nombre de campo sacar el id cuando el farmId no viaja directo. `FarmRoleGuard` lo resuelve con una consulta Prisma dedicada por tipo de recurso (`animal`, `zone`, `geofence` — 2 hops vía `zone.farmId` —, `gateway`, `alert` — 2 hops vía `animal.farmId`).
- Cubierto con 11 tests dedicados (`farm-role.guard.spec.ts`), incluyendo un test específico que verifica que `params.id` de un recurso NO se trata como farmId.

**Política de roles aplicada** (derivada de las definiciones ya documentadas en `sistema-roles-dos-niveles.md` — ADMIN administra, OPERATOR gestiona animales/zonas/geocercas, VIEWER solo lee):

| Controller | Escrituras | Lecturas |
|---|---|---|
| animals, zones, geofences, gateways, medical-events | `OPERATOR`/`ADMIN` | Cualquier miembro |
| alert-settings (umbrales) | `ADMIN` únicamente | Cualquier miembro |
| alerts (resolver) | `OPERATOR`/`ADMIN` | Cualquier miembro (sin guard, ver abajo) |
| reports | — (todo es lectura) | Cualquier miembro, VIEWER incluido |
| collars, animal-types | `SUPER_ADMIN` (son catálogos globales, no de granja — ver 1.2) | Cualquier usuario autenticado |

**Excepciones deliberadas, no se tocaron**: `animals.findAll` y `alerts.findAll` — cuando `farmId` no viene en la query, agregan resultados de **todas** las granjas del usuario (comportamiento intencional ya existente). Meterles `FarmRoleGuard` habría roto esa vista multi-granja (el guard exige un único farmId resoluble). Quedan solo con `ClerkAuthGuard`; el filtrado por dueño lo sigue haciendo el service.

### 1.2 `Collar` y `AnimalType`: catálogos globales, no recursos de granja

`Collar` no tiene `farmId` en el schema — es inventario de la plataforma, no de un establecimiento puntual (varias granjas pueden usar collares del mismo pool). `AnimalType` tampoco (catálogo único, `name` global). `FarmRoleGuard` no aplica a ninguno de los dos. Se protegieron en cambio con `GlobalRolesGuard` + `@GlobalRoles(SUPER_ADMIN)` para altas/ediciones (gestión de flota/catálogo), dejando lectura abierta a cualquier usuario autenticado (necesario para elegir un collar disponible al dar de alta un animal). Excepción: `PATCH /collars/:id/status` (marcar un collar dañado) se dejó sin restringir — es una acción de campo rutinaria, no de gestión de inventario.

### 1.3 Autenticación de dispositivo en `POST /api/iot/telemetry`

No había ningún mecanismo — cualquiera que supiera un `collar_id` válido podía inyectar telemetría falsa. Se implementó API key estática por gateway:

- `Gateway.apiKey` (nuevo campo, `String @unique`): se genera server-side con `crypto.randomBytes(32).toString('hex')` al crear el gateway (`gateways.service.ts create()`) y se devuelve **una sola vez**, en la respuesta de ese POST. `findByFarm`/`update`/`remove` usan `omit: { apiKey: true }` — nunca se vuelve a exponer por HTTP.
- **`IotDeviceAuthGuard`** (nuevo, `iot/guards/iot-device-auth.guard.ts`), aplicado solo a `POST /api/iot/telemetry`: exige `gateway_id` en el body + header `X-API-Key`, valida contra `GatewaysService.validateApiKey()` (comparación en tiempo constante con `crypto.timingSafeEqual`, para no filtrar la clave por timing).
- `gateway_id` pasó de opcional a **requerido** en `TelemetryPayloadDto` — es tanto el dato de heartbeat (CU013) como la identidad para autenticar. Esto es un cambio incompatible con firmware viejo que no lo mande (v3), aceptado porque el equipo no tiene una flota física desplegada todavía (ver `CLAUDE.md`, limitación de alcance conocida) — no hay nada que "romper" en producción real.
- **`agroguard-firmware/src/v4/receptor.cpp`** actualizado en la misma sesión: agrega un tercer campo al portal cautivo de `WiFiManager` (además de URL de API y UUID de gateway) para cargar el API Key, y lo manda en el header `X-API-Key` de cada POST. Sin los tres datos cargados, el gateway loguea el motivo y no manda la telemetría (en vez de mandarla incompleta y que el backend la rechace con 401 silenciosamente).

### 1.4 Baja lógica de personal de granja (CU002/CU018)

`DELETE /farms/:farmId/users/:userId` hacía hard-delete de `FarmUser` — se perdía cualquier rastro de que alguien tuvo acceso. Se agregaron `FarmUser.isActive` (default `true`) y `FarmUser.removedAt`:

- `removeSubUser()` ahora hace `update({ isActive: false, removedAt: now() })` en vez de `delete()`. Devuelve 404 si la membresía ya estaba dada de baja (mismo comportamiento externo que antes).
- `assignSubUser()` (upsert) reactiva automáticamente (`isActive: true, removedAt: null`) si se vuelve a invitar a alguien que ya había sido removido — evita membresías "zombies" inactivas con un rol desactualizado.
- `findAllInFarm()` y `updateSubUserRole()` filtran/validan por `isActive: true`.
- **Bug encontrado de paso**: `FarmRoleGuard` (el guard de autorización, no el módulo de farm-users) buscaba la membresía sin filtrar `isActive` — un usuario dado de baja habría seguido pasando el chequeo de autorización en cualquier otro endpoint protegido, porque la fila seguía existiendo. Se corrigió ahí también (`farm-role.guard.ts`), con test dedicado.

### 1.5 Historial de migraciones de Prisma, reescrito como baseline única

Los 8 migraciones existentes creaban tablas en singular (`farm`, `sector`, `collar`...) mientras `schema.prisma` las mapea en plural (`@@map("farms")`, etc.) — `prisma migrate deploy/reset` fallaba siempre contra una base vacía. Confirmado además que la última migración (`20260811220000_add_global_roles_and_farm_user_role`) había quedado con `finished_at: NULL` en `_prisma_migrations` — ni siquiera terminó de aplicarse la vez que alguien lo intentó.

Se reemplazaron las 8 por una sola (`20260825000000_baseline`), generada con `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` a partir del schema vigente (ya con `Gateway.apiKey` y los campos de `FarmUser` de esta sesión incluidos). **Verificado, no solo generado**: se aplicó con `prisma migrate deploy` contra una base de datos nueva y vacía (no la de desarrollo) y se confirmó con `prisma migrate diff` que el resultado no tiene ningún drift contra `schema.prisma`. La base de datos local de desarrollo se marcó como "ya aplicada" (`prisma migrate resolve --applied`) sin volver a correr el SQL, ya que su esquema real ya coincidía (se sincronizaba con `db push`).

De paso se sacó del schema el modelo `spatial_ref_sys` (tabla de sistema de PostGIS, sin ningún uso en el código — `grep` no encontró ninguna referencia) — no le correspondía a una migración de la app crearla, y de hecho `prisma migrate diff` ya la excluía sola del script generado.

**Importante para el equipo**: cada compañero que baje este cambio va a tener su `_prisma_migrations` local desincronizado (todavía va a tener registradas las 8 migraciones viejas, que ya no existen como archivos). Hace falta correr, una vez, sobre la base local de cada uno:
```bash
# Opción simple si no importa perder los datos locales de prueba:
pnpm exec prisma db push --force-reset
# Opción sin perder datos (si el schema real ya coincide, que debería):
pnpm exec prisma migrate resolve --applied 20260825000000_baseline
```

## 2. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Backend | `backend/prisma/schema.prisma` | `Gateway.apiKey` (nuevo), `FarmUser.isActive`/`removedAt` (nuevo), `spatial_ref_sys` eliminado |
| Backend | `backend/prisma/migrations/20260825000000_baseline/` | Migración única, reemplaza las 8 anteriores |
| Backend | `backend/src/auth/decorators/resolve-farm-id-from.decorator.ts` | **Nuevo** — declara cómo resolver el farmId por recurso |
| Backend | `backend/src/auth/guards/farm-role.guard.ts` | Resolución por recurso (nuevo), ya no trata `params.id` como farmId (fix), filtra `isActive` (fix) |
| Backend | `backend/src/iot/guards/iot-device-auth.guard.ts` | **Nuevo** — autenticación de gateway por API key |
| Backend | `backend/src/gateways/gateways.service.ts` | Genera/valida `apiKey`, `omit` en las respuestas de lectura |
| Backend | `backend/src/farm-users/farm-users.service.ts` | Baja lógica en vez de hard-delete |
| Backend | 9 controllers (animals, zones, geofences, gateways, medical-events, alert-settings, alerts, reports, collars, animal-types) | `@UseGuards`/`@RequireFarmRole`/`@ResolveFarmIdFrom`/`@GlobalRoles` agregados por endpoint |
| Firmware | `agroguard-firmware/src/v4/receptor.cpp` | Campo de portal para API Key + header `X-API-Key` en cada POST |
| Tests | `farm-role.guard.spec.ts`, `iot-device-auth.guard.spec.ts`, `gateways.service.spec.ts`, `farm-users.service.spec.ts` | **Nuevos** — 33 tests |

## 3. Instrucciones de Prueba Rápida

```bash
# Verificar que el historial de migraciones funciona de verdad (antes fallaba siempre):
createdb -h localhost -p 5435 -U postgres damp_fresh_test
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/damp_fresh_test" pnpm exec prisma migrate deploy
# Debería aplicar 1 migración sin errores.

# Verificar RBAC: un usuario sin membresía en la granja del animal debería recibir 403,
# no 200 ni un 403 "genérico" por farmId mal resuelto.
curl -X PATCH http://localhost:3001/animals/<id-de-un-animal-de-otra-granja>/archive \
  -H "Authorization: Bearer <token-clerk>" -H "Content-Type: application/json" \
  -d '{"status":"SOLD"}'
# Esperado: 403 Forbidden ("User is not a registered member of this farm")

# Verificar auth de telemetría (sin X-API-Key):
curl -X POST http://localhost:3001/api/iot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"collar_id":1,"lat":-31.42,"lng":-64.18,"temp":38.2,"gateway_id":"<uuid>"}'
# Esperado: 401 Unauthorized ("Missing X-API-Key header")
```

## 4. Qué queda por hacer

- **Comunicar al equipo el paso manual de migraciones** (sección 1.5) — sin esto, el primero que haga `git pull` y corra `prisma migrate dev` sin saberlo puede confundirse con el estado de su DB local.
- **`updateSubUserRole`/`assignSubUser` no usan `FarmRoleGuard`** (siguen con `@UseGuards(ClerkAuthGuard, GlobalRolesGuard, FarmRoleGuard)` a nivel de `farm-users.controller.ts`, eso ya estaba bien) — sin cambios necesarios ahí, se valida solo por completitud.
- **No hay UI para regenerar/rotar un `apiKey` de gateway** si se filtra — hoy la única forma es borrar el gateway y crear uno nuevo (pierde el historial de heartbeat). Agregar un endpoint `POST /gateways/:id/rotate-key` sería la mejora natural.
- **`spatial_ref_sys` sigue existiendo como tabla real en la base** (la creó la extensión PostGIS) — solo se sacó del schema de Prisma, no se tocó la base de datos ni la extensión.
