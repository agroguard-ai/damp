# Deploy

Guía paso a paso para levantar DAMP (backend + frontend + ml-service) en el VPS con
Dockploy. La base de datos (Postgres + PostGIS) **no** se dockeriza junto al resto,
se crea aparte, directo en Dockploy.

Seguir los pasos en orden. Si algo fallara, la sección de Troubleshooting al final
cubre los problemas más probables.

## 1. Crear la base de datos

1. En Dockploy, crear un nuevo recurso de tipo **Database → PostgreSQL**.
2. Anotar el `DATABASE_URL` que Dockploy genera.

## 2. Habilitar la extensión PostGIS

El schema de Prisma usa tipos geográficos (PostGIS).

Conectarse a la base creada en el paso 1 y correr:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Si tira un error de permisos, es porque el usuario de la conexión no es superusuario, en ese caso
hay que pedirle a Dockploy que la habilite desde su panel de administración de la base, o conectarse
como el usuario `postgres` por defecto en vez del usuario de la app.

## 3. Crear las 3 Aplicaciones 

En Dockploy, crear **3 recursos individuales de tipo Application** (uno para cada servicio). En todos seleccionás el repositorio `damp`, la rama a desplegar, y **Build Type: Dockerfile**.

### A. Servicio: `ml-service`

1. **Configuración de Build:**
   * **Build Type**: `Dockerfile`
   * **Docker Context Path**: `./ml-service`
   * **Docker File**: `Dockerfile` (o `./Dockerfile`)
2. **Configuración de Red / Puerto:**
   * **Port**: `8000`
   * **Health Check Path**: `/health`
3. **Variables de entorno**: Ninguna requerida (los modelos ya están incluidos en el repo).

### B. Servicio: `backend`

1. **Configuración de Build:**
   * **Build Type**: `Dockerfile`
   * **Docker Context Path**: `./backend`
   * **Docker File**: `Dockerfile` (o `./Dockerfile`)
2. **Configuración de Red / Puerto:**
   * **Port**: `3001`
   * **Health Check Path**: `/`
3. **Variables de entorno**:
   ```env
   PORT=3001
   DATABASE_URL=<DATABASE_URL de Postgres en Dockploy>
   FRONTEND_URL=<Dominio público del Frontend>
   ML_SERVICE_URL=http://<nombre-o-internal-host-del-ml-service>:8000
   ```

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
   API_BASE_URL=http://<nombre-o-internal-host-del-backend>:3001
   ```
   
## 4. Deploy y Orden de Lanzamiento

Recomendamos lanzar los deploys en este orden:
1. **`ml-service`**.
2. **`backend`**.
3. **`frontend`**.

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

## Regenerar el modelo

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
  sirviendo el bundle standalone. Los 10 tests de `ml-service/tests/` pasan con el modelo real.
- **`frontend/public/`** (nuevo, con `.gitkeep`): la rama `dev` no tenía esta carpeta (el
  favicon vive en `src/app/`, convención de Next 13+), pero el `Dockerfile` de producción la
  copia — sin ella el build de la imagen fallaba.
