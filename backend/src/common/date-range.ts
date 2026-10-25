/**
 * Helpers para rangos de fecha que llegan por query string.
 *
 * Problema que resuelven: `new Date('2026-10-25')` se interpreta como medianoche **UTC**,
 * mientras que `setHours()` opera sobre el día del calendario **local**. Mezclar ambos
 * (como se hacía antes) producía ventanas de 3 horas desplazadas y, con `to` = fin de día,
 * un rango invertido que devolvía 0 registros.
 *
 * Regla:
 * - `YYYY-MM-DD`  -> día completo en la hora local del servidor.
 * - ISO completo  -> se respeta tal cual (incluido el offset que mande el cliente).
 */

const esFechaSinHora = (value: string) => value.length === 10;

/** Inicio del día (00:00:00.000) para una fecha `YYYY-MM-DD`; si viene con hora, se usa igual. */
export function startOfDay(value: string): Date {
  return new Date(esFechaSinHora(value) ? `${value}T00:00:00.000` : value);
}

/** Fin del día (23:59:59.999) para una fecha `YYYY-MM-DD`; si viene con hora, se usa igual. */
export function endOfDay(value: string): Date {
  return new Date(esFechaSinHora(value) ? `${value}T23:59:59.999` : value);
}
