import { useEffect, useRef, useState } from 'react';
import { STATION_LABELS, toestandLabel, type Puls, type StationStand, type Toestand } from './schermModel';
export { STATION_LABELS, STATION_IDS } from './schermModel';
export type { Puls } from './schermModel';

/**
 * A8-correctie 2 'Teamfoto': 16 grote robotfiguren (eigen SVG) als hoofdbeeld, naam als echte tekst op het shirt,
 * functie en resultaat eronder. Machine-afdelingen en het brein staan in een smalle strook erboven.
 */
export type WerktuinRobot = { robotnaam: string | null; naam: string; status: string; werkplek: string | null; nu_tekst: string | null; resultaat?: string | null };
type Props = { stations: Record<string, StationStand>; totaalVandaag: number; kennisregels: number; pulsen: Puls[]; focus: Puls | null; actief: boolean; robots?: WerktuinRobot[] };

/** Groepen in vaste volgorde, elk met eigen shirtkleur (token --s-team-<id>). */
export const TEAM_GROEPEN = [
  { id: 'aanvraag', titel: 'Aanvraag', robots: ['Echo', 'Lasso'] },
  { id: 'content', titel: 'Content', robots: ['Pen'] },
  { id: 'advertenties', titel: 'Advertenties', robots: ['Turbo'] },
  { id: 'kwaliteit', titel: 'Kwaliteit', robots: ['Loep'] },
  { id: 'regie', titel: 'Regie', robots: ['Coach', 'Kompas', 'Teller'] },
  { id: 'onderhoud', titel: 'Onderhoud', robots: ['Slot', 'Patch', 'Pixel', 'Puls'] },
  { id: 'markt', titel: 'Markt en AI', robots: ['Radar', 'Scout', 'Spoor', 'Baken'] },
] as const;
/** Twee rijen van acht: groepen breken nooit over een rij. */
export const TEAM_RIJEN: (typeof TEAM_GROEPEN[number]['id'])[][] = [
  ['aanvraag', 'content', 'advertenties', 'kwaliteit', 'regie'],
  ['onderhoud', 'markt'],
];
/** Machine-afdelingen in de strook boven de teamfoto. */
export const MACHINE_AFDELINGEN = ['intake', 'acceptatie', 'certificaten', 'facturatie', 'exact', 'assistent', 'mail', 'service'] as const;

/** Resultaatregel: privacygefilterd door schermAnonimiseer, hier alleen ingekort (twee regels van ca. 45 tekens). */
export function resultaatKort(t: string | null | undefined, max = 90): string {
  const s = (t ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}\u2026` : s;
}
const hm = (iso: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export function toestandKort(s: StationStand | undefined): string {
  const t = s?.laatst_actief_op && Number.isFinite(Date.parse(s.laatst_actief_op)) ? s.laatst_actief_op : null;
  switch (s?.toestand) {
    case 'aan_het_werk': return 'bezig';
    case 'stand_by': return t ? `stand-by ${hm(t)}` : 'stand-by';
    case 'storing': return 'aandacht';
    default: return t ? `rust ${hm(t)}` : 'rust';
  }
}
const klasse = (t: Toestand) => ({ aan_het_werk: 'st-werk', stand_by: 'st-standby', rust: 'st-rust', storing: 'st-storing' }[t]);

/** Eén gelijk ontworpen figuur; de naam staat als echte SVG-tekst op het shirt. */
export function RobotFiguur({ naam, groep }: { naam: string; groep: string }) {
  const grootte = naam.length > 5 ? 19 : 22;
  return (
    <svg className="robot-figuur" viewBox="0 0 140 200" role="img" aria-label={naam} style={{ ['--shirt' as string]: `hsl(var(--s-team-${groep}))` }}>
      <line x1="70" y1="8" x2="70" y2="22" className="rf-metaal" strokeWidth="4" />
      <circle cx="70" cy="8" r="6" className="rf-antenne" />
      <g className="rf-hoofd">
        <rect x="34" y="22" width="72" height="56" rx="20" className="rf-kop" />
        <rect x="44" y="34" width="52" height="28" rx="12" className="rf-vizier" />
        <circle cx="58" cy="48" r="5.5" className="rf-oog" />
        <circle cx="82" cy="48" r="5.5" className="rf-oog" />
        <path d="M60 68 Q70 74 80 68" className="rf-mond" strokeWidth="3" fill="none" />
      </g>
      <rect x="62" y="78" width="16" height="8" className="rf-kop" />
      <g className="rf-arm rf-arm-l"><rect x="10" y="90" width="18" height="58" rx="9" className="rf-shirt" /><circle cx="19" cy="152" r="9" className="rf-kop" /></g>
      <g className="rf-arm rf-arm-r"><rect x="112" y="90" width="18" height="58" rx="9" className="rf-shirt" /><circle cx="121" cy="152" r="9" className="rf-kop" /></g>
      <rect x="28" y="84" width="84" height="80" rx="18" className="rf-shirt" />
      <text x="70" y="131" textAnchor="middle" className="rf-naam" fontSize={grootte} data-testid="shirt-naam">{naam}</text>
      <rect x="40" y="164" width="22" height="30" rx="8" className="rf-been" />
      <rect x="78" y="164" width="22" height="30" rx="8" className="rf-been" />
    </svg>
  );
}

export default function MachineScene(props: Props) {
  const robots = new Map((props.robots ?? []).filter(r => r.robotnaam).map(r => [r.robotnaam!, r]));
  // Nieuwe gebeurtenis: brein licht kort op.
  const gezien = useRef(new Set<string>()); const eerste = useRef(true); const [flits, setFlits] = useState(false);
  useEffect(() => {
    const nieuw = props.pulsen.some(p => !gezien.current.has(p.id)); gezien.current = new Set(props.pulsen.map(p => p.id));
    if (eerste.current) { eerste.current = false; return; }
    if (nieuw) { setFlits(true); const t = setTimeout(() => setFlits(false), 2500); return () => clearTimeout(t); }
  }, [props.pulsen]);
  const groep = (id: string) => TEAM_GROEPEN.find(g => g.id === id)!;
  return <div className={`machine-weergave teamfoto ${props.actief ? '' : 'teamfoto-stil'}`}>
    <div className="machine-afdelingen" data-testid="scene-labels">
      <div className={`machine-chip brein-chip ${flits ? 'brein-flits' : ''}`} data-hoek="brein"><strong>Het brein</strong><small>{props.totaalVandaag} vandaag · {props.kennisregels} kennisregels</small></div>
      {MACHINE_AFDELINGEN.map(id => { const st = props.stations[id]; const t = st?.toestand ?? 'rust';
        return <div key={id} className={`machine-chip ${klasse(t)}`} data-station={id} data-toestand={t} title={toestandLabel(st)}><strong>{STATION_LABELS[id]}</strong><small><span className="st-bol" />{toestandKort(st)}<b>{st?.vandaag ?? 0}</b></small></div>; })}
    </div>
    <div className="team-rijen">
      {TEAM_RIJEN.map((rij, i) => <div key={i} className="team-rij">
        {rij.map(gid => { const g = groep(gid); return <div key={gid} className="team-groep" data-groep={gid} style={{ ['--shirt' as string]: `hsl(var(--s-team-${gid}))` }}>
          <div className="team-groep-titel">{g.titel}</div>
          <div className="team-groep-leden">
            {g.robots.map(naam => { const r = robots.get(naam); const status = r?.status ?? 'gepland';
              return <div key={naam} className={`poppetje rb-${status}`} data-robot={naam} data-status={status}>
                <RobotFiguur naam={naam} groep={gid} />
                <div className="poppetje-functie"><span className="st-bol" />{r?.naam ?? ''}</div>
                <em data-testid="poppetje-resultaat">{resultaatKort(status === 'bezig' && r?.nu_tekst ? r.nu_tekst : r?.resultaat) || 'nog geen resultaat'}</em>
              </div>; })}
          </div>
        </div>; })}
      </div>)}
    </div>
  </div>;
}
