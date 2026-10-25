/**
 * Lecturas sin fix GPS.
 *
 * El collar transmite `LAT:0.000000,LON:0.000000` mientras no consiguió señal,
 * así que esas lecturas no aportan posición: no deben dibujarse en recorridos,
 * mapas de calor ni evaluarse contra el cerco virtual.
 */

/** Filtro Prisma para excluir lecturas con latitud y longitud exactamente en 0. */
export const ONLY_WITH_GPS_FIX = { NOT: { latitude: 0, longitude: 0 } };

/** `true` si la lectura tiene una posición real (no es el 0,0 de "sin señal"). */
export function hasGpsFix(lat: number, lng: number): boolean {
  return !(lat === 0 && lng === 0);
}
