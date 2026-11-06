// @vitest-environment happy-dom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANEEL_DUUR_MS, SCHERM_MARGE, schermDpr, schermSchaal, useSchermViewport } from '@/components/scherm/schermWeergave';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('A24 tv-weergave', () => {
  it('wisselt elke 6000 ms', () => { expect(PANEEL_DUUR_MS).toBe(6000); });
  it.each([[1920,1080], [1920,940], [1600,900], [1366,768], [1280,720], [3840,1880], [3840,2160], [1920,1200], [1216,684]])('past %i × %i volledig met rand, één schaalfactor', (w,h) => {
    const m = 2 * SCHERM_MARGE;
    expect(schermSchaal(w,h)).toBeCloseTo(Math.min((w-m)/1920, (h-m)/1080));
    expect(1920 * schermSchaal(w,h)).toBeLessThanOrEqual(w - m + 1e-9);
    expect(1080 * schermSchaal(w,h)).toBeLessThanOrEqual(h - m + 1e-9);
  });
  it('adresbalk 1920 × 940 schaalt op hoogte, niet op breedte', () => {
    expect(schermSchaal(1920,940)).toBeCloseTo((940 - 2 * SCHERM_MARGE) / 1080);
  });
  it('begrenst DPR boven 2560 px en behoudt de lage-kwaliteitfallback', () => {
    expect(schermDpr(2560)).toEqual([1,1.5]);
    expect(schermDpr(2561)).toBe(1);
    expect(schermDpr(3840)).toBe(1);
    expect(schermDpr(1920, false)).toBe(1);
  });
  it('reageert op resize', () => {
    vi.stubGlobal('innerWidth', 1920); vi.stubGlobal('innerHeight', 1080);
    const { result } = renderHook(useSchermViewport);
    expect(result.current).toEqual({breedte:1920, hoogte:1080});
    act(() => { vi.stubGlobal('innerWidth', 3840); vi.stubGlobal('innerHeight', 2160); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toEqual({breedte:3840, hoogte:2160});
  });
});