import type { SchermPayload } from '../../../supabase/functions/_shared/schermAnonimiseer';
import CountUp from './CountUp';

const REIZEN = [['gestart', 'Start aanvraag'], ['verstuurd', 'Aanvraag verstuurd'], ['kvk', 'KVK-check'], ['actief', 'Polis actief'], ['certificaat', 'Certificaat'], ['klant', 'Klant']] as const;
export default function StroomScene({ data }: { data: SchermPayload }) {
  const s = data.stroom;
  const stappen = [...(s.sessies !== null ? [{ label: 'Bezoeker op de site', n: s.sessies }] : []), ...REIZEN.map(([key, label]) => ({ label, n: s[key] }))];
  const max = Math.max(1, ...stappen.map(x => x.n ?? 0));
  const x = (i: number) => 55 + i * 890 / Math.max(1, stappen.length - 1);
  const flows = [
    { naam: 'Aanvraag', stappen: [['intake', '', 'Intake'], ['acceptatie', 'kvk_check', 'KVK'], ['acceptatie', 'lead_actief', 'Acceptatie'], ['mail', '', 'Mail']] },
    { naam: 'Facturatie', stappen: [['facturatie', 'planner_run', 'Planner'], ['exact', '', 'Exact'], ['kwaliteit', '', 'Controle']] },
    { naam: 'Kwaliteit', stappen: [['kwaliteit', '', 'Foutencontrole'], ['kwaliteit', 'wijziging', 'Fix'], ['kennisbank', '', 'Publicatie']] },
  ];
  return <div className="stroom-scene" aria-label="De stroom">
    <div className="stroom-heading"><span>De stroom</span><h2>Van aanvraag naar klant</h2><p>Sinds 6 oktober 2026</p></div>
    <div className="stroom-rivier">
      <svg viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
        {stappen.slice(0, -1).map((step, i) => {
          const next = stappen[i + 1];
          const width = 2 + ((next.n ?? 0) / max) * 74;
          const path = `M ${x(i)} 200 C ${x(i) + 60} 150 ${x(i + 1) - 60} 250 ${x(i + 1)} 200`;
          return <g key={i} className="stroom-baan"><path d={path} strokeWidth={width} className="stroom-water" />
            {next.n !== null && next.n > 0 && Array.from({ length: 8 }, (_, j) => <circle key={j} r="3" className="stroom-deeltje"><animateMotion dur={`${4 + j % 3}s`} begin={`${-j}s`} repeatCount="indefinite" path={path} /></circle>)}
          </g>;
        })}
      </svg>
      <div className="stroom-stappen" style={{ gridTemplateColumns: `repeat(${stappen.length}, minmax(0, 1fr))` }}>
        {stappen.map((step, i) => <div key={step.label}>
          <span>{step.label}</span><b>{step.n === null ? '-' : <CountUp value={step.n} />}</b>
          <small>{i === 0 ? 'start' : step.n !== null && (stappen[i - 1]?.n ?? 0) > 0 ? `${Math.round(step.n / Number(stappen[i - 1].n) * 100)}% van vorige stap` : 'wordt gemeten'}</small>
        </div>)}
      </div>
    </div>
    <div className="stroom-processen">{flows.map(flow => <div key={flow.naam}><h3>{flow.naam}</h3><div className="stroom-proceslijn">{flow.stappen.map(([station, actie, naam]) => {
      const events = data.processen.filter(p => p.station === station && (!actie || p.actie === actie));
      const bezig = events.some(e => e.status === 'bezig');
      const aantal = events.reduce((n, e) => n + e.n, 0);
      return <span key={naam} className={bezig ? 'proces-bezig' : aantal ? 'proces-klaar' : ''}><i /><b>{naam}</b><small>{bezig ? 'bezig' : `${aantal} vandaag`}</small></span>;
    })}</div></div>)}</div>
  </div>;
}