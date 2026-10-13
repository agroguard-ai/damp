import { blockStartFor, buildMlWindow, toFarmLocalIso, ML_WINDOW_BLOCKS, RawReading } from './ml-window';

const BLOCK_MS = 30 * 60 * 1000;

describe('ml-window', () => {
  describe('blockStartFor / toFarmLocalIso', () => {
    it('alinea los bloques de 30 min en hora local del campo (UTC-3)', () => {
      // 15:44 UTC = 12:44 local -> bloque de las 12:30 local = 15:30 UTC
      const start = blockStartFor(new Date('2026-10-13T15:44:00Z'));
      expect(start.toISOString()).toBe('2026-10-13T15:30:00.000Z');
      expect(toFarmLocalIso(start)).toBe('2026-10-13T12:30:00-03:00');
    });

    it('usa la fecha local en el cambio de día (02:10 UTC todavía es el día anterior en Argentina)', () => {
      expect(toFarmLocalIso(blockStartFor(new Date('2026-10-14T02:10:00Z')))).toBe('2026-10-13T23:00:00-03:00');
    });
  });

  describe('buildMlWindow', () => {
    const anchor = new Date('2026-10-13T14:59:59Z'); // ventana que termina a las 15:00 UTC
    const windowStart = new Date('2026-10-12T15:00:00Z');
    const at = (block: number, minute = 5) => new Date(windowStart.getTime() + block * BLOCK_MS + minute * 60 * 1000);
    const reading = (block: number, temperature: number, lat = -34, minute = 5): RawReading => ({
      temperature,
      latitude: lat,
      longitude: -58,
      timestamp: at(block, minute),
    });

    it('devuelve siempre 48 bloques y promedia la temperatura de las lecturas de cada bloque', () => {
      const w = buildMlWindow([reading(10, 38), reading(10, 39, -34, 20)], anchor);
      expect(w.blocks).toHaveLength(ML_WINDOW_BLOCKS);
      expect(w.blocks[10].temperature).toBeCloseTo(38.5);
      expect(w.blocksWithData).toBe(1);
      expect(w.windowEnd.toISOString()).toBe('2026-10-13T15:00:00.000Z');
    });

    it('rellena bloques vacíos con el anterior (ffill) y los iniciales con el primero disponible (bfill)', () => {
      const w = buildMlWindow([reading(5, 38), reading(8, 40)], anchor);
      expect(w.blocks[0].temperature).toBe(38); // bfill
      expect(w.blocks[6].temperature).toBe(38); // ffill desde el bloque 5
      expect(w.blocks[8].temperature).toBe(40);
      expect(w.blocks[47].temperature).toBe(40); // ffill hasta el final
      expect(w.blocksWithData).toBe(2);
    });

    it('suma los metros recorridos dentro del bloque, contando desde la lectura anterior', () => {
      // 0.001° de latitud ~ 111 m
      const w = buildMlWindow([reading(0, 38, -34.0), reading(1, 38, -34.001), reading(1, 38, -34.002, 20)], anchor);
      expect(w.blocks[0].distance_m).toBe(0);
      expect(w.blocks[1].distance_m).toBeGreaterThan(215);
      expect(w.blocks[1].distance_m).toBeLessThan(230);
    });

    it('usa una lectura previa a la ventana solo como punto de partida del primer tramo', () => {
      const before: RawReading = {
        temperature: 41,
        latitude: -34.0,
        longitude: -58,
        timestamp: new Date(windowStart.getTime() - 60_000),
      };
      const w = buildMlWindow([before, reading(0, 38, -34.001)], anchor);
      expect(w.blocks[0].temperature).toBe(38); // la temperatura previa no entra
      expect(w.blocks[0].distance_m).toBeGreaterThan(100);
    });

    it('ignora posiciones 0,0 (GPS sin fix) para la distancia, pero usa su temperatura', () => {
      const noFix: RawReading = { ...reading(1, 39.5), latitude: 0, longitude: 0 };
      const w = buildMlWindow([reading(0, 38, -34.0), noFix, reading(2, 38, -34.0)], anchor);
      expect(w.blocks[1].temperature).toBe(39.5);
      expect(w.blocks[1].distance_m).toBe(0);
      expect(w.blocks[2].distance_m).toBe(0); // volvió al mismo punto que la última posición válida
    });

    it('descarta lecturas posteriores al fin de la ventana', () => {
      const w = buildMlWindow(
        [reading(47, 38), { ...reading(47, 45), timestamp: new Date('2026-10-13T15:05:00Z') }],
        anchor
      );
      expect(w.blocks[47].temperature).toBe(38);
    });
  });
});
