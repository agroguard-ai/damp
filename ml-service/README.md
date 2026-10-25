# DAMP Agro — Servicio de IA (Predicción de Salud)

Microservicio y pipeline de Machine Learning para detección de salud bovina (`fiebre`, `celo`, `inactividad`, `anomalia`):
- **Modelo 6h:** Ventana de entrada de 12h (24 bloques) para alertas inmediatas.
- **Modelo 48h:** Ventana de 48h (96 bloques) para proyectar la trayectoria en 4 etapas de 12h y estados atravesados.

---

## 1. Comandos de Pipeline y Entrenamiento

Ejecutar desde el directorio `ml-service/`:

```bash
cd ml-service

# 1. Generar dataset sintético (guarda en data/telemetry_dataset.csv)
.venv/bin/python -m pipeline.generate_dataset --animals 80 --days 25

# 2. Entrenar ambos modelos y exportar pesos (.keras y .joblib a model/)
.venv/bin/python -m pipeline.train_models --epochs 15

# 3. Probar inferencia y generar gráficas de casos (outputs/examples/*.png)
.venv/bin/python -m pipeline.visualize_predictions

# 4. Correr tests automatizados
.venv/bin/pytest -v
```

---

## 2. Iniciar y Usar la API

```bash
# Iniciar API localmente (puerto 8000)
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Endpoints principales:
- `GET /health`: Estado del servicio y modelos cargados (`model_6h`, `model_48h`).
- `POST /predict/6h` (o `/predict/health`): Requiere $\ge 24$ bloques (12h). Alerta eventos de las próximas 6h.
- `POST /predict/48h`: Requiere $\ge 96$ bloques (48h). Devuelve:
  - `passed_states_summary`: Probabilidad máxima y etapa pico para cada evento.
  - `trajectory_stages`: Detalle de probabilidades en las 4 etapas (`0-12h`, `12-24h`, `24-36h`, `36-48h`).
- `POST /predict/all`: Evalúa 6h y 48h en una sola consulta.
