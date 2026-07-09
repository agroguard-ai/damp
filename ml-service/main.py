"""
DAMP Agro — ML Health Prediction Microservice
=============================================
FastAPI microservice that analyzes animal biometric telemetry
(temperature, position drift) and predicts early signs of disease.

Endpoint:
  POST /predict/health

Currently uses a rule-based stub model. In production, this will
load a trained scikit-learn pipeline (.pkl) or TensorFlow/Keras
model (.h5) for time-series anomaly detection (RNN/LSTM).
"""

import math
from datetime import datetime
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="DAMP Agro ML Service",
    description="Microservicio de inferencia ML para detección temprana de enfermedades en ganado.",
    version="0.1.0",
)


# ── Schemas ──────────────────────────────────────────────────────

class TelemetryReading(BaseModel):
    temperature: float
    lat: float
    lng: float
    timestamp: str


class PredictionRequest(BaseModel):
    animal_id: str
    readings: list[TelemetryReading]


class PredictionResponse(BaseModel):
    animal_id: str
    anomaly_detected: bool
    confidence: float
    type: Optional[str] = None
    avg_temperature: Optional[float] = None
    position_drift_m: Optional[float] = None


# ── Utilities ────────────────────────────────────────────────────

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two lat/lng coordinates."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def compute_position_drift(readings: list[TelemetryReading]) -> float:
    """Sum of distances between consecutive readings (total drift in meters)."""
    total = 0.0
    for i in range(1, len(readings)):
        total += haversine_distance(
            readings[i - 1].lat, readings[i - 1].lng,
            readings[i].lat, readings[i].lng,
        )
    return total


# ── Stub Model ───────────────────────────────────────────────────
#
# This is a placeholder for a real ML model.
# In production, replace this with:
#   import joblib
#   model = joblib.load("models/health_model.pkl")
#   prediction = model.predict(features)
#
# The stub uses simple thresholds derived from veterinary research:
#   - Normal bovine body temperature: 37.8°C – 39.3°C
#   - Fever threshold: > 39.5°C sustained
#   - Hypothermia threshold: < 37.0°C sustained
#   - Inactivity: total drift < 5 meters over 10 readings (~5 minutes)

FEVER_THRESHOLD = 39.5
HYPOTHERMIA_THRESHOLD = 37.0
INACTIVITY_DRIFT_THRESHOLD_M = 5.0  # meters


def predict_health(request: PredictionRequest) -> PredictionResponse:
    """
    Stub prediction engine — rule-based anomaly detection.
    Returns anomaly_detected=true if temperature or inactivity
    thresholds are exceeded.
    """
    if not request.readings:
        return PredictionResponse(
            animal_id=request.animal_id,
            anomaly_detected=False,
            confidence=0.0,
        )

    temperatures = [r.temperature for r in request.readings]
    avg_temp = sum(temperatures) / len(temperatures)
    drift = compute_position_drift(request.readings)

    anomaly_detected = False
    anomaly_type = None
    confidence = 0.0

    # Temperature anomaly detection
    if avg_temp > FEVER_THRESHOLD:
        anomaly_detected = True
        anomaly_type = "Fiebre"
        # Confidence scales with how far above threshold
        confidence = min(0.99, 0.7 + (avg_temp - FEVER_THRESHOLD) * 0.15)
    elif avg_temp < HYPOTHERMIA_THRESHOLD:
        anomaly_detected = True
        anomaly_type = "Hipotermia"
        confidence = min(0.99, 0.7 + (HYPOTHERMIA_THRESHOLD - avg_temp) * 0.15)

    # Inactivity detection (only if we have multiple readings)
    if len(request.readings) >= 3 and drift < INACTIVITY_DRIFT_THRESHOLD_M:
        if anomaly_detected:
            anomaly_type = f"{anomaly_type} + Inactividad"
            confidence = min(0.99, confidence + 0.1)
        else:
            anomaly_detected = True
            anomaly_type = "Inactividad"
            confidence = min(0.99, 0.65 + (INACTIVITY_DRIFT_THRESHOLD_M - drift) * 0.05)

    return PredictionResponse(
        animal_id=request.animal_id,
        anomaly_detected=anomaly_detected,
        confidence=round(confidence, 2),
        type=anomaly_type,
        avg_temperature=round(avg_temp, 2),
        position_drift_m=round(drift, 2),
    )


# ── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health check endpoint for Docker/orchestration readiness probes."""
    return {"status": "healthy", "service": "ml-health-prediction", "version": "0.1.0"}


@app.post("/predict/health", response_model=PredictionResponse)
def predict_health_endpoint(request: PredictionRequest):
    """
    Predict health anomalies from a window of telemetry readings.

    Receives the last N readings for an animal and returns whether
    an anomaly (fever, hypothermia, inactivity) was detected.
    """
    return predict_health(request)
