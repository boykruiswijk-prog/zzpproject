import { useEffect, useState } from 'react';
import { countUpWaarde, COUNTUP_DUUR } from './countUpWaarde';

const MAX_FRAMEGAT = 250;
// Waarden die al eens getoond zijn: bij remount niet opnieuw vanaf 0 tellen
const getoond = new Set<number>();

/**
 * De eindwaarde is altijd de basis in de DOM. De animatie is alleen een optische
 * laag die via requestAnimationFrame tijdelijk een tussenwaarde toont; vuurt rAF
 * niet, dan blijft de eindwaarde gewoon staan.
 */
export default function CountUp({ value, from = 0, decimals = 0 }: { value: number; from?: number; decimals?: number }) {
  const doel = Math.max(0, Number.isFinite(value) ? value : 0);
  const [anim, setAnim] = useState<number | null>(null);
  useEffect(() => {
    const van = getoond.has(doel) ? doel : Math.max(0, from);
    getoond.add(doel);
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof requestAnimationFrame !== 'function' || van === doel || document.visibilityState === 'hidden') return;
    let frame = 0; let start = -1; let vorige = -1;
    const stop = () => { cancelAnimationFrame(frame); setAnim(null); };
    // Vangnet los van rAF: na maximaal 1,5 s altijd de eindwaarde
    const vangnet = window.setTimeout(stop, Math.min(1500, COUNTUP_DUUR));
    const tick = (tijd: number) => {
      if (start < 0) { start = tijd; vorige = tijd; }
      if (tijd - vorige > MAX_FRAMEGAT) { clearTimeout(vangnet); stop(); return; }
      vorige = tijd;
      const v = countUpWaarde(van, doel, tijd - start);
      if (v === doel) { clearTimeout(vangnet); setAnim(null); return; }
      setAnim(v);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clearTimeout(vangnet); setAnim(null); };
  }, [doel, from]);
  const n = anim ?? doel;
  return <>{new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)}</>;
}
