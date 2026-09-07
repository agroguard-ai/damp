/**
 * Calculates geodesic polygon area in Hectares (Ha) from lat/lng vertices.
 * Uses the spherical polygon area formula with WGS84 Earth radius (6,378,137m).
 *
 * @param points Array of [latitude, longitude] pairs representing polygon vertices.
 * @returns Area in Hectares, rounded to 2 decimal places.
 */
export function calculatePolygonAreaHa(points: [number, number][]): number {
  if (!points || points.length < 3) return 0;

  const EARTH_RADIUS = 6378137; // Earth's mean radius in meters
  let area = 0;
  const len = points.length;

  for (let i = 0; i < len; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % len];

    const lat1Rad = (p1[0] * Math.PI) / 180;
    const lat2Rad = (p2[0] * Math.PI) / 180;
    const lon1Rad = (p1[1] * Math.PI) / 180;
    const lon2Rad = (p2[1] * Math.PI) / 180;

    area += (lon2Rad - lon1Rad) * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
  }

  area = Math.abs((area * EARTH_RADIUS * EARTH_RADIUS) / 2);
  const hectares = area / 10000;
  return Math.round(hectares * 100) / 100;
}
