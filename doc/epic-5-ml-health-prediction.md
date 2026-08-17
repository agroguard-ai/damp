# Epic 5: Inferencia ML y Detección Temprana de Enfermedades

* **Autor**: Antigravity (versión original) — actualizado por Claude (sesión con Santino)
* **Fecha de Creación**: 09/07/2026
* **Última actualización**: 17/08/2026
* **Estado**: Modelo LSTM real entrenado y validado en `damp-ml-api`. **No conectado** al backend todavía — ver sección 5.

> **Aviso sobre la versión anterior de este doc**: describía como "Completado" una integración (`iot.service.ts` → `ml-service` → alertas `HEALTH` con cooldown de 1h) que **fue eliminada del código el 14/07/2026**, 5 días después de escrita, y nunca se restauró. Confirmado con `git log -p` sobre `backend/src/iot/iot.service.ts`. El microservicio `ml-service` (sección 2 de abajo) sigue existiendo tal como se documentó, pero desconectado. Lo que reemplazó esa integración en la práctica es la heurística por umbrales de `epic-4-cerco-electrico-virtual-alertas.md` (sección 4) — no es el modelo de ML, es una regla simple mientras no hubiera modelo real.

## 1. Qué existe ahora (17/08/2026)

### 1.1 Modelo LSTM multitarea (nuevo, `damp-ml-api`)

Se armó y entrenó el modelo LSTM multitarea que el proyecto siempre documentó como objetivo pero nunca existió en código (confirmado: hasta esta sesión, `damp-ml-api` solo tenía el generador de datos sintéticos, cero código de modelo). Detalle completo, arquitectura y cómo reproducirlo: [`damp-ml-api/README.md`](../../damp-ml-api/README.md).

**Resumen**: LSTM bidireccional + LSTM, tronco compartido, 4 cabezas de salida (fiebre/celo/inactividad/anomalía). Entrada: ventana de 24hs de telemetría. Predicción: si cada evento va a estar activo en las próximas 6hs (tarea genuinamente predictiva, no clasificación del instante actual). Entrenado y evaluado contra un hold-out set (test, 15% de los animales, nunca visto durante entrenamiento ni ajuste de umbral) generado 100% con datos sintéticos de `generador.py` — no hay ni va a haber datos de campo reales (limitación de alcance conocida y aceptada, ver `CLAUDE.md`).

**Métricas reales sobre el test set** (no simuladas, corridas el 17/08/2026 — ver `damp-ml-api/machine-learning/outputs/artifacts/metrics_report.json` para el detalle completo):

| Evento | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|
| Fiebre | 0.968 | 0.757 | 0.850 | 0.902 |
| Celo | 0.849 | 0.772 | 0.809 | 0.994 |
| Inactividad | 0.959 | 0.861 | 0.908 | 0.944 |
| Anomalía | 0.781 | 0.410 | 0.538 | 0.734 |

`anomalía` es notoriamente el evento más difícil de predecir — tiene sentido: es la categoría más rara en los datos (0.72% de las ventanas) y, por diseño del propio generador sintético, es la menos "fisiológicamente coherente" de las cuatro (combina distancia y pasos elevados sin un patrón único, es un poco un cajón de sastre). No se infló ni se ocultó este resultado — queda documentado tal cual salió.

### 1.2 Microservicio Python (`/ml-service`) — sin cambios, sigue siendo un stub

Todo lo de la sección 2/3 de abajo (contrato del microservicio, reglas fijas de fiebre >39.5°C / hipotermia <37°C / inactividad por drift Haversine) **sigue describiendo el código real de `damp/ml-service/main.py` tal cual está hoy** — no se tocó en esta sesión. Sigue siendo un stub por reglas, no carga ningún modelo entrenado, y **no está conectado al backend**.

## 2. Contrato del Microservicio de Inferencia (Python FastAPI) — histórico, vigente en el código pero desconectado

* **Endpoint**: `POST http://localhost:8000/predict/health`
* **Request Body (JSON)**:
  ```json
  {
    "animal_id": "uuid-del-animal",
    "readings": [
      { "temperature": 39.7, "lat": -33.3082, "lng": -61.8742, "timestamp": "2026-07-09T17:40:00.000Z" }
    ]
  }
  ```
* **Response Body (200 OK - Anomaly Detected)**:
  ```json
  { "animal_id": "uuid-del-animal", "anomaly_detected": true, "confidence": 0.89, "type": "Fiebre", "avg_temperature": 39.8, "position_drift_m": 12.3 }
  ```

## 3. Estructura del Código del Microservicio (sin cambios)

* **`ml-service/requirements.txt`**: `fastapi`, `uvicorn`, `scikit-learn`, `pandas`, `numpy` (los últimos tres declarados pero no usados por el stub actual).
* **`ml-service/main.py`**: servidor FastAPI, validación Pydantic, Haversine para inactividad, lógica de inferencia **por reglas fijas**, no por modelo.
* **`ml-service/Dockerfile`**: imagen `python:3.11-slim`.

## 4. Mapa del Código

| Capa | Archivo | Estado |
|---|---|---|
| Generador de datos | `damp-ml-api/machine-learning/data-generator/generador.py` | Sin cambios, sigue siendo el que genera el dataset de entrenamiento |
| Preprocesamiento | `damp-ml-api/machine-learning/model/preprocess.py` | **Nuevo** — ventaneo temporal + split por animal |
| Arquitectura | `damp-ml-api/machine-learning/model/model.py` | **Nuevo** — LSTM multitarea |
| Entrenamiento/evaluación | `damp-ml-api/machine-learning/model/train.py` | **Nuevo** |
| Modelo entrenado | `damp-ml-api/machine-learning/outputs/artifacts/final_model.keras` | **Nuevo** — generado localmente, no versionado (pesado, va en `.gitignore` de `outputs/`) |
| Microservicio (sin cambios) | `damp/ml-service/main.py` | Stub por reglas, desconectado del backend |
| Backend (sin cambios) | `backend/src/iot/iot.service.ts` | Heurística propia por umbrales (ver `epic-4`), no llama a `ml-service` ni al modelo nuevo |

## 5. Lo que falta para que esto sea "CU014 completo" (no se hizo en esta sesión)

1. **Exportar/servir el modelo real desde `ml-service`**: reescribir `ml-service/main.py` para cargar `final_model.keras` (+ `scaler.joblib` + `thresholds.joblib` de `damp-ml-api/machine-learning/outputs/`) y hacer inferencia real en `POST /predict/health`, en vez de las reglas fijas actuales.
2. **Decidir la relación con la heurística de `iot.service.ts`** (fiebre/hipotermia/inactividad por umbral, `epic-4` sección 4): ¿la reemplaza el modelo, o coexisten? El modelo cubre 4 eventos (agrega `celo` y `anomalía`, que la heurística actual no detecta en absoluto) y predice a futuro, no solo el instante actual — es estrictamente más capaz, pero reemplazarla implica repensar qué significan los umbrales configurables de `AlertSettings` (CU016) en ese nuevo esquema.
3. **Re-conectar `iot.service.ts` → `ml-service`**: la llamada fire-and-forget que describía la versión vieja de este doc ya no existe en el código; hay que reconstruirla apuntando al servicio real, no al stub.

Ninguno de estos tres pasos se hizo — quedó fuera del alcance de "crear el modelo", que era el pedido concreto de esta sesión.
