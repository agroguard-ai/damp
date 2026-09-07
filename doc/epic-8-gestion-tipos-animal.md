# Epic 8: Gestión de Tipos de Animal y Razas

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic introduce el catálogo de taxonomía animal (`AnimalType`) para clasificar a los animales por su raza y especie ganadera en lugar de usar cadenas estáticas, extendiendo además las capacidades del ABM de Hacienda (Epic 2).

* **Prisma Schema**:
  * Se creó el modelo `AnimalType` (id, name, species, description).
  * Se vinculó el modelo `Animal` con `AnimalType` mediante una relación formal (`animalTypeId`), removiendo el enum antiguo `AnimalType`.
* **Backend (NestJS + Prisma)**:
  * `AnimalTypesModule`: Módulo completo que implementa CRUD para razas/especies (`GET /animal-types`, `POST /animal-types`, `PATCH /animal-types/:id`, `DELETE /animal-types/:id`). Protegido por `ClerkAuthGuard`.
  * `AnimalsModule`: Actualizado para soportar la relación formal con `AnimalType` y filtrar listados dinámicamente mediante el ID de clasificación seleccionado en el panel.
* **Frontend (Next.js 16)**:
  * Nueva pantalla de **Tipos de Animal y Especies** en `/animal-types` para registrar razas (ej. Aberdeen Angus, Hereford, Holando Argentino) indicando especie (Bovino, Ovino, Equino, etc.).
  * Integración en el modal "+ Añadir Animal" y en el panel de filtros para cargar las opciones del backend de manera dinámica en lugar de datos quemados.

---

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1. Gestión de Tipos de Animal (AnimalTypes)
* **Crear Tipo / Raza**: `POST http://localhost:3001/animal-types`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
  * **Request Body (JSON)**:
    ```json
    {
      "name": "Aberdeen Angus",
      "species": "Bovino",
      "description": "Raza productora de carne de alta calidad"
    }
    ```
* **Listar Tipos**: `GET http://localhost:3001/animal-types`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`
* **Eliminar Tipo**: `DELETE http://localhost:3001/animal-types/:id`
  * **Headers**: `Authorization: Bearer <CLERK_JWT_TOKEN>`

---

## 3. Mapa del Código (Dónde buscar)

### Backend
* **Módulo Tipos de Animal**:
  * [animal-types.service.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animal-types/animal-types.service.ts)
  * [animal-types.controller.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animal-types/animal-types.controller.ts)
  * DTO: [create-animal-type.dto.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/animal-types/dto/create-animal-type.dto.ts)

### Frontend
* **Página de Catálogo**: [animal-types/page.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/app/animal-types/page.tsx)
* **Sidebar Integration**: [AppLayout.tsx](file:///c:/Users/catal/Desktop/Repos/damp/frontend/src/components/AppLayout.tsx)

---

## 4. Instrucciones de Prueba Rápida
1. Accede a `http://localhost:3000/animal-types` (Tipos de Animal).
2. Registra un nuevo tipo: ingresa "Holando" en raza, selecciona la especie "Bovino", y haz clic en **Guardar Tipo**.
3. Dirígete a la sección **Hacienda** (`/animals`), presiona en **+ Añadir Animal** y comprueba que en el menú desplegable "Tipo de Animal" ya figura la opción "Holando (Bovino)".
4. Filtra el listado de animales seleccionando "Holando" en la cabecera para ver el comportamiento del filtro.
