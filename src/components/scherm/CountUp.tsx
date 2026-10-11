import { useEffect, useRef, useState } from 'react';
import { countUpWaarde, COUNTUP_DUUR } from './countUpWaarde';

const MAX_FRAMEGAT = 250;

export default function CountUp({ value, from = 0, decimals = 0 }: { value: number; from?: number; decimals?: number }) {
  const doel = Math.max(0, Number.isFinite(value) ? value : 0);
  const [n, setN] = useState(Math.max(0, from));
  const huidig = useRef(Math.max(0, from));
  useEffect(() => {
    const van = huidig.current;
    const klaar = () => { huidig.current = doel; setN(doel); };
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof requestAnimationFrame !== 'function' || van === doel) { klaar(); return; }
    let frame = 0; let start = -1; let vorige = -1;
    // Vangnet: als requestAnimationFrame niet loopt, toch de eindwaarde tonen
    const vangnet = window.setTimeout(klaar, COUNTUP_DUUR + 300);
    const tick = (tijd: number) => {
      if (start < 0) { start = tijd; vorige = tijd; }
      if (tijd - vorige > MAX_FRAMEGAT) { clearTimeout(vangnet); klaar(); return; }
      vorige = tijd;
      const v = countUpWaarde(van, doel, tijd - start);
      huidig.current = v; setN(v);
      if (v !== doel) frame = requestAnimationFrame(tick); else clearTimeout(vangnet);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clearTimeout(vangnet); };
  }, [doel]);
  return <>{new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)}</>;
}
