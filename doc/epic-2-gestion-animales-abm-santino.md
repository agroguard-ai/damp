# Epic 2: Gestión de Animales [ABM]

* **Autor**: Santino
* **Fecha de Creación**: 21/05/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic incluye el ABM de Granjas (`Farms`), el registro de animales vinculados a collares y geocercas, la visualización filtrada, y finalmente el archivado preventivo (baja lógica).

En esta fase:
- **Prisma Schema**: Se agregó el campo `status` (String, por defecto `"ACTIVE"`) al modelo `Animal` para permitir bajas lógicas.
- **Backend (NestJS + Prisma)**:
  - `FarmsModule`: Gestión de establecimientos agropecuarios.
  - `AnimalsModule`: Creación, filtros dinámicos en listado (`GET /animals`), y archivado lógico (`PATCH /animals/:id/archive`).
- **Frontend (Next.js 16 + Tailwind CSS 4)**:
  - Formulario de Registro de Campos.
  - Formulario de Registro de Animales (asociado a dropdown de campos).
  - Panel de Monitoreo con listados filtrados por Establecimiento, Tipo, Estado del Collar, Estado de Salud y Estado de Hacienda (Activos, Vendidos, Fallecidos).
  - Control de baja directo desde la Card del animal activo.

---

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Campos / Granjas (Farms)
* **Crear Campo**: `POST http://localhost:3001/farms`
  * **Request Body (JSON)**:
    ```json
    {
      "name": "Estancia Don Silvestre",
      "address": "Ruta 205 Km 90",
      "province": "Buenos Aires",
      "totalAreaHa": 450.5
    }
    ```
* **Listar Campos**: `GET http://localhost:3001/farms`

### 2.2. Registro de Animal y Asignación de Collar
* **Crear Animal**: `POST http://localhost:3001/animals`
  * **Request Body (JSON)**:
    ```json
    {
      "farmId": "123e4567-e89b-12d3-a456-426614174000",
      "tag": "Caravana 22",
      "breed": "Hereford",
      "weightKg": 410.2,
      "ageMonths": 18,
      "collarMacAddress": "00:1B:44:11:3A:B7"
    }
    ```

### 2.3. Listado de Animales con Filtros (US 2.2)
* **Endpoint**: `GET http://localhost:3001/animals`
* **Query Parameters**:
  * `farmId`: (UUID) Filtra por campo.
  * `animalType`: (COW, etc.)
  * `collarStatus`: (`ACTIVE` / `INACTIVE`)
  * `healthStatus`: (`HEALTHY`, `TREATMENT`, `SURGERY`, `VACCINATION`)
  * `status`: (`ACTIVE`, `SOLD`, `DEAD`). Por defecto es `ACTIVE`.

### 2.4. Archivar Animal sin Perder Historial (US 2.3)
* **Endpoint**: `PATCH http://localhost:3001/animals/:id/archive`
* **Cuerpo de la Petición (Request Body)**:
  ```json
  {
    "status": "SOLD" // O "DEAD"
  }
  ```
* **Lógica del Negocio al Archivar**:
  1. Actualiza el `status` del Animal a `SOLD` o `DEAD`.
  2. **Libera el Collar físico**: Busca la relación activa en `AnimalCollar` (donde `endAt` sea nulo) y establece `endAt` a la fecha actual para que el dispositivo quede libre para otros animales.
  3. **Desvincula Geocercas**: Cierra la relación activa en `AnimalGeofence` estableciendo `endAt` a la fecha actual.
  4. **Log de Historial**: Crea un evento médico genérico (`TREATMENT`) con la descripción de la baja, conservando intacto todo el historial de telemetría y eventos previos.

---

## 3. Mapa del Código (Dónde buscar)

### Backend
* **Módulo Granjas**:
    * Servicio: [farms.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.service.ts)
    * Controlador: [farms.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.controller.ts)
* **Módulo Animales**:
    * Servicio (Filtros, Registro y Archivo): [animals.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.service.ts)
    * Controlador: [animals.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.controller.ts)
    * DTO de Archivo: [archive-animal.dto.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/dto/archive-animal.dto.ts)

### Frontend
* **Página Listado y Bajas (US 2.3)**: [animals/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animals/page.tsx)

---

## 4. Instrucciones de Prueba Rápida
1. Accede a `http://localhost:3000/animals` (Panel de Monitoreo).
2. En la tarjeta de cualquier animal activo, selecciona la acción **Dar de Baja...** y elige **Vendido** o **Fallecido**. Confirma en el cuadro de diálogo.
3. El animal desaparecerá de la vista por defecto (Activos).
4. Cambia el filtro de "Estado Hacienda" de *Activos* a *Vendidos* o *Fallecidos*. Verás que el animal archivado aparece allí, y su collar figurará como libre o no vinculado, conservando todo el registro de su peso, raza y fecha de registro.

---

## 5. Resumen de la Integración (Merge) y Resolución de Conflictos
Durante la integración de esta Epic en la rama `dev`, se resolvieron diversos conflictos para conservar tanto la autenticación/webhooks (de la rama `dev` actual) como las nuevas funcionalidades de la gestión de animales (de esta Epic).

A continuación se detallan las decisiones tomadas en cada archivo:

### 5.1. Backend

* **[.env.example](file:///c:/Users/catal/Desktop/Repos/damp/backend/.env.example)**: Se unificó el archivo manteniendo la configuración de base de datos local (puerto `5435`) y se añadieron las nuevas variables de Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`) y `FRONTEND_URL` que venían de `dev`.
* **[schema.prisma](file:///c:/Users/catal/Desktop/Repos/damp/backend/prisma/schema.prisma)**: Git unificó automáticamente los modelos. Se conservan todas las tablas de la Epic (`Animal`, `Collar`, `Farm`, etc.) junto a las tablas de control de roles (`role`, `spatial_ref_sys`, `Sex`) añadidas en `dev`.
* **[app.module.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/app.module.ts)**: Se unificaron los módulos importados. Ahora se cargan tanto `AuthModule` y `WebhookModule` (de `dev`) como `AnimalsModule` y `FarmsModule` (de la Epic).
* **[main.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/main.ts)**: Se unificaron los bootstraps. Se preservó el parseo de cuerpo crudo (`{ rawBody: true }`) y la configuración específica de CORS/puertos mediante `ConfigService` de la rama `dev`, e incorporamos el `ValidationPipe` global que requería la Epic para validar DTOs.

### 5.2. Frontend

* **[layout.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/layout.tsx)**: Se combinaron las fuentes (`Inter`, `DM_Sans`) y el envoltorio `ClerkProvider` (de `dev`) con las clases de estructura y diseño adaptativo (`h-full`, `min-h-full flex flex-col antialiased` y `suppressHydrationWarning`) de la Epic.
* **[page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/page.tsx)**: Se reemplazó la página de inicio estática/placeholder que estaba en `dev` por el panel de accesos directos completo desarrollado en la Epic (con links para Registrar Campo, Registrar Animal y Ver Panel de Monitoreo).
