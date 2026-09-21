/**
 * Motor Geodésico de Proyecciones Cartográficas y Cálculo de Superficie
 *
 * IMPORTANTE: No es correcto calcular áreas agrícolas directamente en grados de latitud/longitud
 * (coordenadas angulares WGS84 EPSG:4326), ya que la distancia de un grado de longitud varía en función
 * del coseno de la latitud (en Argentina, a -35°, 1° de longitud es ~18% más angosto que 1° de latitud).
 *
 * Para obtener una medición fidedigna de hectáreas, proyectamos el polígono a un sistema de coordenadas
 * planas métricas mediante la Proyección Azimutal Equivalente de Lambert (LAEA - Lambert Azimuthal Equal-Area),
 * centrada exactamente en el centroide del campo (authalic sphere WGS84).
 *
 * Esta proyección garantiza la preservación estricta de áreas (Equal-Area), eliminando deformaciones
 * geométricas y calculando metros cuadrados exactos (m²) mediante la fórmula de Gauss (Shoelace),
 * convertidos finalmente a Hectáreas (Ha = m² / 10.000).
 */

export type LatLngTuple = [number, number];

/**
 * Radio medio autálico de la Tierra para la esfera WGS84 (IUGG R2 authalic radius).
 */
const WGS84_AUTHALIC_RADIUS_METERS = 6371007.1809;

/**
 * Proyecta un conjunto de coordenadas angulares [lat, lng] a coordenadas métricas planas [x, y]
 * utilizando la Proyección Azimutal Equivalente de Lambert centrada en el centroide del polígono.
 */
export function projectToLambertEqualArea(
  points: LatLngTuple[]
): { projected: [number, number][]; centerLat: number; centerLng: number } {
  if (!points || points.length === 0) {
    return { projected: [], centerLat: 0, centerLng: 0 };
  }

  // 1. Calcular centroide medio en radianes
  let sumLatRad = 0;
  let sumLngRad = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    sumLatRad += (points[i][0] * Math.PI) / 180;
    sumLngRad += (points[i][1] * Math.PI) / 180;
  }

  const phi0 = sumLatRad / n; // Latitud central (rad)
  const lambda0 = sumLngRad / n; // Longitud central (rad)
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  const R = WGS84_AUTHALIC_RADIUS_METERS;

  // 2. Proyección Azimutal Equivalente de Lambert (LAEA)
  const projected: [number, number][] = points.map((pt) => {
    const phi = (pt[0] * Math.PI) / 180;
    const lambda = (pt[1] * Math.PI) / 180;
    const deltaLambda = lambda - lambda0;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const cosDeltaLambda = Math.cos(deltaLambda);

    // Factor de escala radial para preservar áreas
    const q = 1 + sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDeltaLambda;
    const kPrime = q > 0 ? Math.sqrt(2 / q) : 1;

    // Coordenadas métricas planas (x = Este-Oeste, y = Norte-Sur) en metros
    const x = R * kPrime * cosPhi * Math.sin(deltaLambda);
    const y = R * kPrime * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDeltaLambda);

    return [x, y];
  });

  return {
    projected,
    centerLat: (phi0 * 180) / Math.PI,
    centerLng: (lambda0 * 180) / Math.PI,
  };
}

/**
 * Calcula la superficie de un polígono en Hectáreas (Ha) a partir de vértices [lat, lng],
 * aplicando la proyección azimutal equivalente de Lambert y la fórmula de Gauss / Shoelace.
 *
 * @param points Lista de vértices [latitud, longitud] que delimitan el perímetro.
 * @returns Superficie calculada en Hectáreas (Ha), redondeada a 2 decimales.
 */
export function calculatePolygonAreaHa(points: LatLngTuple[]): number {
  if (!points || points.length < 3) return 0;

  // 1. Proyectar a plano métrico equivalente
  const { projected } = projectToLambertEqualArea(points);
  const n = projected.length;

  // 2. Algoritmo de Gauss / Shoelace en coordenadas planas métricas (m²)
  let shoelaceSum = 0;
  for (let i = 0; i < n; i++) {
    const pCurrent = projected[i];
    const pNext = projected[(i + 1) % n];
    shoelaceSum += pCurrent[0] * pNext[1] - pNext[0] * pCurrent[1];
  }

  const areaSquareMeters = Math.abs(shoelaceSum) / 2;

  // 3. Convertir m² a Hectáreas (1 Ha = 10.000 m²)
  const hectares = areaSquareMeters / 10000;

  return Math.round(hectares * 100) / 100;
}
