import { useEffect, useState } from 'react';

export const SCHERM_BREEDTE = 1920;
export const SCHERM_HOOGTE = 1080;
export const PANEEL_DUUR_MS = 6000;

/** Vaste rand (schermpixels) rond het 16:9-canvas, zodat niets tegen de vensterrand staat. */
export const SCHERM_MARGE = 8;

/** Eén schaalfactor voor het hele 1920x1080-ontwerp: past altijd volledig in het venster. */
export function schermSchaal(breedte: number, hoogte: number) {
  const b = Math.max(0, breedte - 2 * SCHERM_MARGE);
  const h = Math.max(0, hoogte - 2 * SCHERM_MARGE);
  return Math.max(0, Math.min(b / SCHERM_BREEDTE, h / SCHERM_HOOGTE));
}

/** Kleinste werkelijk zichtbare maat: adresbalk, browserzoom en tv-browsers die innerHeight te ruim melden. */
export function zichtbareMaat(): { breedte: number; hoogte: number } {
  const d = document.documentElement;
  const vv = window.visualViewport;
  const kies = (...w: Array<number | undefined>) => Math.min(...w.filter((x): x is number => typeof x === 'number' && x > 0));
  return {
    breedte: kies(window.innerWidth, d?.clientWidth, vv ? vv.width * vv.scale : undefined),
    hoogte: kies(window.innerHeight, d?.clientHeight, vv ? vv.height * vv.scale : undefined),
  };
}

export function schermDpr(breedte: number, kwaliteit = true): 1 | [number, number] {
  return !kwaliteit || breedte > 2560 ? 1 : [1, 1.5];
}

export function useSchermViewport() {
  const [viewport, setViewport] = useState(zichtbareMaat);
  useEffect(() => {
    const resize = () => setViewport((oud) => {
      const n = zichtbareMaat();
      return oud.breedte === n.breedte && oud.hoogte === n.hoogte ? oud : n;
    });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    // Vangnet voor tv-browsers die bij zoom of adresbalk geen resize sturen.
    const poll = window.setInterval(resize, 2000);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.clearInterval(poll);
    };
  }, []);
  return viewport;
}