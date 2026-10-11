import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import logo from "@/assets/logo-zp.webp";
import type { SchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { STATION_LABELS, type Puls } from "@/components/scherm/MachineScene";

const MachineScene = lazy(() => import("@/components/scherm/MachineScene"));

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
      <polyline points={pts} fill="none" stroke="hsl(var(--s-rood))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
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
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className={`${klein ? "text-[5vh]" : "text-[8vh]"} font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]`}>{waarde ?? <Gemeten />}</div>
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
          <div className="text-[9vh] font-bold leading-none tabular-nums text-[hsl(var(--s-tekst))]">{g.totaal}</div>
          <div className="text-[2.6vh] text-[hsl(var(--s-dim))]">van 200</div>
        </Ring>
        <div className="grid flex-1 grid-cols-1 gap-[2.4vh]">
          <Stat klein label="Nodig per dag" waarde={f(g.benodigd_per_dag, 1)} />
          <Stat klein label="Prognose 31 december" waarde={nf.format(g.prognose)} />
          <Stat klein label="Tempo laatste 14 dagen" waarde={`${f(g.tempo_14d, 1)} per dag`} />
        </div>
      </div>
      <div className="mt-auto">
        <div className="flex justify-between"><Label>Aanvragen per dag</Label><Label>vandaag {g.vandaag}, deze week {g.deze_week}, nog {g.resterende_dagen} dagen</Label></div>
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

const PANELEN = [PaneelDoel, PaneelGroei, PaneelService, PaneelZichtbaarheid];

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

export default function Scherm() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [data, setData] = useState<SchermPayload | null>(null);
  const [geweigerd, setGeweigerd] = useState(false);
  const [laatsteOk, setLaatsteOk] = useState<number>(0);
  const [nu, setNu] = useState(new Date());
  const [paneel, setPaneel] = useState(0);
  const [verschuiving, setVerschuiving] = useState({ x: 0, y: 0 });
  const fouten = useRef(0);
  const timer = useRef<number>();

  useWakeLock();

  const laad = useCallback(async () => {
    try {
      const r = await fetch(URL_DATA, { headers: { "x-scherm-token": token, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, cache: "no-store" });
      if (r.status === 401) { setGeweigerd(true); return; }
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      setLaatsteOk(Date.now());
      fouten.current = 0;
      timer.current = window.setTimeout(laad, 15_000);
    } catch {
      fouten.current += 1;
      if (fouten.current >= 6) { window.location.reload(); return; }
      timer.current = window.setTimeout(laad, Math.min(15_000 * 2 ** fouten.current, 300_000));
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    laad();
    return () => window.clearTimeout(timer.current);
  }, [token, laad]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const d = new Date();
      setNu(d);
      if (amsterdamTijd(d).hm === "04:30" && performance.now() > 120_000) window.location.reload();
    }, 1000);
    const p = window.setInterval(() => setPaneel((x) => (x + 1) % PANELEN.length), 20_000);
    const v = window.setInterval(() => setVerschuiving({ x: Math.round(Math.random() * 4 - 2), y: Math.round(Math.random() * 4 - 2) }), 600_000);
    return () => { clearInterval(t); clearInterval(p); clearInterval(v); };
  }, []);

  const pulsen: Puls[] = useMemo(() => (data?.activiteit ?? []).slice().reverse().map((a) => ({ id: a.id, station: a.station, status: a.status as Puls["status"] })), [data]);
  const eersteIds = useRef<Set<string> | null>(null);
  if (data && !eersteIds.current) eersteIds.current = new Set(data.activiteit.map((a) => a.id));
  const nieuwePulsen = useMemo(() => pulsen.filter((p) => !eersteIds.current?.has(p.id)), [pulsen]);

  const meta = (
    <Helmet>
      <title>ZP Zaken Live</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );

  if (!token || geweigerd) {
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
    <div className="scherm h-screen w-screen overflow-hidden bg-[hsl(var(--s-bg))] text-[hsl(var(--s-tekst))]">
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
            <div className="text-[2.2vh] capitalize text-[hsl(var(--s-dim))]">{tijd.datum}</div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1">
          <section className="flex w-[62vw] min-w-0 flex-col border-r border-[hsl(var(--s-lijn))]">
            <div className="relative min-h-0 flex-1">
              <div className="absolute left-[1.5vw] top-[1.5vh] z-10 text-[2.4vh] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--s-dim))]">De machine</div>
              {data && (
                <Suspense fallback={null}>
                  <MachineScene stations={data.stations} totaalVandaag={data.gebeurtenissen_vandaag} pulsen={nieuwePulsen} />
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

          <aside className="flex w-[38vw] min-w-0 flex-col px-[2vw] py-[3vh]">
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
    </div>
  );
}
