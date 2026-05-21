# Estructura del Sistema DAMP y Tecnologías Utilizadas

Este documento detalla la arquitectura de software, las tecnologías implementadas y la relación de comunicación entre las diferentes capas del proyecto **DAMP** (Dispositivo de Monitoreo Animal y Posicionamiento).

---

## 1. Arquitectura General y Flujo de Datos

El sistema sigue una arquitectura desacoplada clásica de **Cliente-Servidor de Tres Capas**:
1. **Capa de Presentación (Frontend)**: Interfaz de usuario interactiva y responsiva.
2. **Capa de Negocio (Backend)**: REST API que implementa lógica de negocio, validaciones, control de acceso e integración.
3. **Capa de Datos (Base de Datos)**: Base de datos relacional PostgreSQL alojada en la nube.
4. **Capa de Abstracción de Datos (Prisma ORM)**: El puente que conecta el Backend con la Base de Datos.

### Diagrama de Relación (Arquitectura)

```mermaid
graph TD
    %% Componentes
    subgraph Frontend [Capa de Presentación - Browser]
        UI["Next.js App (React + CSS Glassmorphic)"]
    end

    subgraph Backend [Capa de Negocio - Server]
        Nest["NestJS API (TypeScript)"]
        PrismaClient["Prisma Client"]
    end

    subgraph Database [Capa de Datos - Cloud]
        NeonDB[("PostgreSQL (Neon Cloud Database)")]
    end

    %% Relaciones
    UI -->|HTTP Requests / REST API <br> Puerto 3001| Nest
    Nest -->|Métodos TS / Consultas Lógicas| PrismaClient
    PrismaClient -->|SQL nativo vía TCP <br> DATABASE_URL| NeonDB
    NeonDB -.->|Registros / Filas de datos| PrismaClient
    PrismaClient -.->|Objetos TypeScript Tipados| Nest
    Nest -.->|JSON Responses| UI
```

---

## 2. Tecnologías Detalladas

### A. Frontend (Next.js / React)
* **Ubicación**: En la carpeta [/frontend](file:///c:/Users/catal/Desktop/Repos/damp/frontend).
* **Puerto Local**: `http://localhost:3000`
* **Función**: 
  * Compila y sirve las vistas para el usuario final (productores rurales).
  * Maneja el estado interactivo mediante React Components.
  * Realiza llamadas HTTP asíncronas (`fetch`) al Backend para traer y enviar datos de los animales, campos, collares, etc.
  * Implementa diseño estético moderno (Dark Glassmorphism) usando Vanilla CSS.

### B. Backend (NestJS)
* **Ubicación**: En la carpeta [/backend](file:///c:/Users/catal/Desktop/Repos/damp/backend).
* **Puerto Local**: `http://localhost:3001`
* **Función**:
  * Expone los endpoints REST (ej. `POST /animals`, `GET /farms`).
  * Ejecuta validaciones (con DTOs y class-validator) y lógica del negocio (ej. archivar un animal, desvincular un collar para que pueda ser reutilizado).
  * Controla la autenticación y sesiones de usuario con la integración de **Clerk**.
  * Se comunica con la base de datos a través de Prisma.

### C. Base de Datos (Neon PostgreSQL - Cloud)
* **Ubicación**: Servidor en la nube de Neon.tech (AWS us-east-1).
* **Función**:
  * Es el motor de base de datos relacional (PostgreSQL) donde residen de forma permanente las tablas física del sistema.
  * Almacena datos espaciales (geometrías como Polígonos de sectores y Ubicaciones de telemetría) usando la extensión **PostGIS**.
  * No está en tu máquina local, sino "en la nube", lo que permite que sea accesible desde cualquier entorno de desarrollo o producción usando una cadena de conexión segura (`DATABASE_URL`).

### D. Prisma ORM (Object-Relational Mapper)
* **Ubicación de Configuración**: [backend/prisma/schema.prisma](file:///c:/Users/catal/Desktop/Repos/damp/backend/prisma/schema.prisma).
* **Función**:
  * **Traductor de Base de Datos**: Evita que tengamos que escribir sentencias SQL a mano (ej. `SELECT * FROM animal WHERE status = 'ACTIVE'`). En su lugar, usamos métodos nativos de TypeScript como `this.prisma.animal.findMany({ where: { status: 'ACTIVE' } })`.
  * **Tipado Estático**: Prisma lee el esquema en `schema.prisma` y genera tipos TypeScript de manera automática (`npx prisma generate`). Esto hace que en el backend sepamos exactamente qué campos tiene un animal, collar o usuario, evitando errores en tiempo de compilación.
  * **Migraciones / Estructura**: Nos permite sincronizar los cambios de tablas desde nuestro código local hacia la base de datos de Neon en la nube de manera segura.

---

## 3. Ejemplo Práctico: ¿Cómo viaja la información?

Imagina que registras un nuevo animal en la aplicación:

1. **Frontend**: Llenas el formulario en `http://localhost:3000/animals/new` (raza, peso, collar). Al hacer clic en "Guardar", el Frontend envía un `POST` en formato JSON a `http://localhost:3001/animals`.
2. **Backend**: NestJS recibe la solicitud, valida los datos con el DTO correspondiente, y en el servicio `AnimalsService` llama a Prisma:
   ```typescript
   this.prisma.animal.create({ data: { breed, weightKg, farmId, ... } })
   ```
3. **Prisma**: Traduce esa llamada de TypeScript a una consulta SQL `INSERT INTO animal ...` y la envía de forma segura a través de Internet a la base de datos PostgreSQL en **Neon**.
4. **Base de Datos (Neon Cloud)**: Ejecuta el `INSERT`, guarda el registro en el disco físico de la nube y le responde a Prisma con la confirmación y el ID autogenerado.
5. **Prisma**: Toma esa respuesta en SQL, la convierte a un objeto de TypeScript y se la devuelve a NestJS.
6. **Backend**: NestJS responde al Frontend con un código HTTP `201 Created` y el JSON del animal creado.
7. **Frontend**: Recibe la confirmación, actualiza la pantalla del usuario (ej. redirigiendo al listado de animales) con un mensaje de éxito.

---

## 4. Archivos de Configuración Clave

* **Conexión de Base de Datos**: Definida en [backend/.env](file:///c:/Users/catal/Desktop/Repos/damp/backend/.env) mediante la variable `DATABASE_URL`.
* **Esquema de Base de Datos**: Definido en [backend/prisma/schema.prisma](file:///c:/Users/catal/Desktop/Repos/damp/backend/prisma/schema.prisma) donde están declaradas todas las tablas y relaciones (`User`, `Farm`, `Animal`, `Collar`, etc.).
* **Configuración CORS**: En [backend/src/main.ts](file:///c:/Users/catal/Desktop/Repos/damp/backend/src/main.ts), permitiendo que el Frontend (`localhost:3000`) pueda hacer peticiones seguras al Backend (`localhost:3001`).

---

## 5. Configuración para Desarrollo Local (Recomendado)

Para evitar desajustes y pisarse la base de datos compartida de la nube durante el desarrollo de nuevas Epics, cada desarrollador debe levantar su propia base de datos local usando Docker.

### Pasos para iniciar la Base de Datos Local:

1. **Levantar el contenedor**: En la raíz del repositorio, ejecuta:
   ```bash
   docker-compose up -d
   ```
   Esto creará un contenedor de PostgreSQL con la extensión PostGIS habilitada en el puerto `5435`.

2. **Configurar el entorno (.env)**: En el archivo [backend/.env](file:///c:/Users/catal/Desktop/Repos/damp/backend/.env), cambia la URL de la base de datos para apuntar a la local:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5435/damp_db?schema=public"
   ```

3. **Crear y aplicar el esquema local**: Desde la carpeta `backend`, corre:
   ```bash
   pnpm exec prisma db push
   ```
   Esto creará las tablas y relaciones definidas en `schema.prisma` dentro de tu base de datos local.

4. **Detener la base de datos**: Si necesitas apagar el contenedor:
   ```bash
   docker-compose down
   ```
