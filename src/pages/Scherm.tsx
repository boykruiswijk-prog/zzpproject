import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import logo from "@/assets/logo-zp.webp";
import { supabase } from "@/integrations/supabase/client";
import type { SchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { STATION_LABELS, STATION_IDS, stationToken, type Puls } from "@/components/scherm/schermModel";
import CountUp from '@/components/scherm/CountUp';
import BreakingMoment from '@/components/scherm/BreakingMoment';

const MachineScene = lazy(() => import("@/components/scherm/MachineScene"));
const StroomScene = lazy(() => import('@/components/scherm/StroomScene'));

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
const tijdKort = (iso: string) => {
  try { return new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return ""; }
};

function Logo({ groot = false }: { groot?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-[0.6vh] bg-[hsl(var(--s-tekst))] ${groot ? "p-[2vh]" : "px-[1vh] py-[0.5vh]"}`}>
      <img src={logo} alt="ZP Zaken" className={groot ? "h-[14vh] w-auto" : "h-[4.5vh] w-auto"} />
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
    <div className="scherm fixed inset-0 flex flex-col items-center justify-center gap-[5vh] overflow-hidden bg-[hsl(var(--s-bg))] text-[hsl(var(--s-tekst))]">
      <Helmet><title>ZP Zaken Live</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Logo groot />
      <h1 className="text-[6vh] font-semibold">Koppel dit scherm</h1>
      <p data-testid="koppelcode" className="rounded-[1.5vh] border-[0.5vh] border-[hsl(var(--s-lijn))] px-[4vh] py-[2vh] font-mono text-[12vh] font-bold tracking-[0.3em]">
        {verzoek?.koppelcode ?? "......"}
      </p>
      <p className="max-w-[80vw] text-center text-[3.5vh] text-[hsl(var(--s-tekst-zacht,var(--s-tekst)))]">
        Ga naar zpzaken.nl/admin/schermen en voer deze code in
      </p>
      <p role="alert" className="h-[4vh] text-[3vh] text-[hsl(var(--s-rood))]">{fout ? "Verbinding mislukt, nieuwe poging volgt" : ""}</p>
    </div>
  );
}

function Ring({ pct, kleur = "var(--s-rood)", children }: { pct: number; kleur?: string; children: React.ReactNode }) {
  const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative h-[26vh] w-[26vh] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--s-lijn))" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={`hsl(${kleur})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} style={{ transition: "stroke-dasharray 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function Sparkline({ waarden }: { waarden: number[] }) {
  if (waarden.length < 2) return <div className="h-[10vh]" />;
  const max = Math.max(1, ...waarden);
  const pts = waarden.map((v, i) => `${(i / (waarden.length - 1)) * 100},${38 - (v / max) * 34}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-[10vh] w-full">
      <polyline points={`0,40 ${pts} 100,40`} fill="hsl(var(--s-rood) / 0.15)" stroke="none" />
      <polyline className="scherm-spark" pathLength="1" points={pts} fill="none" stroke="hsl(var(--s-rood))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Staven({ data }: { data: { maand: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const maanden = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return (
    <div className="flex h-[24vh] items-end gap-[0.6vw]">
      {data.map((d) => (
        <div key={d.maand} className="flex h-full flex-1 flex-col items-center justify-end gap-[0.5vh]">
          <span className="text-[2.2vh] font-semibold tabular-nums text-[hsl(var(--s-tekst))]">{d.n}</span>
          <div className="w-full rounded-t-[0.4vh] bg-[hsl(var(--s-blauw))]" style={{ height: `${(d.n / max) * 15}vh`, minHeight: "0.4vh", transition: "height 1s ease" }} />
          <span className="text-[2.2vh] text-[hsl(var(--s-dim))]">{maanden[Number(d.maand.slice(5, 7)) - 1]}</span>
        </div>
      ))}
    </div>
  );
}

const Kop = ({ children }: { children: React.ReactNode }) => <h2 className="text-[3.6vh] font-semibold tracking-tight text-[hsl(var(--s-tekst))]">{children}</h2>;
const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[2.4vh] text-[hsl(var(--s-dim))]">{children}</div>;
const Gemeten = () => <span className="text-[2.6vh] font-normal text-[hsl(var(--s-dim))]">wordt gemeten</span>;

function Stat({ label, waarde, klein = false }: { label: string; waarde: string | null; klein?: boolean }) {
  const match = waarde?.match(/^([\d.,]+)(.*)$/);
  const number = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null;
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className={`${klein ? "text-[5vh]" : "text-[8vh]"} font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]`}>{number !== null && Number.isFinite(number) ? <><CountUp value={number} decimals={match?.[1].includes(',') ? 1 : 0} />{match?.[2]}</> : waarde ?? <Gemeten />}</div>
    </div>
  );
}

function PaneelDoel({ d }: { d: SchermPayload }) {
  const g = d.doel;
  return (
    <div className="flex h-full flex-col gap-[3vh]">
      <Kop>Doel 200 aanvragen BAV + AVB</Kop>
      <Label>6 oktober tot en met 31 december 2026</Label>
      <div className="flex items-center gap-[2vw]">
        <Ring pct={g.totaal / 200}>
          <div className="text-[9vh] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]"><CountUp value={g.totaal} /></div>
          <div className="text-[2.6vh] text-[hsl(var(--s-dim))]">van 200</div>
        </Ring>
        <div className="grid flex-1 grid-cols-1 gap-[2.4vh]">
          <Stat klein label="Nodig per dag" waarde={f(g.benodigd_per_dag, 1)} />
          <Stat klein label="Prognose 31 december" waarde={nf.format(g.prognose)} />
          <Stat klein label="Tempo laatste 14 dagen" waarde={`${f(g.tempo_14d, 1)} per dag`} />
        </div>
      </div>
      <div className="mt-auto">
        <div className="flex justify-between whitespace-nowrap"><Label>Per dag</Label><Label>vandaag {g.vandaag} | week {g.deze_week} | nog {g.resterende_dagen} dagen</Label></div>
        <Sparkline waarden={g.per_dag.map((x) => x.n)} />
      </div>
    </div>
  );
}

function PaneelGroei({ d }: { d: SchermPayload }) {
  const k = d.klantbasis;
  return (
    <div className="flex h-full flex-col gap-[3vh]">
      <Kop>Groei</Kop>
      <div className="grid grid-cols-2 gap-[2vw]">
        <Stat label="Actieve klanten" waarde={nf.format(k.actieve_klanten)} />
        <Stat label="Actieve contracten" waarde={nf.format(k.actieve_contracten)} />
        <Stat label="Certificaten deze maand" waarde={nf.format(k.certificaten_maand)} />
        <Stat label="Certificaten deze week" waarde={nf.format(k.certificaten_week)} />
      </div>
      <div className="mt-auto">
        <Label>Nieuwe klanten per maand</Label>
        <Staven data={k.nieuw_per_maand} />
      </div>
    </div>
  );
}

function StatusRegel({ label, ok }: { label: string; ok: boolean | null }) {
  const kleur = ok === null ? "var(--s-dim)" : ok ? "var(--s-groen)" : "var(--s-rood)";
  return (
    <div className="flex items-center gap-[1vw] text-[2.8vh] text-[hsl(var(--s-tekst))]">
      <span className="h-[2vh] w-[2vh] rounded-full" style={{ background: `hsl(${kleur})`, boxShadow: `0 0 1.5vh hsl(${kleur})` }} />
      <span>{label}</span>
      <span className="ml-auto text-[hsl(var(--s-dim))]">{ok === null ? "wordt gemeten" : ok ? "in orde" : "aandacht"}</span>
    </div>
  );
}

function PaneelService({ d }: { d: SchermPayload }) {
  const s = d.service, g = d.gezondheid;
  return (
    <div className="flex h-full flex-col gap-[3vh]">
      <Kop>Service en kwaliteit</Kop>
      <div className="grid grid-cols-3 gap-[1.5vw]">
        <Stat klein label="Afhandeltijd" waarde={s.afhandeltijd_uur === null ? null : `${f(s.afhandeltijd_uur, 1)} u`} />
        <Stat klein label="Mail binnen 5 min" waarde={s.bevestiging_5min_pct === null ? null : `${s.bevestiging_5min_pct}%`} />
        <Stat klein label="Open verzoeken" waarde={nf.format(s.open)} />
      </div>
      <div className="flex items-center gap-[2vw]">
        <Ring pct={(g.uptime_7d_pct ?? 0) / 100} kleur="var(--s-groen)">
          <div className="text-[7vh] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]">{g.uptime_7d_pct === null ? "-" : `${f(g.uptime_7d_pct, 1)}%`}</div>
          <div className="text-[2.2vh] text-[hsl(var(--s-dim))]">uptime 7 dagen</div>
        </Ring>
        <div className="flex flex-1 flex-col gap-[2.2vh]">
          <StatusRegel label="Exact-koppeling" ok={g.exact_ok} />
          <StatusRegel label="Facturatie" ok={g.planner_ok} />
          <StatusRegel label={`Geplande taken ${g.cron_ok_24u} / ${g.cron_totaal_24u}`} ok={g.cron_totaal_24u ? g.cron_ok_24u === g.cron_totaal_24u : null} />
          <StatusRegel label={`Fouten laatste 24 uur: ${g.fouten_24u}`} ok={g.fouten_24u === 0} />
        </div>
      </div>
    </div>
  );
}

function AdsBlok({ naam, a }: { naam: string; a: Record<string, number | string | null> | null }) {
  const w = (v: unknown, suf = "") => (typeof v === "number" ? `${nf.format(v)}${suf}` : null);
  return (
    <div className="rounded-[1vh] border border-[hsl(var(--s-lijn))] p-[1.6vh]">
      <div className="text-[2.6vh] font-semibold text-[hsl(var(--s-tekst))]">{naam}</div>
      {!a ? <Gemeten /> : (
        <div className="mt-[1vh] grid grid-cols-4 gap-[0.8vw]">
          {[["Vertoningen", w(a.vertoningen)], ["Klikken", w(a.klikken)], ["Conversies", w(a.conversies)], ["Budget", w(a.budget_pct, "%")]].map(([l, v]) => (
            <div key={l as string}><Label>{l}</Label><div className="text-[3.6vh] font-bold tabular-nums text-[hsl(var(--s-tekst))]">{v ?? <Gemeten />}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaneelZichtbaarheid({ d }: { d: SchermPayload }) {
  const m = d.marketing, sc = m.search_console, ai = m.ai_zichtbaarheid;
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <Kop>Zichtbaarheid</Kop>
      <AdsBlok naam="Google Ads" a={m.google_ads} />
      <AdsBlok naam="Microsoft Ads" a={m.microsoft_ads} />
      <div className="grid grid-cols-3 gap-[1vw]">
        <Stat klein label="Positie Google" waarde={typeof sc?.positie === "number" ? f(sc.positie, 1) : null} />
        <Stat klein label="Klikken Google" waarde={typeof sc?.klikken === "number" ? nf.format(sc.klikken) : null} />
        <Stat klein label="AI-zichtbaarheid" waarde={typeof ai?.score === "number" ? `${f(ai.score)}%` : null} />
      </div>
      <div className="mt-auto">
        <Label>Kennisbank: {d.kennisbank.gepubliceerd} artikelen, {d.kennisbank.nieuw_maand} nieuw deze maand</Label>
        {d.kennisbank.laatste.map((t) => <div key={t} className="truncate text-[2.4vh] text-[hsl(var(--s-tekst))]">{t}</div>)}
      </div>
    </div>
  );
}

function PaneelVandaag({ d }: { d: SchermPayload }) {
  const drukste = STATION_IDS.reduce((best, id) => (d.stations[id]?.vandaag ?? 0) > (d.stations[best]?.vandaag ?? 0) ? id : best, STATION_IDS[0]);
  return <div className="flex h-full flex-col gap-[3vh]">
    <Kop>Vandaag</Kop><Stat label="Gebeurtenissen" waarde={nf.format(d.gebeurtenissen_vandaag)} />
    <div className="vandaag-tijdlijn"><Label>Van 0 tot 24 uur</Label>
      <svg viewBox="0 0 600 140" aria-label="Gebeurtenissen per minuut vandaag">
        <line x1="10" x2="590" y1="110" y2="110" />
        {d.tijdlijn.map((a, i) => <circle key={`${a.station}-${a.minuut}`} cx={10 + a.minuut / 1440 * 580} cy={95 - STATION_IDS.indexOf(a.station) * 7} r={Math.min(7, 2 + Math.sqrt(a.n))} style={{ fill: `hsl(${stationToken(a.station)})` }} />)}
        {[0, 6, 12, 18, 24].map(h => <text key={h} x={10 + h / 24 * 580} y="135" textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}>{h}</text>)}
      </svg>
    </div>
    <div><Label>Drukste afdeling</Label><div className="text-[4vh] font-semibold">{d.gebeurtenissen_vandaag ? STATION_LABELS[drukste] : 'Nog geen gebeurtenissen'}</div><span className="text-[2.6vh] text-[hsl(var(--s-dim))]">{d.stations[drukste]?.vandaag ?? 0} gebeurtenissen</span></div>
    <div className="vandaag-legenda">{STATION_IDS.filter(id => (d.stations[id]?.vandaag ?? 0) > 0).map(id => <span key={id}><i style={{ background: `hsl(${stationToken(id)})` }} />{STATION_LABELS[id]}</span>)}</div>
  </div>;
}
function runTijd(iso: string | null, nu: string) {
  if (!iso) return null;
  const dag = (t: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
  if (dag(iso) === dag(nu)) return new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
}

function PaneelAiTeam({ d }: { d: SchermPayload }) {
  const kb = d.kennisbank, team = d.ai_team ?? [];
  const kleur = (s: string) => s === 'fout' ? 'var(--s-rood)' : s === 'gepland' ? 'var(--s-dim)' : 'var(--s-groen)';
  return (
    <div className="flex h-full flex-col gap-[1.6vh] overflow-hidden">
      <Kop>Ons AI-team</Kop>
      <div className="rounded-[1vh] border border-[hsl(var(--s-rood)/0.6)] bg-[hsl(var(--s-rood)/0.1)] p-[1.6vh]">
        <div className="text-[2.6vh] font-semibold text-[hsl(var(--s-tekst))]">Contentmachine</div>
        <div className="mt-[0.6vh] grid grid-cols-2 gap-[1vw]">
          <div><div className="text-[6vh] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]">{kb.content_nieuw ?? <Gemeten />}</div><Label>nieuwe artikelen</Label></div>
          <div><div className="text-[6vh] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]">{kb.content_verbeterd ?? <Gemeten />}</div><Label>artikelen verbeterd</Label></div>
        </div>
        <div className="mt-[0.6vh] text-[2vh] text-[hsl(var(--s-dim))]">sinds 6 oktober, automatisch geschreven en gecontroleerd</div>
      </div>
      {team.length === 0 ? <Gemeten /> : (
        <div className="flex min-h-0 flex-1 flex-col justify-start gap-[0.9vh]">
          {team.map((a, i) => {
            const t = runTijd(a.laatste_run, d.gegenereerd_op);
            return (
              <div key={`${a.naam}-${i}`} className="min-w-0 leading-tight">
                <div className="flex items-center gap-[0.6vw] text-[1.9vh]">
                  <span className="h-[1.4vh] w-[1.4vh] shrink-0 rounded-full" style={{ background: `hsl(${kleur(a.status)})`, boxShadow: `0 0 1vh hsl(${kleur(a.status)})` }} />
                  <span className="shrink-0 font-bold text-[hsl(var(--s-tekst))]">{a.naam}</span>
                  <span className="min-w-0 truncate text-[hsl(var(--s-dim))]">{a.taak}</span>
                  {t && <span className="ml-auto shrink-0 tabular-nums text-[hsl(var(--s-dim))]">{t}</span>}
                </div>
                {a.resultaat && <div className="truncate pl-[2vh] text-[1.7vh] text-[hsl(var(--s-tekst))]">{a.resultaat}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PANELEN = [PaneelDoel, PaneelGroei, PaneelService, PaneelZichtbaarheid, PaneelAiTeam, PaneelVandaag];

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
  const [scene, setScene] = useState(0);
  const [demoEvent, setDemoEvent] = useState<Puls | null>(null);
  const [breaking, setBreaking] = useState<{ event: Puls; total: number } | null>(null);
  const [focus, setFocus] = useState<Puls | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const breakingTimer = useRef<number>();
  const [verschuiving, setVerschuiving] = useState({ x: 0, y: 0 });
  const fouten = useRef(0);
  const timer = useRef<number>();

  useWakeLock();
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
        setFocus(latest);
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
      timer.current = window.setTimeout(laad, 15_000);
    } catch {
      fouten.current += 1;
      if (fouten.current >= 6) { window.location.reload(); return; }
      timer.current = window.setTimeout(laad, Math.min(15_000 * 2 ** fouten.current, 300_000));
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
    const p = window.setInterval(() => setPaneel((x) => (x + 1) % PANELEN.length), 20_000);
    const sc = window.setInterval(() => setScene(x => 1 - x), 60_000);
    const v = window.setInterval(() => setVerschuiving({ x: Math.round(Math.random() * 4 - 2), y: Math.round(Math.random() * 4 - 2) }), 600_000);
    return () => { clearInterval(t); clearInterval(p); clearInterval(v); clearInterval(sc); };
  }, []);

  useEffect(() => {
    if (!demo || !data) return;
    let i = 0;
    const t = window.setInterval(() => {
      const station = STATION_IDS[i % STATION_IDS.length];
      const event: Puls = { id: `demo-${Date.now()}`, station, actie: 'overig', status: 'klaar', tekst: station === 'intake' ? 'Nieuwe aanvraag binnen, Consultant uit Utrecht' : 'Demonstratie: afdeling aan het werk', tijd: new Date().toISOString(), echte_aanvraag: station === 'intake', beroepsgroep: station === 'intake' ? 'Consultant' : null, provincie: station === 'intake' ? 'Utrecht' : null };
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
  const vers = laatsteOk > 0 && nu.getTime() - laatsteOk < 120_000;
  const Huidig = PANELEN[paneel];

  return (
    <div className="scherm fixed inset-0 h-screen w-screen overflow-hidden bg-[hsl(var(--s-bg))] text-[hsl(var(--s-tekst))]">
      {meta}
      <div className="flex h-full w-full flex-col" style={{ transform: `translate(${verschuiving.x}px, ${verschuiving.y}px)` }}>
        <header className="flex h-[9vh] shrink-0 items-center gap-[1.5vw] border-b border-[hsl(var(--s-lijn))] px-[2vw]">
          <Logo />
          <div className="flex items-center gap-[0.6vw] rounded-full bg-[hsl(var(--s-rood))] px-[1vw] py-[0.4vh] text-[2.4vh] font-bold uppercase tracking-widest">
            <span className="scherm-knipper h-[1.2vh] w-[1.2vh] rounded-full bg-[hsl(var(--s-tekst))]" /> Live
          </div>
          <div className="flex items-center gap-[0.6vw] text-[2.4vh] text-[hsl(var(--s-dim))]">
            <span className="h-[1.6vh] w-[1.6vh] rounded-full" style={{ background: `hsl(var(${vers ? "--s-groen" : "--s-oranje"}))`, boxShadow: `0 0 1.2vh hsl(var(${vers ? "--s-groen" : "--s-oranje"}))` }} />
            {vers ? "machine actief" : "wacht op nieuwe data"}
          </div>
          <div className="ml-auto text-right">
            <div className="text-[4.4vh] font-bold leading-none tabular-nums">{tijd.klok}</div>
            <div className="text-[2.2vh] text-[hsl(var(--s-dim))]">{tijd.datum.charAt(0).toUpperCase() + tijd.datum.slice(1)}</div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1">
          <section className="flex w-[62vw] min-w-0 flex-col border-r border-[hsl(var(--s-lijn))]">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div className="scherm-scene-kop"><span>{scene === 0 ? 'Het agentkantoor' : 'De stroom'}</span><small>{scene === 0 ? 'Afdelingen verbonden met het brein' : 'De klantreis en processtromen'}</small></div>
              {data && (
                <Suspense fallback={null}>
                  <div className={`scherm-scene ${scene === 0 ? 'scene-zichtbaar' : ''}`} aria-hidden={scene !== 0}>
                    <MachineScene stations={data.stations} totaalVandaag={data.gebeurtenissen_vandaag} kennisregels={data.kennisbank.gepubliceerd} pulsen={nieuwePulsen} focus={focus} actief={scene === 0 && !breaking} adsBeschikbaar={Boolean(data.marketing.microsoft_ads)} />
                  </div>
                  {scene === 1 && <div className="scherm-scene scene-zichtbaar stroom-laag"><StroomScene data={data} /></div>}
                </Suspense>
              )}
            </div>
            <div className="h-[11vh] shrink-0 overflow-hidden border-t border-[hsl(var(--s-lijn))]">
              <div className="scherm-ticker flex h-full items-center gap-[3vw] whitespace-nowrap">
                {[0, 1].map((k) => (
                  <div key={k} className="flex shrink-0 items-center gap-[3vw] pr-[3vw]" aria-hidden={k === 1}>
                    {(data?.activiteit ?? []).slice(0, 14).map((a) => (
                      <span key={`${k}-${a.id}`} className="flex items-center gap-[0.8vw] text-[2.6vh]">
                        <span className="h-[1.4vh] w-[1.4vh] rounded-full" style={{ background: `hsl(var(${a.status === "fout" ? "--s-rood" : a.status === "bezig" ? "--s-blauw" : "--s-groen"}))` }} />
                        <span className="tabular-nums text-[hsl(var(--s-dim))]">{tijdKort(a.tijd)}</span>
                        <span className="font-semibold text-[hsl(var(--s-rood))]">{STATION_LABELS[a.station] ?? a.station}</span>
                        <span>{a.tekst}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="scherm-rapport flex w-[38vw] min-w-0 flex-col px-[2vw] py-[3vh]">
            <div className="relative min-h-0 flex-1">
              {data ? (
                <div key={paneel} className="scherm-paneel absolute inset-0"><Huidig d={data} /></div>
              ) : (
                <Label>Rapportage laden</Label>
              )}
            </div>
            <div className="flex shrink-0 justify-center gap-[1vw] pt-[2vh]">
              {PANELEN.map((_, i) => (
                <span key={i} className="h-[1.4vh] rounded-full transition-all duration-700" style={{ width: i === paneel ? "4vh" : "1.4vh", background: `hsl(var(${i === paneel ? "--s-rood" : "--s-lijn"}))` }} />
              ))}
            </div>
          </aside>
        </main>
      </div>
      {breaking && <BreakingMoment event={breaking.event} total={breaking.total} />}
      {demo && <span className="scherm-demo">demo</span>}
    </div>
  );
}
