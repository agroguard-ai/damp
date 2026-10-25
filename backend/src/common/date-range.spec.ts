import { startOfDay, endOfDay } from './date-range';

describe('date-range', () => {
  describe('con fecha sin hora (YYYY-MM-DD)', () => {
    it('startOfDay devuelve el inicio del día LOCAL, no UTC', () => {
      const d = startOfDay('2026-10-25');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9); // octubre
      expect(d.getDate()).toBe(25);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
    });

    it('endOfDay devuelve el final del mismo día LOCAL', () => {
      const d = endOfDay('2026-10-25');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9);
      expect(d.getDate()).toBe(25);
      expect(d.getHours()).toBe(23);
      expect(d.getMinutes()).toBe(59);
      expect(d.getSeconds()).toBe(59);
      expect(d.getMilliseconds()).toBe(999);
    });

    it('el rango no queda invertido (regresión: devolvía 0 registros)', () => {
      const gte = startOfDay('2026-10-25');
      const lte = endOfDay('2026-10-25');
      expect(lte.getTime()).toBeGreaterThan(gte.getTime());
      expect(lte.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
    });
  });

  describe('con ISO completo', () => {
    it('respeta el instante y el offset recibidos', () => {
      expect(startOfDay('2026-10-25T00:00:00.000-03:00').toISOString()).toBe('2026-10-25T03:00:00.000Z');
      expect(endOfDay('2026-10-25T23:59:59.999-03:00').toISOString()).toBe('2026-10-26T02:59:59.999Z');
    });
  });
});
