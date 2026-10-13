import { haversineMeters } from './utils/haversine.utils';

/**
 * Armado de la ventana de entrada del modelo LSTM a partir de la telemetría cruda.
 *
 * El modelo (damp-ml-api) se entrenó con UNA lectura por bloque de 30 minutos y 48 bloques
 * (24 h) por ventana, en hora local del campo. El collar real manda una lectura cada ~5 min
 * (y el simulador, cada pocos segundos), así que mandar "las últimas 48 lecturas" crudas
 * le daba al modelo 4 horas en vez de 24 y distancias 6 veces más chicas: un desajuste
 * entrenamiento-servido. Acá se replica el formato del entrenamiento:
 *
 *   - bloques de 30 min alineados en hora local (Argentina, UTC-3, sin horario de verano);
 *   - temperatura = promedio de las lecturas del bloque;
 *   - distancia = metros recorridos en el bloque (suma de tramos entre lecturas consecutivas);
 *   - bloques sin lecturas: se rellenan con el bloque anterior (ffill) y los iniciales con el
 *     primero disponible (bfill), igual que `clean()` en damp-ml-api/machine-learning/model/preprocess.py.
 */

export const ML_WINDOW_BLOCKS = 48; // = lookback del modelo entrenado
export const ML_BLOCK_MINUTES = 30;
/** Bloques con datos reales mínimos para predecir (el resto se rellena); por debajo, no se predice. */
export const ML_MIN_BLOCKS_WITH_DATA = 36;
/** Offset del campo respecto de UTC. El dataset de entrenamiento está en hora local argentina. */
export const FARM_UTC_OFFSET_MINUTES = -180;

const BLOCK_MS = ML_BLOCK_MINUTES * 60 * 1000;
const OFFSET_MS = FARM_UTC_OFFSET_MINUTES * 60 * 1000;

export interface RawReading {
  temperature: number;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

/** Un bloque de 30 min tal como lo recibe ml-service. */
export interface MlBlock {
  temperature: number;
  lat: number;
  lng: number;
  /** Inicio del bloque en hora local con offset explícito, p. ej. "2026-10-13T08:30:00-03:00". */
  timestamp: string;
  /** Metros recorridos dentro del bloque. */
  distance_m: number;
}

export interface MlWindow {
  blocks: MlBlock[];
  /** Inicio (UTC) del primer bloque de la ventana. */
  windowStart: Date;
  /** Fin (UTC, exclusivo) del último bloque: identifica la ventana para no predecir dos veces. */
  windowEnd: Date;
  /** Cuántos de los 48 bloques tienen lecturas reales (el resto se rellenó). */
  blocksWithData: number;
}

/** Inicio (UTC) del bloque de 30 min, alineado en hora local, que contiene `date`. */
export function blockStartFor(date: Date): Date {
  const localMs = date.getTime() + OFFSET_MS;
  return new Date(Math.floor(localMs / BLOCK_MS) * BLOCK_MS - OFFSET_MS);
}

/** Formatea un instante UTC como ISO en hora local del campo, con su offset. */
export function toFarmLocalIso(date: Date): string {
  const local = new Date(date.getTime() + OFFSET_MS);
  const sign = FARM_UTC_OFFSET_MINUTES <= 0 ? '-' : '+';
  const abs = Math.abs(FARM_UTC_OFFSET_MINUTES);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return local.toISOString().slice(0, 19) + offset;
}

/** Un GPS sin fix manda 0,0: no es una posición real y no debe sumar distancia. */
function hasFix(r: RawReading) {
  return r.latitude !== 0 || r.longitude !== 0;
}

/**
 * Arma la ventana de 48 bloques que termina en el bloque de `anchor` (normalmente, la lectura
 * más reciente). `readings` tiene que venir ordenado por timestamp ascendente e incluir, si
 * existe, alguna lectura previa a la ventana (para medir el primer tramo recorrido).
 */
export function buildMlWindow(readings: RawReading[], anchor: Date): MlWindow {
  const windowEnd = new Date(blockStartFor(anchor).getTime() + BLOCK_MS);
  const windowStart = new Date(windowEnd.getTime() - ML_WINDOW_BLOCKS * BLOCK_MS);

  type Acc = { tempSum: number; count: number; distance: number; lat: number; lng: number };
  const acc: (Acc | null)[] = Array.from({ length: ML_WINDOW_BLOCKS }, () => null);

  let lastFix: RawReading | null = null;
  for (const r of readings) {
    const t = r.timestamp.getTime();
    if (t >= windowEnd.getTime()) break;

    const index = Math.floor((t - windowStart.getTime()) / BLOCK_MS);
    const step =
      hasFix(r) && lastFix ? haversineMeters([lastFix.latitude, lastFix.longitude], [r.latitude, r.longitude]) : 0;
    if (hasFix(r)) lastFix = r;
    if (index < 0) continue; // lectura previa a la ventana: solo sirve como punto de partida

    const block = acc[index] ?? { tempSum: 0, count: 0, distance: 0, lat: 0, lng: 0 };
    block.tempSum += r.temperature;
    block.count += 1;
    block.distance += step;
    if (hasFix(r)) {
      block.lat = r.latitude;
      block.lng = r.longitude;
    }
    acc[index] = block;
  }

  const blocksWithData = acc.filter(Boolean).length;
  const firstWithData = acc.find((b): b is Acc => b !== null);

  const blocks: MlBlock[] = [];
  let previous: Omit<MlBlock, 'timestamp'> | null = null;
  for (let i = 0; i < ML_WINDOW_BLOCKS; i++) {
    const a = acc[i] ?? (previous ? null : (firstWithData ?? null));
    const values: Omit<MlBlock, 'timestamp'> =
      a !== null
        ? { temperature: a.tempSum / a.count, distance_m: a.distance, lat: a.lat, lng: a.lng }
        : (previous ?? { temperature: 0, distance_m: 0, lat: 0, lng: 0 });
    previous = values;
    blocks.push({ ...values, timestamp: toFarmLocalIso(new Date(windowStart.getTime() + i * BLOCK_MS)) });
  }

  return { blocks, windowStart, windowEnd, blocksWithData };
}
