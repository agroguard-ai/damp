"""
DAMP Agro - Shared Feature Engineering & Windowing
==================================================
Módulo compartido de extracción de features y construcción de ventanas temporales
para entrenamiento e inferencia. Evita discrepancias entre el entrenamiento
y el microservicio de producción.
"""

import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

FEATURE_COLS = [
    "temp_corporal",
    "distancia_rodeo",
    "es_noche",
    "sexo_num",
    "hour_sin",
    "hour_cos",
]

EVENT_LABELS = [
    "fiebre",
    "celo",
    "inactividad",
    "anomalia",
]

RAW_LABEL_COLS = [f"label_{e}" for e in EVENT_LABELS]

NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 6
BLOCK_MINUTES = 30
STAGES_48H = ["stage_0_12h", "stage_12_24h", "stage_24_36h", "stage_36_48h"]


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calcula distancia en metros entre dos coordenadas geográficas."""
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return float(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def parse_timestamp(ts: Union[str, datetime, pd.Timestamp]) -> datetime:
    """Parsea un timestamp a datetime con timezone intacto o UTC por defecto."""
    if isinstance(ts, pd.Timestamp):
        return ts.to_pydatetime()
    if isinstance(ts, datetime):
        return ts
    ts_str = str(ts).replace("Z", "+00:00")
    return datetime.fromisoformat(ts_str)


def compute_feature_dict(
    temp_corporal: float,
    distancia_rodeo: float,
    timestamp: Union[str, datetime, pd.Timestamp],
    sex: Optional[str] = None,
) -> Dict[str, float]:
    """Calcula el diccionario de 6 features para un único bloque de 30 min."""
    dt = parse_timestamp(timestamp)
    sexo_num = 1.0 if (sex or "").upper() == "MALE" else 0.0

    bloque_horario = (dt.hour * 60 + dt.minute) // BLOCK_MINUTES
    hour_frac = bloque_horario / 2.0
    hour_sin = math.sin(2 * math.pi * hour_frac / 24.0)
    hour_cos = math.cos(2 * math.pi * hour_frac / 24.0)
    es_noche = 1.0 if (dt.hour >= NIGHT_START_HOUR or dt.hour < NIGHT_END_HOUR) else 0.0

    return {
        "temp_corporal": float(temp_corporal),
        "distancia_rodeo": float(distancia_rodeo),
        "es_noche": float(es_noche),
        "sexo_num": float(sexo_num),
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
    }


def compute_feature_row(
    temp_corporal: float,
    distancia_rodeo: float,
    timestamp: Union[str, datetime, pd.Timestamp],
    sex: Optional[str] = None,
) -> List[float]:
    """Devuelve la fila de features en el orden exacto de FEATURE_COLS."""
    f = compute_feature_dict(temp_corporal, distancia_rodeo, timestamp, sex)
    return [f[col] for col in FEATURE_COLS]


def extract_features_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Asegura que un DataFrame contenga las 6 columnas en FEATURE_COLS
    y las columnas target necesarias.
    """
    out = df.copy()
    if "timestamp" in out.columns and not np.issubdtype(out["timestamp"].dtype, np.datetime64):
        out["dt"] = pd.to_datetime(out["timestamp"])
    elif "timestamp" in out.columns:
        out["dt"] = out["timestamp"]
    else:
        raise ValueError("DataFrame debe contener columna 'timestamp'")

    if "sex" in out.columns:
        out["sexo_num"] = (out["sex"].astype(str).str.upper() == "MALE").astype(float)
    elif "sexo_num" not in out.columns:
        out["sexo_num"] = 0.0

    hours = out["dt"].dt.hour
    minutes = out["dt"].dt.minute
    block = (hours * 60 + minutes) // BLOCK_MINUTES
    hour_frac = block / 2.0
    out["hour_sin"] = np.sin(2 * np.pi * hour_frac / 24.0)
    out["hour_cos"] = np.cos(2 * np.pi * hour_frac / 24.0)
    out["es_noche"] = ((hours >= NIGHT_START_HOUR) | (hours < NIGHT_END_HOUR)).astype(float)

    if "distancia_rodeo" not in out.columns and "distance_m" in out.columns:
        out["distancia_rodeo"] = out["distance_m"].astype(float)

    for col in FEATURE_COLS:
        if col not in out.columns:
            raise ValueError(f"Falta columna requerida: {col}")

    return out


def build_windows_6h(
    df: pd.DataFrame,
    lookback: int = 24,
    horizon: int = 12,
    stride: int = 2,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Construye ventanas deslizantes para el modelo de 6 horas.
    - lookback: cantidad de bloques de entrada (ej: 24 bloques de 30m = 12h)
    - horizon: cantidad de bloques de predicción (12 bloques de 30m = 6h)
    - Target: 1 si el evento está activo en CUALQUIER bloque del horizonte futuro [t, t+horizon)
    Retorna:
      X: array (N, lookback, 6)
      y: array (N, 4) con labels ['fiebre', 'celo', 'inactividad', 'anomalia']
    """
    prepared = extract_features_df(df)
    x_list, y_list = [], []

    for _, group in prepared.groupby("animal_id"):
        grp = group.sort_values("dt").reset_index(drop=True)
        feat_matrix = grp[FEATURE_COLS].to_numpy(dtype=np.float32)
        label_matrix = grp[RAW_LABEL_COLS].to_numpy(dtype=np.float32)

        n = len(grp)
        for i in range(0, n - lookback - horizon + 1, stride):
            x_window = feat_matrix[i : i + lookback]
            future_labels = label_matrix[i + lookback : i + lookback + horizon]
            y_window = (np.max(future_labels, axis=0) > 0.5).astype(np.float32)

            x_list.append(x_window)
            y_list.append(y_window)

    if not x_list:
        return np.empty((0, lookback, len(FEATURE_COLS)), dtype=np.float32), np.empty((0, len(EVENT_LABELS)), dtype=np.float32)

    return np.array(x_list, dtype=np.float32), np.array(y_list, dtype=np.float32)


def build_windows_48h(
    df: pd.DataFrame,
    lookback: int = 96,
    stage_blocks: int = 24,
    num_stages: int = 4,
    stride: int = 4,
) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
    """
    Construye ventanas deslizantes para el modelo de trayectoria de 48 horas.
    - lookback: 96 bloques de entrada (48h)
    - 4 etapas de 24 bloques cada una (12h por etapa, total 48h futuras):
        * stage_0_12h: [t, t+24)
        * stage_12_24h: [t+24, t+48)
        * stage_24_36h: [t+48, t+72)
        * stage_36_48h: [t+72, t+96)
    Retorna:
      X: array (N, lookback, 6)
      y: dict con cada etapa -> array (N, 4)
    """
    total_horizon = stage_blocks * num_stages  # 96 bloques = 48h
    prepared = extract_features_df(df)
    x_list = []
    y_stages: Dict[str, List[np.ndarray]] = {stage: [] for stage in STAGES_48H}

    for _, group in prepared.groupby("animal_id"):
        grp = group.sort_values("dt").reset_index(drop=True)
        feat_matrix = grp[FEATURE_COLS].to_numpy(dtype=np.float32)
        label_matrix = grp[RAW_LABEL_COLS].to_numpy(dtype=np.float32)

        n = len(grp)
        for i in range(0, n - lookback - total_horizon + 1, stride):
            x_window = feat_matrix[i : i + lookback]
            x_list.append(x_window)

            for s_idx, stage_name in enumerate(STAGES_48H):
                s_start = i + lookback + s_idx * stage_blocks
                s_end = s_start + stage_blocks
                stage_labels = label_matrix[s_start:s_end]
                y_stage = (np.max(stage_labels, axis=0) > 0.5).astype(np.float32)
                y_stages[stage_name].append(y_stage)

    if not x_list:
        empty_x = np.empty((0, lookback, len(FEATURE_COLS)), dtype=np.float32)
        empty_y = {s: np.empty((0, len(EVENT_LABELS)), dtype=np.float32) for s in STAGES_48H}
        return empty_x, empty_y

    return np.array(x_list, dtype=np.float32), {s: np.array(y_stages[s], dtype=np.float32) for s in STAGES_48H}
