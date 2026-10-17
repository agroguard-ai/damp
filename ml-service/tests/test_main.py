"""
Tests del microservicio de inferencia (ml-service/main.py).

Los tests de feature engineering y de las respuestas de la API funcionan
siempre, con o sin el modelo real copiado en ml-service/model/ (se simula
el bundle con monkeypatch). El test de integración end-to-end contra el
modelo real se salta automáticamente si esos artefactos no están presentes
localmente (no se versionan en este repo, ver model/.gitignore).
"""

import math
import os

import numpy as np
import pytest
from fastapi.testclient import TestClient

import main as ml_main

MODEL_ARTIFACTS_PRESENT = os.path.exists(os.path.join(ml_main.MODEL_DIR, "final_model.keras"))


def _reading(temperature, lat, lng, timestamp):
    return ml_main.TelemetryReading(temperature=temperature, lat=lat, lng=lng, timestamp=timestamp)


class TestHaversine:
    def test_zero_distance_for_same_point(self):
        assert ml_main.haversine_meters(-33.30, -61.87, -33.30, -61.87) == pytest.approx(0.0, abs=1e-6)

    def test_known_distance_one_degree_latitude(self):
        # 1 grado de latitud son ~111.19 km, independientemente de la longitud.
        d = ml_main.haversine_meters(0.0, 0.0, 1.0, 0.0)
        assert d == pytest.approx(111_195, rel=0.01)


class TestBuildFeatureMatrix:
    @pytest.fixture(autouse=True)
    def fixed_feature_cols(self, monkeypatch):
        monkeypatch.setattr(ml_main.bundle, "feature_cols",
                             ["temp_corporal", "distancia_rodeo", "es_noche", "sexo_num", "hour_sin", "hour_cos"])

    def test_column_order_and_values_for_single_reading(self):
        readings = [_reading(38.7, -33.30, -61.87, "2026-08-25T03:00:00.000Z")]
        X = ml_main.build_feature_matrix(readings, sex="MALE")

        assert X.shape == (1, 6)
        temp, dist, es_noche, sexo_num, hour_sin, hour_cos = X[0]
        assert temp == pytest.approx(38.7)
        assert dist == pytest.approx(0.0)  # primera lectura, no hay anterior contra la cual medir distancia
        assert es_noche == 1.0  # 03:00 cae en la ventana de noche (>=22 or <6)
        assert sexo_num == 1.0  # MALE

    def test_distancia_rodeo_uses_haversine_against_previous_reading(self):
        readings = [
            _reading(38.5, 0.0, 0.0, "2026-08-25T10:00:00.000Z"),
            _reading(38.5, 1.0, 0.0, "2026-08-25T10:30:00.000Z"),
        ]
        X = ml_main.build_feature_matrix(readings, sex="FEMALE")
        assert X[0, 1] == pytest.approx(0.0)
        assert X[1, 1] == pytest.approx(111_195, rel=0.01)

    def test_sexo_num_defaults_to_zero_when_sex_missing(self):
        readings = [_reading(38.5, 0.0, 0.0, "2026-08-25T10:00:00.000Z")]
        X = ml_main.build_feature_matrix(readings, sex=None)
        assert X[0, 3] == 0.0

    def test_es_noche_is_false_at_midday(self):
        readings = [_reading(38.5, 0.0, 0.0, "2026-08-25T14:00:00.000Z")]
        X = ml_main.build_feature_matrix(readings, sex=None)
        assert X[0, 2] == 0.0

    def test_uses_distance_m_from_backend_when_present(self):
        readings = [
            ml_main.TelemetryReading(temperature=38.5, lat=0.0, lng=0.0, timestamp="2026-08-25T10:00:00-03:00", distance_m=12.0),
            ml_main.TelemetryReading(temperature=38.5, lat=1.0, lng=0.0, timestamp="2026-08-25T10:30:00-03:00", distance_m=340.5),
        ]
        X = ml_main.build_feature_matrix(readings, sex=None)
        assert X[0, 1] == pytest.approx(12.0)
        assert X[1, 1] == pytest.approx(340.5)  # no usa Haversine (serían ~111 km)

    def test_local_offset_defines_night(self):
        # 23:00 hora local argentina = 02:00 UTC del día siguiente: tiene que contar como noche
        # por la hora local (el dataset de entrenamiento está en hora local)
        readings = [_reading(38.5, 0.0, 0.0, "2026-08-25T23:00:00-03:00")]
        X = ml_main.build_feature_matrix(readings, sex=None)
        assert X[0, 2] == 1.0
        # 12:00 local (15:00 UTC) no es de noche
        X = ml_main.build_feature_matrix([_reading(38.5, 0.0, 0.0, "2026-08-25T12:00:00-03:00")], sex=None)
        assert X[0, 2] == 0.0


class _FakeModel:
    def predict(self, X, verbose=0):
        return {"fiebre": np.array([[0.8]]), "celo": np.array([[0.1]])}


class _IdentityScaler:
    def transform(self, X):
        return X


class TestPredictHealthWithFakeModel:
    @pytest.fixture(autouse=True)
    def fake_bundle(self, monkeypatch):
        monkeypatch.setattr(ml_main.bundle, "load_error", None)
        monkeypatch.setattr(ml_main.bundle, "lookback", 2)
        monkeypatch.setattr(ml_main.bundle, "model", _FakeModel())
        monkeypatch.setattr(ml_main.bundle, "scaler", _IdentityScaler())
        monkeypatch.setattr(ml_main.bundle, "thresholds", {"fiebre": 0.5, "celo": 0.5})
        monkeypatch.setattr(ml_main.bundle, "event_labels", ["fiebre", "celo"])
        monkeypatch.setattr(ml_main.bundle, "feature_cols",
                            ["temp_corporal", "distancia_rodeo", "es_noche", "sexo_num", "hour_sin", "hour_cos"])

    def _request(self, include_features):
        readings = [
            ml_main.TelemetryReading(temperature=39.8, lat=0.0, lng=0.0, timestamp="2026-08-25T10:00:00-03:00", distance_m=50.0),
            ml_main.TelemetryReading(temperature=40.1, lat=0.0, lng=0.0, timestamp="2026-08-25T10:30:00-03:00", distance_m=20.0),
        ]
        return ml_main.PredictionRequest(animal_id="a1", sex="FEMALE", readings=readings, include_features=include_features)

    def test_detects_events_over_threshold(self):
        response = ml_main.predict_health(self._request(False))
        assert response.ready is True
        assert response.events["fiebre"].detected is True
        assert response.events["celo"].detected is False
        assert response.features is None

    def test_returns_unscaled_features_when_requested(self):
        response = ml_main.predict_health(self._request(True))
        assert len(response.features) == 2
        last = response.features[-1]
        assert last.timestamp == "2026-08-25T10:30:00-03:00"
        assert last.values["temp_corporal"] == pytest.approx(40.1)
        assert last.values["distancia_rodeo"] == pytest.approx(20.0)


class TestPredictHealthWithoutModel:
    def test_returns_503_when_model_failed_to_load(self, monkeypatch):
        monkeypatch.setattr(ml_main.bundle, "load_error", "artefactos no encontrados (simulado en test)")
        request = ml_main.PredictionRequest(animal_id="a1", sex="MALE", readings=[])
        with pytest.raises(Exception):  # HTTPException
            ml_main.predict_health(request)


class TestPredictHealthInsufficientWindow:
    def test_ready_false_when_fewer_readings_than_lookback(self, monkeypatch):
        monkeypatch.setattr(ml_main.bundle, "load_error", None)
        monkeypatch.setattr(ml_main.bundle, "lookback", 48)
        readings = [_reading(38.5, 0.0, 0.0, f"2026-08-25T{h:02d}:00:00.000Z") for h in range(5)]
        request = ml_main.PredictionRequest(animal_id="a1", sex="MALE", readings=readings)

        response = ml_main.predict_health(request)
        assert response.ready is False
        assert response.window_size == 5
        assert response.required_window_size == 48
        assert response.events == {}


@pytest.mark.skipif(not MODEL_ARTIFACTS_PRESENT, reason="Modelo real no copiado en ml-service/model/ (ver model/.gitignore)")
class TestPredictHealthEndToEndWithRealModel:
    def test_health_endpoint_reports_model_loaded(self):
        client = TestClient(ml_main.app)
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["model_loaded"] is True
        assert body["required_window_size"] == ml_main.bundle.lookback

    def test_predict_endpoint_with_full_window_returns_all_events(self):
        client = TestClient(ml_main.app)
        lookback = ml_main.bundle.lookback
        readings = [
            {"temperature": 38.5 + 0.01 * i, "lat": -33.30 + i * 0.0001, "lng": -61.87,
             "timestamp": f"2026-08-{(i // 24) % 28 + 1:02d}T{i % 24:02d}:00:00.000Z"}
            for i in range(lookback)
        ]
        res = client.post("/predict/health", json={"animal_id": "a1", "sex": "FEMALE", "readings": readings})
        assert res.status_code == 200
        body = res.json()
        assert body["ready"] is True
        assert set(body["events"].keys()) == set(ml_main.bundle.event_labels)
        for event in body["events"].values():
            assert 0.0 <= event["probability"] <= 1.0
