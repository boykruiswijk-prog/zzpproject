import { useEffect, useState } from 'react';

export const SCHERM_BREEDTE = 1920;
export const SCHERM_HOOGTE = 1080;
export const PANEEL_DUUR_MS = 6000;

export function schermSchaal(breedte: number, hoogte: number) {
  return Math.max(0, Math.min(breedte / SCHERM_BREEDTE, hoogte / SCHERM_HOOGTE));
}

export function schermDpr(breedte: number, kwaliteit = true): 1 | [number, number] {
  return !kwaliteit || breedte > 2560 ? 1 : [1, 1.5];
}

export function useSchermViewport() {
  const lees = () => ({ breedte: window.innerWidth, hoogte: window.innerHeight });
  const [viewport, setViewport] = useState(lees);
  useEffect(() => {
    const resize = () => setViewport(lees());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return viewport;
}