/**
 * Evaluates if a point [lat, lng] is on or within a small distance tolerance of a polygon edge.
 * Tolerance in degrees (~0.0002 deg is approx. 20 meters).
 */
export function isPointOnPolygonEdge(
  point: [number, number],
  polygon: [number, number][],
  tolerance: number = 0.0002
): boolean {
  const [lat, lng] = point;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const minLat = Math.min(p1[0], p2[0]) - tolerance;
    const maxLat = Math.max(p1[0], p2[0]) + tolerance;
    const minLng = Math.min(p1[1], p2[1]) - tolerance;
    const maxLng = Math.max(p1[1], p2[1]) + tolerance;

    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      const dx = p2[1] - p1[1];
      const dy = p2[0] - p1[0];
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) {
        const dLat = lat - p1[0];
        const dLng = lng - p1[1];
        if (dLat * dLat + dLng * dLng <= tolerance * tolerance) return true;
        continue;
      }
      const t = Math.max(0, Math.min(1, ((lng - p1[1]) * dx + (lat - p1[0]) * dy) / lenSq));
      const projLat = p1[0] + t * dy;
      const projLng = p1[1] + t * dx;
      const distSq = (lat - projLat) * (lat - projLat) + (lng - projLng) * (lng - projLng);
      if (distSq <= tolerance * tolerance) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Distancia aproximada en metros desde un punto [lat, lng] hasta el borde más cercano del polígono.
 * Usa una proyección local equirectangular, suficiente para cercos de escala predial.
 */
export function distancePointToPolygonEdgeMeters(point: [number, number], polygon: [number, number][]): number {
  if (!polygon || polygon.length < 2) return Infinity;

  const [lat, lng] = point;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  let min = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const ax = (p1[1] - lng) * metersPerDegLng;
    const ay = (p1[0] - lat) * metersPerDegLat;
    const bx = (p2[1] - lng) * metersPerDegLng;
    const by = (p2[0] - lat) * metersPerDegLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const dist = Math.sqrt(projX * projX + projY * projY);

    if (dist < min) min = dist;
  }

  return min;
}

/**
 * Evaluates if a point (lat, lng) is inside a polygon using the Ray-Casting algorithm.
 * Also treats points resting on the polygon perimeter edge as inside.
 * @param point The coordinate of the animal [latitude, longitude]
 * @param polygon The array of coordinates representing the boundaries [[lat1, lng1], [lat2, lng2], ...]
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return true;

  // If point is on the polygon edge within tolerance, consider it inside
  if (isPointOnPolygonEdge(point, polygon)) {
    return true;
  }

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
