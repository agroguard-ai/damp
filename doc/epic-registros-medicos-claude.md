# Epic: Gestión de Registros Médicos (CU008)

* **Autor**: Claude (sesión con Santino)
* **Fecha de Creación**: 17/08/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica

El modelo `MedicalEvent` ya existía en el schema pero no tenía ningún CRUD dedicado — el único lugar que lo escribía era `animals.service.ts` al archivar un animal (baja del rodeo), y con un bug: el evento de baja se guardaba con `type: 'TREATMENT'` hardcodeado, aunque dar de baja un animal no es un tratamiento médico.

* **Prisma Schema**: `MedicalEventType` ganó `WEIGHING` y `BIRTH` (el CU pide vacunación, pesaje, parto, tratamiento — antes solo estaban `VACCINATION`/`TREATMENT`/`SURGERY`). Se agregó `MedicalEvent.value: Float?` para guardar el dato numérico de un pesaje sin forzarlo dentro de `description` como texto libre.
* **Backend**: `backend/src/medical-events/` — crear un registro y listar el historial cronológico de un animal, ambos con chequeo de propiedad vía `animal.farm.userId`.
* **Comportamiento acumulativo**: si el registro es `WEIGHING` con `value`, además actualiza `animal.weightKg` — así el peso "vigente" del animal siempre refleja el último pesaje cargado, sin que el usuario tenga que editarlo a mano en dos lugares.
* **Bug corregido**: `animals.service.ts` ahora guarda el evento de baja con `type: null` en vez de `TREATMENT` (el campo ya era opcional en el schema). El texto descriptivo de la baja se mantiene para el historial, pero ya no queda mal clasificado como evento médico.

## 2. Contrato de Integración y Consumo

* **`POST /medical-events`** — crea un registro médico.
  ```json
  {
    "animalId": "uuid",
    "type": "VACCINATION",
    "description": "Vacuna aftosa",
    "value": null,
    "occurredAt": "2026-08-17T10:00:00.000Z"
  }
  ```
  `type` es uno de `VACCINATION | TREATMENT | SURGERY | WEIGHING | BIRTH`. `description`, `value` y `occurredAt` son opcionales (`occurredAt` default `now()`).

* **`GET /medical-events?animalId=xxx`** — historial cronológico (más reciente primero) de un animal.

## 3. Mapa del Código

| Capa | Archivo | Descripción |
|---|---|---|
| Schema | `backend/prisma/schema.prisma` | `MedicalEventType` extendido, campo `value` agregado |
| Backend | `backend/src/medical-events/medical-events.service.ts` | `create()` (con side-effect sobre `weightKg` en pesajes), `findAllByAnimal()` |
| Backend | `backend/src/animals/animals.service.ts` | `archive()` ya no marca la baja como `TREATMENT` |
| Frontend | `frontend/src/app/(dashboard)/animals/page.tsx` | Modal "Historial médico" por tarjeta de animal — ver eventos + formulario de carga. No se armó una pantalla separada; se integró directo donde ya se gestionan los animales |
| Frontend | `frontend/src/lib/api/medical-events.ts` | Cliente |

## 4. Instrucciones de Prueba Rápida

Desde la UI: en `/animals`, cada tarjeta tiene un botón "Historial médico" que abre el modal con el listado y el formulario de carga (tipo, valor opcional, descripción opcional). Cargar un pesaje y verificar que el peso mostrado en la tarjeta del animal se actualiza tras refrescar.

```bash
curl -X POST http://localhost:3001/medical-events \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"animalId":"<uuid>","type":"WEIGHING","value":425.5}'
# Verificar: SELECT weight_kg FROM animals WHERE id = '<uuid>'; → debería ser 425.5
```
