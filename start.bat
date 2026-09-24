@echo off
:: Levanta el entorno local completo de DAMP: DB (Docker), backend y frontend.
:: Solo levanta el servicio "db" del docker-compose (Postgres) - el compose
:: tambien define backend/ml-service como contenedores completos, pero el
:: flujo de desarrollo real es correr backend y frontend directo con pnpm
:: (mas rapido para iterar, sin rebuildear una imagen en cada cambio).
:: Backend y frontend se abren cada uno en su propia ventana para poder ver
:: los logs de cada uno por separado (y cortarlos con Ctrl+C sin matar al otro).
set ROOT=%~dp0
echo ============================================
echo  DAMP - levantando entorno local
echo ============================================
echo.
echo [1/3] Base de datos local (Postgres + PostGIS, Docker)...
docker-compose -f "%ROOT%docker-compose.yml" up -d db
if errorlevel 1 (
    echo.
    echo ERROR: no se pudo levantar la base de datos. Esta Docker Desktop corriendo?
    pause
    exit /b 1
)
echo.
echo [2/3] Backend (NestJS, puerto 3001)...
start "DAMP Backend (3001)" /D "%ROOT%backend" cmd /k pnpm dev
echo.
echo [3/3] Frontend (Next.js, puerto 3000)...
start "DAMP Frontend (3000)" /D "%ROOT%frontend" cmd /k pnpm run dev
echo.
echo ============================================
echo  Listo. Backend: http://localhost:3001
echo         Frontend: http://localhost:3000
echo ============================================
echo Esta ventana se puede cerrar - backend y frontend quedan en sus propias ventanas.
pause
