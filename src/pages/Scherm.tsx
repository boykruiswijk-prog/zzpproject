import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import logo from "@/assets/logo-zp.webp";
import { supabase } from "@/integrations/supabase/client";
import type { SchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { STATION_IDS, workersSamenvatting, type Puls } from "@/components/scherm/schermModel";
import { nettoRegel, aiTeamVolgorde } from "@/components/scherm/schermTeksten";
import { weekomzetWeergave } from "../../supabase/functions/_shared/weekomzet";
import CountUp from '@/components/scherm/CountUp';
import { startVersieControle } from "@/lib/versieControle";
import { PANEEL_DUUR_MS, schermSchaal, useSchermViewport } from "@/components/scherm/schermWeergave";
import BreakingMoment from '@/components/scherm/BreakingMoment';
import BezoekersKaart from '@/components/scherm/BezoekersKaart';

const MachineScene = lazy(() => import("@/components/scherm/MachineScene"));
import { StroomTrechter, StroomProcessen } from '@/components/scherm/StroomScene';

const URL_DATA = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scherm-data`;
const TZ = "Europe/Amsterdam";
const nf = new Intl.NumberFormat("nl-NL");
const f = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? null : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n));

function amsterdamTijd(d: Date) {
  return {
    klok: new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d),
    datum: new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    hm: new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
  };
}

function Logo({ groot = false }: { groot?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-[6.48px] bg-[hsl(var(--s-tekst))] ${groot ? "p-[21.6px]" : "px-[10.8px] py-[5.4px]"}`}>
      <img src={logo} alt="ZP Zaken" className={groot ? "h-[151.2px] w-auto" : "h-[48.6px] w-auto"} />
    </div>
  );
}

const TV_SLEUTEL = "zp_tv_sleutel";
const URL_KOPPEL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scherm-koppel`;
function leesTvSleutel(): string { try { return window.localStorage.getItem(TV_SLEUTEL) ?? ""; } catch { return ""; } }
function zetTvSleutel(s: string) { try { if (s) window.localStorage.setItem(TV_SLEUTEL, s); else window.localStorage.removeItem(TV_SLEUTEL); } catch { /* geen opslag */ } }
const schermHeaders = (token: string, sleutel: string, sessie = ""): Record<string, string> => ({
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ...(token ? { "x-scherm-token": token } : sleutel ? { "x-scherm-apparaat": sleutel } : sessie ? { "x-scherm-sessie": "1", Authorization: `Bearer ${sessie}` } : {}),
});
const koppelPost = (body: unknown) => fetch(URL_KOPPEL, {
  method: "POST", cache: "no-store",
  headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Oude directe links /tv/<CODE>: de vaste code bestaat niet meer, dus alleen doorsturen naar /tv. */
export function TvCode() {
  return <Navigate to="/tv" replace />;
}

/** Koppelscherm: vraagt een koppelverzoek aan; het geheim blijft alleen in het geheugen. */
function Koppelscherm({ onGekoppeld }: { onGekoppeld: (s: string) => void }) {
  const [verzoek, setVerzoek] = useState<{ id: string; koppelcode: string; geheim: string; verloopt_op: string } | null>(null);
  const [fout, setFout] = useState(false);
  useEffect(() => {
    let stop = false;
    let t: number | undefined;
    let huidig: { id: string; geheim: string; verloopt: number } | null = null;
    const aanvragen = async () => {
      try {
        const r = await koppelPost({ actie: "aanvragen" });
        if (!r.ok) throw new Error(String(r.status));
        const v = await r.json();
        if (stop) return;
        huidig = { id: v.id, geheim: v.geheim, verloopt: Date.parse(v.verloopt_op) };
        setVerzoek(v); setFout(false);
        t = window.setTimeout(poll, 5000);
      } catch { if (!stop) { setFout(true); t = window.setTimeout(aanvragen, 60_000); } }
    };
    const poll = async () => {
      if (stop || !huidig) return;
      if (Date.now() >= huidig.verloopt) { aanvragen(); return; }
      try {
        const r = await koppelPost({ actie: "status", id: huidig.id, geheim: huidig.geheim });
        const s = await r.json().catch(() => ({}));
        if (stop) return;
        if (s.status === "gekoppeld" && s.token) { zetTvSleutel(s.token); onGekoppeld(s.token); return; }
        if (s.status === "verlopen" || s.status === "onbekend") { aanvragen(); return; }
      } catch { /* volgende poging */ }
      t = window.setTimeout(poll, 5000);
    };
    aanvragen();
    return () => { stop = true; window.clearTimeout(t); };
  }, [onGekoppeld]);
  return (
    <div className="scherm fixed inset-0 flex flex-col items-center justify-center gap-[54px] overflow-hidden bg-[hsl(var(--s-bg))] text-[hsl(var(--s-tekst))]">
      <Helmet><title>ZP Zaken Live</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Logo groot />
      <h1 className="text-[64.8px] font-semibold">Koppel dit scherm</h1>
      <p data-testid="koppelcode" className="rounded-[16.2px] border-[5.4px] border-[hsl(var(--s-lijn))] px-[43.2px] py-[21.6px] font-mono text-[129.6px] font-bold tracking-[0.3em]">
        {verzoek?.koppelcode ?? "......"}
      </p>
      <p className="max-w-[1536px] text-center text-[37.8px] text-[hsl(var(--s-tekst-zacht,var(--s-tekst)))]">
        Ga naar zpzaken.nl/admin/schermen en voer deze code in
      </p>
      <p role="alert" className="h-[43.2px] text-[32.4px] text-[hsl(var(--s-rood))]">{fout ? "Verbinding mislukt, nieuwe poging volgt" : ""}</p>
    </div>
  );
}

function Ring({ pct, kleur = "var(--s-rood)", children }: { pct: number; kleur?: string; children: React.ReactNode }) {
  const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative h-[280.8px] w-[280.8px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--s-lijn))" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={`hsl(${kleur})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} style={{ transition: "stroke-dasharray 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function Sparkline({ waarden }: { waarden: number[] }) {
  if (waarden.length < 2) return <div className="h-[108px]" />;
  const max = Math.max(1, ...waarden);
  const pts = waarden.map((v, i) => `${(i / (waarden.length - 1)) * 100},${38 - (v / max) * 34}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-[108px] w-full">
      <polyline points={`0,40 ${pts} 100,40`} fill="hsl(var(--s-rood) / 0.15)" stroke="none" />
      <polyline className="scherm-spark" pathLength="1" points={pts} fill="none" stroke="hsl(var(--s-rood))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const Kop = ({ children }: { children: React.ReactNode }) => <h2 className="text-[38.88px] font-semibold tracking-tight text-[hsl(var(--s-tekst))]">{children}</h2>;
const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[25.92px] text-[hsl(var(--s-dim))]">{children}</div>;
const Gemeten = () => <span className="text-[28.08px] font-normal text-[hsl(var(--s-dim))]">wordt gemeten</span>;

function Stat({ label, waarde, klein = false }: { label: string; waarde: string | null; klein?: boolean }) {
  const match = waarde?.match(/^([\d.,]+)(.*)$/);
  const number = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null;
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className={`${klein ? "text-[54px]" : "text-[86.4px]"} font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]`}>{number !== null && Number.isFinite(number) ? <><CountUp value={number} decimals={match?.[1].includes(',') ? 1 : 0} />{match?.[2]}</> : waarde ?? <Gemeten />}</div>
    </div>
  );
}

function PaneelDoel({ d }: { d: SchermPayload }) {
  const g = d.doel;
  return (
    <div className="doel-paneel flex h-full min-h-0 flex-col gap-[16px]">
      <Kop>Doel 200 aanvragen BAV + AVB</Kop>
      <Label>6 oktober tot en met 31 december 2026</Label>
      <div className="flex min-h-0 items-center gap-[32px]">
        <Ring pct={g.totaal / 200}>
          <div className="text-[97.2px] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]"><CountUp value={g.totaal} /></div>
          <div className="text-[28.08px] text-[hsl(var(--s-dim))]">van 200</div>
        </Ring>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-[12px]">
          <Stat klein label="Nodig per dag" waarde={f(g.benodigd_per_dag, 1)} />
          <Stat klein label="Prognose 31 december" waarde={nf.format(g.prognose)} />
          <Stat klein label="Tempo laatste 14 dagen" waarde={`${f(g.tempo_14d, 1)} per dag`} />
        </div>
      </div>
      <div className="mt-auto shrink-0" data-testid="doel-per-dag">
        <div className="flex flex-wrap justify-between gap-x-[16px] gap-y-[6px]"><Label>Per dag</Label><Label>vandaag {g.vandaag} | week {g.deze_week} | nog {g.resterende_dagen} dagen</Label></div>
        <Sparkline waarden={g.per_dag.map((x) => x.n)} />
      </div>
    </div>
  );
}

/** Besluit Boy 12-11-2026: klanten = unieke ondernemingen met minstens één factureerbaar contract (scherm_groei). */
function PaneelGroei({ d }: { d: SchermPayload }) {
  const g = d.groei;
  if (!g) return <div className="flex h-full flex-col gap-[32.4px]"><Kop>Groei</Kop><Gemeten /></div>;
  const opbouw: [string, number][] = [["BAV + AVB", g.bav_avb], ["Cyber", g.cyber], ["Lidmaatschappen", g.lidmaatschap], ["Overig", g.overig]];
  return (
    <div className="flex h-full flex-col gap-[32.4px]" data-testid="paneel-groei">
      <Kop>Groei</Kop>
      <div className="grid grid-cols-2 gap-[38.4px]">
        <Stat label="Klanten" waarde={nf.format(g.klanten)} />
        <Stat label="Facturabele contracten" waarde={nf.format(g.contracten)} />
      </div>
      <div className="text-[25.92px] leading-snug text-[hsl(var(--s-dim))]">1 klant kan meerdere verzekeringen hebben (bijv. BAV + AVB en cyber)</div>
      <div className="flex flex-col gap-[10px]" data-testid="groei-opbouw">
        <Label>Facturabele contracten per soort</Label>
        {opbouw.filter(([, n]) => n > 0).map(([l, n]) => (
          <div key={l} className="flex items-baseline justify-between border-b border-[hsl(var(--s-lijn))] pb-[6px] text-[32.4px]">
            <span>{l}</span><strong className="tabular-nums">{nf.format(n)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Netto groei: zelfde bron en klantdefinitie als Groei; begin + nieuw - gestopt = nu. */
function PaneelNettoGroei({ d }: { d: SchermPayload }) {
  const g = d.groei;
  if (!g?.sinds) return <div className="flex h-full flex-col gap-[32.4px]"><Kop>Netto groei</Kop><Gemeten /></div>;
  const blok = (titel: string, b: NonNullable<typeof g.sinds> | null, beginLabel: string) => b && (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[38.88px] font-semibold leading-snug text-[hsl(var(--s-tekst))]">{nettoRegel(titel, b)}</div>
      <Label>{nf.format(b.begin)} klanten {beginLabel}, nu {nf.format(b.nu)}</Label>
    </div>
  );
  return (
    <div className="flex h-full flex-col gap-[43.2px]" data-testid="paneel-netto-groei">
      <Kop>Netto groei</Kop>
      {blok("Sinds 1 oktober", g.sinds, "op 30 september")}
      {blok("Deze week", g.week, "op zondag")}
    </div>
  );
}

function PaneelService({ d }: { d: SchermPayload }) {
  const s = d.service;
  return (
    <div className="flex h-full flex-col gap-[28px]" data-testid="paneel-service">
      <Kop>Service en kwaliteit</Kop>
      <Stat klein label="Aanvraag tot polis (mediaan)" waarde={s.aanvraag_tot_polis_uur === null ? null : `${f(s.aanvraag_tot_polis_uur, 1)} u`} />
      <Stat klein label="Serviceverzoek afgehandeld (mediaan)" waarde={s.afhandeltijd_uur === null ? null : `${f(s.afhandeltijd_uur, 1)} u`} />
      <Stat klein label="Mail binnen 5 minuten" waarde={s.bevestiging_5min_pct === null ? null : `${s.bevestiging_5min_pct}%`} />
      <Stat klein label="Open verzoeken" waarde={nf.format(s.open)} />
    </div>
  );
}

function Pijl({ deze, vorige }: { deze: number | null; vorige: number | null }) {
  if (deze === null || vorige === null || deze === vorige) return null;
  return deze > vorige
    ? <span aria-label="hoger dan vorige week" style={{ color: "hsl(var(--s-groen))" }}>▲</span>
    : <span aria-label="lager dan vorige week" style={{ color: "hsl(var(--s-rood))" }}>▼</span>;
}

/** Besluit Boy 12-11-2026: vier cijfers, deze week tegen vorige week. */
function PaneelZichtbaarheid({ d }: { d: SchermPayload }) {
  const z = d.zichtbaarheid;
  const rijen: [string, { deze: number | null; vorige: number | null }, string][] = [
    ["Google Ads klikken", z.ads_klikken, ""],
    ["Aanvragen via advertenties", z.advertentie_aanvragen, ""],
    ["Klikken uit Google (organisch)", z.organisch_klikken, ""],
    ["AI-zichtbaarheid", z.ai_zichtbaarheid, "%"],
  ];
  const w = (v: number | null, suf: string) => (v === null ? "-" : `${f(v, suf ? 1 : 0)}${suf}`);
  return (
    <div className="flex h-full flex-col gap-[32.4px]" data-testid="paneel-zichtbaarheid">
      <Kop>Zichtbaarheid</Kop>
      <ul className="flex flex-col gap-[30px]">
        {rijen.map(([l, v, suf]) => (
          <li key={l} className="flex min-w-0 flex-col gap-[4px]" data-zichtbaarheid={l}>
            <Label>{l}</Label>
            <div className="flex items-baseline gap-[16px] tabular-nums">
              <span className="text-[54px] font-bold leading-none text-[hsl(var(--s-tekst))]">{w(v.deze, suf)}</span>
              <span className="text-[38.88px] font-bold leading-none"><Pijl deze={v.deze} vorige={v.vorige} /></span>
              <span className="text-[25.92px] text-[hsl(var(--s-dim))]">vorige week {w(v.vorige, suf)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Besluit Boy 12-11-2026: Weekomzet, enige bedrag op het scherm (vervangt A8 Dagomzet). */
function Weekomzet({ d }: { d: SchermPayload }) {
  const w = weekomzetWeergave(d.weekomzet);
  const vorig = useRef(w.aantal);
  const [licht, setLicht] = useState(false);
  useEffect(() => {
    if (w.aantal > vorig.current) { setLicht(true); const t = setTimeout(() => setLicht(false), 2400); vorig.current = w.aantal; return () => clearTimeout(t); }
    vorig.current = w.aantal;
  }, [w.aantal]);
  const pct = w.verschil_pct;
  return (
    <div data-testid="weekomzet" className={`scherm-dagomzet${licht ? " scherm-dagomzet-licht" : ""}`}>
      <div className="scherm-dagomzet-tekst">
        <div className="scherm-dagomzet-titel">Weekomzet nieuwe contracten</div>
        <div className="scherm-dagomzet-sub">nieuwe jaarpremie uit {nf.format(w.aantal)} {w.aantal === 1 ? "aanvraag" : "aanvragen"} sinds maandag</div>
      </div>
      <div className="min-w-0 text-right">
        <div className="scherm-dagomzet-bedrag tabular-nums" data-testid="weekomzet-bedrag">{euro.format(w.bedrag)}</div>
        <div className="scherm-weekomzet-vergelijk tabular-nums" data-testid="weekomzet-vergelijk">
          vorige week {euro.format(w.vorige_bedrag)}{" "}
          {pct === null ? null : pct > 0 ? <span style={{ color: "hsl(var(--s-groen))" }}>▲ {pct}%</span>
            : pct < 0 ? <span style={{ color: "hsl(var(--s-rood))" }}>▼ {Math.abs(pct)}%</span> : <span>gelijk</span>}
        </div>
      </div>
    </div>
  );
}

function runTijd(iso: string | null, nu: string) {
  if (!iso) return null;
  const dag = (t: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
  if (dag(iso) === dag(nu)) return new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
}

/** Besluit Boy 12-11-2026: per robot één regel (stip, naam, vaste functie, laatste run); fouten bovenaan in rood. */
function PaneelAiTeam({ d }: { d: SchermPayload }) {
  const kb = d.kennisbank;
  const team = aiTeamVolgorde(d.ai_team ?? []);
  const kleur = (s: string) => s === 'fout' ? 'var(--s-rood)' : s === 'gepland' ? 'var(--s-dim)' : 'var(--s-groen)';
  return (
    <div className="ai-team-paneel flex h-full min-w-0 flex-col gap-[17.28px] overflow-hidden">
      <Kop>Ons AI-team</Kop>
      <div className="flex items-baseline gap-[24px] rounded-[10.8px] border border-[hsl(var(--s-rood)/0.6)] bg-[hsl(var(--s-rood)/0.1)] px-[17.28px] py-[10px]" data-testid="contentmachine">
        <span className="text-[25.92px] font-semibold text-[hsl(var(--s-tekst))]">Contentmachine</span>
        <span className="text-[25.92px] text-[hsl(var(--s-dim))]"><strong className="text-[38.88px] tabular-nums text-[hsl(var(--s-tekst))]">{kb.content_nieuw ?? "-"}</strong> nieuw</span>
        <span className="text-[25.92px] text-[hsl(var(--s-dim))]"><strong className="text-[38.88px] tabular-nums text-[hsl(var(--s-tekst))]">{kb.content_verbeterd ?? "-"}</strong> verbeterd</span>
      </div>
      {team.length === 0 ? <Gemeten /> : (
        <div className="flex min-h-0 flex-1 flex-col justify-start gap-[4px]" data-testid="ai-team-lijst" data-aantal={team.length}>
          {team.map((a, i) => {
            const t = runTijd(a.laatste_run, d.gegenereerd_op);
            const fout = a.status === 'fout';
            return (
              <div key={`${a.naam}-${i}`} className="flex min-w-0 items-center gap-[12px] text-[21.6px] leading-[28px]" data-testid="ai-team-regel" data-status={a.status}>
                <span className="h-[15.12px] w-[15.12px] shrink-0 rounded-full" style={{ background: `hsl(${kleur(a.status)})` }} />
                <span className="w-[96px] shrink-0 truncate font-bold" style={{ color: fout ? 'hsl(var(--s-rood))' : 'hsl(var(--s-tekst))' }} data-testid="robotnaam">{a.robotnaam ?? a.naam}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: fout ? 'hsl(var(--s-rood))' : 'hsl(var(--s-dim))' }}>{fout ? a.reden ?? 'laatste run mislukt' : a.functie}</span>
                <span className="shrink-0 tabular-nums text-[hsl(var(--s-dim))]">{t ?? '-'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const workerKleur = (s: string) => s === 'fout' ? 'var(--s-rood)' : s === 'gepland' ? 'var(--s-dim)' : 'var(--s-groen)';
const Bolletje = ({ status }: { status: string }) => <span className="h-[15.12px] w-[15.12px] shrink-0 rounded-full" style={{ background: `hsl(${workerKleur(status)})`, boxShadow: `0 0 10.8px hsl(${workerKleur(status)})` }} />;

function PaneelWorkers({ d }: { d: SchermPayload }) {
  if (!d.workers) return <div className="workers-strook"><strong>Alle workers</strong><Gemeten /></div>;
  const s = workersSamenvatting(d.workers, d.gegenereerd_op);
  return (
    <div className="workers-strook" data-testid="workers-samenvatting">
      <span><strong>Alle workers</strong> {s.totaal}: <strong>{s.goed}</strong> goed, <strong>{s.bezig}</strong> bezig, <strong className={s.fout.length ? 'ws-fout' : ''}>{s.fout.length}</strong> fout</span>
      {s.fout.length > 0 && <span className="ws-fout" data-testid="workers-fout">Fout: {s.fout.join(', ')}</span>}
      {s.volgende.length > 0 && <span data-testid="workers-volgende">Straks: {s.volgende.map(v => <span key={v.naam} className="mr-[14px]"><strong>{v.tijd}</strong> {v.naam}</span>)}</span>}
    </div>
  );
}

function PaneelStroom({ d }: { d: SchermPayload }) {
  return <div className="stroom-paneel h-full"><StroomTrechter data={d} /></div>;
}

function PaneelProcessen({ d }: { d: SchermPayload }) {
  return <div className="processen-paneel flex h-full min-w-0 flex-col gap-[32.4px] overflow-hidden">
    <Kop>Processtromen</Kop>
    <StroomProcessen data={d} />
  </div>;
}

function PaneelBezoekers({ d }: { d: SchermPayload }) {
  return <BezoekersKaart b={d.bezoekers} />;
}

// Besluit Boy 12-11-2026: paneel Vandaag vervallen.
const PANELEN = [PaneelDoel, PaneelGroei, PaneelNettoGroei, PaneelService, PaneelZichtbaarheid, PaneelStroom, PaneelAiTeam, PaneelProcessen, PaneelBezoekers];
// A7-aanvulling (besluit Boy 15-10-2026): PaneelWorkers staat vast links, niet in de carrousel.

function useWakeLock() {
  useEffect(() => {
    // deno-lint-ignore no-explicit-any
    let lock: any = null;
    const vraag = async () => {
      try { lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock?.request("screen"); } catch { /* niet ondersteund */ }
    };
    vraag();
    const zicht = () => { if (document.visibilityState === "visible") vraag(); };
    document.addEventListener("visibilitychange", zicht);
    return () => { document.removeEventListener("visibilitychange", zicht); lock?.release?.(); };
  }, []);
}

export default function Scherm({ tv = false }: { tv?: boolean }) {
  const viewport = useSchermViewport();
  const schaal = schermSchaal(viewport.breedte, viewport.hoogte);
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [tvCode, setTvCode] = useState(() => (tv && !token ? leesTvSleutel() : ""));
  // Zonder token of apparaatsleutel: beheersessie van de ingelogde supervisor/admin (demo vanuit het beheer).
  const [sessie, setSessie] = useState("");
  const [sessieGecontroleerd, setSessieGecontroleerd] = useState(Boolean(tv || token));
  useEffect(() => {
    if (tv || token) return;
    supabase.auth.getSession().then(({ data }) => { setSessie(data.session?.access_token ?? ""); setSessieGecontroleerd(true); }).catch(() => setSessieGecontroleerd(true));
  }, [tv, token]);
  const actief = Boolean(token || tvCode || sessie);
  const demo = useMemo(() => new URLSearchParams(window.location.search).get('demo') === '1', []);
  const [data, setData] = useState<SchermPayload | null>(null);
  const [geweigerd, setGeweigerd] = useState(false);
  const [laatsteOk, setLaatsteOk] = useState<number>(0);
  const [nu, setNu] = useState(new Date());
  const [paneel, setPaneel] = useState(0);
  const [demoEvent, setDemoEvent] = useState<Puls | null>(null);
  const [breaking, setBreaking] = useState<{ event: Puls; total: number } | null>(null);
  const [focus, setFocus] = useState<Puls | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const breakingTimer = useRef<number>();
  const [verschuiving, setVerschuiving] = useState({ x: 0, y: 0 });
  const fouten = useRef(0);
  const timer = useRef<number>();
  const laatsteFocus = useRef(0);

  useWakeLock();
  // Nieuwe build: zelf oppikken (elke 10 minuten index.html vergelijken), niet wachten op 04:30.
  useEffect(() => startVersieControle(), []);
  useEffect(() => {
    const oudOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // index.html heeft een vaste robots-tag; op dit scherm altijd noindex
    const m = document.querySelector('meta[name="robots"]');
    const oud = m?.getAttribute("content");
    m?.setAttribute("content", "noindex, nofollow");
    return () => { document.body.style.overflow = oudOverflow; if (oud) m?.setAttribute("content", oud); };
  }, []);

  const laad = useCallback(async () => {
    try {
      const r = await fetch(URL_DATA, { headers: schermHeaders(token, tvCode, sessie), cache: "no-store" });
      if (r.status === 401) { if (!token && tvCode) { zetTvSleutel(""); seen.current = null; setData(null); setTvCode(""); } else setGeweigerd(true); return; }
      if (!r.ok) throw new Error(String(r.status));
      const next: SchermPayload = await r.json();
      const nieuwe = seen.current ? next.activiteit.filter(a => !seen.current?.has(a.id)) : [];
      seen.current = new Set(next.activiteit.map(a => a.id));
      if (nieuwe.length) {
        const latest = [...nieuwe].sort((a, b) => Date.parse(b.tijd) - Date.parse(a.tijd))[0];
        // Camera wisselt hooguit eens per 20 seconden.
        if (Date.now() - laatsteFocus.current >= 20_000) { laatsteFocus.current = Date.now(); setFocus(latest); }
        const intake = [...nieuwe].sort((a, b) => Date.parse(b.tijd) - Date.parse(a.tijd)).find(a => a.echte_aanvraag && Date.now() - Date.parse(a.tijd) < 120_000);
        if (intake) {
          setBreaking({ event: intake, total: next.doel.totaal });
          clearTimeout(breakingTimer.current);
          breakingTimer.current = window.setTimeout(() => setBreaking(null), 8000);
        }
      }
      setData(next);
      setLaatsteOk(Date.now());
      fouten.current = 0;
      timer.current = window.setTimeout(laad, 5_000);
    } catch {
      fouten.current += 1;
      if (fouten.current >= 6) { window.location.reload(); return; }
      timer.current = window.setTimeout(laad, Math.min(5_000 * 2 ** fouten.current, 300_000));
    }
  }, [token, tvCode, sessie]);

  useEffect(() => {
    if (!actief) return;
    laad();
    return () => { window.clearTimeout(timer.current); window.clearTimeout(breakingTimer.current); };
  }, [actief, laad]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const d = new Date();
      setNu(d);
      if (amsterdamTijd(d).hm === "04:30" && performance.now() > 120_000) window.location.reload();
    }, 1000);
    const p = window.setInterval(() => setPaneel((x) => (x + 1) % PANELEN.length), PANEEL_DUUR_MS);
    const v = window.setInterval(() => setVerschuiving({ x: Math.round(Math.random() * 4 - 2), y: Math.round(Math.random() * 4 - 2) }), 600_000);
    return () => { clearInterval(t); clearInterval(p); clearInterval(v); };
  }, []);

  useEffect(() => {
    if (!demo || !data) return;
    let i = 0;
    const t = window.setInterval(() => {
      const station = STATION_IDS[i % STATION_IDS.length];
      const event: Puls = { id: `demo-${Date.now()}`, station, actie: 'overig', status: 'klaar', tekst: station === 'intake' ? 'Nieuwe aanvraag binnen, Consultant uit Utrecht' : 'Demonstratie: afdeling aan het werk', tijd: new Date().toISOString(), echte_aanvraag: station === 'intake', beroepsgroep: station === 'intake' ? 'Consultant' : null, provincie: station === 'intake' ? 'Utrecht' : null, gestart_op: null, afgerond_op: null, agent: false, aantal: 1 };
      setDemoEvent(event); setFocus(event);
      if (station === 'intake') {
        setBreaking({ event, total: data.doel.totaal + 1 });
        clearTimeout(breakingTimer.current);
        breakingTimer.current = window.setTimeout(() => setBreaking(null), 8000);
      }
      i++;
    }, 10_000);
    return () => clearInterval(t);
  }, [demo, Boolean(data)]);

  // Demo (alleen in de browser): elke 10 seconden schuiven de vier toestanden over de werkplekken.
  const stationsWeergave = useMemo(() => {
    if (!data) return {};
    if (!demo) return data.stations;
    const volgorde = ['aan_het_werk', 'stand_by', 'rust', 'storing'] as const;
    const stap = Math.floor(nu.getTime() / 10_000);
    return Object.fromEntries(STATION_IDS.map((id, i) => {
      const toestand = volgorde[(i + stap) % 4];
      const minuten = toestand === 'stand_by' ? 25 : toestand === 'rust' ? 60 * 20 : 2;
      return [id, { ...data.stations[id], toestand, laatst_actief_op: new Date(nu.getTime() - minuten * 60_000).toISOString(), lopende_tekst: 'Demonstratie: afdeling aan het werk' }];
    }));
  }, [data, demo, demo ? Math.floor(nu.getTime() / 10_000) : 0]);

  const nieuwePulsen = useMemo(() => [...(data?.activiteit ?? []), ...(demoEvent ? [demoEvent] : [])], [data, demoEvent]);

  const meta = (
    <Helmet>
      <title>ZP Zaken Live</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );

  if (tv && !token && !tvCode) return <Koppelscherm onGekoppeld={setTvCode} />;

  if (!sessieGecontroleerd) return null;
  if (!actief || geweigerd) {
    return (
      <div className="scherm flex h-screen w-screen items-center justify-center overflow-hidden bg-[hsl(var(--s-bg))]">
        {meta}
        <Logo groot />
      </div>
    );
  }

  const tijd = amsterdamTijd(nu);
  const vers = laatsteOk > 0 && nu.getTime() - laatsteOk < 120_000 && !data?.verouderd_sinds;
  const Huidig = PANELEN[paneel];

  return (
    <div className="scherm fixed inset-0 h-screen w-screen overflow-hidden bg-[hsl(var(--s-bg))] text-[hsl(var(--s-tekst))]">
      {meta}
      <div className="scherm-canvas" data-testid="scherm-canvas" style={{ transform: `translate(-50%, -50%) scale(${schaal})` }}>
      <div className="flex h-full w-full flex-col" style={{ transform: `translate(${verschuiving.x}px, ${verschuiving.y}px)` }}>
        <header className="flex h-[97.2px] shrink-0 items-center gap-[28.8px] border-b border-[hsl(var(--s-lijn))] px-[38.4px]">
          <Logo />
          <div className="flex items-center gap-[11.52px] rounded-full bg-[hsl(var(--s-rood))] px-[19.2px] py-[4.32px] text-[25.92px] font-bold uppercase tracking-widest">
            <span className="scherm-knipper h-[12.96px] w-[12.96px] rounded-full bg-[hsl(var(--s-tekst))]" /> Live
          </div>
          <div className="flex items-center gap-[11.52px] text-[25.92px] text-[hsl(var(--s-dim))]">
            <span className="h-[17.28px] w-[17.28px] rounded-full" style={{ background: `hsl(var(${vers ? "--s-groen" : "--s-oranje"}))`, boxShadow: `0 0 12.96px hsl(var(${vers ? "--s-groen" : "--s-oranje"}))` }} />
            {vers ? "machine actief" : "wacht op nieuwe data"}
          </div>
          {data && (
            <div className="ml-auto flex items-center gap-[28.8px] text-[25.92px] text-[hsl(var(--s-dim))] tabular-nums">
              <span>Nu op de site: {data.nu_op_site === null ? <Gemeten /> : <strong className="text-[hsl(var(--s-tekst))]">{data.nu_op_site}</strong>}</span>
            </div>
          )}
          <div className={`${data ? '' : 'ml-auto '}text-right`}>
            <div className="text-[47.52px] font-bold leading-none tabular-nums">{tijd.klok}</div>
            <div className="text-[23.76px] text-[hsl(var(--s-dim))]">{tijd.datum.charAt(0).toUpperCase() + tijd.datum.slice(1)}</div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1">
          <section className="flex w-[1290px] min-w-0 flex-col border-r border-[hsl(var(--s-lijn))]">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {data && (
                <Suspense fallback={null}>
                  <div className="scherm-scene scene-zichtbaar" data-testid="agentkantoor">
                    <MachineScene stations={stationsWeergave} totaalVandaag={data.gebeurtenissen_vandaag} kennisregels={data.kennisbank.gepubliceerd} pulsen={nieuwePulsen} focus={focus} actief={!breaking} robots={data.ai_team} />
                  </div>
                </Suspense>
              )}
            </div>
            <div data-testid="workers-vast" className="h-[60px] shrink-0 overflow-hidden border-t border-[hsl(var(--s-lijn))] px-[24px]">
              {data && <PaneelWorkers d={data} />}
            </div>
          </section>

          <aside className="scherm-rapport flex w-[630px] min-w-0 flex-col px-[28px] py-[26px]">
            {data && <Weekomzet d={data} />}
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              {data ? (
                <div key={paneel} data-testid="rapportage-paneel" data-paneel={paneel} className="scherm-paneel absolute inset-0 overflow-hidden"><Huidig d={data} /></div>
              ) : (
                <Label>Rapportage laden</Label>
              )}
            </div>
            <div data-testid="paneel-puntjes" className="flex shrink-0 justify-center gap-[19.2px] pt-[21.6px]">
              {PANELEN.map((_, i) => (
                <span key={i} className="h-[15.12px] rounded-full transition-all duration-700" style={{ width: i === paneel ? "43.2px" : "15.12px", background: `hsl(var(${i === paneel ? "--s-rood" : "--s-lijn"}))` }} />
              ))}
            </div>
          </aside>
        </main>
      </div>
      {breaking && <BreakingMoment event={breaking.event} total={breaking.total} />}
      {demo && <span className="scherm-demo">demo</span>}
      </div>
    </div>
  );
}
