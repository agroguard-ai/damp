# Epic 5: Inferencia ML y Detección Temprana de Enfermedades

* **Autor**: Antigravity
* **Fecha de Creación**: 09/07/2026
* **Estado**: Completado

## 1. Resumen de la Solución Técnica
Esta Epic introduce el motor de **Inferencia de Machine Learning** para la detección temprana de anomalías de salud (como fiebre, hipotermia o inactividad prolongada) a partir de la telemetría recolectada de los collares. 

Para mantener el backend NestJS enfocado y permitir el uso de librerías científicas y de modelos avanzados (como scikit-learn, tensorflow, o pandas), el motor se implementó como un **microservicio independiente en Python** utilizando **FastAPI**.

* **Microservicio Python (`/ml-service`)**:
  * Expone el endpoint de inferencia `POST /predict/health`.
  * Recibe una ventana temporal de las últimas 10 lecturas de telemetría del animal.
  * Implementa un modelo basado en reglas biométricas (veterinarias):
    * **Fiebre**: Temperatura promedio sostenida > 39.5°C.
    * **Hipotermia**: Temperatura promedio sostenida < 37.0°C.
    * **Inactividad**: Desplazamiento acumulado (drift posicional) < 5 metros sobre las 10 lecturas utilizando la fórmula de Haversine.
* **Integración en el Ingestor (NestJS)**:
  * Al procesar cada lote de telemetría en `IotService`, el backend de forma asíncrona (no bloqueante, fire-and-forget) obtiene las últimas 10 lecturas del animal y hace un POST interno a `http://localhost:8000/predict/health` (o la URL configurada por entorno).
* **Alertas de Salud con Cooldown**:
  * Si el microservicio de inferencia retorna `anomaly_detected: true`, se inserta una alerta de tipo `HEALTH` en la tabla `Alert`.
  * Para evitar spam, se implementó un **cooldown de 1 hora** por animal. Si ya existe una alerta de salud activa o resuelta creada en los últimos 60 minutos para ese animal, se omite la creación de la nueva alerta.
* **Orquestación en Producción (Docker)**:
  * Se configuró un entorno multinodo en `docker-compose.yml` que levanta la base de datos (PostgreSQL/PostGIS), el backend principal y el microservicio de Python en una red privada compartida (`damp-network`).

---

## 2. Contrato del Microservicio de Inferencia (Python FastAPI)

* **Endpoint**: `POST http://localhost:8000/predict/health`
* **Request Body (JSON)**:
  ```json
  {
    "animal_id": "uuid-del-animal",
    "readings": [
      {
        "temperature": 39.7,
        "lat": -33.3082,
        "lng": -61.8742,
        "timestamp": "2026-07-09T17:40:00.000Z"
      },
      {
        "temperature": 39.9,
        "lat": -33.3081,
        "lng": -61.8741,
        "timestamp": "2026-07-09T17:41:00.000Z"
      }
    ]
  }
  ```
* **Response Body (200 OK - Anomaly Detected)**:
  ```json
  {
    "animal_id": "uuid-del-animal",
    "anomaly_detected": true,
    "confidence": 0.89,
    "type": "Fiebre",
    "avg_temperature": 39.8,
    "position_drift_m": 12.3
  }
  ```

---

## 3. Estructura del Código del Microservicio

* **`ml-service/requirements.txt`**: Define las librerías necesarias (`fastapi`, `uvicorn`, `scikit-learn`, `pandas`, `numpy`).
* **`ml-service/main.py`**: Código del servidor FastAPI, validación de esquemas con Pydantic, cálculo de distancias geodésicas (Haversine) para inactividad y lógica de inferencia.
* **`ml-service/Dockerfile`**: Genera la imagen liviana de producción basada en `python:3.11-slim`.

---

## 4. Mapa del Código (NestJS Backend)

* **`backend/src/iot/iot.service.ts`**:
  * Ejecuta la llamada asíncrona no bloqueante `this.runMLHealthChecks(animalCollarMap)`.
  * Consulta las últimas 10 lecturas (`TelemetryReading.findMany()`).
  * Valida el cooldown de 1 hora con `prisma.alert.findFirst()` antes de crear la alerta de tipo `HEALTH`.
* **`docker-compose.yml`**: Configuración de redes de red compartidas y variables de entorno para que el backend localice el microservicio vía nombre de contenedor: `ML_SERVICE_URL: http://ml-service:8000`.
