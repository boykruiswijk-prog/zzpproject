import CountUp from './CountUp';
import type { Puls } from './schermModel';
export default function BreakingMoment({ event, total }: { event: Puls; total: number }) {
  return <div className="scherm-breaking" role="status">
    <div className="breaking-particles" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--hoek': `${i * 137.5}deg`, '--afstand': `${18 + i % 8 * 5}vh`, '--vertraging': `${i % 5 * 0.04}s` } as React.CSSProperties} />)}</div>
    <span className="breaking-eyebrow">ZP Zaken Live</span><h1>Nieuwe aanvraag binnen</h1>
    <p>{event.tekst}</p>
    <div className="breaking-counter"><b className="breaking-pop"><CountUp value={total} /></b> <span>/ 200</span></div>
  </div>;
}