# Epic 2: Gestión de Animales [ABM]

* **Autor**: Santino
* **Fecha de Creación**: 21/05/2026
* **Estado**: En Progreso

## 1. Resumen de la Solución Técnica
Se ha iniciado la implementación del ABM de Animales. En esta primera fase, nos enfocamos en el registro (Alta) y vinculación con los dispositivos físicos (Collares IoT). 
El backend expone endpoints REST bajo NestJS que interactúan con una base de datos PostgreSQL mapeada mediante Prisma. En el frontend, se desarrolló un formulario interactivo con estética "Dark Glassmorphism" utilizando Next.js 16 y Tailwind CSS 4.

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Crear / Registrar un Animal y Asignar Collar
* **Endpoint**: `POST http://localhost:3001/animals`
* **Content-Type**: `application/json`
* **Cuerpo de la Petición (Request Body)**:
  ```json
  {
    "farmId": "123e4567-e89b-12d3-a456-426614174000", // UUID de la Granja (Requerido)
    "tag": "Vaca 405",                             // Identificador/Nombre (Opcional)
    "breed": "Hereford",                            // Raza (Requerido)
    "weightKg": 480.5,                              // Peso en kilogramos (Requerido)
    "ageMonths": 24,                                // Edad en meses (Requerido)
    "collarMacAddress": "00:1B:44:11:3A:B7"        // MAC Address del Collar (Opcional)
  }
  ```
* **Respuesta Exitosa (201 Created)**:
  ```json
  {
    "message": "Animal creado exitosamente",
    "animal": {
      "id": "78fa1b98-bc88-43d9-9f77-ee3d45aa9821",
      "farmId": "123e4567-e89b-12d3-a456-426614174000",
      "tag": "Vaca 405",
      "sex": "FEMALE", // Por defecto u omitido
      "birthDate": "2024-05-21T12:00:00.000Z", // Calculado automáticamente a partir de ageMonths
      "breed": "Hereford",
      "weightKg": 480.5,
      "animalType": "COW",
      "createdAt": "2026-05-21T12:25:00.000Z"
    },
    "collarLinked": true
  }
  ```
* **Lógica del Negocio**:
  - El backend calculará `birthDate` restando la cantidad de meses (`ageMonths`) a la fecha actual.
  - Si se proporciona `collarMacAddress`, el sistema busca si ya existe ese dispositivo por su número de serie (`serialNumber`). Si no existe, lo crea automáticamente en estado `ACTIVE` y luego vincula el animal al collar mediante un registro en la tabla `AnimalCollar`.

### 2.2. Obtener Todos los Animales
* **Endpoint**: `GET http://localhost:3001/animals`
* **Respuesta Exitosa (200 OK)**:
  Retorna un arreglo de animales con sus collares asociados incluidos.

### 2.3. Obtener un Animal por ID
* **Endpoint**: `GET http://localhost:3001/animals/:id`

---

## 3. Mapa del Código (Dónde buscar)
* **Modelos de BD**: [schema.prisma](file:///c:/Users/catal/Desktop/Repos/damp/backend/prisma/schema.prisma) (Entidades `Animal`, `Collar`, `AnimalCollar`).
* **Controlador NestJS**: [animals.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.controller.ts).
* **Servicio NestJS**: [animals.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/animals.service.ts).
* **Clase DTO (Validaciones)**: [create-animal.dto.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animals/dto/create-animal.dto.ts).
* **Formulario Frontend**: [page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animals/new/page.tsx).

---

## 4. Instrucciones de Prueba Rápida
1. Iniciar base de datos de PostgreSQL e insertar una granja inicial (u obtener el UUID de una existente en la tabla `farm`).
2. Levantar el backend (`pnpm run start:dev` en `/backend`) y frontend (`pnpm run dev` en `/frontend`).
3. Acceder a `http://localhost:3000/animals/new` en el navegador.
4. Rellenar el formulario, asegurando un UUID de granja válido. Hacer click en "Registrar Animal".
5. Validar en consola del navegador o base de datos que se haya creado el `animal` y el `collar` mapeado correspondientemente.
