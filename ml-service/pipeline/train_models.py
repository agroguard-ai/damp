"""
DAMP Agro - Training Pipeline (6h Short-Term & 48h Trajectory Models)
=====================================================================
Entrena y evalúa los dos modelos predictivos a partir del CSV de telemetría:
  1. Modelo 6h (Entrada: 12h = 24 bloques -> Predicción de eventos próximos)
  2. Modelo 48h (Entrada: 48h = 96 bloques -> Trayectoria en 4 etapas de 12h)

Exporta todos los pesos y metadatos a ml-service/model/ y reportes a ml-service/outputs/.
"""

import argparse
from datetime import datetime
import json
import os
import shutil
import time
from typing import Dict, List, Tuple

import joblib
import matplotlib
matplotlib.use("Agg")  # Backend sin GUI para servidores/headless
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    auc,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

from pipeline.features import (
    EVENT_LABELS,
    FEATURE_COLS,
    STAGES_48H,
    build_windows_6h,
    build_windows_48h,
    extract_features_df,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")


def split_animals(df: pd.DataFrame, train_ratio=0.70, val_ratio=0.15, seed=42) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Partición por animal sin data leakage."""
    animals = np.array(sorted(df["animal_id"].unique()))
    rng = np.random.default_rng(seed)
    rng.shuffle(animals)

    n_total = len(animals)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    train_ids = set(animals[:n_train])
    val_ids = set(animals[n_train : n_train + n_val])
    test_ids = set(animals[n_train + n_val :])

    df_train = df[df["animal_id"].isin(train_ids)].copy()
    df_val = df[df["animal_id"].isin(val_ids)].copy()
    df_test = df[df["animal_id"].isin(test_ids)].copy()

    print(f"📊 Partición de Animales ({n_total} totales):")
    print(f"   • Train : {len(train_ids)} animales ({len(df_train):,} lecturas)")
    print(f"   • Val   : {len(val_ids)} animales ({len(df_val):,} lecturas)")
    print(f"   • Test  : {len(test_ids)} animales ({len(df_test):,} lecturas)")

    return df_train, df_val, df_test


def scale_windows(X: np.ndarray, scaler: StandardScaler) -> np.ndarray:
    """Aplica StandardScaler 2D a un tensor 3D (N, seq_len, n_features)."""
    if len(X) == 0:
        return X
    n, seq_len, n_feats = X.shape
    X_reshaped = X.reshape(-1, n_feats)
    X_scaled = scaler.transform(X_reshaped).reshape(n, seq_len, n_feats)
    return X_scaled.astype(np.float32)


def build_model_6h(lookback: int, n_features: int) -> keras.Model:
    """Arquitectura LSTM multitarea para 6h (4 salidas sigmoides)."""
    inputs = layers.Input(shape=(lookback, n_features), name="telemetry_window_6h")
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True), name="bilstm_6h")(inputs)
    x = layers.Dropout(0.3, name="drop1_6h")(x)
    x = layers.LSTM(32, return_sequences=False, name="lstm_6h")(x)
    x = layers.Dropout(0.3, name="drop2_6h")(x)
    shared = layers.Dense(32, activation="relu", name="shared_dense_6h")(x)

    outputs = {}
    for event in EVENT_LABELS:
        h = layers.Dense(16, activation="relu", name=f"dense_{event}_6h")(shared)
        out = layers.Dense(1, activation="sigmoid", name=event)(h)
        outputs[event] = out

    model = keras.Model(inputs=inputs, outputs=outputs, name="bovine_health_6h")
    losses = {event: "binary_crossentropy" for event in EVENT_LABELS}
    metrics = {event: ["precision", "recall"] for event in EVENT_LABELS}
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001), loss=losses, metrics=metrics)
    return model


def build_model_48h(lookback: int, n_features: int) -> keras.Model:
    """Arquitectura LSTM para trayectoria de 48h (4 etapas de 12h con 4 eventos cada una)."""
    inputs = layers.Input(shape=(lookback, n_features), name="telemetry_window_48h")
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True), name="bilstm_48h")(inputs)
    x = layers.Dropout(0.3, name="drop1_48h")(x)
    x = layers.LSTM(48, return_sequences=False, name="lstm_48h")(x)
    x = layers.Dropout(0.3, name="drop2_48h")(x)
    shared = layers.Dense(64, activation="relu", name="shared_dense_48h")(x)

    outputs = {}
    for stage in STAGES_48H:
        h = layers.Dense(32, activation="relu", name=f"dense_{stage}_48h")(shared)
        out = layers.Dense(len(EVENT_LABELS), activation="sigmoid", name=stage)(h)
        outputs[stage] = out

    model = keras.Model(inputs=inputs, outputs=outputs, name="bovine_trajectory_48h")
    losses = {stage: "binary_crossentropy" for stage in STAGES_48H}
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001), loss=losses)
    return model


def calibrate_thresholds_6h(model: keras.Model, X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, float]:
    """Optimiza umbrales de decisión maximizando F1-score en Validación."""
    preds = model.predict(X_val, verbose=0)
    thresholds = {}

    for idx, event in enumerate(EVENT_LABELS):
        p = preds[event].ravel()
        y_true = y_val[:, idx]

        best_th = 0.5
        best_f1 = -1.0
        for th in np.arange(0.20, 0.85, 0.05):
            y_pred = (p >= th).astype(int)
            f = f1_score(y_true, y_pred, zero_division=0)
            if f > best_f1:
                best_f1 = f
                best_th = round(float(th), 2)

        thresholds[event] = best_th

    return thresholds


def calibrate_thresholds_48h(model: keras.Model, X_val: np.ndarray, y_val_dict: Dict[str, np.ndarray]) -> Dict[str, float]:
    """Optimiza umbrales para eventos en el modelo de 48h."""
    preds = model.predict(X_val, verbose=0)
    thresholds = {}

    for idx, event in enumerate(EVENT_LABELS):
        # Concatenar predicciones y verdad de todas las etapas para un umbral robusto por evento
        all_p = np.concatenate([preds[s][:, idx] for s in STAGES_48H])
        all_y = np.concatenate([y_val_dict[s][:, idx] for s in STAGES_48H])

        best_th = 0.5
        best_f1 = -1.0
        for th in np.arange(0.20, 0.85, 0.05):
            y_pred = (all_p >= th).astype(int)
            f = f1_score(all_y, y_pred, zero_division=0)
            if f > best_f1:
                best_f1 = f
                best_th = round(float(th), 2)

        thresholds[f"{event}_48h"] = best_th

    return thresholds


def evaluate_model_6h(model: keras.Model, X_test: np.ndarray, y_test: np.ndarray, thresholds: Dict[str, float]) -> Dict:
    """Calcula métricas detalladas en el conjunto de Test."""
    preds = model.predict(X_test, verbose=0)
    metrics = {}

    print("\n" + "=" * 65)
    print(" 📈 EVALUACIÓN MODELO 6 HORAS (TEST SET)")
    print("=" * 65)
    print(f"{'Evento':<14} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'ROC-AUC':<10} | {'Umbral':<7}")
    print("-" * 65)

    for idx, event in enumerate(EVENT_LABELS):
        p = preds[event].ravel()
        y_true = y_test[:, idx]
        th = thresholds.get(event, 0.5)
        y_pred = (p >= th).astype(int)

        prec = float(precision_score(y_true, y_pred, zero_division=0))
        rec = float(recall_score(y_true, y_pred, zero_division=0))
        f1 = float(f1_score(y_true, y_pred, zero_division=0))
        try:
            auc_val = float(roc_auc_score(y_true, p))
        except Exception:
            auc_val = 0.5

        metrics[event] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc_val, 4),
            "threshold": th,
            "support": int(np.sum(y_true)),
        }

        print(f"{event:<14} | {prec:10.4f} | {rec:10.4f} | {f1:10.4f} | {auc_val:10.4f} | {th:7.2f}")
    print("=" * 65)
    return metrics


def evaluate_model_48h(model: keras.Model, X_test: np.ndarray, y_test_dict: Dict[str, np.ndarray], thresholds: Dict[str, float]) -> Dict:
    """Evalúa el modelo de 48h tanto por etapa como a nivel incidencia acumulada en las 48h."""
    preds = model.predict(X_test, verbose=0)
    stage_metrics = {}

    print("\n" + "=" * 65)
    print(" 📈 EVALUACIÓN MODELO 48 HORAS (TRAYECTORIA POR ETAPAS)")
    print("=" * 65)

    for stage in STAGES_48H:
        print(f"\n--- Etapa: {stage} ---")
        print(f"{'Evento':<14} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'ROC-AUC':<10}")
        print("-" * 65)
        stage_metrics[stage] = {}

        for idx, event in enumerate(EVENT_LABELS):
            p = preds[stage][:, idx]
            y_true = y_test_dict[stage][:, idx]
            th = thresholds.get(f"{event}_48h", 0.5)
            y_pred = (p >= th).astype(int)

            prec = float(precision_score(y_true, y_pred, zero_division=0))
            rec = float(recall_score(y_true, y_pred, zero_division=0))
            f1 = float(f1_score(y_true, y_pred, zero_division=0))
            try:
                auc_val = float(roc_auc_score(y_true, p))
            except Exception:
                auc_val = 0.5

            stage_metrics[stage][event] = {
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "roc_auc": round(auc_val, 4),
            }
            print(f"{event:<14} | {prec:10.4f} | {rec:10.4f} | {f1:10.4f} | {auc_val:10.4f}")

    # Incidencia global acumulada en las 48h: ¿Ocurrió en alguna etapa?
    print("\n" + "=" * 65)
    print(" 🎯 DETECCIÓN ACUMULADA EN LAS 48 HORAS (¿PASA POR ESTE ESTADO?)")
    print("=" * 65)
    print(f"{'Evento':<14} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'ROC-AUC':<10}")
    print("-" * 65)

    global_metrics = {}
    for idx, event in enumerate(EVENT_LABELS):
        # Probabilidad máxima en cualquiera de las 4 etapas
        max_p = np.max([preds[s][:, idx] for s in STAGES_48H], axis=0)
        # Verdad: 1 si ocurrió en alguna etapa
        any_y = np.max([y_test_dict[s][:, idx] for s in STAGES_48H], axis=0)
        th = thresholds.get(f"{event}_48h", 0.5)
        y_pred = (max_p >= th).astype(int)

        prec = float(precision_score(any_y, y_pred, zero_division=0))
        rec = float(recall_score(any_y, y_pred, zero_division=0))
        f1 = float(f1_score(any_y, y_pred, zero_division=0))
        try:
            auc_val = float(roc_auc_score(any_y, max_p))
        except Exception:
            auc_val = 0.5

        global_metrics[event] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc_val, 4),
        }
        print(f"{event:<14} | {prec:10.4f} | {rec:10.4f} | {f1:10.4f} | {auc_val:10.4f}")
    print("=" * 65 + "\n")

    return {"by_stage": stage_metrics, "cumulative_48h": global_metrics}


def plot_training_history(history_6h, history_48h, save_path: str):
    """Guarda gráfica comparativa de curvas de entrenamiento."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Pérdida modelo 6h
    axes[0].plot(history_6h.history["loss"], label="Train Loss", color="#1f77b4", linewidth=2)
    axes[0].plot(history_6h.history["val_loss"], label="Val Loss", color="#ff7f0e", linestyle="--", linewidth=2)
    axes[0].set_title("Curva de Pérdida - Modelo 6 Horas", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Época")
    axes[0].set_ylabel("Binary Crossentropy Loss")
    axes[0].grid(True, alpha=0.3)
    axes[0].legend()

    # Pérdida modelo 48h
    axes[1].plot(history_48h.history["loss"], label="Train Loss", color="#2ca02c", linewidth=2)
    axes[1].plot(history_48h.history["val_loss"], label="Val Loss", color="#d62728", linestyle="--", linewidth=2)
    axes[1].set_title("Curva de Pérdida - Modelo 48 Horas (Trayectoria)", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Época")
    axes[1].set_ylabel("Binary Crossentropy Loss")
    axes[1].grid(True, alpha=0.3)
    axes[1].legend()

    plt.tight_layout()
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"📊 Gráfica de entrenamiento guardada en: {save_path}")


def plot_evaluation_curves(model_6h, X_test_6h, y_test_6h, save_path: str):
    """Genera curvas ROC y Precision-Recall para el modelo de 6 horas."""
    preds = model_6h.predict(X_test_6h, verbose=0)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    colors = {"fiebre": "#d62728", "celo": "#e377c2", "inactividad": "#7f7f7f", "anomalia": "#ff7f0e"}

    # Curvas ROC
    for idx, event in enumerate(EVENT_LABELS):
        p = preds[event].ravel()
        y_true = y_test_6h[:, idx]
        fpr, tpr, _ = roc_curve(y_true, p)
        roc_val = auc(fpr, tpr)
        axes[0].plot(fpr, tpr, color=colors.get(event, "blue"), label=f"{event} (AUC = {roc_val:.3f})", linewidth=2)

    axes[0].plot([0, 1], [0, 1], color="black", linestyle=":", label="Azar")
    axes[0].set_title("Curvas ROC (Test Set)", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Tasa de Falsos Positivos (FPR)")
    axes[0].set_ylabel("Tasa de Verdaderos Positivos (TPR)")
    axes[0].grid(True, alpha=0.3)
    axes[0].legend()

    # Curvas Precision-Recall
    for idx, event in enumerate(EVENT_LABELS):
        p = preds[event].ravel()
        y_true = y_test_6h[:, idx]
        prec, rec, _ = precision_recall_curve(y_true, p)
        pr_val = auc(rec, prec)
        axes[1].plot(rec, prec, color=colors.get(event, "blue"), label=f"{event} (PR-AUC = {pr_val:.3f})", linewidth=2)

    axes[1].set_title("Curvas Precision-Recall (Test Set)", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Recall")
    axes[1].set_ylabel("Precision")
    axes[1].grid(True, alpha=0.3)
    axes[1].legend()

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"📊 Gráfica de evaluación guardada en: {save_path}")


def train_pipeline(
    csv_path: str,
    lookback_6h: int = 24,
    lookback_48h: int = 96,
    epochs: int = 20,
    batch_size: int = 64,
):
    start_time = time.time()
    print("=" * 65)
    print(" DAMP Agro - Entrenamiento de Modelos (6h y 48h)")
    print("=" * 65)
    print(f" Dataset CSV   : {csv_path}")
    print(f" Lookback 6h   : {lookback_6h} bloques ({lookback_6h * 0.5:.1f} hs de historia)")
    print(f" Lookback 48h  : {lookback_48h} bloques ({lookback_48h * 0.5:.1f} hs de historia)")
    print(f" Épocas máx    : {epochs}")
    print(f" Batch size    : {batch_size}")
    print("-" * 65)

    df = pd.read_csv(csv_path)
    df_train, df_val, df_test = split_animals(df)

    df_train = extract_features_df(df_train)
    df_val = extract_features_df(df_val)
    df_test = extract_features_df(df_test)

    # 1. Ajustar StandardScaler con Train
    print("\n⏳ Ajustando StandardScaler sobre features de entrenamiento...")
    scaler = StandardScaler()
    scaler.fit(df_train[FEATURE_COLS].to_numpy(dtype=np.float32))

    # 2. Construir ventanas para modelo 6h
    print("\n⏳ Construyendo ventanas deslizantes (Modelo 6h)...")
    X_train_6h, y_train_6h = build_windows_6h(df_train, lookback=lookback_6h, horizon=12, stride=2)
    X_val_6h, y_val_6h = build_windows_6h(df_val, lookback=lookback_6h, horizon=12, stride=2)
    X_test_6h, y_test_6h = build_windows_6h(df_test, lookback=lookback_6h, horizon=12, stride=2)

    X_train_6h = scale_windows(X_train_6h, scaler)
    X_val_6h = scale_windows(X_val_6h, scaler)
    X_test_6h = scale_windows(X_test_6h, scaler)
    print(f"   Ventanas 6h -> Train: {len(X_train_6h):,}, Val: {len(X_val_6h):,}, Test: {len(X_test_6h):,}")

    # 3. Construir ventanas para modelo 48h
    print("\n⏳ Construyendo ventanas deslizantes (Modelo 48h Trayectoria)...")
    X_train_48h, y_train_48h = build_windows_48h(df_train, lookback=lookback_48h, stage_blocks=24, num_stages=4, stride=4)
    X_val_48h, y_val_48h = build_windows_48h(df_val, lookback=lookback_48h, stage_blocks=24, num_stages=4, stride=4)
    X_test_48h, y_test_48h = build_windows_48h(df_test, lookback=lookback_48h, stage_blocks=24, num_stages=4, stride=4)

    X_train_48h = scale_windows(X_train_48h, scaler)
    X_val_48h = scale_windows(X_val_48h, scaler)
    X_test_48h = scale_windows(X_test_48h, scaler)
    print(f"   Ventanas 48h -> Train: {len(X_train_48h):,}, Val: {len(X_val_48h):,}, Test: {len(X_test_48h):,}")

    # 4. Entrenar Modelo 6h
    print("\n🚀 Entrenando Modelo 1 (6 horas)...")
    t_start_6h = time.time()
    model_6h = build_model_6h(lookback=lookback_6h, n_features=len(FEATURE_COLS))
    y_train_6h_dict = {event: y_train_6h[:, idx] for idx, event in enumerate(EVENT_LABELS)}
    y_val_6h_dict = {event: y_val_6h[:, idx] for idx, event in enumerate(EVENT_LABELS)}

    callbacks_6h = [keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)]
    hist_6h = model_6h.fit(
        X_train_6h,
        y_train_6h_dict,
        validation_data=(X_val_6h, y_val_6h_dict),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks_6h,
        verbose=1,
    )
    duration_6h = time.time() - t_start_6h
    print(f"   ⏱️  Modelo 6h completado en: {int(duration_6h//60)}m {int(duration_6h%60)}s ({duration_6h:.1f} s)")

    # 5. Entrenar Modelo 48h
    print("\n🚀 Entrenando Modelo 2 (48 horas - Trayectoria)...")
    t_start_48h = time.time()
    model_48h = build_model_48h(lookback=lookback_48h, n_features=len(FEATURE_COLS))
    callbacks_48h = [keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)]
    hist_48h = model_48h.fit(
        X_train_48h,
        y_train_48h,
        validation_data=(X_val_48h, y_val_48h),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks_48h,
        verbose=1,
    )
    duration_48h = time.time() - t_start_48h
    print(f"   ⏱️  Modelo 48h completado en: {int(duration_48h//60)}m {int(duration_48h%60)}s ({duration_48h:.1f} s)")

    # 6. Calibrar umbrales
    print("\n⚙️  Calibrando umbrales óptimos F1 sobre conjunto de Validación...")
    thresholds_6h = calibrate_thresholds_6h(model_6h, X_val_6h, y_val_6h)
    thresholds_48h = calibrate_thresholds_48h(model_48h, X_val_48h, y_val_48h)
    all_thresholds = {**thresholds_6h, **thresholds_48h}
    print(f"   Umbrales calculados: {all_thresholds}")

    # 7. Evaluación en Test Set
    metrics_6h = evaluate_model_6h(model_6h, X_test_6h, y_test_6h, all_thresholds)
    metrics_48h = evaluate_model_48h(model_48h, X_test_48h, y_test_48h, all_thresholds)

    # 8. Guardar artefactos en ml-service/model/ y versionar por fecha/hora
    now = datetime.now()
    version_id = now.strftime("%Y%m%d_%H%M%S")
    trained_at = now.isoformat()
    version_dir = os.path.join(MODEL_DIR, "versions", version_id)

    elapsed = time.time() - start_time
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)

    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(version_dir, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    print(f"\n💾 Guardando versión del modelo: {version_id} ({trained_at})")
    print(f"   📁 Directorio versionado: {version_dir}")

    metadata = {
        "version": version_id,
        "trained_at": trained_at,
        "duration_total_seconds": round(elapsed, 2),
        "duration_total_human": f"{mins}m {secs}s",
        "duration_6h_seconds": round(duration_6h, 2),
        "duration_48h_seconds": round(duration_48h, 2),
        "feature_cols": FEATURE_COLS,
        "event_labels": EVENT_LABELS,
        "lookback_6h": lookback_6h,
        "lookback_48h": lookback_48h,
        "lookback": lookback_6h,  # compatibilidad con clientes existentes
        "horizon_6h": 12,
        "stages_48h": STAGES_48H,
        "stage_blocks": 24,
    }

    # Guardar en directorio versionado
    model_6h.save(os.path.join(version_dir, "model_6h.keras"))
    model_48h.save(os.path.join(version_dir, "model_48h.keras"))
    joblib.dump(scaler, os.path.join(version_dir, "scaler.joblib"))
    joblib.dump(all_thresholds, os.path.join(version_dir, "thresholds.joblib"))
    joblib.dump(metadata, os.path.join(version_dir, "metadata.joblib"))

    # Actualizar versión activa en ml-service/model/ (para que la API use siempre la última)
    model_6h_path = os.path.join(MODEL_DIR, "model_6h.keras")
    final_model_path = os.path.join(MODEL_DIR, "final_model.keras")
    model_48h_path = os.path.join(MODEL_DIR, "model_48h.keras")

    model_6h.save(model_6h_path)
    shutil.copyfile(model_6h_path, final_model_path)  # Retrocompatibilidad
    model_48h.save(model_48h_path)

    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    joblib.dump(all_thresholds, os.path.join(MODEL_DIR, "thresholds.joblib"))
    joblib.dump(metadata, os.path.join(MODEL_DIR, "metadata.joblib"))

    with open(os.path.join(MODEL_DIR, "active_version.txt"), "w") as f:
        f.write(f"{version_id}\n{trained_at}\n{mins}m {secs}s\n")

    # 9. Guardar reportes y gráficas
    report = {
        "version": version_id,
        "trained_at": trained_at,
        "training_duration": {
            "total_seconds": round(elapsed, 2),
            "total_human": f"{mins}m {secs}s",
            "model_6h_seconds": round(duration_6h, 2),
            "model_48h_seconds": round(duration_48h, 2),
        },
        "model_6h": metrics_6h,
        "model_48h": metrics_48h,
        "thresholds": all_thresholds,
        "metadata": metadata,
    }
    with open(os.path.join(OUTPUTS_DIR, "metrics_report.json"), "w") as f:
        json.dump(report, f, indent=2)
    with open(os.path.join(version_dir, "metrics_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    plot_training_history(hist_6h, hist_48h, os.path.join(OUTPUTS_DIR, "training_history.png"))
    plot_evaluation_curves(model_6h, X_test_6h, y_test_6h, os.path.join(OUTPUTS_DIR, "evaluation_metrics.png"))

    print("\n🎉 Entrenamiento y exportación finalizados con éxito!")
    print("   ⏱️  Tiempos de ejecución:")
    print(f"       • Modelo 6h           : {int(duration_6h//60)}m {int(duration_6h%60)}s ({duration_6h:.1f} s)")
    print(f"       • Modelo 48h          : {int(duration_48h//60)}m {int(duration_48h%60)}s ({duration_48h:.1f} s)")
    print(f"       • Tiempo total        : {mins}m {secs}s ({elapsed:.1f} s)")
    print(f"   • Modelo 6h guardado  : {model_6h_path}")
    print(f"   • Modelo 48h guardado : {model_48h_path}")
    print(f"   • Scaler & Thresholds : {MODEL_DIR}")
    print(f"   • Gráficas y Métricas : {OUTPUTS_DIR}")
    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Pipeline de entrenamiento DAMP")
    parser.add_argument("--csv", type=str, default="data/telemetry_dataset.csv", help="Ruta al CSV")
    parser.add_argument("--lookback-6h", type=int, default=24, help="Bloques entrada modelo 6h (default: 24 = 12h)")
    parser.add_argument("--lookback-48h", type=int, default=96, help="Bloques entrada modelo 48h (default: 96 = 48h)")
    parser.add_argument("--epochs", type=int, default=20, help="Épocas de entrenamiento (default: 20)")
    parser.add_argument("--batch-size", type=int, default=64, help="Tamaño de batch (default: 64)")
    args = parser.parse_args()

    csv_path = args.csv
    if not os.path.isabs(csv_path):
        csv_path = os.path.join(BASE_DIR, csv_path)

    train_pipeline(
        csv_path=csv_path,
        lookback_6h=args.lookback_6h,
        lookback_48h=args.lookback_48h,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
