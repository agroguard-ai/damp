"""
DAMP Agro — ML Health Prediction Microservice (Dual Cadence: 6h & 48h)
======================================================================
FastAPI microservice that loads the trained models:
  1. Short-Term Model (6h): Predicts acute events (fiebre, celo, inactividad, anomalía)
     for the upcoming 6 hours using a lightweight window (default: 12h = 24 blocks).
  2. Trajectory Model (48h): Predicts the sequence of clinical states across 4 stages
     of 12 hours ('0-12h', '12-24h', '24-36h', '36-48h'), detecting passed states
     even if the animal recovers at the end.

Endpoints:
  GET  /health
  POST /predict/health         (or /predict/6h)
  POST /predict/48h            (or /predict/trajectory-48h)
  POST /predict/all            (both 6h and 48h in one call)
"""

import math
import os
from datetime import datetime
from typing import Dict, List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from tensorflow import keras

from pipeline.features import (
    BLOCK_MINUTES,
    EVENT_LABELS,
    FEATURE_COLS,
    NIGHT_END_HOUR,
    NIGHT_START_HOUR,
    STAGES_48H,
    compute_feature_row,
    haversine_meters,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

app = FastAPI(
    title="DAMP Agro ML Service",
    description="Microservicio de inferencia: predicción táctica a 6h y trayectoria de estados a 48h.",
    version="2.0.0",
)


# ── Schemas ──────────────────────────────────────────────────────

class TelemetryReading(BaseModel):
    """Un bloque de 30 min de telemetría."""
    temperature: float
    lat: float
    lng: float
    timestamp: str  # ISO 8601 con offset horario local del campo (p. ej. -03:00)
    distance_m: Optional[float] = None  # metros recorridos en el bloque


class PredictionRequest(BaseModel):
    animal_id: str
    sex: Optional[str] = None  # "MALE" | "FEMALE"
    readings: List[TelemetryReading]
    include_features: bool = False


class EventPrediction(BaseModel):
    probability: float


class FeatureRow(BaseModel):
    """Features sin escalar de un bloque."""
    timestamp: str
    values: Dict[str, float]


class PredictionResponse(BaseModel):
    animal_id: str
    ready: bool
    window_size: int
    required_window_size: int
    events: Dict[str, EventPrediction] = {}
    features: Optional[List[FeatureRow]] = None


# Schemas para Modelo de 48h (Trayectoria)

class StagePrediction(BaseModel):
    stage: str
    probabilities: Dict[str, float]


class PassedStateSummary(BaseModel):
    max_probability: float
    peak_stage: str


class TrajectoryPredictionResponse(BaseModel):
    animal_id: str
    ready: bool
    window_size: int
    required_window_size: int
    passed_states_summary: Dict[str, PassedStateSummary] = {}
    trajectory_stages: List[StagePrediction] = []


class CombinedPredictionResponse(BaseModel):
    animal_id: str
    prediction_6h: Optional[PredictionResponse] = None
    trajectory_48h: Optional[TrajectoryPredictionResponse] = None


# ── Carga de Modelos y Artefactos ────────────────────────────────

class ModelBundle:
    def __init__(self):
        self.model = None
        self.model_6h = None
        self.model_48h = None
        self.scaler = None
        self.thresholds = None
        self.metadata = None
        self.feature_cols = FEATURE_COLS
        self.event_labels = EVENT_LABELS
        self.lookback_6h = 24
        self.lookback_48h = 96
        self.lookback = 24  # compatibilidad con clientes existentes
        self.version = "unknown"
        self.trained_at = None
        self.load_error = None

    def load(self):
        try:
            target_dir = MODEL_DIR
            requested_version = os.environ.get("MODEL_VERSION")
            if requested_version:
                v_dir = os.path.join(MODEL_DIR, "versions", requested_version)
                if os.path.isdir(v_dir):
                    target_dir = v_dir

            # 1. Cargar modelo 6h
            model_6h_file = os.path.join(target_dir, "model_6h.keras")
            if not os.path.exists(model_6h_file):
                model_6h_file = os.path.join(target_dir, "final_model.keras")
            self.model_6h = keras.models.load_model(model_6h_file)
            self.model = self.model_6h  # alias

            # 2. Cargar modelo 48h si existe
            model_48h_file = os.path.join(target_dir, "model_48h.keras")
            if os.path.exists(model_48h_file):
                self.model_48h = keras.models.load_model(model_48h_file)

            # 3. Scaler, Thresholds y Metadata
            self.scaler = joblib.load(os.path.join(target_dir, "scaler.joblib"))
            self.thresholds = joblib.load(os.path.join(target_dir, "thresholds.joblib"))
            self.metadata = joblib.load(os.path.join(target_dir, "metadata.joblib"))

            self.feature_cols = self.metadata.get("feature_cols", FEATURE_COLS)
            self.event_labels = [label.replace("label_", "") for label in self.metadata.get("event_labels", EVENT_LABELS)]
            self.lookback_6h = self.metadata.get("lookback_6h", self.metadata.get("lookback", 24))
            self.lookback_48h = self.metadata.get("lookback_48h", 96)
            self.lookback = self.lookback_6h
            self.version = self.metadata.get("version", "legacy")
            self.trained_at = self.metadata.get("trained_at", None)
        except Exception as exc:  # noqa: BLE001
            self.load_error = str(exc)


bundle = ModelBundle()
bundle.load()


# ── Feature Engineering ──────────────────────────────────────────

def build_feature_matrix(readings: List[TelemetryReading], sex: Optional[str]) -> np.ndarray:
    """Extrae la matriz de features sin escalar en el orden exacto de FEATURE_COLS."""
    rows = []
    prev = None
    for r in readings:
        if r.distance_m is not None:
            distancia = r.distance_m
        else:
            distancia = 0.0 if prev is None else haversine_meters(prev.lat, prev.lng, r.lat, r.lng)
        prev = r

        f_row = compute_feature_row(r.temperature, distancia, r.timestamp, sex)
        rows.append(f_row)

    return np.array(rows, dtype="float32")


# ── Lógica de Predicción ─────────────────────────────────────────

def predict_health(request: PredictionRequest) -> PredictionResponse:
    if bundle.load_error:
        raise HTTPException(status_code=503, detail=f"Modelo no disponible: {bundle.load_error}")

    readings = sorted(request.readings, key=lambda r: r.timestamp)
    window_size = len(readings)
    req_lookback = getattr(bundle, "lookback_6h", bundle.lookback)

    # Si vienen menos bloques que los requeridos por el modelo de 6h
    if window_size < req_lookback:
        return PredictionResponse(
            animal_id=request.animal_id,
            ready=False,
            window_size=window_size,
            required_window_size=req_lookback,
        )

    # Tomar los últimos req_lookback bloques
    window = readings[-req_lookback:]
    X = build_feature_matrix(window, request.sex)
    X_scaled = bundle.scaler.transform(X).astype("float32")
    X_scaled = X_scaled.reshape(1, req_lookback, len(bundle.feature_cols))

    raw_preds = bundle.model_6h.predict(X_scaled, verbose=0)

    features = None
    if request.include_features:
        features = [
            FeatureRow(timestamp=r.timestamp, values={col: round(float(v), 4) for col, v in zip(bundle.feature_cols, row)})
            for r, row in zip(window, X)
        ]

    events = {}
    for name in bundle.event_labels:
        prob = float(np.asarray(raw_preds[name]).ravel()[0])
        events[name] = EventPrediction(probability=round(prob, 4))

    return PredictionResponse(
        animal_id=request.animal_id,
        ready=True,
        window_size=window_size,
        required_window_size=req_lookback,
        events=events,
        features=features,
    )


def predict_trajectory_48h(request: PredictionRequest) -> TrajectoryPredictionResponse:
    if bundle.load_error or bundle.model_48h is None:
        raise HTTPException(status_code=503, detail="Modelo de trayectoria de 48h no disponible.")

    readings = sorted(request.readings, key=lambda r: r.timestamp)
    window_size = len(readings)

    if window_size < bundle.lookback_48h:
        return TrajectoryPredictionResponse(
            animal_id=request.animal_id,
            ready=False,
            window_size=window_size,
            required_window_size=bundle.lookback_48h,
        )

    window = readings[-bundle.lookback_48h:]
    X = build_feature_matrix(window, request.sex)
    X_scaled = bundle.scaler.transform(X).astype("float32")
    X_scaled = X_scaled.reshape(1, bundle.lookback_48h, len(bundle.feature_cols))

    raw_preds = bundle.model_48h.predict(X_scaled, verbose=0)

    stage_labels = ["0-12h", "12-24h", "24-36h", "36-48h"]
    stages_res = []
    max_event_probs = {e: 0.0 for e in bundle.event_labels}
    peak_stages = {e: "0-12h" for e in bundle.event_labels}

    for s_idx, stage_name in enumerate(STAGES_48H):
        probs = raw_preds[stage_name][0]
        stage_dict = {}

        for e_idx, event in enumerate(bundle.event_labels):
            p = float(probs[e_idx])
            stage_dict[event] = round(p, 4)
            if p > max_event_probs[event]:
                max_event_probs[event] = p
                peak_stages[event] = stage_labels[s_idx]

        stages_res.append(
            StagePrediction(
                stage=stage_labels[s_idx],
                probabilities=stage_dict,
            )
        )

    passed_summary = {}
    for event in bundle.event_labels:
        mp = max_event_probs[event]
        passed_summary[event] = PassedStateSummary(
            max_probability=round(mp, 4),
            peak_stage=peak_stages[event],
        )

    return TrajectoryPredictionResponse(
        animal_id=request.animal_id,
        ready=True,
        window_size=window_size,
        required_window_size=bundle.lookback_48h,
        passed_states_summary=passed_summary,
        trajectory_stages=stages_res,
    )


# ── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy" if not bundle.load_error else "degraded",
        "service": "ml-health-prediction",
        "version": "2.0.0",
        "model_version": bundle.version,
        "trained_at": bundle.trained_at,
        "model_loaded": bundle.model_6h is not None,
        "model_6h_loaded": bundle.model_6h is not None,
        "model_48h_loaded": bundle.model_48h is not None,
        "model_load_error": bundle.load_error,
        "event_labels": bundle.event_labels,
        "required_window_size": bundle.lookback_6h,
        "required_window_size_6h": bundle.lookback_6h,
        "required_window_size_48h": bundle.lookback_48h,
        "stages_48h": ["0-12h", "12-24h", "24-36h", "36-48h"],
    }


@app.post("/predict/health", response_model=PredictionResponse)
@app.post("/predict/6h", response_model=PredictionResponse)
def predict_health_endpoint(request: PredictionRequest):
    """
    Predice si cada evento de salud estará activo en las próximas 6hs.
    Requiere al menos `required_window_size_6h` bloques (default: 24 bloques = 12h).
    """
    return predict_health(request)


@app.post("/predict/48h", response_model=TrajectoryPredictionResponse)
@app.post("/predict/trajectory-48h", response_model=TrajectoryPredictionResponse)
def predict_trajectory_endpoint(request: PredictionRequest):
    """
    Predice la trayectoria y estados por los que pasará el animal en las próximas 48hs
    en 4 etapas de 12hs ('0-12h', '12-24h', '24-36h', '36-48h') y su estado final.
    Requiere al menos `required_window_size_48h` bloques (96 bloques = 48h).
    """
    return predict_trajectory_48h(request)


@app.post("/predict/all", response_model=CombinedPredictionResponse)
def predict_all_endpoint(request: PredictionRequest):
    """
    Evalúa ambos horizontes (6h y 48h) en una sola llamada.
    """
    pred_6h = None
    pred_48h = None

    if len(request.readings) >= bundle.lookback_6h:
        pred_6h = predict_health(request)
    if len(request.readings) >= bundle.lookback_48h:
        pred_48h = predict_trajectory_48h(request)

    return CombinedPredictionResponse(
        animal_id=request.animal_id,
        prediction_6h=pred_6h,
        trajectory_48h=pred_48h,
    )
