# Deploy de DAMP en Dockploy

Guía paso a paso para levantar DAMP (backend + frontend + ml-service) en el VPS con
Dockploy. La base de datos (Postgres + PostGIS) **no** se dockeriza junto al resto —
se crea aparte, directo en Dockploy.

Seguir los pasos en orden. Si algo fallara, la sección de Troubleshooting al final
cubre los problemas más probables.

## 0. Qué se necesita antes de empezar

- Acceso a Dockploy en el VPS.
- Acceso al repo `damp` en GitHub (rama a desplegar: `dev`, salvo que el equipo decida otra).
- Las claves de Clerk del proyecto (Dashboard de Clerk → API Keys): publishable key y secret key.
- El signing secret del webhook de Clerk (Dashboard de Clerk → Webhooks → tu endpoint → Signing Secret).
  Si el webhook todavía no está creado en Clerk, se puede crear después de tener la URL pública
  del backend (paso 5) y volver a este paso.

## 1. Crear la base de datos en Dockploy

1. En Dockploy, crear un nuevo recurso de tipo **Database → PostgreSQL**.
2. Anotar el `DATABASE_URL` (o host/puerto/usuario/password/nombre de base) que Dockploy genera —
   se necesita en el paso 4.

## 2. Habilitar la extensión PostGIS

El schema de Prisma usa tipos geográficos (PostGIS) — sin este paso, las migraciones del backend
van a fallar al arrancar.

Conectarse a la base creada en el paso 1 (con el cliente SQL que Dockploy exponga, o por `psql`
desde afuera si el puerto está expuesto) y correr:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Si tira un error de permisos, es porque el usuario de la conexión no es superusuario — en ese caso
hay que pedirle a Dockploy que la habilite desde su panel de administración de la base, o conectarse
como el usuario `postgres` por defecto en vez del usuario de la app.

## 3. Crear las 3 Aplicaciones en Dockploy

En Dockploy, crear **3 recursos individuales de tipo Application** (uno para cada servicio). En todos seleccionás el repositorio `damp`, la rama a desplegar (`dev` o `main`), y **Build Type: Dockerfile**.

---

### A. Servicio: `ml-service`

1. **Configuración de Build:**
   * **Build Type**: `Dockerfile`
   * **Docker Context Path**: `./ml-service`
   * **Docker File**: `Dockerfile` (o `./Dockerfile`)
2. **Configuración de Red / Puerto:**
   * **Port**: `8000`
   * **Health Check Path**: `/health`
3. **Variables de entorno**: Ninguna requerida (los modelos ya están incluidos en el repo).

---

### B. Servicio: `backend`

1. **Configuración de Build:**
   * **Build Type**: `Dockerfile`
   * **Docker Context Path**: `./backend`
   * **Docker File**: `Dockerfile` (o `./Dockerfile`)
2. **Configuración de Red / Puerto:**
   * **Port**: `3001`
   * **Health Check Path**: `/`
3. **Variables de entorno (Environment Variables)**:
   ```env
   PORT=3001
   DATABASE_URL=<DATABASE_URL de Postgres en Dockploy>
   FRONTEND_URL=<Dominio público del Frontend, ej: https://app.tu-dominio.com>
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_test_... o pk_live_...>
   CLERK_SECRET_KEY=<sk_test_... o sk_live_...>
   CLERK_WEBHOOK_SECRET=<whsec_...>
   ML_SERVICE_URL=http://<nombre-o-internal-host-del-ml-service>:8000
   ```
   *(Nota: Si están en el mismo proyecto de Dockploy, el hostname suele ser el nombre que le diste a la aplicación `ml-service` en Dockploy).*

---

### C. Servicio: `frontend`

1. **Configuración de Build:**
   * **Build Type**: `Dockerfile`
   * **Docker Context Path**: `./frontend`
   * **Docker File**: `Dockerfile` (o `./Dockerfile`)
2. **Configuración de Red / Puerto:**
   * **Port**: `3000`
   * **Health Check Path**: `/`
3. **Variables de entorno y Build Args**:
   * En Dockploy, cargar en las variables de entorno de la aplicación:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_test_... o pk_live_...>
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
   CLERK_SECRET_KEY=<sk_test_... o sk_live_...>
   API_BASE_URL=http://<nombre-o-internal-host-del-backend>:3001
   ```
   *(Nota: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se inyecta durante el build de Next.js, por lo que debe estar presente al momento de compilar la imagen).*

---

## 4. Deploy y Orden de Lanzamiento

Recomendamos lanzar los deploys en este orden:
1. **`ml-service`** (arranca independiente).
2. **`backend`** (corre migraciones automáticamente vía `docker-entrypoint.sh` y conecta con la base y el ml-service).
3. **`frontend`** (conecta con el backend).

Verificar que todo responde:
- `GET https://<dominio-backend>/` → responde OK.
- `https://<dominio-frontend>/` → carga la app web de DAMP.
- `GET http://<ml-service>:8000/health` → devuelve `{"status": "ok", "model_loaded": true}`.

---

## 5. Redeploy después de un nuevo push

Depende de cómo esté configurado el proyecto en Dockploy:
- Si tiene **auto-deploy por webhook**: cada push a la rama configurada dispara el deploy solo.
- Si no: hay un botón de **Redeploy** manual en el panel de la app, en Dockploy.

(Documentar acá cuál de los dos aplica una vez que el amigo lo configure — para que quede como
referencia del equipo.)

## Troubleshooting

- **El backend no levanta / loguea `getOrThrow` explotando en el arranque**: al backend le falta
  una variable de entorno — el mensaje de error nombra cuál (usa `configService.getOrThrow`, así
  que falla explícito, no en silencio). Revisar la tabla del paso 4.
- **Las migraciones fallan al arrancar el backend**: casi siempre es que falta el paso 2
  (`CREATE EXTENSION postgis`). El log del contenedor del backend va a mostrar el error de Prisma
  al respecto.
- **`ml-service` responde `"model_loaded": false` en `/health`**: los 4 archivos del modelo
  (`final_model.keras`, `scaler.joblib`, `thresholds.joblib`, `metadata.joblib`) no llegaron a la
  imagen — confirmar que estén commiteados en `ml-service/model/` en la rama que se está desplegando.
- **El frontend no autentica / Clerk tira error en el cliente**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  no llegó como build arg (quedó vacía "horneada" en el bundle). Hay que forzar un rebuild de la
  imagen del frontend después de cargar la variable en Dockploy, no alcanza con solo reiniciar el
  contenedor.

## Regenerar el modelo (para el equipo, si se reentrena)

Los 4 archivos en `ml-service/model/` (`final_model.keras`, `scaler.joblib`, `thresholds.joblib`,
`metadata.joblib`) están commiteados en este repo — normalmente esos artefactos se consideran
"regenerables" y se versionan con DVC en `damp-ml-api`, pero como Dockploy buildea la imagen del
ml-service directo desde este repo (sin acceso a DVC ni a un remote real), se decidió commitearlos
acá también para que el build funcione standalone.

Si el equipo reentrena el modelo:

```bash
# En damp-ml-api:
dvc repro

# Copiar los 4 archivos actualizados a damp/ml-service/model/:
cp machine-learning/outputs/artifacts/final_model.keras   ../damp/ml-service/model/
cp machine-learning/outputs/artifacts/thresholds.joblib   ../damp/ml-service/model/
cp machine-learning/outputs/preprocessed/scaler.joblib    ../damp/ml-service/model/
cp machine-learning/outputs/preprocessed/metadata.joblib  ../damp/ml-service/model/

# En damp:
git add ml-service/model/*.keras ml-service/model/*.joblib
git commit -m "chore: actualiza artefactos del modelo ML"
git push
```

Después del push, redeploy en Dockploy (o esperar el auto-deploy si está configurado).

## Qué se hizo (07/09/2026) — preparación inicial para deploy en VPS

Antes de esta sesión, `dev` tenía el microservicio `ml-service` y un `docker-compose.yml`
pensado para desarrollo local (con `db` incluida), pero backend y frontend solo tenían
`Dockerfile.dev` — no existía ninguna imagen de producción, ni un compose ni una guía para
desplegar en un VPS. Se agregó todo lo necesario para que un compañero pueda desplegar en
Dockploy sin dockerizar la base de datos:

- **`backend/Dockerfile`** (nuevo): multi-stage con pnpm, corre `prisma migrate deploy` al
  arrancar (`backend/docker-entrypoint.sh`, nuevo) antes de levantar `node dist/main.js`.
- **`frontend/Dockerfile`** (nuevo): multi-stage con `output: 'standalone'` (agregado a
  `next.config.ts`, no estaba seteado), maneja los build args de Clerk por separado de las
  variables de runtime — ver comentarios en el propio Dockerfile.
- **`ml-service/Dockerfile`**: se le agregó usuario no root y `HEALTHCHECK`. Los 4 artefactos
  del modelo (`final_model.keras`, `scaler.joblib`, `thresholds.joblib`, `metadata.joblib`) se
  generaron corriendo `dvc repro` end-to-end en `damp-ml-api` y se commitearon en
  `ml-service/model/` (antes gitignoreados) — ver `ml-service/model/.gitignore` para el porqué.
- **`docker-compose.prod.yml`** (nuevo): junta backend + frontend + ml-service en una red
  interna, sin el servicio `db` (a diferencia de `docker-compose.yml`, que es solo para
  desarrollo local y no se tocó).
- **`.env.example`** de backend y frontend reordenados/comentados, más
  **`.env.production.example`** (nuevo, en la raíz) con la lista consolidada para pegar en
  Dockploy.
- **CI**: `.github/workflows/ml-service-ci.yml` (pytest) y `.github/workflows/docker-build.yml`
  (buildea las 3 imágenes en cada push/PR, sin publicarlas — para no descubrir un Dockerfile
  roto recién al desplegar), sumados a los workflows de backend/frontend que ya existían.
- **Bug real encontrado y arreglado**: el Prisma Client se genera fuera de `node_modules` (ver
  `output` en `prisma/schema.prisma`), y una de sus dependencias internas
  (`@prisma/client-runtime-utils`) quedaba aislada en el store virtual de pnpm sin hoistear —
  `node dist/main` (por lo tanto `start:prod`, y cualquier imagen Docker) rompía siempre con
  `Cannot find module '@prisma/client-runtime-utils'`, con o sin Docker de por medio. Se
  arregló agregando `publicHoistPattern: ['@prisma/*']` en `backend/pnpm-workspace.yaml` (en
  pnpm 10+ esta config vive ahí, no en `.npmrc` — se comprobó en la práctica que `.npmrc` no
  tenía efecto). De paso, `backend/Dockerfile.dev` y `frontend/Dockerfile.dev` quedaron pineados
  a pnpm@9 sin copiar `pnpm-workspace.yaml`, desalineados con la CI (pnpm 11) y rotos por el
  mismo motivo — se actualizaron a pnpm@11 y a copiar `pnpm-workspace.yaml`.
- **Validado de punta a punta, no solo "debería andar"**: se buildearon las 3 imágenes reales y
  se corrieron — el backend contra un Postgres+PostGIS real (las migraciones crearon las 54
  tablas esperadas), el ml-service respondiendo `"model_loaded": true` en `/health`, el frontend
  sirviendo el bundle standalone. Los 10 tests de `ml-service/tests/` pasan con el modelo real.
- **`frontend/public/`** (nuevo, con `.gitkeep`): la rama `dev` no tenía esta carpeta (el
  favicon vive en `src/app/`, convención de Next 13+), pero el `Dockerfile` de producción la
  copia — sin ella el build de la imagen fallaba.
