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

## 3. Crear la app de tipo "Compose" en Dockploy

1. Nuevo recurso → **Application → Docker Compose** (o el tipo equivalente en tu versión de Dockploy).
2. Repositorio: `damp` (el mismo de este archivo).
3. Rama: `dev` (o la que el equipo use como rama de deploy).
4. Archivo de compose: `docker-compose.prod.yml` (no `docker-compose.yml` — ese es solo para
   desarrollo local, incluye una base de datos propia que acá no se usa).

## 4. Cargar las variables de entorno

En la sección de Environment Variables de la app en Dockploy, cargar exactamente estos nombres
(son los mismos que usan `backend/.env.example` y `frontend/.env.example`, revisar ahí si hace
falta más contexto de cada uno):

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | El de la base creada en el paso 1 |
| `FRONTEND_URL` | El dominio que Dockploy le asigne al servicio `frontend` (ej. `https://damp-frontend.tu-dominio.com`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Dashboard de Clerk → API Keys |
| `CLERK_SECRET_KEY` | Dashboard de Clerk → API Keys |
| `CLERK_WEBHOOK_SECRET` | Dashboard de Clerk → Webhooks → tu endpoint → Signing Secret |

No hace falta cargar `ML_SERVICE_URL` ni `API_BASE_URL`: `docker-compose.prod.yml` ya los fija al
nombre interno de cada servicio en la red de Docker (`http://ml-service:8000` y `http://backend:3001`).

Importante: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se usa dos veces — como variable de entorno del
backend en runtime, y como **build arg** del frontend (Next.js la inyecta en el bundle del cliente
durante el build, no en runtime). Si Dockploy pasa las Environment Variables del proyecto también
como build args del compose (comportamiento estándar de `docker compose build` con interpolación
`${VAR}`), no hay que hacer nada extra — `docker-compose.prod.yml` ya está armado para eso.

## 5. Deploy

Lanzar el deploy desde Dockploy. Va a buildear las 3 imágenes (`backend`, `frontend`, `ml-service`)
y levantarlas en la red interna del compose.

Verificar que quedó bien:

- `GET https://<dominio-backend>/` → responde (aunque sea un simple "Hello World").
- `https://<dominio-frontend>/` → carga la home de DAMP.
- `GET https://<dominio-ml-service>/health` (si Dockploy expone el ml-service con dominio propio;
  si no, entrar al contenedor o pegarle desde el backend) → debe devolver `"model_loaded": true`.
  Si da `false`, revisar que los 4 archivos de `ml-service/model/` se hayan commiteado al repo
  (ver sección "Regenerar el modelo" más abajo).

## 6. Redeploy después de un nuevo push

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
