/** Toont altijd direct de eindwaarde; geen count-up (betrouwbaarheid gaat voor effect). */
export default function CountUp({ value, decimals = 0 }: { value: number; from?: number; decimals?: number }) {
  const n = Math.max(0, Number.isFinite(value) ? value : 0);
  return <>{new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)}</>;
}
