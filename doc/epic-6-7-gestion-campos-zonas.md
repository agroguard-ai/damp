# Epic 6 & 7: Gestión de Campos y Zonas

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic incluye la gestión completa de establecimientos agropecuarios (`Farms`) y la subdivisión de los mismos en potreros o parcelas (`Zones`), restringiendo el acceso del usuario autenticado con Clerk únicamente a sus propios establecimientos.

* **Prisma Schema**:
  * Se agregaron los campos `user_id` y `location` al modelo `Farm`.
  * Se creó el modelo `Zone` con relaciones a `Farm`, incluyendo `pasture_type` (tipo de cobertura/pastura) y `polygon_coordinates` (array JSON para guardar los límites espaciales).
* **Backend (NestJS + Prisma)**:
  * `FarmsModule`: Actualizado para requerir `ClerkAuthGuard`. Todas las operaciones CRUD (`GET /farms`, `POST /farms`, `PATCH /farms/:id`, `DELETE /farms/:id`) están limitadas usando el `userId` inyectado por el decorador `@CurrentUser('sub')`.
  * `ZonesModule`: CRUD completo (`GET /zones`, `POST /zones`, `PATCH /zones/:id`, `DELETE /zones/:id`). El servicio valida la propiedad del campo antes de añadir o retornar las zonas correspondientes.
* **Frontend (Next.js 16)**:
  * Formulario de alta de campos adaptado para enviar la cabecera `Authorization: Bearer <token>` de Clerk.
  * Selector dinámico en la vista de Dashboard y Hacienda conectado a la lista de establecimientos del usuario logueado.
  * Nueva pantalla de **Gestión de Zonas y Potreros** accesible desde el menú lateral (`/zonas`), permitiendo seleccionar el campo, ver su mapa interactivo de OpenStreetMap (Leaflet), dibujar perímetros/polígonos haciendo clics directos sobre el mapa para capturar las coordenadas de forma dinámica y registrar el nuevo potrero.

---

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Gestión de Campos (Farms)
* **Crear Campo**: `POST http://localhost:3001/farms`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
  * **Request Body (JSON)**:
    ```json
    {
      "name": "Estancia El Milagro",
      "address": "Ruta 3 Km 120",
      "province": "Buenos Aires",
      "location": "Pampa Húmeda",
      "totalAreaHa": 620.0
    }
    ```
* **Listar Campos**: `GET http://localhost:3001/farms`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`

### 2.2. Gestión de Zonas (Zones)
* **Crear Zona**: `POST http://localhost:3001/zones`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
  * **Request Body (JSON)**:
    ```json
    {
      "name": "Potrero de Cría",
      "pastureType": "Alfalfa",
      "farmId": "UUID_DEL_CAMPO",
      "polygonCoordinates": [[-34.60, -58.40], [-34.61, -58.40]]
    }
    ```
* **Listar Zonas por Campo**: `GET http://localhost:3001/zones?farmId=UUID_DEL_CAMPO`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
* **Eliminar Zona**: `DELETE http://localhost:3001/zones/:id`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`

---

## 3. Mapa del Código (Dónde buscar)

### Backend
* **Módulo Campos (`Farms`)**:
  * [farms.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.service.ts)
  * [farms.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.controller.ts)
* **Módulo Zonas (`Zones`)**:
  * [zones.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/zones/zones.service.ts)
  * [zones.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/zones/zones.controller.ts)

### Frontend
* **Página de Zonas**: [zonas/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/zonas/page.tsx)
* **Layout Wrapper (Sidebar)**: [AppLayout.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/components/AppLayout.tsx)

---

## 4. Instrucciones de Prueba Rápida
1. Accede a `http://localhost:3000/zonas` (Gestión de Zonas).
2. Si no tenés campos creados, el sistema te solicitará crear uno.
3. Tras registrar el campo, selecciónalo en el menú desplegable superior.
4. En el panel derecho de "Crear Nueva Zona", ingresa el nombre (ej. "Lote Norte") y el tipo de pastura ("Trébol blanco"), luego haz clic en **Registrar Zona**.
5. Verás cómo aparece automáticamente en la tabla de parcelas de la izquierda y podrás eliminarla pulsando el botón **Eliminar**.
