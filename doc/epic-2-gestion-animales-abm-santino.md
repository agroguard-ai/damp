# Epic 2: Gestión de Animales [ABM]

* **Autor**: Santino
* **Fecha de Creación**: 21/05/2026
* **Estado**: En Progreso

## 1. Resumen de la Solución Técnica
Esta Epic se extendió para incluir el ABM básico de Campos/Granjas (`Farms`), ya que es un prerrequisito para asociar y catalogar a los animales de forma limpia. 

En esta fase:
- **Backend (NestJS + Prisma)**: Se crearon dos módulos principales:
  - `FarmsModule`: Permite registrar nuevos campos (nombre, superficie, ubicación) y listarlos.
  - `AnimalsModule`: Permite dar de alta animales asociados a una granja y a un collar físico, así como listar todos los animales con filtros avanzados.
- **Frontend (Next.js 16 + Tailwind CSS 4)**: Se implementó:
  - Formulario de Registro de Campos.
  - Formulario de Registro de Animales (con un dropdown dinámico que consume la API de campos).
  - Panel de Monitoreo (Listado de animales) con filtros dinámicos (Establecimiento, Tipo de animal, Estado del collar y Estado de salud).

---

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Campos / Granjas (Farms)
* **Crear Campo**: `POST http://localhost:3001/farms`
  * **Request Body (JSON)**:
    ```json
    {
      "name": "Estancia Don Silvestre",
      "address": "Ruta 205 Km 90",      // Opcional
      "province": "Buenos Aires",        // Opcional
      "totalAreaHa": 450.5               // Opcional
    }
    ```
* **Listar Campos**: `GET http://localhost:3001/farms`

### 2.2. Registro de Animal y Asignación de Collar
* **Crear Animal**: `POST http://localhost:3001/animals`
  * **Request Body (JSON)**:
    ```json
    {
      "farmId": "123e4567-e89b-12d3-a456-426614174000", // Requerido (UUID)
      "tag": "Caravana 22",                            // Opcional (Identificador)
      "breed": "Hereford",                             // Requerido
      "weightKg": 410.2,                               // Requerido
      "ageMonths": 18,                                 // Requerido
      "collarMacAddress": "00:1B:44:11:3A:B7"          // Opcional (MAC o Nro. Serie)
    }
    ```

### 2.3. Listado de Animales con Filtros (US 2.3)
* **Endpoint**: `GET http://localhost:3001/animals`
* **Query Parameters (Opcionales)**:
  * `farmId`: Filtra por el UUID de la granja (muy recomendado para separar haciendas).
  * `animalType`: Tipo de animal (ej. `COW`).
  * `collarStatus`: Estado de conexión del collar (`ACTIVE` o `INACTIVE`).
  * `healthStatus`: Eventos médicos activos (`HEALTHY`, `TREATMENT`, `SURGERY`, `VACCINATION`).
* **Respuesta Exitosa (200 OK - JSON)**:
  Retorna un arreglo de animales con su último collar activo (`animalCollars`), geocercas activas (`animalGeofences`), y su último evento médico (`medicalEvents`):
  ```json
  [
    {
      "id": "78fa1b98-bc88-43d9-9f77-ee3d45aa9821",
      "tag": "Caravana 22",
      "breed": "Hereford",
      "weightKg": 410.2,
      "animalType": "COW",
      "birthDate": "2024-11-21T12:00:00.000Z",
      "createdAt": "2026-05-21T12:25:00.000Z",
      "animalCollars": [
        {
          "collar": {
            "serialNumber": "00:1B:44:11:3A:B7",
            "status": "ACTIVE"
          }
        }
      ],
      "animalGeofences": [],
      "medicalEvents": []
    }
  ]
  ```

---

## 3. Mapa del Código (Dónde buscar)

### Backend
* **Módulo Granjas**:
    * Servicio: [farms.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.service.ts)
    * Controlador: [farms.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/farms.controller.ts)
    * DTO: [create-farm.dto.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/farms/dto/create-farm.dto.ts)
* **Módulo Animales**:
    * Servicio (Filtros y Creación): [animals.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.service.ts)
    * Controlador: [animals.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.controller.ts)

### Frontend
* **Página Registrar Campo**: [farms/new/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/farms/new/page.tsx)
* **Página Registrar Animal**: [animals/new/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animals/new/page.tsx)
* **Página Listado y Filtros (US 2.3)**: [animals/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animals/page.tsx)

---

## 4. Instrucciones de Prueba Rápida
1. Inicia backend y frontend (`pnpm run start:dev` y `pnpm run dev`).
2. Ve al Home e ingresa a "Registrar Nuevo Campo". Completa los datos y guárdalos.
3. Te redirigirá automáticamente a "Registrar Nuevo Animal". Verás que ahora el campo recién creado figura seleccionado en el dropdown superior. Completa la vaca y agrégale un ID de collar (ej: `COLLAR-999`).
4. Ve al "Ver Panel de Monitoreo" (`/animals`). Podrás ver el listado, filtrar por granjas, tipo y estado de collares en tiempo real.
