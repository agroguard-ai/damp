# DAMP Agro — Guía del Proyecto y Directivas de Desarrollo

Sistema integral de gestión agropecuaria con monitoreo IoT en tiempo real (collares con GPS y temperatura), geocercas virtuales rotativas, alertas clínicas y servicio de inteligencia artificial para predicción de salud bovina.

---

## 1. Arquitectura General del Repositorio

Monorepo compuesto por tres aplicaciones principales:

1. **`backend/` (NestJS 10 + PostgreSQL + Prisma):**
   - Ingesta de telemetría IoT desde gateways (`POST /iot/telemetry`).
   - Gestión de animales, rodeos, collares, potreros y geocercas poligonales rotativas.
   - Motor de alarmas y notificaciones clínicas.
   - Cliente hacia el microservicio de IA (`MlHealthService` en `src/iot/ml-health.service.ts`).
   - Aplicación de umbrales clínicos de negocio (`ML_HEALTH_THRESHOLDS` en `src/iot/iot.service.ts`).

2. **`frontend/` (Next.js 14 App Router + Tailwind CSS):**
   - Dashboard web de control ganadero, mapa de potreros interactivo (Leaflet/Mapbox) y seguimiento satelital.
   - Historial médico, eventos clínicos y métricas de salud por animal.

3. **`ml-service/` (Python 3.12 + FastAPI + TensorFlow/Keras):**
   - Microservicio de inferencia y pipeline de entrenamiento de modelos predictivos de salud animal.
   - Modelos: Corto plazo (6h) y Trayectoria por etapas (48h).

---

## 2. Microservicio de Inteligencia Artificial (`ml-service`)

> ⚠️ **IMPORTANTE PARA ASISTENTES Y LLMs:**  
> Para interactuar, consultar la API, entrenar modelos o integrar el servicio de IA con el backend, **debes consultar y utilizar la skill `damp-ml-service`** ubicada en:  
> - `.claude/skills/damp-ml-service/SKILL.md`  
> - `.agents/skills/damp-ml-service/SKILL.md`  
> 
> Esta skill contiene los esquemas exactos de los payloads, shapes de tensores, ventanas de historia requeridas, comandos de pipeline y ejemplos de integración.

### Cómo funciona el sistema de IA:
1. **Envío de telemetría:** El backend recopila el registro continuo de comportamiento del animal (temperatura corporal, velocidad, distancia al rodeo, ciclo día/noche circadiano) en bloques de 30 minutos y lo envía a `ml-service` vía API REST (`POST /predict/6h`, `POST /predict/48h` o `POST /predict/all`).
2. **Inferencia basada en patrones aprendidos:** En base al estudio y entrenamiento previo sobre patrones de comportamiento de animales similares, el modelo de red neuronal convolucional/recurrente determina probabilísticamente en qué estado clínico estará el animal (`fiebre`, `celo`, `inactividad`, `anomalia`).
3. **Respuesta en probabilidades puras:** `ml-service` retorna exclusivamente un JSON con las probabilidades continuas calculadas (entre 0.0 y 1.0) para cada evento o etapa. **No aplica ni decide umbrales de alarma**.
4. **Decisión de negocio en el Backend:** Con esa respuesta JSON, el backend NestJS aplica sus propios umbrales clínicos (`ML_HEALTH_THRESHOLDS`), evalúa si amerita disparar una alerta (`[IA:EVENTO]`) y persiste la predicción para auditoría.

---

## 3. Comandos Rápidos de Desarrollo

### Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev   # Servidor en http://localhost:3000
npm test            # Tests unitarios con Jest
```

### Frontend (Next.js)
```bash
cd frontend
pnpm install
pnpm dev            # Servidor en http://localhost:3001
```

### ML Service (Python / FastAPI)
```bash
cd ml-service
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
.venv/bin/pytest -v  # Tests del microservicio
```
