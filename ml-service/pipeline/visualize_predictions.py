"""
DAMP Agro - Inference Testing & Visual Case Dashboard (Interactive Version Selector)
=====================================================================================
Prueba la inferencia de ambos modelos (6h y 48h) sobre casos arquetípicos
y genera reportes visuales con curvas de temperatura, velocidad y trayectoria
de predicción.

Permite seleccionar interactivamente qué versión del modelo entrenado cargar (1, 2, 3...)
o pasarla por argumento (--version <id>).
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from tensorflow import keras

from pipeline.features import (
    BLOCK_MINUTES,
    EVENT_LABELS,
    FEATURE_COLS,
    STAGES_48H,
    compute_feature_row,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model")
EXAMPLES_DIR = os.path.join(BASE_DIR, "outputs", "examples")
FARM_TZ = timezone(timedelta(hours=-3))


def get_available_versions() -> List[Dict]:
    """Escanea model/versions/ y active_version.txt para listar versiones disponibles."""
    versions_dir = os.path.join(MODEL_DIR, "versions")
    versions = []

    active_id = None
    active_path = os.path.join(MODEL_DIR, "active_version.txt")
    if os.path.exists(active_path):
        with open(active_path) as f:
            lines = [line.strip() for line in f if line.strip()]
            if lines:
                active_id = lines[0]

    if os.path.exists(versions_dir):
        for entry in sorted(os.listdir(versions_dir), reverse=True):
            entry_path = os.path.join(versions_dir, entry)
            if os.path.isdir(entry_path):
                meta_file = os.path.join(entry_path, "metadata.joblib")
                meta = joblib.load(meta_file) if os.path.exists(meta_file) else {}
                trained_at = meta.get("trained_at", "Fecha desconocida")
                duration = meta.get("duration_total_human", "")
                is_active = (entry == active_id)
                versions.append({
                    "id": entry,
                    "path": entry_path,
                    "trained_at": trained_at,
                    "duration": duration,
                    "is_active": is_active,
                })
    return versions


def select_model_dir(cli_version: Optional[str] = None) -> Tuple[str, str]:
    """
    Permite al usuario elegir qué versión cargar mediante menú 1, 2, 3...
    o por flag CLI --version.
    Retorna (ruta_directorio, id_version).
    """
    versions = get_available_versions()

    # Si se pasó por flag CLI
    if cli_version:
        if cli_version.lower() in ("latest", "activa", "default"):
            return MODEL_DIR, "última activa"
        for v in versions:
            if v["id"] == cli_version:
                return v["path"], v["id"]
        print(f"⚠️ Versión '{cli_version}' no encontrada. Mostrando menú de selección...")

    # Si no hay versiones archivadas aún, usar MODEL_DIR
    if not versions:
        return MODEL_DIR, "activa"

    print("\n" + "=" * 70)
    print(" 📦 SELECCIÓN DE VERSIÓN DEL MODELO")
    print("=" * 70)
    print("   [1] Última versión activa (ml-service/model/)")

    for idx, v in enumerate(versions, start=2):
        tag = " ⭐ [ACTIVA]" if v["is_active"] else ""
        dur = f" | Duración: {v['duration']}" if v["duration"] else ""
        print(f"   [{idx}] Versión {v['id']} (Entrenado: {v['trained_at']}{dur}){tag}")

    choice = None
    # Solo pedir input si stdin es interactivo
    if sys.stdin.isatty():
        try:
            choice = input(f"\n👉 Ingrese el número de versión a probar [1]: ").strip()
        except (EOFError, KeyboardInterrupt):
            choice = "1"
    else:
        choice = "1"

    if not choice or choice == "1":
        active_name = versions[0]["id"] if versions else "activa"
        print(f"✅ Cargando última versión activa ({active_name}).\n")
        return MODEL_DIR, active_name

    try:
        idx = int(choice)
        if 2 <= idx <= len(versions) + 1:
            selected = versions[idx - 2]
            print(f"✅ Cargando versión: {selected['id']}\n")
            return selected["path"], selected["id"]
    except ValueError:
        pass

    print("⚠️ Opción no reconocida. Cargando última versión activa por defecto.\n")
    return MODEL_DIR, "activa"


class ModelPredictor:
    def __init__(self, model_dir: str, version_label: str):
        self.model_dir = model_dir
        self.model_6h = keras.models.load_model(os.path.join(model_dir, "model_6h.keras"))
        self.model_48h = keras.models.load_model(os.path.join(model_dir, "model_48h.keras"))
        self.scaler = joblib.load(os.path.join(model_dir, "scaler.joblib"))
        self.thresholds = joblib.load(os.path.join(model_dir, "thresholds.joblib"))
        self.metadata = joblib.load(os.path.join(model_dir, "metadata.joblib"))

        self.version = self.metadata.get("version", version_label)
        self.trained_at = self.metadata.get("trained_at", "Fecha no especificada")
        self.duration = self.metadata.get("duration_total_human", "N/A")
        self.lookback_6h = self.metadata.get("lookback_6h", 24)
        self.lookback_48h = self.metadata.get("lookback_48h", 96)

        self._print_architecture_summary()

    def _print_architecture_summary(self):
        print("=" * 70)
        print(" 🔎 CONFIGURACIÓN Y ARQUITECTURA DE MODELOS CARGADOS")
        print("=" * 70)
        print(f" 📦 Versión cargada       : {self.version}")
        print(f" 📅 Fecha de entrenamiento: {self.trained_at}")
        print(f" ⏱️  Tiempo de entreno    : {self.duration}")
        print(f" 📁 Directorio origen     : {self.model_dir}")
        print("-" * 70)
        print(" 🧠 MODELO 1: Corto Plazo (model_6h.keras)")
        print(f"    • Datos pasados (Input) : {self.lookback_6h} bloques de 30 min ({self.lookback_6h * 0.5:.1f} hs de historia)")
        print(f"    • Shape del tensor      : (1, {self.lookback_6h}, {len(FEATURE_COLS)})")
        print("    • Tarea / Horizonte     : Predice si habrá evento activo en las próximas 6.0 horas")
        th_6h_str = ", ".join([f"{e.capitalize()}={self.thresholds.get(e, 0.5)*100:.0f}%" for e in EVENT_LABELS])
        print(f"    • Umbrales de decisión  : {th_6h_str}")
        print("-" * 70)
        print(" 🧠 MODELO 2: Trayectoria (model_48h.keras)")
        print(f"    • Datos pasados (Input) : {self.lookback_48h} bloques de 30 min ({self.lookback_48h * 0.5:.1f} hs de historia)")
        print(f"    • Shape del tensor      : (1, {self.lookback_48h}, {len(FEATURE_COLS)})")
        print("    • Tarea / Horizonte     : Proyecta la evolución en 4 etapas de 12 horas (+0h a +48h)")
        th_48_str = ", ".join([f"{e.capitalize()}={self.thresholds.get(f'{e}_48h', 0.5)*100:.0f}%" for e in EVENT_LABELS])
        print(f"    • Umbrales de decisión  : {th_48_str}")
        print("=" * 70 + "\n")

    def predict_6h(self, feature_rows: List[List[float]]) -> Dict[str, Dict]:
        window = np.array(feature_rows[-self.lookback_6h:], dtype=np.float32)
        window_scaled = self.scaler.transform(window).reshape(1, self.lookback_6h, len(FEATURE_COLS))

        raw_preds = self.model_6h.predict(window_scaled, verbose=0)
        res = {}
        for event in EVENT_LABELS:
            prob = float(np.asarray(raw_preds[event]).ravel()[0])
            th = float(self.thresholds.get(event, 0.5))
            res[event] = {
                "probability": round(prob, 4),
                "threshold": th,
                "detected": prob >= th,
                "margin": round((prob - th) * 100, 1),
            }
        return res

    def predict_48h(self, feature_rows: List[List[float]]) -> Dict:
        window = np.array(feature_rows[-self.lookback_48h:], dtype=np.float32)
        window_scaled = self.scaler.transform(window).reshape(1, self.lookback_48h, len(FEATURE_COLS))

        raw_preds = self.model_48h.predict(window_scaled, verbose=0)

        stage_labels = ["0-12h", "12-24h", "24-36h", "36-48h"]
        stages_res = []
        max_event_probs = {e: 0.0 for e in EVENT_LABELS}
        peak_stages = {e: "0-12h" for e in EVENT_LABELS}

        for s_idx, stage_name in enumerate(STAGES_48H):
            probs = raw_preds[stage_name][0]
            stage_dict = {}
            active_events = []

            for e_idx, event in enumerate(EVENT_LABELS):
                p = float(probs[e_idx])
                th = float(self.thresholds.get(f"{event}_48h", 0.5))
                stage_dict[event] = round(p, 4)
                if p >= th:
                    active_events.append(event)
                if p > max_event_probs[event]:
                    max_event_probs[event] = p
                    peak_stages[event] = stage_labels[s_idx]

            label = " + ".join(active_events) if active_events else "sano"
            stages_res.append({
                "stage": stage_labels[s_idx],
                "state_label": label,
                "active_events": active_events,
                "probabilities": stage_dict,
            })

        passed_summary = {}
        for event in EVENT_LABELS:
            th = float(self.thresholds.get(f"{event}_48h", 0.5))
            mp = max_event_probs[event]
            passed_summary[event] = {
                "will_pass_through": mp >= th,
                "max_probability": round(mp, 4),
                "threshold": th,
                "peak_stage": peak_stages[event],
            }

        final_stage = stages_res[-1]
        return {
            "passed_states_summary": passed_summary,
            "trajectory_stages": stages_res,
            "final_state": {
                "stage": final_stage["stage"],
                "state_label": final_stage["state_label"],
                "active_events": final_stage["active_events"],
            },
        }


def generate_case_telemetry(scenario: str) -> pd.DataFrame:
    """Genera 96 bloques de historia (48h) + 96 bloques de futuro (48h)."""
    from pipeline.generate_dataset import AnimalSimulator

    start_dt = datetime(2026, 9, 1, 0, 0, 0, tzinfo=FARM_TZ)
    sim = AnimalSimulator("TEST-01", sex="FEMALE", seed=101)

    total_blocks = 192
    rows = []

    for b in range(total_blocks):
        current_dt = start_dt + timedelta(minutes=b * BLOCK_MINUTES)

        if scenario == "fiebre_transitoria":
            if b < 80:
                sim.current_state = "sano"
                sim.state_remaining_blocks = 999
            elif b == 80:
                sim.current_state = "fiebre"
                sim.state_subphase = 0
                sim.state_total_blocks = 24  # incubación en el pasado
                sim.state_remaining_blocks = 24
            elif b == 104:
                sim.current_state = "fiebre"
                sim.state_subphase = 1  # clímax en horas 12-24h
                sim.state_total_blocks = 36
                sim.state_remaining_blocks = 36
            elif b == 140:
                sim.current_state = "fiebre"
                sim.state_subphase = 2  # recuperación
                sim.state_total_blocks = 24
                sim.state_remaining_blocks = 24
            elif b >= 164:
                sim.current_state = "sano"
                sim.state_remaining_blocks = 999

        elif scenario == "celo":
            if b < 84:
                sim.current_state = "sano"
                sim.state_remaining_blocks = 999
            elif b == 84:
                sim.current_state = "celo"
                sim.state_total_blocks = 44
                sim.state_remaining_blocks = 44
            elif b >= 128:
                sim.current_state = "sano"
                sim.state_remaining_blocks = 999

        elif scenario == "inactividad":
            if b < 76:
                sim.current_state = "sano"
                sim.state_remaining_blocks = 999
            elif b == 76:
                sim.current_state = "inactividad"
                sim.state_total_blocks = 100
                sim.state_remaining_blocks = 100

        elif scenario == "sano":
            sim.current_state = "sano"
            sim.state_remaining_blocks = 999

        rows.append(sim.step(current_dt))

    return pd.DataFrame(rows)


def plot_case_dashboard(df: pd.DataFrame, pred_6h: Dict, pred_48h: Dict, title: str, save_path: str):
    fig = plt.figure(figsize=(15, 12))
    gs = fig.add_gridspec(4, 1, height_ratios=[1.2, 1.2, 1.0, 1.3], hspace=0.35)

    hours = np.arange(len(df)) * 0.5

    # 1. TEMPERATURA
    ax0 = fig.add_subplot(gs[0])
    ax0.plot(hours, df["temp_corporal"], color="#1f77b4", linewidth=1.8, label="Temperatura Corporal")
    ax0.axhline(39.5, color="#d62728", linestyle="--", alpha=0.8, label="Umbral Febril Clínico (39.5 °C)")
    ax0.axvline(48.0, color="black", linestyle="-", linewidth=2.5, label="Instante de Inferencia (T=0: Hoy / Fin de datos)")
    ax0.axvspan(0, 48, color="gray", alpha=0.15, label="Datos que ve el modelo (Pasado: 48h de historia)")
    ax0.axvspan(48, 96, color="#ff7f0e", alpha=0.12, label="Realidad Futura / Ground Truth (El modelo NO lo ve, sirve para verificar)")
    ax0.set_title(f"{title} - Perfil de Temperatura Corporal", fontsize=12, fontweight="bold")
    ax0.set_ylabel("Temp (°C)")
    ax0.set_xlim(0, 96)
    ax0.grid(True, alpha=0.3)
    ax0.legend(loc="upper right", framealpha=0.92)

    # 2. VELOCIDAD Y DISTANCIA
    ax1 = fig.add_subplot(gs[1])
    ax1.plot(hours, df["velocidad_m_min"], color="#2ca02c", linewidth=1.5, label="Velocidad (m/min)")
    ax1.axvline(48.0, color="black", linestyle="-", linewidth=2.5)
    ax1.axvspan(0, 48, color="gray", alpha=0.15)
    ax1.axvspan(48, 96, color="#ff7f0e", alpha=0.12)
    ax1.set_title("Fluctuación de Desplazamiento y Velocidad", fontsize=12, fontweight="bold")
    ax1.set_ylabel("Velocidad (m/min)")
    ax1.set_xlim(0, 96)
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc="upper right", framealpha=0.9)

    # 3. PREDICCIÓN MODELO 6 HORAS
    ax2 = fig.add_subplot(gs[2])
    events = EVENT_LABELS
    probs_6h = [pred_6h[e]["probability"] for e in events]
    ths_6h = [pred_6h[e]["threshold"] for e in events]
    colors = ["#d62728" if pred_6h[e]["detected"] else "#1f77b4" for e in events]

    x_indices = np.arange(len(events))
    bars = ax2.bar(x_indices, probs_6h, width=0.45, color=colors, alpha=0.85, label="Probabilidad Predicha (6h)")
    ax2.plot(x_indices, ths_6h, "r_", markersize=25, markeredgewidth=2.5, label="Umbral de Alarma")

    for bar, p in zip(bars, probs_6h):
        yval = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width() / 2.0, yval + 0.02, f"{p*100:.1f}%", ha="center", va="bottom", fontweight="bold")

    ax2.set_xticks(x_indices)
    ax2.set_xticklabels([e.capitalize() for e in events], fontweight="bold")
    ax2.set_ylim(0, 1.15)
    ax2.set_title("Salida Modelo Rápido 6 Horas (Horizonte Inmediato)", fontsize=12, fontweight="bold")
    ax2.set_ylabel("Probabilidad")
    ax2.grid(True, alpha=0.3, axis="y")
    ax2.legend(loc="upper right")

    # 4. TRAYECTORIA Y ETAPAS 48 HORAS
    ax3 = fig.add_subplot(gs[3])
    stages_info = pred_48h["trajectory_stages"]
    stage_names = [s["stage"] for s in stages_info]

    matrix = np.zeros((len(events), len(stage_names)))
    for s_idx, s in enumerate(stages_info):
        for e_idx, e in enumerate(events):
            matrix[e_idx, s_idx] = s["probabilities"][e]

    im = ax3.imshow(matrix, cmap="YlOrRd", vmin=0, vmax=1.0, aspect="auto")
    cbar = plt.colorbar(im, ax=ax3, orientation="vertical", pad=0.02)
    cbar.set_label("Probabilidad")

    ax3.set_xticks(np.arange(len(stage_names)))
    ax3.set_yticks(np.arange(len(events)))
    ax3.set_xticklabels(
        [f"Etapa {s['stage']}\nEstado: {s['state_label'].upper()}" for s in stages_info],
        fontweight="bold"
    )
    ax3.set_yticklabels([e.capitalize() for e in events], fontweight="bold")

    for i in range(len(events)):
        for j in range(len(stage_names)):
            val = matrix[i, j]
            color = "white" if val > 0.55 else "black"
            ax3.text(j, i, f"{val*100:.1f}%", ha="center", va="center", color=color, fontweight="bold")

    ax3.set_title("Modelo 48 Horas - Trayectoria de Estados y Secuencia de Evolución", fontsize=12, fontweight="bold")

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    plt.savefig(save_path, dpi=160, bbox_inches="tight")
    plt.close()
    print(f"🖼️  Dashboard visual guardado en: {save_path}")


def run_visual_cases(cli_version: Optional[str] = None):
    model_dir, version_id = select_model_dir(cli_version)
    predictor = ModelPredictor(model_dir=model_dir, version_label=version_id)

    scenarios = [
        ("fiebre_transitoria", "Caso 1: Vaca Sana -> Pico Fiebre (12-24h) -> Recuperación Sana"),
        ("inactividad", "Caso 2: Decaimiento e Inactividad Sostenida"),
        ("celo", "Caso 3: Hembra en Celo (Incremento Actividad + Temp)"),
        ("sano", "Caso 4: Vaca Sana (Control Circadiano Normal)"),
    ]

    for sc_name, sc_title in scenarios:
        print("\n" + "=" * 70)
        print(f" 🧪 EVALUANDO: {sc_title.upper()}")
        print("=" * 70)

        df_case = generate_case_telemetry(sc_name)

        print(" 🕒 Contexto del Análisis (¿Qué datos tiene el modelo?):")
        print("    • Datos reales de la vaca (Pasado): Bloques 0 a 95 (horas -48h a 0h)")
        print("    • Momento actual / Hoy (T=0)      : Fin de los datos reales. ¡Acá predice el modelo a ciegas!")
        print("    • Futuro real (horas +0h a +48h)  : El modelo NO LO VE. Solo se grafica para contrastar si acertó.")

        # Extraer features ÚNICAMENTE de los 96 bloques de historia (el pasado que tiene la vaca)
        history_features = [
            compute_feature_row(row["temp_corporal"], row["distancia_rodeo"], row["timestamp"], row["sex"])
            for _, row in df_case.iloc[:96].iterrows()
        ]

        pred_6h = predictor.predict_6h(history_features)
        pred_48h = predictor.predict_48h(history_features)

        # 1. Salida Modelo 6h
        print("\n" + "-" * 70)
        print(" 1️⃣  MODELO 1: Corto Plazo (Predicción próximas 6 Horas)")
        print(f"     (Recibió los últimos {predictor.lookback_6h} bloques = {predictor.lookback_6h * 0.5:.1f} hs de historia)")
        print("-" * 70)
        for e in EVENT_LABELS:
            info = pred_6h[e]
            status = "🔴 ALARMA DETECTADA ⚠️" if info["detected"] else "🟢 NORMAL"
            sign = "+" if info["margin"] >= 0 else ""
            print(f"     • {e.capitalize():<12}: Prob={info['probability']*100:5.1f}%  |  Umbral={info['threshold']*100:4.1f}%  |  Margen={sign}{info['margin']:5.1f}%  --> {status}")

        # 2. Salida Modelo 48h
        print("\n" + "-" * 70)
        print(" 2️⃣  MODELO 2: Trayectoria (Evolución en 4 Etapas de 12 Horas)")
        print(f"     (Recibió los últimos {predictor.lookback_48h} bloques = {predictor.lookback_48h * 0.5:.1f} hs de historia)")
        print("-" * 70)
        for stage in pred_48h["trajectory_stages"]:
            status_tag = f"⚠️ [{stage['state_label'].upper()}]" if stage["state_label"] != "sano" else "🟢 SANO"
            print(f"     • Tramo {stage['stage']}: Estado proyectado: {status_tag}")
            sub_probs = []
            for k, v in stage["probabilities"].items():
                th = predictor.thresholds.get(f"{k}_48h", 0.5)
                flag = " ⚠️" if v >= th else ""
                sub_probs.append(f"{k}: {v*100:.1f}%{flag}")
            print(f"       Detalle probabilidades: [{', '.join(sub_probs)}]")

        # 3. Resumen acumulado 48h
        print("\n" + "-" * 70)
        print(" 3️⃣  RESUMEN CLÍNICO A 48 HORAS (¿Por qué estados pasa y cómo termina?)")
        print("-" * 70)
        for e, summary in pred_48h["passed_states_summary"].items():
            if summary["will_pass_through"]:
                verdict = f"🔴 SÍ ATRAVIESA ESTE ESTADO ⚠️  (Pico máx: {summary['max_probability']*100:5.1f}% en tramo {summary['peak_stage']})"
            else:
                verdict = f"🟢 NO (Probabilidad máxima {summary['max_probability']*100:5.1f}% por debajo del umbral {summary['threshold']*100:.0f}%)"
            print(f"     • ¿Atraviesa {e.capitalize():<11}? : {verdict}")

        final_label = pred_48h["final_state"]["state_label"].upper()
        final_tag = "🟢 SANO (Recuperado / Estable)" if final_label == "SANO" else f"🔴 {final_label}"
        print(f"     • Estado al finalizar 48h (tramo 36-48h): {final_tag}")

        save_name = f"caso_{sc_name}.png"
        save_path = os.path.join(EXAMPLES_DIR, save_name)
        plot_case_dashboard(df_case, pred_6h, pred_48h, sc_title, save_path)

    print("\n" + "=" * 70)
    print("✅ Todos los casos de ejemplo fueron procesados exitosamente.")
    print(f"📁 Gráficas generadas en: {EXAMPLES_DIR}")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Prueba visual de inferencia DAMP")
    parser.add_argument("--version", type=str, default=None, help="ID de versión a cargar (ej: 20261024_194122) o 'latest'")
    args = parser.parse_args()
    run_visual_cases(cli_version=args.version)


if __name__ == "__main__":
    main()
