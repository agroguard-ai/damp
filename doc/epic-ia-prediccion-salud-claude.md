# IA de salud: corrección del pipeline, simulador y vista en el front

* **Autor**: Claude (sesión con Santino)
* **Fecha**: 13/10/2026
* **Estado**: Completado (validado contra el modelo real; falta recorrerlo en el navegador)

## 1. Qué hace la IA

Un modelo LSTM multitarea (entrenado en `damp-ml-api`, servido por `damp/ml-service`) predice, para cada
animal, si en las **próximas 6 h** va a tener **fiebre, celo, inactividad o una anomalía**, mirando sus
**últimas 24 h** de telemetría: temperatura, metros recorridos, hora del día y sexo.

## 2. Qué se corrigió (commit `6500a61`)

El modelo se entrenó con **una lectura por bloque de 30 min, en hora local**. El backend le mandaba las
últimas 48 lecturas crudas (el collar manda cada ~5 min → eran **4 h**, no 24), con timestamps UTC
(la "noche" quedaba corrida 3 h) y distancias entre lecturas sueltas (~6 veces más chicas).

* `backend/src/iot/ml-window.ts` agrupa la telemetría en **48 bloques de 30 min en hora local**:
  temperatura promedio, metros recorridos por bloque y relleno de bloques vacíos (ffill/bfill), igual
  que `clean()` del entrenamiento. Ignora posiciones `0,0` (GPS sin fix).
* Se predice **una vez por ventana** (`HealthPrediction.windowEndAt` + índice único), con mínimo 36
  bloques con datos.
* La predicción corre **en segundo plano** con timeout: ya no demora la respuesta al gateway (que
  además era parte de por qué el cerco no le llegaba al collar).
* `ml-service` acepta `distance_m` por bloque, respeta el offset horario y puede devolver las features
  que vio (`include_features`).
* `start.bat` ahora levanta `ml-service` (puerto 8000).

## 3. Simulador (commit `35557bd`)

`scripts/ml-simulator.js` manda telemetría como un gateway real con escenarios **sano / fiebre /
inactividad / celo / anomalía**, que imitan los patrones del generador con el que se entrenó el modelo.
Carga 24+ h de historial en segundos (timestamps del pasado) y opcionalmente sigue en vivo.

Validado contra el modelo real (probabilidad del evento de cada escenario, antes del evento → al final):
fiebre 0,13 → **0,99** · inactividad 0,06 → **0,71** · celo 0,05 → **0,69** · anomalía 0,07 → **0,52**;
el escenario sano queda en ≤ 0,12 en todo.

## 4. Dónde se ve en el front

* **Alertas → "Salud Predictiva"**:
  * aviso del **estado del servicio** (activo / caído / sin modelo);
  * al elegir un animal, **evolución de la probabilidad de cada evento** con su umbral;
  * en cada predicción, **"¿En qué se basó?"**: las 24 h que analizó el modelo (temperatura y
    distancia por bloque, qué bloques se rellenaron) en gráfico y en tabla.
* **Hacienda**: badge **"🧠 Fiebre 97%"** junto al estado de salud para los animales con un evento
  detectado en las últimas 6 h.
* Las alertas generadas siguen apareciendo en la lista de Alertas con el prefijo `[IA:...]`.

Endpoints nuevos: `GET /alerts/ml-status`, `GET /alerts/predictions/current-risk?farmId=`,
`GET /alerts/predictions/:id/inputs`.

## 5. Cómo probarlo de punta a punta

1. En `backend/.env`: `ALLOW_SIMULATED_TIMESTAMPS=true` (**nunca en producción**).
2. Migrar la base: `cd backend && pnpm db:migrate`.
3. Levantar todo con `start.bat` (incluye `ml-service`; la primera vez construye la imagen).
4. Tener un gateway registrado y collares **asignados a animales** (`fleet-simulator.config.json`,
   o `node scripts/bootstrap-simulation.js` para crearlos). El celo solo tiene efecto en hembras.
5. `node scripts/ml-simulator.js` (o `--live` para seguir mandando en vivo).
6. Abrir **Alertas → Salud Predictiva** y **Hacienda**.

## 6. Pendientes

* El feedback de "falso positivo" se guarda pero todavía no se usa para evaluar ni reentrenar el modelo.
* Las métricas del modelo son contra datos sintéticos (no hay datos de campo reales).
* La zona horaria del campo está fija en UTC-3 (`FARM_UTC_OFFSET_MINUTES`); si hubiera campos fuera de
  Argentina, habría que guardarla por campo.
