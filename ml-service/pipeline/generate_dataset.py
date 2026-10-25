"""
DAMP Agro - Synthetic Telemetry Dataset Generator
=================================================
Genera series temporales fisiológicamente consistentes para ganado bovino,
modelando ciclos circadianos, transiciones graduales de enfermedad y recuperación
(incluyendo el caso: sano -> pico de fiebre -> recuperación -> sano).

Guarda los datos en CSV con columnas de telemetría y etiquetas de eventos.
"""

import argparse
import math
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

FARM_UTC_OFFSET_HOURS = -3
FARM_TZ = timezone(timedelta(hours=FARM_UTC_OFFSET_HOURS))
BLOCK_MINUTES = 30


def circadian_temp(hour: float) -> float:
    """Ciclo diario de temperatura: pico ~15h, valle ~03h (amplitud 0.4°C)."""
    return 0.4 * math.sin((2.0 * math.pi * (hour - 15.0 + 6.0)) / 24.0)


def circadian_activity(hour: float) -> float:
    """Modulador circadiano de actividad: pastoreo diurno y descanso nocturno."""
    if 22 <= hour or hour < 6:
        return 0.3  # noche: reposo y rumia
    if 6 <= hour < 10 or 16 <= hour < 20:
        return 1.4  # picos de pastoreo matutino y vespertino
    return 1.0  # mediodía normal


class AnimalSimulator:
    def __init__(self, animal_id: str, sex: str, seed: int):
        self.animal_id = animal_id
        self.sex = sex
        self.rng = np.random.default_rng(seed)

        # Parámetros basales individuales
        self.temp_base = float(self.rng.normal(38.45, 0.12))
        self.dist_base = float(max(12.0, self.rng.normal(25.0, 4.0)))

        # Estado clínico actual
        self.current_state = "sano"
        self.state_remaining_blocks = 0
        self.state_total_blocks = 0
        self.state_subphase = 0  # 0: incubación/rampa, 1: clímax, 2: resolución

    def maybe_transition(self):
        """Gestiona las transiciones estocásticas de estado."""
        if self.state_remaining_blocks > 0:
            self.state_remaining_blocks -= 1
            return

        # Si estaba en un evento y terminó, pasa a resolución o vuelve a sano
        if self.current_state == "fiebre":
            if self.state_subphase == 0:
                # Terminó incubación, pasa a clímax febril (12 a 24 hs = 24 a 48 bloques)
                self.state_subphase = 1
                self.state_total_blocks = int(self.rng.integers(24, 48))
                self.state_remaining_blocks = self.state_total_blocks
                return
            elif self.state_subphase == 1:
                # Terminó clímax, pasa a resolución/recuperación post-febril (12 a 24 hs)
                self.state_subphase = 2
                self.state_total_blocks = int(self.rng.integers(24, 48))
                self.state_remaining_blocks = self.state_total_blocks
                return
            else:
                # Completó la recuperación -> vuelve a sano
                self.current_state = "sano"

        elif self.current_state in ("celo", "inactividad", "anomalia"):
            self.current_state = "sano"

        # Está sano: evalúa probabilidad de inicio de nuevo evento
        # Se evalúa cada 30 min (48 bloques/día). Queremos ~1 a 2 eventos por animal al mes.
        p = self.rng.random()
        if p < 0.002:  # ~1 vez cada 10-15 días
            candidates = ["fiebre", "inactividad", "anomalia"]
            if self.sex == "FEMALE":
                candidates.append("celo")

            chosen = str(self.rng.choice(candidates))
            self.current_state = chosen
            self.state_subphase = 0

            if chosen == "fiebre":
                # Fase de incubación sutil (8 a 16 horas = 16 a 32 bloques)
                self.state_total_blocks = int(self.rng.integers(16, 32))
            elif chosen == "celo":
                # Celo dura entre 18 y 30 horas (36 a 60 bloques)
                self.state_total_blocks = int(self.rng.integers(36, 60))
            elif chosen == "inactividad":
                # Inactividad/decaimiento dura entre 24 y 60 horas (48 a 120 bloques)
                self.state_total_blocks = int(self.rng.integers(48, 120))
            elif chosen == "anomalia":
                # Anomalía motora dura entre 2 y 6 horas (4 a 12 bloques)
                self.state_total_blocks = int(self.rng.integers(4, 12))

            self.state_remaining_blocks = self.state_total_blocks

    def step(self, dt: datetime) -> Dict:
        self.maybe_transition()

        local_dt = dt.astimezone(FARM_TZ)
        hour = local_dt.hour + local_dt.minute / 60.0

        temp_circ = circadian_temp(hour)
        act_circ = circadian_activity(hour)

        temp = self.temp_base + temp_circ + float(self.rng.normal(0, 0.08))
        dist = max(2.0, self.dist_base * act_circ + float(self.rng.normal(0, 3.5)))

        is_fiebre = 0
        is_celo = 0
        is_inactividad = 0
        is_anomalia = 0

        # Modificación según estado clínico
        if self.current_state == "fiebre":
            is_fiebre = 1
            if self.state_subphase == 0:
                # Incubación/prodrómica: leve inquietud y leve elevación térmica
                prog = 1.0 - (self.state_remaining_blocks / max(1, self.state_total_blocks))
                temp += 0.3 * prog
                dist *= 1.0 + 0.3 * prog
            elif self.state_subphase == 1:
                # Clímax febril: fiebre manifiesta (39.8°C a 40.8°C)
                fever_intensity = float(self.rng.normal(1.8, 0.25))
                temp += max(1.2, fever_intensity)
                # Al inicio de la fiebre hay agitación, luego decaimiento
                dist *= 1.4
            elif self.state_subphase == 2:
                # Resolución: temperatura baja gradualmente a la normalidad y descanso
                prog = self.state_remaining_blocks / max(1, self.state_total_blocks)
                temp += 0.6 * prog
                dist *= 0.6  # recuperación/reposo

        elif self.current_state == "celo":
            is_celo = 1
            temp += float(self.rng.normal(0.35, 0.08))
            # Durante el celo camina entre 2x y 3x lo habitual
            dist *= float(self.rng.normal(2.4, 0.3))

        elif self.current_state == "inactividad":
            is_inactividad = 1
            temp -= float(self.rng.normal(0.25, 0.06))
            # Desplazamiento mínimo (pastoreo casi ausente)
            dist = max(1.0, float(self.rng.normal(4.0, 1.5)))

        elif self.current_state == "anomalia":
            is_anomalia = 1
            # Movimiento explosivo errático (4x a 6x)
            dist *= float(self.rng.normal(4.8, 0.8))

        # Velocidad media en metros por minuto (distancia en 30 min / 30)
        velocidad_m_min = round(dist / float(BLOCK_MINUTES), 2)

        return {
            "animal_id": self.animal_id,
            "timestamp": local_dt.isoformat(),
            "sex": self.sex,
            "temp_corporal": round(temp, 2),
            "distancia_rodeo": round(dist, 1),
            "velocidad_m_min": velocidad_m_min,
            "estado_actual": self.current_state,
            "label_fiebre": is_fiebre,
            "label_celo": is_celo,
            "label_inactividad": is_inactividad,
            "label_anomalia": is_anomalia,
        }


def generate_dataset(
    num_animals: int = 80,
    days: int = 25,
    output_path: str = "data/telemetry_dataset.csv",
    seed: int = 42,
) -> pd.DataFrame:
    """Genera el dataset completo y lo guarda en CSV."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    random.seed(seed)
    np.random.seed(seed)

    start_date = datetime(2026, 8, 1, 0, 0, 0, tzinfo=FARM_TZ)
    total_blocks = days * 24 * (60 // BLOCK_MINUTES)

    print(f"==================================================")
    print(f" DAMP Agro - Generador de Dataset Sintético")
    print(f"==================================================")
    print(f" Animales: {num_animals}")
    print(f" Días de simulación: {days} ({total_blocks} bloques de {BLOCK_MINUTES}m por animal)")
    print(f" Total filas esperadas: {num_animals * total_blocks:,}")
    print(f" Archivo de destino: {output_path}")
    print(f"--------------------------------------------------")

    animals: List[AnimalSimulator] = []
    for i in range(num_animals):
        aid = f"A-{i+1:03d}"
        # 80% hembras (para que haya ciclos de celo), 20% machos
        sex = "FEMALE" if random.random() < 0.80 else "MALE"
        animals.append(AnimalSimulator(aid, sex, seed + i * 100))

    all_rows = []
    print("⏳ Generando series temporales...")
    for b in range(total_blocks):
        current_dt = start_date + timedelta(minutes=b * BLOCK_MINUTES)
        for a in animals:
            all_rows.append(a.step(current_dt))

        if (b + 1) % (total_blocks // 10 or 1) == 0 or (b + 1) == total_blocks:
            pct = int(100 * (b + 1) / total_blocks)
            print(f"   Progreso: {pct}% ({len(all_rows):,} lecturas)")

    df = pd.DataFrame(all_rows)
    df.to_csv(output_path, index=False)

    print("\n✅ Dataset generado exitosamente:")
    print(f"   Dimensiones: {df.shape[0]:,} filas x {df.shape[1]} columnas")
    print("   Distribución de estados actuales:")
    state_counts = df["estado_actual"].value_counts(normalize=True) * 100
    for state, pct in state_counts.items():
        print(f"     - {state:<12}: {pct:5.2f}% ({int((pct/100)*len(df)):,} filas)")

    print("   Resumen de etiquetas binarias activas:")
    for lbl in ["label_fiebre", "label_celo", "label_inactividad", "label_anomalia"]:
        active = int(df[lbl].sum())
        pct = (active / len(df)) * 100
        print(f"     - {lbl:<18}: {pct:5.2f}% ({active:,} bloques)")
    print(f"==================================================\n")

    return df


def main():
    parser = argparse.ArgumentParser(description="Generador de telemetría sintética DAMP")
    parser.add_argument("--animals", type=int, default=80, help="Cantidad de animales (default: 80)")
    parser.add_argument("--days", type=int, default=25, help="Días de historial a generar (default: 25)")
    parser.add_argument("--output", type=str, default="data/telemetry_dataset.csv", help="Ruta del CSV de salida")
    parser.add_argument("--seed", type=int, default=42, help="Semilla para reproducibilidad")
    args = parser.parse_args()

    # Si output es relativo, ubicarlo respecto al directorio del ml-service
    out = args.output
    if not os.path.isabs(out):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        out = os.path.join(base_dir, out)

    generate_dataset(num_animals=args.animals, days=args.days, output_path=out, seed=args.seed)


if __name__ == "__main__":
    main()
