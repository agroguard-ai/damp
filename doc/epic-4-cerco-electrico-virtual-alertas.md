# Epic 4: Cerco Eléctrico Virtual y Sistema de Alertas

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic implementa la lógica de **Cerco Eléctrico Virtual (Geofencing)** que evalúa en tiempo real si un animal abandonó la Zona (polígono/potrero) que tiene asignada, cada vez que el Gateway envía un batch de telemetría. Cuando se detecta una fuga, el sistema genera una alerta persistente del tipo `ESCAPE` que se refleja en el Dashboard y en el mapa de Geolocalización en vivo.

* **Prisma Schema**:
  * Se creó el enum `AlertType` con los valores `ESCAPE`, `HEALTH`, `SYSTEM`.
  * Se creó la entidad `Alert` (id, type, message, animal_id, is_resolved, created_at) con relación al modelo `Animal`.
* **Backend (NestJS + Prisma)**:
  * `geofencing.utils.ts`: Función matemática pura `isPointInPolygon()` basada en el algoritmo **Ray-Casting (Jordan Curve Theorem)** que evalúa si un punto (lat, lng) se encuentra dentro de un polígono definido por un array de coordenadas.
  * `IotService` (modificado): Ahora, por cada lectura de telemetría válida, si el animal tiene un `zone_id` asignado, obtiene el polígono de esa zona, evalúa la nueva posición del animal y, si está fuera del polígono, crea una alerta `ESCAPE` (siempre que no exista una alerta activa previa para ese animal).
  * `AlertsModule` (nuevo): Expone endpoints para consultar alertas activas y resolverlas.
* **Frontend (Dashboard y Mapa)**:
  * El **Dashboard (Home)** muestra una KPI real con el conteo de alertas activas y una lista en vivo de alertas sin resolver con botón "Resolver".
  * El **Mapa de Geolocalización** distingue animales con alerta activa usando un marcador rojo pulsante (SVG custom con animación CSS) y muestra un banner de advertencia en el popup del animal.

---

## 2. Contratos de API

### 2.1 Obtener Alertas Activas
* **Endpoint**: `GET http://localhost:3001/alerts`
* **Headers**: `Authorization: Bearer <JWT_Clerk>`
* **Respuesta Exitosa (200 OK)**:
  ```json
  [
    {
      "id": "uuid",
      "type": "ESCAPE",
      "message": "El animal con caravana \"223\" ha traspasado los límites del potrero \"Lote Norte\".",
      "animalId": "uuid",
      "isResolved": false,
      "createdAt": "2026-07-09T14:30:00.000Z",
      "animal": {
        "tag": "223",
        "breed": "Holando",
        "animalType": {
          "name": "Holando",
          "species": "Bovino"
        }
      }
    }
  ]
  ```

### 2.2 Resolver una Alerta
* **Endpoint**: `PATCH http://localhost:3001/alerts/:id/resolve`
* **Headers**: `Authorization: Bearer <JWT_Clerk>`
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "id": "uuid",
    "type": "ESCAPE",
    "message": "...",
    "animalId": "uuid",
    "isResolved": true,
    "createdAt": "2026-07-09T14:30:00.000Z"
  }
  ```

### 2.3 Localización en Vivo (actualizado)
* **Endpoint**: `GET http://localhost:3001/api/animals/locations?farmId=<uuid>`
* **Cambio**: Se agregó el campo `hasActiveAlert: boolean` a cada objeto animal en la respuesta.
  ```json
  {
    "id": "uuid",
    "tag": "223",
    "hasActiveAlert": true,
    "latestReading": { "latitude": -33.30, "longitude": -61.87, "..." : "..." },
    "..."
  }
  ```

---

## 3. Mapa del Código (Dónde buscar)

| Capa        | Archivo                                              | Descripción                                                         |
|-------------|------------------------------------------------------|---------------------------------------------------------------------|
| Schema      | `backend/prisma/schema.prisma`                       | Enum `AlertType` y modelo `Alert`. Relación `alerts` en `Animal`.   |
| Utilidad    | `backend/src/iot/utils/geofencing.utils.ts`          | Función `isPointInPolygon()` — algoritmo Ray-Casting.               |
| Backend     | `backend/src/iot/iot.service.ts`                     | Lógica de evaluación de cerco en cada batch de telemetría recibida.  |
| Backend     | `backend/src/alerts/alerts.service.ts`               | Servicio para obtener alertas activas y resolverlas.                 |
| Backend     | `backend/src/alerts/alerts.controller.ts`            | Controlador REST: `GET /alerts` y `PATCH /alerts/:id/resolve`.      |
| Backend     | `backend/src/alerts/alerts.module.ts`                | Módulo NestJS que registra el servicio y controlador.                |
| Backend     | `backend/src/app.module.ts`                          | Registra `AlertsModule` en el módulo raíz.                          |
| Backend     | `backend/src/animals/animals.service.ts`             | `getLiveLocations()` ahora incluye `hasActiveAlert` en la respuesta. |
| Frontend    | `frontend/src/app/page.tsx`                          | Dashboard Home: KPI real y lista de alertas con botón "Resolver".   |
| Frontend    | `frontend/src/components/LiveTrackingMap.tsx`         | Marcador rojo pulsante para animales con alerta de escape activa.   |
| Frontend    | `frontend/src/app/globals.css`                       | Animación CSS `pulse-alert` y reset de estilos `.alert-marker`.     |

---

## 4. Algoritmo de Ray-Casting (Geofencing)

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

## 5. Flujo de Evaluación de Cerco

```
Gateway POST /api/iot/telemetry  (batch de lecturas)
  │
  ├──▶ IotService.handleTelemetryBatch()
  │      │
  │      ├── Para cada lectura válida:
  │      │     ├── ¿Animal tiene zone_id asignado?
  │      │     │     ├── Sí → Obtener polygonCoordinates de la zona
  │      │     │     │     ├── isPointInPolygon(lat, lng, polygon)?
  │      │     │     │     │     ├── Sí (dentro) → No hacer nada
  │      │     │     │     │     └── No (fuera) → ¿Existe alerta ESCAPE activa?
  │      │     │     │     │           ├── Sí → No crear duplicado
  │      │     │     │     │           └── No → Crear Alert(ESCAPE)
  │      │     │     └── No → Omitir evaluación
  │      │     │
  │      │     └── Insertar TelemetryReading en BD
  │      │
  │      └── Actualizar lastTelemetryDate en collares
  │
  └──▶ Respuesta al Gateway
```

---

## 6. Notas de Diseño

* **Anti-Spam de Alertas**: Antes de crear una alerta de escape, el sistema verifica que no exista una alerta `ESCAPE` activa (`isResolved: false`) para el mismo animal. Esto evita inundar la base de datos con alertas duplicadas en cada ciclo de telemetría (cada 30 segundos).
* **Resolución Manual**: Las alertas se resuelven manualmente desde el Dashboard mediante el botón "Resolver", que ejecuta un `PATCH` al backend cambiando `isResolved` a `true`.
* **Marcadores Visuales en Mapa**: Se utiliza un `DivIcon` de Leaflet con un SVG inline (pin rojo con signo de exclamación) y una animación CSS `pulse-alert` para que el punto rojo del marcador pulse visualmente, alertando al productor de inmediato.
* **Extensibilidad**: El enum `AlertType` incluye los valores `HEALTH` y `SYSTEM` para futuras alertas de salud animal (temperatura anormal, etc.) y alertas del sistema (batería baja del collar, pérdida de señal, etc.).
