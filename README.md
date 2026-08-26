# damp

## Arranque rápido (Windows)

Una vez que ya instalaste dependencias y configuraste los `.env` de `backend/` y `frontend/`
al menos una vez (ver secciones de abajo), `start.bat` (en la raíz de este repo) levanta todo
de un solo doble-click: la base de datos local (Docker), el backend y el frontend, cada uno en
su propia ventana. Requiere Docker Desktop corriendo.

---

## Cómo correr el Backend

El backend está construido sobre **NestJS** (v11) y utiliza **Prisma ORM** con una base de datos **PostgreSQL** habilitada con **PostGIS**. La autenticación de usuarios está delegada a **Clerk**.

### Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

1. **Node.js** (v18 o superior recomendado).
2. **pnpm**
3. **PostgreSQL** (v12 o superior) con soporte para la extensión **PostGIS**.

### Pasos para la Ejecución

1. **Acceder al backend:**

   ```bash
   cd backend
   ```

2. **Instalar las dependencias:**

   ```bash
   pnpm install
   ```

3. **Configurar las variables de entorno:**
   Crea un archivo `.env` basado en la plantilla:

   ```bash
   cp .env.example .env
   ```

   Abre el archivo `.env` y completa la configuración.

4. **Inicializar y migrar la Base de Datos:**

   ```bash
   pnpm prisma migrate dev
   pnpm prisma generate
   ```

5. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm start:dev
   ```
   La aplicación estará disponible en el puerto definido en la variable de entorno PORT.

---

## Cómo correr el Frontend

El frontend está desarrollado con **Next.js** (v16), **TailwindCSS** (v4) para el estilizado y la librería de **Clerk** para el control de accesos y sesiones.

### Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

1. **Node.js** (v18 o superior).
2. **pnpm**.

### Pasos para la Ejecución

1. **Acceder al frontend:**

   ```bash
   cd frontend
   ```

2. **Instalar las dependencias:**

   ```bash
   pnpm install
   ```

3. **Configurar las variables de entorno:**
   Crea un archivo `.env` basado en la plantilla:

   ```bash
   cp .env.example .env
   ```

   Abre el archivo `.env` y completa la configuración.

4. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm dev
   ```
   La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).
