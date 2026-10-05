/**
 * Spatial Engine for Geodesic Calculations & Polygon Boundary Enforcement
 * (Ray casting, distance to segment, snap-to-edge projection)
 */

export type LatLngTuple = [number, number];

/**
 * Calculates Haversine distance between two coordinates in meters
 */
export function haversineDistanceMeters(p1: LatLngTuple, p2: LatLngTuple): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ray casting algorithm to check if point [lat, lng] is strictly inside a polygon
 */
export function isPointInPolygon(point: LatLngTuple, polygon: LatLngTuple[]): boolean {
  if (!polygon || polygon.length < 3) return true; // If no boundary defined, allow everywhere

  const [x, y] = [point[1], point[0]]; // [lng, lat]
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Projects point P onto line segment AB in local flat projection coordinates.
 * Returns the nearest point on segment AB and the distance in meters.
 */
export function projectPointOnSegment(
  P: LatLngTuple,
  A: LatLngTuple,
  B: LatLngTuple
): { projectedPoint: LatLngTuple; distanceMeters: number } {
  const refLat = (A[0] + B[0] + P[0]) / 3;
  const cosRef = Math.cos((refLat * Math.PI) / 180);

  // Convert lat/lng differences to meters relative to origin
  const toMeters = (pt: LatLngTuple): [number, number] => [
    pt[1] * 111320 * cosRef, // x = lng in meters
    pt[0] * 110574, // y = lat in meters
  ];

  const fromMeters = (m: [number, number]): LatLngTuple => [
    m[1] / 110574, // lat
    m[0] / (111320 * cosRef), // lng
  ];

  const pM = toMeters(P);
  const aM = toMeters(A);
  const bM = toMeters(B);

  const abX = bM[0] - aM[0];
  const abY = bM[1] - aM[1];
  const abLenSq = abX * abX + abY * abY;

  if (abLenSq === 0) {
    const dist = haversineDistanceMeters(P, A);
    return { projectedPoint: A, distanceMeters: dist };
  }

  const apX = pM[0] - aM[0];
  const apY = pM[1] - aM[1];

  // Parameter t along segment AB
  let t = (apX * abX + apY * abY) / abLenSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment bounds

  const projM: [number, number] = [aM[0] + t * abX, aM[1] + t * abY];
  const projectedPoint = fromMeters(projM);
  const distanceMeters = haversineDistanceMeters(P, projectedPoint);

  return { projectedPoint, distanceMeters };
}

/**
 * Clamps a point to the nearest edge or vertex of a polygon without distance threshold.
 */
export function clampPointToPolygonBoundary(
  point: LatLngTuple,
  polygon: LatLngTuple[]
): { point: LatLngTuple; distanceMeters: number } {
  if (!polygon || polygon.length < 2) {
    return { point, distanceMeters: 0 };
  }

  let minDistance = Infinity;
  let bestPoint: LatLngTuple = point;

  for (let i = 0; i < polygon.length; i++) {
    const A = polygon[i];
    const B = polygon[(i + 1) % polygon.length];

    const { projectedPoint, distanceMeters } = projectPointOnSegment(point, A, B);

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      bestPoint = projectedPoint;
    }
  }

  return { point: bestPoint, distanceMeters: minDistance };
}

/**
 * Snaps a point to the nearest edge or vertex of a polygon if within snapThresholdMeters.
 */
export function snapPointToPolygonEdge(
  point: LatLngTuple,
  polygon: LatLngTuple[],
  snapThresholdMeters: number = 20
): {
  point: LatLngTuple;
  isSnapped: boolean;
  distanceMeters: number;
} {
  const clampResult = clampPointToPolygonBoundary(point, polygon);
  const isSnapped = clampResult.distanceMeters <= snapThresholdMeters;

  return {
    point: isSnapped ? clampResult.point : point,
    isSnapped,
    distanceMeters: clampResult.distanceMeters,
  };
}

export type BoundaryValidationStatus = 'valid_inside' | 'snapped_to_border' | 'rejected_outside' | 'clamped_to_border';

export interface BoundaryPointValidationResult {
  point: LatLngTuple;
  status: BoundaryValidationStatus;
  message?: string;
  isValid: boolean;
}

export type ZonePointValidationResult = BoundaryPointValidationResult;

/**
 * Generic point-in-boundary validator with edge clamping/snapping.
 * When clampInfinite is true (default), points clicked or dragged outside the boundary
 * are projected/clamped onto the nearest boundary edge instead of being rejected.
 */
export function validatePointInBoundary(
  clickedPoint: LatLngTuple,
  boundaryPolygon: LatLngTuple[],
  boundaryLabel: string = 'del establecimiento',
  snapThresholdMeters: number = 20,
  clampInfinite: boolean = true
): BoundaryPointValidationResult {
  if (!boundaryPolygon || boundaryPolygon.length < 3) {
    return { point: clickedPoint, status: 'valid_inside', isValid: true };
  }

  // 1. Check if point is inside polygon
  const inside = isPointInPolygon(clickedPoint, boundaryPolygon);
  if (inside) {
    return { point: clickedPoint, status: 'valid_inside', isValid: true };
  }

  // 2. Point is outside boundary:
  const clampResult = clampPointToPolygonBoundary(clickedPoint, boundaryPolygon);

  if (clampInfinite) {
    const isSnip = clampResult.distanceMeters <= snapThresholdMeters;
    return {
      point: clampResult.point,
      status: isSnip ? 'snapped_to_border' : 'clamped_to_border',
      message: isSnip
        ? `Vértice adherido al perímetro ${boundaryLabel}.`
        : `Vértice ajustado al límite ${boundaryLabel}.`,
      isValid: true,
    };
  }

  // 3. Fallback rejection if clampInfinite is false and outside threshold
  if (clampResult.distanceMeters <= snapThresholdMeters) {
    return {
      point: clampResult.point,
      status: 'snapped_to_border',
      message: `Vértice adherido al perímetro ${boundaryLabel}.`,
      isValid: true,
    };
  }

  return {
    point: clickedPoint,
    status: 'rejected_outside',
    message: `Punto fuera de los límites ${boundaryLabel}. Debe situarse dentro del perímetro.`,
    isValid: false,
  };
}

/**
 * Validates whether all vertices of a child polygon are strictly inside a parent polygon.
 */
export function isPolygonInsideBoundary(
  childPolygon: LatLngTuple[],
  parentPolygon: LatLngTuple[],
  snapThresholdMeters: number = 20
): { isInside: boolean; outsideCount: number } {
  if (!parentPolygon || parentPolygon.length < 3) {
    return { isInside: true, outsideCount: 0 };
  }
  if (!childPolygon || childPolygon.length === 0) {
    return { isInside: true, outsideCount: 0 };
  }

  let outsideCount = 0;
  for (const pt of childPolygon) {
    const inside = isPointInPolygon(pt, parentPolygon);
    if (!inside) {
      const clampResult = clampPointToPolygonBoundary(pt, parentPolygon);
      if (clampResult.distanceMeters > snapThresholdMeters) {
        outsideCount++;
      }
    }
  }

  return {
    isInside: outsideCount === 0,
    outsideCount,
  };
}

/**
 * Enforces boundary containment and snap-to-edge logic for zone point creation.
 * Maintained for backward compatibility.
 */
export function validateAndSnapZonePoint(
  clickedPoint: LatLngTuple,
  farmPolygon: LatLngTuple[],
  snapThresholdMeters: number = 20
): ZonePointValidationResult {
  return validatePointInBoundary(clickedPoint, farmPolygon, 'del establecimiento', snapThresholdMeters);
}
