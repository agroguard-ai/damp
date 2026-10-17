@echo off
:: Levanta el entorno local completo de DAMP: DB y servicio de IA (Docker),
:: backend y frontend. Del docker-compose solo se levantan "db" (Postgres) y
:: "ml-service" (modelo de prediccion de salud) - el compose tambien define el
:: backend como contenedor, pero el flujo de desarrollo real es correr backend y frontend directo con pnpm
:: (mas rapido para iterar, sin rebuildear una imagen en cada cambio).
:: Backend y frontend se abren cada uno en su propia ventana para poder ver
:: los logs de cada uno por separado (y cortarlos con Ctrl+C sin matar al otro).
set ROOT=%~dp0
echo ============================================
echo  DAMP - levantando entorno local
echo ============================================
echo.
echo [1/4] Base de datos local (Postgres + PostGIS, Docker)...
docker-compose -f "%ROOT%docker-compose.yml" up -d db
if errorlevel 1 (
    echo.
    echo ERROR: no se pudo levantar la base de datos. Esta Docker Desktop corriendo?
    pause
    exit /b 1
)
echo.
echo [2/4] Servicio de IA (ml-service, puerto 8000)...
docker-compose -f "%ROOT%docker-compose.yml" up -d --build ml-service
if errorlevel 1 (
    echo AVISO: no se pudo levantar ml-service. La app funciona igual, pero sin predicciones de salud.
)
echo.
echo [3/4] Backend (NestJS, puerto 3001)...
start "DAMP Backend (3001)" /D "%ROOT%backend" cmd /k pnpm dev
echo.
echo [4/4] Frontend (Next.js, puerto 3000)...
start "DAMP Frontend (3000)" /D "%ROOT%frontend" cmd /k pnpm run dev
echo.
echo ============================================
echo  Listo. Backend: http://localhost:3001
echo         Frontend: http://localhost:3000
echo         IA:       http://localhost:8000/health
echo ============================================
echo Esta ventana se puede cerrar - backend y frontend quedan en sus propias ventanas.
pause
