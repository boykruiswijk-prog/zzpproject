import { useEffect, useState } from 'react';

export default function CountUp({ value, from = 0, decimals = 0 }: { value: number; from?: number; decimals?: number }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (time: number) => {
      const t = reduced ? 1 : Math.min(1, (time - start) / 1400);
      setN(from + (value - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, from]);
  return <>{new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)}</>;
}