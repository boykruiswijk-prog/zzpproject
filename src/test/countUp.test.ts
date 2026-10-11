// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { countUpWaarde } from '@/components/scherm/countUpWaarde';

describe('countUpWaarde', () => {
  it('start vanaf 0 en eindigt exact op doel', () => {
    expect(countUpWaarde(0, 43, 0)).toBe(0);
    expect(countUpWaarde(0, 43, 1400)).toBe(43);
  });
  it('blijft altijd binnen oud en nieuw, nooit negatief', () => {
    for (let t = -50; t < 2000; t += 7) {
      const op = countUpWaarde(10, 43, t), af = countUpWaarde(43, 10, t);
      expect(op).toBeGreaterThanOrEqual(10); expect(op).toBeLessThanOrEqual(43);
      expect(af).toBeGreaterThanOrEqual(10); expect(af).toBeLessThanOrEqual(43);
    }
    expect(countUpWaarde(-5, -9, 300)).toBe(0);
  });
  it('grote tijdsprong tussen frames geeft direct de eindwaarde', () => {
    expect(countUpWaarde(0, 43, 1e9)).toBe(43);
    expect(countUpWaarde(0, 43, Number.NaN)).toBe(43);
  });
});
