"""
DAMP Agro — ML Health Prediction Microservice
=============================================
FastAPI microservice that loads the trained multitask LSTM (entrenado y
versionado en el repo damp-ml-api) and predicts, para cada evento de salud
(fiebre, celo, inactividad, anomalía), si va a estar activo en las próximas
6 horas a partir de la ventana de 24hs de telemetría más reciente del animal.

Contrato de features: SOLO usa señales que el collar real puede proveer hoy
o en el corto plazo — temperatura de contacto, posición GPS (de la que se
deriva una distancia recorrida aproximada por Haversine, ya que el collar
todavía no manda ese dato directo) y la hora del día. No usa pasos,
temperatura/humedad ambiente ni días desde el último celo: el hardware no
tiene acelerómetro ni sensor ambiental, y el backend no registra ciclos de
celo — entrenar o inferir con esas columnas ausentes obligaría a rellenarlas
con un valor constante, lo que sesga las predicciones de forma impredecible
en vez de simplemente degradarlas (ver damp-ml-api/README.md).

Endpoint:
  POST /predict/health
"""

import math
import os
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from tensorflow import keras

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

app = FastAPI(
    title="DAMP Agro ML Service",
    description="Microservicio de inferencia del modelo LSTM multitarea de detección predictiva de eventos de salud.",
    version="1.0.0",
)


# ── Schemas ──────────────────────────────────────────────────────

class TelemetryReading(BaseModel):
    temperature: float
    lat: float
    lng: float
    timestamp: str  # ISO 8601


class PredictionRequest(BaseModel):
    animal_id: str
    sex: Optional[str] = None  # "MALE" | "FEMALE" (enum Sex del backend), afecta sexo_num
    readings: list[TelemetryReading]  # orden cronológico, idealmente las últimas `lookback` lecturas


class EventPrediction(BaseModel):
    probability: float
    threshold: float
    detected: bool


class PredictionResponse(BaseModel):
    animal_id: str
    ready: bool
    window_size: int
    required_window_size: int
    events: dict[str, EventPrediction] = {}


# ── Carga del modelo entrenado (falla explícito si no está disponible) ──

class ModelBundle:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.thresholds = None
        self.feature_cols = None
        self.event_labels = None
        self.lookback = None
        self.load_error = None

    def load(self):
        try:
            self.model = keras.models.load_model(os.path.join(MODEL_DIR, "final_model.keras"))
            self.scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.joblib"))
            self.thresholds = joblib.load(os.path.join(MODEL_DIR, "thresholds.joblib"))
            metadata = joblib.load(os.path.join(MODEL_DIR, "metadata.joblib"))
            self.feature_cols = metadata["feature_cols"]
            self.event_labels = [label.replace("label_", "") for label in metadata["event_labels"]]
            self.lookback = metadata["lookback"]
        except Exception as exc:  # noqa: BLE001 — se reporta en /health, no se oculta
            self.load_error = str(exc)


bundle = ModelBundle()
bundle.load()


# ── Feature engineering (debe coincidir exactamente con damp-ml-api/machine-learning/model/preprocess.py) ──

NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 6
BLOCK_MINUTES = 30


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_feature_matrix(readings: list[TelemetryReading], sex: Optional[str]) -> np.ndarray:
    """
    Replica exactamente el feature engineering de preprocess.py (clean()) fila por fila,
    a partir de lecturas crudas del backend. `readings` debe venir ordenado cronológicamente.
    """
    sexo_num = 1.0 if (sex or "").upper() == "MALE" else 0.0

    rows = []
    prev = None
    for r in readings:
        ts = datetime.fromisoformat(r.timestamp.replace("Z", "+00:00"))

        # distancia_rodeo: el collar todavía no manda este dato directo (ver docstring del módulo);
        # se aproxima con la distancia Haversine contra la lectura anterior. Cuando agroguard-firmware
        # empiece a mandar la distancia nativa de los últimos 5 minutos, reemplazar esta línea por
        # el valor recibido directamente — mismo tipo de magnitud (metros recorridos), no debería
        # requerir reentrenar, pero sí verificar que la distribución sea comparable.
        distancia = 0.0 if prev is None else haversine_meters(prev.lat, prev.lng, r.lat, r.lng)
        prev = r

        bloque_horario = (ts.hour * 60 + ts.minute) // BLOCK_MINUTES
        hour_frac = bloque_horario / 2.0
        hour_sin = math.sin(2 * math.pi * hour_frac / 24)
        hour_cos = math.cos(2 * math.pi * hour_frac / 24)
        es_noche = 1.0 if (ts.hour >= NIGHT_START_HOUR or ts.hour < NIGHT_END_HOUR) else 0.0

        feature_row = {
            "temp_corporal": r.temperature,
            "distancia_rodeo": distancia,
            "es_noche": es_noche,
            "sexo_num": sexo_num,
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
        }
        rows.append([feature_row[col] for col in bundle.feature_cols])

    return np.array(rows, dtype="float32")


def predict_health(request: PredictionRequest) -> PredictionResponse:
    if bundle.load_error:
        raise HTTPException(status_code=503, detail=f"Modelo no disponible: {bundle.load_error}")

    readings = sorted(request.readings, key=lambda r: r.timestamp)
    window_size = min(len(readings), bundle.lookback)

    if len(readings) < bundle.lookback:
        return PredictionResponse(
            animal_id=request.animal_id,
            ready=False,
            window_size=len(readings),
            required_window_size=bundle.lookback,
        )

    window = readings[-bundle.lookback:]
    X = build_feature_matrix(window, request.sex)
    X_scaled = bundle.scaler.transform(X).astype("float32")
    X_scaled = X_scaled.reshape(1, bundle.lookback, len(bundle.feature_cols))

    raw_preds = bundle.model.predict(X_scaled, verbose=0)

    events = {}
    for name in bundle.event_labels:
        prob = float(np.asarray(raw_preds[name]).ravel()[0])
        threshold = float(bundle.thresholds.get(name, 0.5))
        events[name] = EventPrediction(probability=round(prob, 4), threshold=threshold, detected=prob >= threshold)

    return PredictionResponse(
        animal_id=request.animal_id,
        ready=True,
        window_size=window_size,
        required_window_size=bundle.lookback,
        events=events,
    )


# ── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy" if not bundle.load_error else "degraded",
        "service": "ml-health-prediction",
        "version": "1.0.0",
        "model_loaded": bundle.load_error is None,
        "model_load_error": bundle.load_error,
        "event_labels": bundle.event_labels,
        "required_window_size": bundle.lookback,
    }


@app.post("/predict/health", response_model=PredictionResponse)
def predict_health_endpoint(request: PredictionRequest):
    """
    Predice, para cada tipo de evento, si va a estar activo en las próximas 6hs
    a partir de la ventana de 24hs de telemetría más reciente del animal.

    Si `readings` tiene menos lecturas que las que el modelo necesita
    (`required_window_size`), devuelve `ready=false` sin intentar predecir —
    no se rellena la ventana con datos inventados.
    """
    return predict_health(request)
