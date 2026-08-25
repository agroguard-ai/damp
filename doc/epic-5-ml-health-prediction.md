# Epic 5: Inferencia ML y Detección Temprana de Enfermedades

* **Autor**: Antigravity (versión original) — actualizado por Claude (sesión con Santino)
* **Fecha de Creación**: 09/07/2026
* **Última actualización**: 25/08/2026
* **Estado**: Modelo LSTM real entrenado, testeado, versionado con DVC y **conectado al backend** — genera alertas `HEALTH` reales a partir de telemetría real. Detalle completo en `damp-ml-api/README.md`.

> **Aviso sobre versiones anteriores de este doc**: la primera versión describía como "Completado" una integración (`iot.service.ts` → `ml-service` → alertas `HEALTH`) que en realidad **fue eliminada del código el 14/07/2026**, 5 días después de escrita, y nunca se restauró — quedó como aspiración documentada, no como código real. La versión del 17/08/2026 dejó el modelo entrenado pero todavía sin conectar. Esta versión (25/08/2026) sí describe una integración end-to-end verificada.

## 1. Qué existe ahora (25/08/2026)

### 1.1 Modelo LSTM multitarea (`damp-ml-api`)

LSTM bidireccional + LSTM, tronco compartido, 4 cabezas de salida (fiebre/celo/inactividad/anomalía).
Entrada: ventana de 24hs de telemetría (48 lecturas). Predicción: si cada evento va a estar activo en
las próximas 6hs (tarea genuinamente predictiva, no clasificación del instante actual). Entrenado y
evaluado contra un hold-out set (test, 15% de los animales, nunca visto durante entrenamiento ni
ajuste de umbral) generado 100% con datos sintéticos de `generador.py` — no hay ni va a haber datos de
campo reales (limitación de alcance conocida y aceptada, ver `CLAUDE.md`). Detalle completo,
arquitectura y cómo reproducirlo: [`damp-ml-api/README.md`](../../damp-ml-api/README.md).

**Cambio de features (25/08/2026)**: la primera versión del modelo (17/08) se entrenó con 11 features,
incluyendo varias que el collar real no puede proveer — pasos (no hay acelerómetro), temperatura y
humedad ambiente (no hay sensor ambiental), días desde el último celo (el backend no registra ciclos
de celo). Server ese modelo tal cual habría significado rellenar esas 5 columnas con un valor
constante en cada inferencia real: un desajuste entrenamiento-servido (*training-serving skew*) que
sesga las predicciones de forma impredecible, no solo las degrada. Se reentrenó usando solo las 6
features que el collar puede dar hoy o en el corto plazo: temperatura corporal, distancia recorrida
(aproximada por GPS hasta que el firmware mande el dato nativo de los últimos 5 minutos), hora del día
(seno/coseno), si es de noche, sexo. Detalle completo en `damp-ml-api/README.md`, sección "Features
del modelo: qué es real y qué no".

**Métricas reales sobre el test set** (calculadas exclusivamente sobre datos nunca vistos durante
entrenamiento ni ajuste de umbral — corrida del 25/08/2026, ver
`damp-ml-api/machine-learning/outputs/artifacts/metrics_report.json` para el detalle completo):

| Evento | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|
| Fiebre | 0.980 | 0.809 | 0.886 | 0.916 |
| Celo | 0.699 | 0.627 | 0.661 | 0.960 |
| Inactividad | 0.949 | 0.725 | 0.822 | 0.954 |
| Anomalía | 0.980 | 0.410 | 0.578 | 0.727 |

Comparado con la corrida del 17/08 (11 features, incluyendo señales que el collar real no puede dar):
`fiebre` y `anomalía` se mantuvieron o mejoraron levemente, pero `celo` bajó notoriamente (F1 0.809 →
0.661) e `inactividad` también (F1 0.908 → 0.822) — se apoyaban fuerte en `dias_desde_celo` y
`pasos_30min`, ambas sacadas por no ser reales. Es el costo esperado de priorizar un modelo honesto
sobre uno mejor solo en el papel, no una regresión sin explicar (detalle en `damp-ml-api/README.md`).

`anomalía` sigue siendo el evento más difícil de predecir de los cuatro — es la categoría más rara en
los datos y, por diseño del propio generador sintético, la menos "fisiológicamente coherente".

### 1.2 Tests automatizados (nuevo, `damp-ml-api/tests/` y `damp/ml-service/tests/`)

- **`damp-ml-api/tests/`** (pytest, 21 tests): ventaneo temporal — el target sale del horizonte futuro,
  nunca de la ventana de entrada (verificado explícitamente para no dejar pasar fuga de datos);
  partición train/val/test sin que un mismo animal aparezca en dos splits; el `StandardScaler` se
  ajusta solo con train; arquitectura del modelo (shapes de entrada/salida, rango válido de
  probabilidades); helpers de `train.py` (elección de umbral por F1, formato de targets). Escribir
  estos tests encontró un bug real en `make_windows()` (crasheaba con `ValueError` si ningún animal
  tenía suficiente historial, en vez de devolver un array vacío) — se arregló como parte de esta
  sesión.
- **`damp/ml-service/tests/`** (pytest, 8 tests + 2 que requieren el modelo copiado localmente):
  feature engineering (Haversine, codificación de hora, `es_noche`, `sexo_num`) contra casos con
  resultado conocido a mano; comportamiento cuando el modelo no cargó (503) y cuando la ventana de
  lecturas es insuficiente (`ready: false`, no inventa datos para completar la ventana).
- **`damp/backend`**: `src/iot/iot.service.spec.ts` y `src/iot/ml-health.service.spec.ts` (Jest, 11
  tests) — dedupe de alertas por prefijo (fiebre por umbral y celo por IA no se bloquean entre sí),
  ventana de telemetría armada en orden cronológico correcto, `ml-service` caído no rompe la ingesta.
  Se corrigió además `package.json` (`jest.moduleNameMapper`): el alias `@/*` usado en todo `src/` no
  estaba mapeado para Jest — sin eso, cualquier test que importara un servicio real fallaba al resolver
  módulos, con o sin relación a este cambio.

### 1.3 Versionado de datos y modelos con DVC (nuevo, `damp-ml-api`)

`outputs/` (dataset generado + artefactos entrenados) sigue sin ir a git por peso, pero ahora está
versionado de verdad con [DVC](https://dvc.org): `dvc.yaml` declara el pipeline en 3 etapas
(`generate` → `preprocess` → `train`), `dvc.lock` fija el hash de contenido exacto de cada corrida
(sí se commitea a git). `dvc repro` reproduce el pipeline completo o solo lo desactualizado;
`dvc metrics show/diff` compara resultados entre corridas. El remote configurado hoy es una carpeta
local (placeholder, no compartible entre máquinas) — pasar a un remote real (S3/GCS/Drive) queda
pendiente, es un solo comando cuando el equipo tenga esa infraestructura. Detalle en
`damp-ml-api/README.md`, sección "Versionado de datos y modelos (DVC)".

### 1.4 Microservicio Python (`damp/ml-service`) — reescrito, ahora sirve el modelo real

`main.py` fue reescrito por completo. Ya no es un stub por reglas fijas: al arrancar, carga
`final_model.keras` + `scaler.joblib` + `thresholds.joblib` + `metadata.joblib` desde
`ml-service/model/` (copiados manualmente desde `damp-ml-api/machine-learning/outputs/` — no hay
todavía un mecanismo compartido de distribución de artefactos entre los dos repos, ver "Qué queda por
hacer"). El feature engineering de `main.py` replica exactamente el de
`damp-ml-api/machine-learning/model/preprocess.py` (mismo cálculo de `hour_sin/cos`, `es_noche`,
`distancia_rodeo` vía Haversine) — si alguno de los dos cambia, hay que cambiar el otro, no hay una
única fuente de verdad compartida entre repos (limitación conocida, ver "Qué queda por hacer").

### 1.5 Backend conectado al modelo real (nuevo)

`backend/src/iot/iot.service.ts` llama al modelo en cada lectura de telemetría, además de (no en vez
de) la heurística por umbrales configurables que ya existía (`epic-4`, CU016). Ver sección 2 para el
contrato y la justificación de por qué conviven ambas.

## 2. Contrato del Microservicio de Inferencia (Python FastAPI) — vigente

* **Endpoint**: `POST http://localhost:8000/predict/health`
* **Request Body (JSON)**:
  ```json
  {
    "animal_id": "uuid-del-animal",
    "sex": "MALE",
    "readings": [
      { "temperature": 39.7, "lat": -33.3082, "lng": -61.8742, "timestamp": "2026-08-25T17:40:00.000Z" }
    ]
  }
  ```
  `readings` va en orden cronológico. Si trae menos de 48 lecturas (la ventana que el modelo necesita),
  la respuesta es `ready: false` — el servicio **no** rellena la ventana con datos inventados.
* **Response Body (200 OK, ventana completa)**:
  ```json
  {
    "animal_id": "uuid-del-animal",
    "ready": true,
    "window_size": 48,
    "required_window_size": 48,
    "events": {
      "fiebre": { "probability": 0.83, "threshold": 0.35, "detected": true },
      "celo": { "probability": 0.12, "threshold": 0.40, "detected": false },
      "inactividad": { "probability": 0.05, "threshold": 0.30, "detected": false },
      "anomalia": { "probability": 0.18, "threshold": 0.45, "detected": false }
    }
  }
  ```
* **Response Body (200 OK, historial insuficiente)**: `{ "animal_id": "...", "ready": false, "window_size": 12, "required_window_size": 48, "events": {} }`
* **503**: el modelo no pudo cargar (artefactos ausentes o corruptos) — `GET /health` también reporta `model_loaded: false` con el detalle del error.

### 2.1 Cómo lo consume el backend

`IotService.checkPredictiveHealth()` (llamado desde `handleTelemetry`, después de la heurística por
umbrales existente):

1. Busca las últimas 48 `TelemetryReading` del collar del animal (`ML_WINDOW_SIZE`, exportado desde
   `ml-health.service.ts` — debe coincidir con el `lookback` del modelo).
2. Si hay menos de 48, no llama al servicio — evita una llamada HTTP que sabemos que va a volver
   `ready: false`.
3. Si hay suficientes, llama a `MlHealthService.predict()` con las lecturas en orden cronológico y el
   sexo del animal.
4. Por cada evento con `detected: true`, crea `Alert(type: HEALTH, message: "[IA:FIEBRE] Modelo
   predictivo: posible fiebre en las próximas 6hs (confianza 83%).")` — el prefijo `[IA:EVENTO]` es la
   clave de dedupe (no se crea una nueva si ya hay una sin resolver con el mismo prefijo).
5. Si `ml-service` no responde o tira error de red, se loguea un warning y la ingesta de telemetría
   sigue normal — la predicción es complementaria, no puede tumbar el flujo principal.

### 2.2 Por qué conviven dos mecanismos de alerta HEALTH (y no se reemplazó uno por el otro)

| | Heurística por umbrales (`checkHealthThresholds`, CU016) | Modelo predictivo (`checkPredictiveHealth`) |
|---|---|---|
| Cuándo dispara | Con una sola lectura fuera de umbral | Necesita 24hs de historial (48 lecturas) |
| Qué mira | Instante actual | Predice hacia las próximas 6hs |
| Eventos | Fiebre, hipotermia, inactividad (3) | Fiebre, celo, inactividad, anomalía (4) |
| Configurable por granja | Sí (`AlertSettings`, umbrales editables en `/alertas`) | No — usa el umbral por F1 fijado en entrenamiento |
| Se cae si `ml-service` no está corriendo | No, no depende de él | Sí — se loguea y se sigue sin predicción |

Son complementarias, no compiten: la heurística da una respuesta instantánea y configurable por el
usuario (útil como red de seguridad simple), el modelo agrega cobertura predictiva y dos eventos que
la heurística no puede detectar en absoluto (celo, anomalía). Reemplazar la heurística habría dejado
sin sentido los umbrales configurables de CU016 (una funcionalidad real y ya usada) a cambio de una
dependencia dura de un servicio Python en un pipeline que hoy es best-effort. Si el equipo gana
confianza en las predicciones del modelo en uso real, tiene sentido revisar esta decisión — hoy no hay
señal para tomarla.

### 2.3 Anti-spam de alertas HEALTH — dedupe por prefijo, no por tipo

Antes, cualquier alerta `HEALTH` sin resolver bloqueaba la creación de cualquier otra `HEALTH` para
ese animal, sin importar el motivo — con un solo mecanismo de alerta esto no importaba, pero con dos
(y cuatro tipos de evento del lado del modelo) habría significado que una alerta de fiebre por umbral
bloqueara indefinidamente una de celo predicha por el modelo. Se cambió el dedupe para que compare por
prefijo del mensaje (`[UMBRAL:FIEBRE]`, `[UMBRAL:HIPOTERMIA]`, `[UMBRAL:INACTIVIDAD]`,
`[IA:FIEBRE]`, `[IA:CELO]`, `[IA:INACTIVIDAD]`, `[IA:ANOMALIA]`) en vez de por tipo a secas — sin
migración de schema, sigue siendo todo `AlertType.HEALTH`.

## 3. Mapa del Código

| Capa | Archivo | Estado |
|---|---|---|
| Generador de datos | `damp-ml-api/machine-learning/data-generator/generador.py` | Sin cambios funcionales |
| Preprocesamiento | `damp-ml-api/machine-learning/model/preprocess.py` | Feature set reducido a 6 columnas reales (25/08); bug de `make_windows()` con historial insuficiente arreglado |
| Arquitectura | `damp-ml-api/machine-learning/model/model.py` | Sin cambios desde el 17/08 |
| Entrenamiento/evaluación | `damp-ml-api/machine-learning/model/train.py` | Sin cambios de lógica, reentrenado con el nuevo feature set |
| Tests del pipeline ML | `damp-ml-api/tests/` | **Nuevo** — 21 tests pytest |
| Pipeline versionado | `damp-ml-api/dvc.yaml`, `dvc.lock` | **Nuevo** — DVC, remote local placeholder |
| Modelo entrenado | `damp-ml-api/machine-learning/outputs/artifacts/final_model.keras` | Generado localmente, versionado con DVC (no con git) |
| Microservicio | `damp/ml-service/main.py` | **Reescrito** — carga el modelo real, ya no es un stub por reglas |
| Tests del microservicio | `damp/ml-service/tests/` | **Nuevo** — 8 tests pytest (+2 que requieren el modelo copiado) |
| Backend | `backend/src/iot/iot.service.ts` | `checkPredictiveHealth` (nuevo), `raiseHealthAlert` con dedupe por prefijo (cambiado) |
| Backend | `backend/src/iot/ml-health.service.ts` | **Nuevo** — cliente HTTP hacia `ml-service`, resiliente a caídas |
| Tests del backend | `backend/src/iot/iot.service.spec.ts`, `ml-health.service.spec.ts` | **Nuevo** — 11 tests Jest |
| Config Jest | `backend/package.json` (`jest.moduleNameMapper`) | **Arreglado** — el alias `@/*` no estaba mapeado, necesario para que cualquier test pudiera importar servicios reales |

## 4. Qué queda por hacer

1. **Distribución de artefactos entre repos**: hoy `ml-service/model/*.keras`/`*.joblib` se copian a
   mano desde `damp-ml-api/machine-learning/outputs/` después de `dvc repro`. Funciona para desarrollo
   local, pero no hay CI ni proceso automático que mantenga esa copia sincronizada — si se reentrena el
   modelo y no se vuelve a copiar, `ml-service` sigue sirviendo el modelo viejo sin ningún aviso.
2. **Feature engineering duplicado entre repos**: `ml-service/main.py` y
   `damp-ml-api/machine-learning/model/preprocess.py` calculan las mismas features con código
   independiente — si uno cambia sin el otro, las predicciones en producción divergen silenciosamente
   de lo que el modelo aprendió. No hay un paquete compartido entre los dos repos hoy.
3. **Remote de DVC real** (S3/GCS/Drive) en vez del local placeholder — ver `damp-ml-api/README.md`.
4. **Reemplazar la distancia GPS-derivada** por el dato nativo del collar cuando `agroguard-firmware`
   lo mande (distancia recorrida en los últimos 5 minutos) — verificar que la distribución sea
   comparable antes de asumir que no hace falta reentrenar.
5. **Mejorar `anomalía`**, la métrica más débil de las cuatro — ver `damp-ml-api/README.md`.
6. **Revisar si el modelo debería reemplazar (no solo complementar) la heurística de `AlertSettings`**
   una vez que el equipo tenga confianza en las predicciones en uso real (ver sección 2.2).
