'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

export interface HeatmapCoordinate {
  latitude: number;
  longitude: number;
}

interface HeatmapCanvasLayerProps {
  points: HeatmapCoordinate[];
  /**
   * Factor de peso/aportación de cada punto a la sumatoria térmica (de 0.1 a 1.5, por defecto 0.55).
   * Valores bajos hacen que cada punto sume menos, exigiendo mucha más concentración para llegar al rojo
   * y permitiendo distinguir micro-zonas de detalle dentro de un mismo sector.
   */
  intensity?: number;
}

interface HeatCell {
  lat: number;
  lng: number;
  count: number;
}

/**
 * Construye una tabla de búsqueda (LUT) de 256 colores RGBA continuos
 * para transformar la máscara de densidad alfa en una nebulosa térmica suave:
 *   0.00 -> Transparente
 *   0.20 -> Verde lima suave (#84cc16)
 *   0.48 -> Amarillo cálido (#eab308)
 *   0.72 -> Naranja intenso (#f97316)
 *   0.92 -> Rojo núcleo (#ef4444)
 */
function buildColorPaletteLut(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(256 * 4);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(132, 204, 22, 0)');
  grad.addColorStop(0.15, 'rgba(132, 204, 22, 0.35)');
  grad.addColorStop(0.35, 'rgba(132, 204, 22, 0.75)');
  grad.addColorStop(0.55, 'rgba(234, 179, 8, 0.88)');
  grad.addColorStop(0.78, 'rgba(249, 115, 22, 0.94)');
  grad.addColorStop(0.95, 'rgba(239, 68, 68, 1)');
  grad.addColorStop(1.0, 'rgba(220, 38, 38, 1)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

export default function HeatmapCanvasLayer({ points, intensity = 0.55 }: HeatmapCanvasLayerProps) {
  const map = useMap();

  // Agrupación fina para renderizado en Canvas + celdas para popups interactivos al hacer clic
  const { fineCells, fineMax, popupCells, popupMax } = useMemo(() => {
    if (!points || points.length === 0) {
      return { fineCells: [] as HeatCell[], fineMax: 1, popupCells: [] as HeatCell[], popupMax: 1 };
    }

    // Grilla fina (~18m) para que el canvas dibuje una nebulosa orgánica continua
    const fineBin = 0.00018;
    const fineGrid = new Map<string, { sumLat: number; sumLng: number; count: number }>();
    let fMax = 1;

    // Grilla media (~55m) solo para áreas de clic invisibles con Popup informativo
    const popupBin = 0.00055;
    const popupGrid = new Map<string, { sumLat: number; sumLng: number; count: number }>();
    let pMax = 1;

    for (const p of points) {
      const fKey = `${Math.round(p.latitude / fineBin)}_${Math.round(p.longitude / fineBin)}`;
      const fEntry = fineGrid.get(fKey);
      if (fEntry) {
        fEntry.sumLat += p.latitude;
        fEntry.sumLng += p.longitude;
        fEntry.count += 1;
        if (fEntry.count > fMax) fMax = fEntry.count;
      } else {
        fineGrid.set(fKey, { sumLat: p.latitude, sumLng: p.longitude, count: 1 });
      }

      const pKey = `${Math.round(p.latitude / popupBin)}_${Math.round(p.longitude / popupBin)}`;
      const pEntry = popupGrid.get(pKey);
      if (pEntry) {
        pEntry.sumLat += p.latitude;
        pEntry.sumLng += p.longitude;
        pEntry.count += 1;
        if (pEntry.count > pMax) pMax = pEntry.count;
      } else {
        popupGrid.set(pKey, { sumLat: p.latitude, sumLng: p.longitude, count: 1 });
      }
    }

    const fCells: HeatCell[] = Array.from(fineGrid.values()).map((c) => ({
      lat: c.sumLat / c.count,
      lng: c.sumLng / c.count,
      count: c.count,
    }));

    const pCells: HeatCell[] = Array.from(popupGrid.values()).map((c) => ({
      lat: c.sumLat / c.count,
      lng: c.sumLng / c.count,
      count: c.count,
    }));

    return { fineCells: fCells, fineMax: fMax, popupCells: pCells, popupMax: pMax };
  }, [points]);

  useEffect(() => {
    if (!map || fineCells.length === 0) return;

    const overlayPane = map.getPanes().overlayPane;
    if (!overlayPane) return;

    const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-nebula-layer') as HTMLCanvasElement;
    canvas.style.pointerEvents = 'none';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '250';
    overlayPane.appendChild(canvas);

    const paletteLut = buildColorPaletteLut();

    const redraw = () => {
      const size = map.getSize();
      if (size.x <= 0 || size.y <= 0) return;

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      canvas.width = size.x;
      canvas.height = size.y;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size.x, size.y);

      // Escalar el radio de difusión según el nivel de zoom y la sensibilidad elegida
      const clampedIntensity = Math.max(0.08, Math.min(1.6, intensity));
      const zoom = map.getZoom();
      const zoomScale = Math.pow(1.22, Math.max(-3, Math.min(4, zoom - 15)));
      // A menor intensidad por punto, radio y blur ligeramente más finos para revelar mayor detalle espacial
      const detailRadiusFactor = 0.65 + 0.35 * Math.min(1.2, clampedIntensity);
      const baseRadius = Math.round(44 * zoomScale * detailRadiusFactor);
      const blurPx = Math.max(5, Math.round(12 * zoomScale * detailRadiusFactor));

      // 1. Acumular máscara de densidad suave en un canvas auxiliar con desenfoque Gaussiano
      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = size.x;
      alphaCanvas.height = size.y;
      const alphaCtx = alphaCanvas.getContext('2d');
      if (!alphaCtx) return;

      alphaCtx.filter = `blur(${blurPx}px)`;

      for (const cell of fineCells) {
        const pt = map.latLngToContainerPoint([cell.lat, cell.lng]);
        if (
          pt.x < -baseRadius * 2 ||
          pt.y < -baseRadius * 2 ||
          pt.x > size.x + baseRadius * 2 ||
          pt.y > size.y + baseRadius * 2
        ) {
          continue;
        }

        // Aporte de cada celda graduado por `clampedIntensity`:
        // con valores bajos, cada punto aporta mucho menos a la sumatoria para llegar al color rojo
        const normalized = Math.pow(cell.count / fineMax, 0.75);
        const radius = baseRadius * (0.72 + 0.45 * normalized);
        const rawAlpha = (0.08 + normalized * 0.68) * clampedIntensity;
        const peakAlpha = Math.min(0.92, Math.max(0.02, rawAlpha));

        const rGrad = alphaCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        rGrad.addColorStop(0, `rgba(0, 0, 0, ${peakAlpha})`);
        rGrad.addColorStop(0.4, `rgba(0, 0, 0, ${peakAlpha * 0.6})`);
        rGrad.addColorStop(0.75, `rgba(0, 0, 0, ${peakAlpha * 0.2})`);
        rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        alphaCtx.fillStyle = rGrad;
        alphaCtx.beginPath();
        alphaCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        alphaCtx.fill();
      }

      // 2. Mapear el canal alfa acumulado a la paleta de colores continua (nebulosa)
      const imgData = alphaCtx.getImageData(0, 0, size.x, size.y);
      const pixels = imgData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha < 4) {
          pixels[i + 3] = 0;
          continue;
        }
        const lutOffset = alpha * 4;
        pixels[i] = paletteLut[lutOffset];
        pixels[i + 1] = paletteLut[lutOffset + 1];
        pixels[i + 2] = paletteLut[lutOffset + 2];
        // Opacidad final suave y translúcida para dejar ver el terreno satelital debajo
        pixels[i + 3] = Math.min(205, Math.round((paletteLut[lutOffset + 3] * 0.78)));
      }

      ctx.putImageData(imgData, 0, 0);
    };

    redraw();

    map.on('moveend zoomend resize viewreset', redraw);

    return () => {
      map.off('moveend zoomend resize viewreset', redraw);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [map, fineCells, fineMax, intensity]);

  if (popupCells.length === 0) return null;

  return (
    <>
      {popupCells.map((cell, idx) => {
        const ratio = cell.count / popupMax;
        let intensityLabel = 'Pastoreo bajo / moderado';
        if (ratio > 0.7) {
          intensityLabel = 'Pastoreo intensivo (máxima permanencia)';
        } else if (ratio > 0.4) {
          intensityLabel = 'Pastoreo frecuente';
        } else if (ratio > 0.2) {
          intensityLabel = 'Pastoreo regular';
        }

        return (
          <CircleMarker
            key={`heat-hit-${idx}`}
            center={[cell.lat, cell.lng]}
            radius={22}
            pathOptions={{
              fillColor: 'transparent',
              fillOpacity: 0,
              stroke: false,
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs text-zinc-900">
                <p className="font-bold">{intensityLabel}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Frecuencia: <b>{cell.count}</b> lecturas en este sector ({Math.round(ratio * 100)}% de intensidad)
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
