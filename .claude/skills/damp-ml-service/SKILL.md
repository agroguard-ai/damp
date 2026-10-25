---
name: damp-ml-service
description: Guía integral para interactuar, consumir e integrar el microservicio de IA/Machine Learning (damp-ml-service) de predicción de salud bovina. Explica la arquitectura, envío de telemetría, interpretación de probabilidades por etapas (6h y 48h) y manejo de umbrales en el backend.
argument-hint: "[inferencia, entrenamiento, api o integracion-backend]"
license: MIT
metadata:
  version: "2.0.0"
  service: "ml-service"
---

# Microservicio de IA para Predicción de Salud Bovina (damp-ml-service)

Guía para LLMs y desarrolladores sobre el funcionamiento, consumo vía API, pipeline de entrenamiento y arquitectura de integración del servicio de Machine Learning.

---

## 1. Visión General y Arquitectura

El microservicio de IA procesa las series temporales de telemetría generadas por los collares IoT de cada animal (temperatura corporal, posición geográfica, velocidad de desplazamiento, distancia relativa al rodeo y ciclo día/noche).

A partir de patrones aprendidos durante el entrenamiento sobre el histórico de animales similares, el modelo calcula **probabilidades estadísticas continuas (entre 0.0 y 1.0)** de atravesar 4 eventos clínicos:
- `fiebre`: Síndrome febril (temperatura sostenida > 39.5 °C).
- `celo`: Fase de estro reproductivo (incremento de movilidad 2x-3x y leve elevación térmica).
- `inactividad`: Decaimiento o letargo (cese de pastoreo y movilidad mínima).
- `anomalia`: Comportamiento atípico o estrés motor agudo.

### Principio de Separación de Responsabilidades:
- **ML Service (`ml-service`):** Responsabilidad exclusiva de Machine Learning. Recibe la ventana de historia previa, escala variables, ejecuta la inferencia de las redes neuronales y **devuelve únicamente probabilidades puras en formato JSON**. No aplica ni decide umbrales de alarma.
- **Backend (`backend` NestJS):** Dueño de las **reglas de negocio y alarmas**. Recibe el JSON de probabilidades, evalúa los umbrales de decisión (`ML_HEALTH_THRESHOLDS`), genera las alertas clínicas si corresponde (`[IA:EVENTO]`), y persiste la predicción en PostgreSQL/Prisma.

```
[Collar IoT] ──(Telemetría)──> [Backend NestJS]
                                      │
                POST /predict/6h      ▼
              ┌─────────────────────────────────┐
              │     ml-service (FastAPI/Keras)  │
              │  • Convolución temporal + GRU   │
              │  • Salida: Probabilidades puras │
              └─────────────────────────────────┘
                                      │
                   JSON Response      ▼
               { "fiebre": { "probability": 0.499 } }
                                      │
                                      ▼
                               [Backend NestJS]
                   Aplica umbrales de negocio (ej. Fiebre >= 75%)
                   ¿Supera corte? -> Dispara Alerta / Guarda en BD
```

---

## 2. Modelos y Ventanas de Historia Requeridas

La telemetría se procesa agrupada en **bloques de 30 minutos** (48 bloques por día):

| Modelo | Archivo Keras | Entrada Requerida | Salida / Tarea |
| :--- | :--- | :--- | :--- |
| **Modelo 6h** (Corto plazo) | `model_6h.keras` | **24 bloques** (12 horas previas) | Probabilidad de que el evento esté activo en las próximas **6 horas**. |
| **Modelo 48h** (Trayectoria) | `model_48h.keras` | **96 bloques** (48 horas previas) | Probabilidad proyectada en **4 tramos de 12 horas** (`0-12h`, `12-24h`, `24-36h`, `36-48h`) y resumen de estados atravesados. |

> **Nota Crítica sobre Inferencia:**  
> El modelo realiza la predicción **exclusivamente en base a la historia pasada** ($T \le 0$). No requiere proyecciones futuras de temperatura ni regresiones paso a paso; la red neuronal mapea directamente la matriz histórica hacia las probabilidades futuras.

---

## 3. Especificación de la API de Inferencia

El servicio corre por defecto en `http://localhost:8000` (o `http://ml-service:8000` en Docker).

### 3.1. Estructura del Request (`PredictionRequest`)
Se envía un payload JSON con la historia del animal:
```json
{
  "animal_id": "c1f7a0b3-1234-4567-89ab-cdef01234567",
  "sex": "FEMALE",
  "readings": [
    {
      "temperature": 38.65,
      "lat": -33.3012,
      "lng": -61.8745,
      "timestamp": "2026-09-02T10:00:00-03:00",
      "distance_m": 24.5
    }
  ],
  "include_features": false
}
```

* `temperature`: Grados Celsius medidos por el collar.
* `lat`, `lng`: Coordenadas GPS del collar (si `distance_m` no se envía, se calcula la distancia mediante la fórmula de Haversine con la lectura anterior).
* `timestamp`: Fecha y hora en formato ISO 8601 con huso horario local (importante para el cálculo circadiano día/noche).
* `distance_m` *(opcional)*: Metros recorridos en ese bloque de 30 minutos.

---

### 3.2. Endpoints Principales

#### `GET /health`
Verifica la disponibilidad del servicio y los modelos cargados en memoria.
```json
{
  "status": "healthy",
  "service": "ml-health-prediction",
  "version": "2.0.0",
  "model_version": "20261024_194122",
  "model_loaded": true,
  "required_window_size_6h": 24,
  "required_window_size_48h": 96
}
```

#### `POST /predict/6h` (o `/predict/health`)
Predice la probabilidad inmediata a corto plazo (requiere $\ge 24$ lecturas).

**Respuesta JSON:**
```json
{
  "animal_id": "c1f7a0b3-1234-4567-89ab-cdef01234567",
  "ready": true,
  "window_size": 24,
  "required_window_size": 24,
  "events": {
    "fiebre": { "probability": 0.4991 },
    "celo": { "probability": 0.0204 },
    "inactividad": { "probability": 0.0012 },
    "anomalia": { "probability": 0.0033 }
  }
}
```
*Si `window_size < required_window_size`, responde `ready: false` y `events: {}` sin fallar.*

#### `POST /predict/48h`
Proyecta la evolución temporal en 4 etapas sucesivas (requiere $\ge 96$ lecturas).

**Respuesta JSON:**
```json
{
  "animal_id": "c1f7a0b3-1234-4567-89ab-cdef01234567",
  "ready": true,
  "window_size": 96,
  "required_window_size": 96,
  "passed_states_summary": {
    "fiebre": { "max_probability": 0.1302, "peak_stage": "36-48h" },
    "celo": { "max_probability": 0.0514, "peak_stage": "36-48h" },
    "inactividad": { "max_probability": 0.0361, "peak_stage": "36-48h" },
    "anomalia": { "max_probability": 0.0382, "peak_stage": "0-12h" }
  },
  "trajectory_stages": [
    {
      "stage": "0-12h",
      "probabilities": { "fiebre": 0.0631, "celo": 0.0162, "inactividad": 0.0135, "anomalia": 0.0382 }
    },
    {
      "stage": "12-24h",
      "probabilities": { "fiebre": 0.0854, "celo": 0.0391, "inactividad": 0.0230, "anomalia": 0.0341 }
    },
    {
      "stage": "24-36h",
      "probabilities": { "fiebre": 0.1012, "celo": 0.0423, "inactividad": 0.0271, "anomalia": 0.0380 }
    },
    {
      "stage": "36-48h",
      "probabilities": { "fiebre": 0.1302, "celo": 0.0514, "inactividad": 0.0361, "anomalia": 0.0232 }
    }
  ]
}
```

#### `POST /predict/all`
Ejecuta la predicción combinada (6h y 48h) en una única llamada HTTP. Devuelve `prediction_6h` y `trajectory_48h`.

---

## 4. Integración y Umbrales en el Backend (NestJS)

En el backend NestJS ([backend/src/iot/iot.service.ts](file:///Users/matiasluhmann/src/utn/damp/backend/src/iot/iot.service.ts) y [backend/src/iot/ml-health.service.ts](file:///Users/matiasluhmann/src/utn/damp/backend/src/iot/ml-health.service.ts)), la llamada a la IA se ejecuta en segundo plano tras la ingesta de telemetría:

### 4.1. Umbrales de Decisión en NestJS
```typescript
export const ML_HEALTH_THRESHOLDS: Record<string, number> = {
  fiebre: 0.75,      // 75% certeza para evitar falsas alarmas clínicas
  celo: 0.30,        // 30% para maximizar detección de ventana reproductiva
  inactividad: 0.70, // 70% para descartar reposo nocturno normal
  anomalia: 0.70,    // 70% para eventos atípicos
};
```

### 4.2. Flujo de Decisión en NestJS
```typescript
const result = await this.mlHealthService.predict(animalId, animal?.sex, window.blocks);
if (!result?.ready) return;

for (const [eventName, prediction] of Object.entries(result.events)) {
  const threshold = ML_HEALTH_THRESHOLDS[eventName] ?? 0.5;
  const isDetected = prediction.probability >= threshold;

  let alertId: string | null = null;
  if (isDetected) {
    const alert = await this.raiseHealthAlert(
      animalId,
      `[IA:${eventName.toUpperCase()}]`,
      `Modelo predictivo: posible ${eventName} en las próximas 6hs (probabilidad ${Math.round(prediction.probability * 100)}%).`
    );
    alertId = alert?.id ?? null;
  }

  // Se persiste la predicción para auditoría y reentrenamiento
  await this.prisma.healthPrediction.create({
    data: {
      animalId,
      predictedEvent: eventName,
      probability: prediction.probability,
      threshold,
      detected: isDetected,
      horizonHours: 6,
      windowReadingsCount: window.blocksWithData,
      windowEndAt: windowEnd,
      alertId,
    },
  });
}
```

---

## 5. Pipeline de Entrenamiento y Mantenimiento

Para generar datos o reentrenar modelos, ejecutar en el directorio `ml-service/`:

```bash
cd ml-service

# 1. Generar dataset sintético basado en simulaciones fisiológicas
.venv/bin/python -m pipeline.generate_dataset --animals 80 --days 25

# 2. Entrenar y versionar modelos (guarda en model/versions/<timestamp>/ y activa en model/)
.venv/bin/python -m pipeline.train_models --epochs 15

# 3. Validar inferencia interactiva y exportar dashboards gráficos
.venv/bin/python -m pipeline.visualize_predictions --version latest

# 4. Correr batería de tests
.venv/bin/pytest -v
```

---

## 6. Buenas Prácticas para LLMs al Modificar el Sistema

1. **No mezclar umbrales en `ml-service`:** La API de Python nunca debe dictaminar si una probabilidad es una alarma o no. Mantener la salida como probabilidades flotantes puras.
2. **Preservar la dimensionalidad de entrada:** El modelo de 6h siempre espera `(batch, 24, 6)` y el de 48h siempre espera `(batch, 96, 6)`. Las 6 features deben calcularse con `pipeline/features.py`.
3. **No bloquear la ingesta IoT:** Las llamadas a `mlHealthService.predict()` en NestJS deben correr desacopladas del downlink al collar IoT para que la respuesta al hardware sea instantánea aun si el modelo tarda en responder.
