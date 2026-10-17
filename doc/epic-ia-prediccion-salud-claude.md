# IA de salud: corrección del pipeline, simulador y vista en el front

* **Autor**: Claude (sesión con Santino)
* **Fecha de Finalización**: 13/10/2026
* **Estado**: Completado. Validado contra el modelo real con tests automáticos; **falta recorrerlo en el navegador**.
* **Commits** (rama `dev`): `6500a61` (pipeline), `35557bd` (simulador), `10b1a0c` (front)
* **Relacionado**: [Epic 5](epic-5-ml-health-prediction.md) describe el modelo, su entrenamiento y sus métricas. Este doc
  describe cómo se le arman los datos, cómo se prueba y dónde se ve. Donde se contradigan, vale este.

## 1. Resumen de la Solución Técnica

### 1.1 Qué hace la IA

Un modelo LSTM multitarea (entrenado en `damp-ml-api`, servido por `damp/ml-service` en el puerto 8000) predice,
para cada animal, si en las **próximas 6 h** va a tener **fiebre, celo, inactividad o una anomalía**. Para eso mira
sus **últimas 24 h** de telemetría (temperatura corporal y metros recorridos), más la hora del día y el sexo.

Flujo completo:

```
collar → gateway → POST /iot/telemetry → se guarda la lectura (respuesta inmediata al gateway)
                                       └→ en segundo plano: ¿cerró un bloque de 30 min nuevo?
                                            → arma la ventana de 48 bloques (ml-window.ts)
                                            → POST ml-service /predict
                                            → guarda 4 HealthPrediction (una por evento)
                                            → si alguna supera su umbral: alerta HEALTH "[IA:fiebre] ..."
front → Alertas › Salud Predictiva / Hacienda ← GET /alerts/predictions, /current-risk, /:id/inputs
```

### 1.2 El problema: el modelo recibía datos distintos a los de su entrenamiento

El modelo se entrenó con **una fila cada 30 min, en hora local** (`clean()` y `LOOKBACK=48` en `damp-ml-api`).
El backend le mandaba otra cosa:

| | Entrenamiento | Lo que recibía antes | Ahora |
|---|---|---|---|
| Ventana | 48 bloques × 30 min = **24 h** | Últimas 48 lecturas crudas (el collar manda cada ~5 min → **4 h**) | 48 bloques de 30 min = 24 h |
| Hora | Local (Argentina) | UTC → `es_noche` y `hour_sin/cos` corridos 3 h | Hora local (`-03:00`) |
| Distancia | Metros recorridos en 30 min | Metros entre dos lecturas sueltas (~6 veces menos) | Metros recorridos en el bloque |
| Huecos | ffill/bfill | No se rellenaban | ffill/bfill, igual que `clean()` |
| Frecuencia | — | Una predicción **por lectura**, bloqueando la respuesta al gateway | Una por bloque, en segundo plano |

Con los datos mal armados el modelo daba probabilidades que no significaban nada. Ahora, validado con el modelo
real (ver 4.3), cada escenario dispara su evento y el animal sano no dispara nada.

### 1.3 Backend (NestJS)

* **`backend/src/iot/ml-window.ts` (nuevo).** Funciones puras, testeadas aparte:
  * `blockStartFor(date)`: inicio del bloque de 30 min que contiene esa fecha.
  * `toFarmLocalIso(date)`: ISO con el offset del campo, p. ej. `2026-10-13T14:30:00-03:00`.
  * `buildMlWindow(readings, anchor)`: agrupa las lecturas en los 48 bloques anteriores a `anchor`. Por bloque
    calcula la temperatura promedio y los metros recorridos, sumando Haversine entre posiciones consecutivas e
    incluyendo el tramo desde la última posición del bloque anterior. Ignora posiciones `0,0` (GPS sin fix).
    Rellena los bloques vacíos con ffill/bfill y devuelve cuántos tenían datos reales.
  * Constantes: `ML_WINDOW_BLOCKS = 48`, `ML_BLOCK_MINUTES = 30`, `ML_MIN_BLOCKS_WITH_DATA = 36` (con menos
    datos no predice), `FARM_UTC_OFFSET_MINUTES = -180`.
* **`iot.service.ts`:**
  * Después de guardar la lectura, lanza `checkPredictiveHealth` **sin esperarlo** (con `.catch` que loguea).
    El gateway recibe su respuesta (y el cerco pendiente) sin esperar a la IA.
  * La ventana termina al **inicio del bloque actual**, así que solo se analizan bloques cerrados. Si ya existe
    una predicción del animal para ese `windowEndAt`, no se vuelve a predecir.
  * `resolveReadingTime(payload)`: si la lectura trae `timestamp` y `ALLOW_SIMULATED_TIMESTAMPS=true`, se usa esa
    hora. Si el flag está apagado, responde **400**. Sin `timestamp` se usa la hora del servidor, como siempre.
  * El chequeo de inactividad por reglas se calcula relativo a la hora de la lectura, no a "ahora", para que el
    historial simulado no dispare alertas falsas.
* **`ml-health.service.ts`:** timeout de 10 s en `/predict` y método nuevo `status()` contra `/health` (3 s).
* **`alerts.service.ts` / `alerts.controller.ts`:** tres endpoints nuevos para el front (sección 2.1).

### 1.4 Base de datos (Prisma)

Migración `20261013120000_health_prediction_window_end`:

* `health_predictions.window_end_at` (`DateTime?`): fin de la ventana analizada. Es nullable porque las
  predicciones viejas no lo tienen.
* Índice único `(animal_id, predicted_event, window_end_at)`, para no repetir predicciones de la misma ventana.
* `window_readings_count` ahora guarda **cuántos de los 48 bloques tenían datos reales**, no lecturas crudas.

### 1.5 Microservicio de IA (`ml-service/main.py`)

* `TelemetryReading.distance_m` (opcional): si viene, se usa tal cual. Si no, se calcula Haversine contra la
  lectura anterior, para mantener la compatibilidad con clientes viejos.
* La hora del `timestamp` se toma **con su offset**: el backend manda hora local y de ahí salen `es_noche` y
  `hour_sin/cos`.
* `PredictionRequest.include_features`: si es `true`, la respuesta trae `features`, la matriz exacta que vio el
  modelo. Sirve para depurar.

### 1.6 Frontend (Next.js)

* **Alertas → "Salud Predictiva"** (`components/alerts/PredictiveHealthMonitoring.tsx`):
  * **Estado del servicio** arriba de todo. Muestra "Modelo de IA activo" en verde, o un aviso amarillo si el
    servicio no responde o no cargó el modelo, con cómo levantarlo.
  * **Evolución**: al elegir un animal en el filtro, aparece un gráfico por evento con la probabilidad en el
    tiempo y el umbral punteado.
  * Cada predicción muestra la hora de su ventana, cuántos bloques tenían datos y el botón **"¿En qué se basó?"**.
* **"¿En qué se basó?"** (`components/alerts/PredictionInputsModal.tsx`): las 24 h que analizó el modelo.
  * Resumen: bloques con datos, temperatura máxima y recorrido medio.
  * Gráfico de línea de temperatura y de barras de metros recorridos. Las barras claras son bloques rellenados.
  * Los mismos datos en una tabla desplegable.
* **Hacienda** (`app/(dashboard)/animals/page.tsx`): un badge violeta con 🧠 junto al estado de salud por cada
  evento detectado en las últimas 6 h (p. ej. "Fiebre 97%").
* **`components/charts/TimeSeriesChart.tsx` (nuevo):** gráfico SVG de una sola serie (línea o barras), sin
  librerías. Tiene tooltip, línea de referencia y modo oscuro.
* Las alertas siguen apareciendo en la lista general de Alertas con el prefijo `[IA:evento]`.

### 1.7 Infraestructura

* `start.bat` levanta `ml-service` con `docker-compose up -d --build ml-service` en el paso 2/4. Si falla, avisa y
  sigue: el resto del sistema anda sin IA.
* `backend/.env.example` documenta `ALLOW_SIMULATED_TIMESTAMPS=false`.

## 2. Contrato de Integración y Consumo (Cómo Conectarse)

### 2.1 Endpoints nuevos del backend

Todos requieren sesión (JWT) y devuelven solo datos de los campos del usuario.

* **`GET /alerts/ml-status`**: estado del microservicio.
  ```json
  { "online": true, "modelLoaded": true, "error": null, "requiredWindowBlocks": 48 }
  ```
  Si no responde: `{ "online": false, "modelLoaded": false, "error": "...", "requiredWindowBlocks": null }`.

* **`GET /alerts/predictions/current-risk?farmId=<uuid>`**: animales con algún evento **detectado** en las
  últimas 6 h. Trae la probabilidad más alta por animal y evento, ordenada de mayor a menor.
  ```json
  [
    {
      "animalId": "uuid",
      "events": [
        { "event": "fiebre", "probability": 0.97, "createdAt": "2026-10-13T17:30:05.000Z" },
        { "event": "anomalia", "probability": 0.61, "createdAt": "2026-10-13T17:30:05.000Z" }
      ]
    }
  ]
  ```

* **`GET /alerts/predictions/:id/inputs`**: la ventana que analizó una predicción. Se reconstruye desde la
  telemetría con la misma función que usa la IA, con los collares que tuvo el animal en ese período.
  ```json
  {
    "predictionId": "uuid",
    "animal": { "id": "uuid", "tag": "A-102" },
    "predictedEvent": "fiebre",
    "probability": 0.97,
    "threshold": 0.42,
    "detected": true,
    "windowStart": "2026-10-12T17:30:00.000Z",
    "windowEnd": "2026-10-13T17:30:00.000Z",
    "blocksWithData": 48,
    "blocks": [
      { "timestamp": "2026-10-12T14:30:00-03:00", "temperature": 38.52, "distanceMeters": 24, "hasData": true }
    ]
  }
  ```
  Las predicciones viejas, sin `windowEndAt`, usan como fin el inicio del bloque en que se crearon. Responde 404
  si la predicción no existe y 403 si es de un campo al que el usuario no tiene acceso.

* **`GET /alerts/predictions`** (ya existía): cada predicción ahora trae `windowEndAt`.

Los proxies del front están en `frontend/src/app/api/alerts/{ml-status,predictions/current-risk,predictions/[id]/inputs}/route.ts`
y las funciones en `lib/api/alerts.ts`: `getMlStatus`, `getCurrentMlRisk` y `getPredictionInputs`.

### 2.2 Telemetría con hora simulada

`POST /iot/telemetry` acepta un campo opcional más:

```json
{ "collarId": "...", "temperature": 38.6, "lat": -34.6, "lng": -58.4, "timestamp": "2026-10-12T14:35:00-03:00" }
```

* Con `ALLOW_SIMULATED_TIMESTAMPS=true`, la lectura se guarda con esa hora.
* Con el flag apagado (el default), responde **400** si viene `timestamp`.

> ⚠️ **Nunca activar `ALLOW_SIMULATED_TIMESTAMPS` en producción**: cualquiera con la API key de un gateway podría
> cargar historial falso y disparar o tapar alertas.

### 2.3 Backend → `ml-service`

`POST {ML_SERVICE_URL}/predict`:

```json
{
  "animal_id": "uuid",
  "sex": "FEMALE",
  "readings": [
    { "temperature": 38.5, "lat": -34.6, "lng": -58.4, "timestamp": "2026-10-12T14:30:00-03:00", "distance_m": 24.0 }
  ],
  "include_features": false
}
```

* `readings` son **exactamente 48 bloques** en orden cronológico.
* La respuesta trae, por evento, `probability`, `threshold` y `detected`.
* Con menos de 48 bloques responde `ready: false` y el backend no guarda nada.

## 3. Mapa del Código (Dónde buscar)

| Parte | Archivo |
|---|---|
| Armado de la ventana | `backend/src/iot/ml-window.ts` (+ `ml-window.spec.ts`) |
| Disparo de la predicción | `backend/src/iot/iot.service.ts` (`checkPredictiveHealth`, `resolveReadingTime`) |
| Cliente HTTP de la IA | `backend/src/iot/ml-health.service.ts` |
| Endpoints para el front | `backend/src/alerts/alerts.service.ts` / `alerts.controller.ts` |
| Modelo de datos | `backend/prisma/schema.prisma` (`HealthPrediction`) + migración `20261013120000_health_prediction_window_end` |
| Microservicio | `ml-service/main.py` (+ `ml-service/tests/test_main.py`) |
| Simulador | `scripts/ml-simulator.js` |
| Pantalla de predicciones | `frontend/src/components/alerts/PredictiveHealthMonitoring.tsx` |
| "¿En qué se basó?" | `frontend/src/components/alerts/PredictionInputsModal.tsx` |
| Badge en Hacienda | `frontend/src/app/(dashboard)/animals/page.tsx` |
| Gráfico | `frontend/src/components/charts/TimeSeriesChart.tsx` |
| Nombres de eventos | `frontend/src/components/alerts/mlEvents.ts` |

## 4. Instrucciones de Prueba Rápida

### 4.1 Levantar todo

1. En `backend/.env`, poner `ALLOW_SIMULATED_TIMESTAMPS=true` (solo en local).
2. Migrar la base con `cd backend && pnpm db:migrate`.
3. Correr `start.bat`. Levanta Postgres, `ml-service`, backend y front. La primera vez tarda porque construye la
   imagen de la IA.
4. Chequear la IA: `curl http://localhost:8000/health` tiene que devolver `"model_loaded": true`. En la app,
   Alertas → Salud Predictiva tiene que decir "Modelo de IA activo".

### 4.2 Simulador (`scripts/ml-simulator.js`)

Manda telemetría como un gateway real (con `X-API-Key`), con patrones copiados del generador con el que se
entrenó el modelo (`damp-ml-api/machine-learning/data-generator/generador.py`).

**Configuración.** Usa `scripts/ml-simulator.config.json` si existe; si no, reutiliza
`scripts/fleet-simulator.config.json` (`baseUrl`, `gatewayId`, `apiKey`, `geofencePolygon`, `collars`). Los dos
están en `.gitignore` porque tienen la API key. Los collares tienen que estar **asignados a animales**. Para
crear gateway, collares y animales de prueba se puede usar `node scripts/bootstrap-simulation.js`.

**Escenarios.** Cada collar puede tener `"scenario"` en la config. Si no lo tiene, se reparten en orden: fiebre,
inactividad, anomalía, celo, sano.

| Escenario | Qué simula |
|---|---|
| `sano` | ~38,5 °C con ciclo diario, ~25 m cada 30 min |
| `fiebre` | La temperatura sube ~1,8 °C en 4 h y se mueve ~2,2 veces más |
| `inactividad` | Distancia casi constante entre bloques y −0,2 °C |
| `celo` | +0,3 °C y menos movimiento. **Solo tiene efecto en hembras** |
| `anomalia` | Se mueve ~4,5 veces más de lo normal |

**Uso.**

```bash
node scripts/ml-simulator.js                      # 26 h de historial en segundos
node scripts/ml-simulator.js --live               # historial + sigue en vivo cada 5 s (--tick=N)
node scripts/ml-simulator.js --scenario=fiebre    # todos los collares con el mismo escenario
node scripts/ml-simulator.js --history-hours=30 --interval-min=5 --event-start-hours=8
node scripts/ml-simulator.js --config=otra-config.json
```

* `--history-hours`: cuántas horas de historial carga (default 26).
* `--interval-min`: cada cuántos minutos manda una lectura (default 5, como el collar).
* `--event-start-hours`: cuántas horas antes del final empieza el evento (default 8).

Durante el historial, el backend va cerrando bloques y predice uno por uno. Al terminar ya hay ~4 h de
predicciones por animal para ver la evolución.

### 4.3 Qué esperar

Probabilidad del evento de cada escenario con el modelo real, antes del evento → al final del historial:

| Escenario | Antes | Al final |
|---|---|---|
| fiebre | 0,13 | **0,99** |
| inactividad | 0,06 | **0,71** |
| celo (hembra) | 0,05 | **0,69** |
| anomalía | 0,07 | **0,52** |
| sano | ≤ 0,12 en todos los eventos | sin alertas |

En la app:

* **Alertas → Salud Predictiva:** predicciones detectadas. Al elegir un animal aparece la curva subiendo y
  cruzando el umbral; "¿En qué se basó?" muestra la fiebre o el cambio de movimiento en las últimas horas.
* **Alertas (lista):** alertas `[IA:fiebre]`, `[IA:anomalia]`, etc.
* **Hacienda:** badges 🧠 en los animales con eventos.

### 4.4 Tests automáticos

```bash
cd backend && pnpm test -- src/iot src/alerts     # ventana, disparo, timestamps simulados, endpoints
cd ml-service && pytest                           # 14 tests, incluidos los de punta a punta con el modelo real
```

`collars.service.spec.ts` ya fallaba antes de este trabajo (le falta el mock de `collarRequest`) y no tiene
relación con esto.

### 4.5 Si algo no anda

| Síntoma | Causa probable |
|---|---|
| El simulador recibe 400 "timestamp" | Falta `ALLOW_SIMULATED_TIMESTAMPS=true` o no se reinició el backend |
| Aviso amarillo "El servicio de IA no responde" | `ml-service` no levantó: `docker-compose up -d --build ml-service` y ver `docker logs` |
| No aparece ninguna predicción | El collar no está asignado a un animal, o hay menos de 36 de 48 bloques con datos (cargar más historial) |
| El celo no dispara | El animal es macho |
| Error de columna `window_end_at` | Falta correr la migración |

## 5. Pendientes

* El feedback de "falso positivo" se guarda, pero todavía no se usa para evaluar ni reentrenar el modelo.
* Las métricas del modelo son contra datos sintéticos; no hay datos de campo reales.
* La zona horaria del campo está fija en UTC-3 (`FARM_UTC_OFFSET_MINUTES`). Si hubiera campos fuera de
  Argentina, habría que guardarla por campo.
* Los artefactos del modelo se siguen copiando a mano de `damp-ml-api` a `ml-service/model/` (ver Epic 5).
* No se probó en el navegador.
