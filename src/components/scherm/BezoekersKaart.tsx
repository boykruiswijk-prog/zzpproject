import { useEffect, useRef, useState } from "react";
import { NL_PROVINCIES } from "@/data/nlKaart";
import { boogPad, kaartPunten, nieuweBezoekers, projecteer, SCHIPHOL_RIJK } from "@/lib/bezoekersKaart";
import { topPlaatsen, type BezoekersPayload } from "../../../supabase/functions/_shared/bezoekers";

const nf = new Intl.NumberFormat("nl-NL");

/** A8 Bezoekerskaart: eigen SVG van Nederland, stip per plaats en een boog naar Schiphol-Rijk. Alleen plaats en aantal. */
export default function BezoekersKaart({ b }: { b: BezoekersPayload | null }) {
  const punten = kaartPunten(b?.plaatsen ?? []);
  const vorig = useRef(new Map<string, number>());
  const [vuur, setVuur] = useState<Record<string, number>>({});
  useEffect(() => {
    const lijst = b?.plaatsen ?? [];
    const nieuw = nieuweBezoekers(vorig.current, lijst);
    if (nieuw.length && vorig.current.size) setVuur((v) => { const x = { ...v }; for (const p of nieuw) x[p] = (x[p] ?? 0) + 1; return x; });
    vorig.current = new Map(lijst.map((p) => [p.plaats, p.aantal]));
  }, [b]);
  const kantoor = projecteer(SCHIPHOL_RIJK.lat, SCHIPHOL_RIJK.lon);
  const top = topPlaatsen(b?.plaatsen ?? []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[16px]" data-testid="bezoekerskaart">
      <div className="flex items-baseline justify-between gap-[16px]">
        <h2 className="text-[38.88px] font-semibold tracking-tight text-[hsl(var(--s-tekst))]">Bezoekers afgelopen 7 dagen</h2>
        <span className="text-[54px] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]" data-testid="bezoekers-totaal">{b ? nf.format(b.totaal) : "-"}</span>
      </div>
      {!b && <div className="text-[23.76px] text-[hsl(var(--s-dim))]">Wacht op de koppeling met Google Analytics</div>}
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 590 690" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMaxYMid meet" role="img" aria-label="Kaart van Nederland met bezoekers per plaats">
          {NL_PROVINCIES.map((p) => <path key={p.naam} d={p.d} className="bk-provincie" />)}
          {punten.map((p) => <path key={`b-${p.plaats}-${vuur[p.plaats] ?? 0}`} d={boogPad(p)} className="bk-boog" pathLength={1} />)}
          {punten.map((p) => <circle key={`s-${p.plaats}`} cx={p.x} cy={p.y} r={p.r} className="bk-stip" />)}
          <circle cx={kantoor.x} cy={kantoor.y} r={9} className="bk-kantoor" />
        </svg>
        <ol className="absolute left-0 top-0 flex w-[230px] flex-col gap-[10px]" data-testid="bezoekers-top5">
          {top.map((p, i) => (
            <li key={p.plaats} className="flex min-w-0 items-baseline gap-[10px] text-[25.92px]">
              <span className="w-[26px] shrink-0 text-[hsl(var(--s-dim))]">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[hsl(var(--s-tekst))]">{p.plaats}</span>
              <strong className="tabular-nums text-[hsl(var(--s-tekst))]">{nf.format(p.aantal)}</strong>
            </li>
          ))}
          {b && top.length === 0 && <li className="text-[23.76px] text-[hsl(var(--s-dim))]">Nog geen plaatsen bekend</li>}
          {b && b.nu.length > 0 && <li className="mt-[10px] text-[20px] text-[hsl(var(--s-dim))]">Laatste 30 minuten: <strong className="text-[hsl(var(--s-tekst))]">{nf.format(b.nu.reduce((s, p) => s + p.aantal, 0))}</strong></li>}
        </ol>
      </div>
      <div className="text-[18.36px] text-[hsl(var(--s-dim))]">Bron: Google Analytics, bezoekers met cookietoestemming</div>
    </div>
  );
}
