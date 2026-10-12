// Laatste anonimiseringslaag voor het ZP Zaken Live-scherm (bezoekers kijken mee).
// Pure TypeScript zonder Deno- of npm-imports, zodat vitest dit ook test.

export const ADS_BUDGET = 22500;
export const STATIONS = [
  "intake", "acceptatie", "certificaten", "facturatie", "exact", "kennisbank",
  "ads", "kwaliteit", "assistent", "mail", "service",
] as const;

const PATRONEN: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, // e-mail
  /\b[A-Z]{2}\d{2}[A-Z]{4}\d{6,10}\b/gi, // IBAN
  /(\+31|0031|\b0)[\s-]?\d(?:[\s-]?\d){7,9}\b/g, // telefoon
  /\b\d{4}\s?[A-Z]{2}\b/g, // postcode
  /\b\d{8}\b/g, // KVK
  /€\s?\d[\d.,]*/g, // bedragen
  /\b(B\.?V\.?|V\.?O\.?F\.?|holding)\b/gi, // bedrijfsvormen
];

/** Schoont een publieke regel: geen contactgegevens, nummers, bedragen of bedrijfsvormen. */
export function schoonTekst(t: unknown, max = 90): string {
  let s = typeof t === "string" ? t : "";
  for (const p of PATRONEN) s = s.replace(p, "").replace(/\s{2,}/g, " ");
  s = s.replace(/[\u2013\u2014]/g, "-").trim();
  return s.slice(0, max);
}

const getal = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const eerste = (o: Record<string, unknown>, ...k: string[]) => {
  for (const x of k) { const n = getal(o[x]); if (n !== null) return n; }
  return null;
};

type Snap = { dag?: string; data?: Record<string, unknown> } | undefined;

/** Alleen toegestane marketingcijfers; budget als percentage, nooit euro's of kosten per aanvraag. */
export function schoonMarketing(m: Record<string, Snap> | null | undefined) {
  const uit: Record<string, Record<string, number | string | null> | null> = {};
  const ads = (s: Snap) => {
    const d = s?.data ?? {};
    if (!s || Object.keys(d).length === 0) return null;
    const kosten = eerste(d, "kosten", "cost", "spend", "budget_verbruikt");
    // Alle numerieke velden door, behalve bedragvelden (en cpa/spend als kosten per aanvraag).
    const vrij: Record<string, number> = {};
    for (const [k, v] of Object.entries(d)) {
      if (/kosten|cost|eur|bedrag|cpa|spend|verbruikt/i.test(k)) continue;
      const n = getal(v); if (n !== null && typeof v === 'number') vrij[k] = n;
    }
    return {
      ...vrij,
      dag: s.dag ?? null,
      vertoningen: eerste(d, "vertoningen", "impressions"),
      klikken: eerste(d, "klikken", "clicks"),
      conversies: eerste(d, "conversies", "conversions"),
      // Only an explicitly defined month-to-date spend can use the monthly budget.
      budget_pct: getal(d.budget_pct) ?? (d.periode === 'maand_tot_datum' && d.budget_scope === 'totaal_advertenties' && kosten !== null
        ? Math.round((kosten / ADS_BUDGET) * 1000) / 10 : null),
    };
  };
  uit.google_ads = ads(m?.google_ads);
  uit.microsoft_ads = ads(m?.microsoft_ads);
  const sc = m?.search_console?.data ?? {};
  uit.search_console = m?.search_console && Object.keys(sc).length ? {
    dag: m.search_console.dag ?? null,
    positie: eerste(sc, "gemiddelde_positie", "positie", "position"),
    klikken: eerste(sc, "klikken", "clicks"),
    vertoningen: eerste(sc, "vertoningen", "impressions"),
  } : null;
  const ai = m?.ai_zichtbaarheid?.data ?? {};
  uit.ai_zichtbaarheid = m?.ai_zichtbaarheid && Object.keys(ai).length ? {
    dag: m.ai_zichtbaarheid.dag ?? null,
    score: eerste(ai, "score", "percentage", "zichtbaarheid_pct"),
    vermeldingen: eerste(ai, "vermeldingen", "mentions"),
  } : null;
  const ga = m?.ga4?.data ?? {};
  uit.ga4 = m?.ga4 && Object.keys(ga).length ? {
    dag: m.ga4.dag ?? null,
    sessies: eerste(ga, "sessies", "sessions"),
    gebruikers: eerste(ga, "gebruikers", "users"),
  } : null;
  return uit;
}

// deno-lint-ignore no-explicit-any
type Ruw = Record<string, any>;

const BEROEPEN = ['ICT', 'Consultant', 'Interim-manager', 'Finance', 'HR', 'Marketing', 'Coach', 'Zorg', 'Zelfstandig professional'];
const PROVINCIES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Flevoland', 'Gelderland', 'Zeeland', 'Noord-Brabant', 'Limburg', 'Overijssel', 'Drenthe', 'Friesland', 'Groningen'];
export function intakeGroep(tekst: unknown) {
  const t = typeof tekst === 'string' ? tekst.toLowerCase() : '';
  const beroepsgroep = BEROEPEN.find(b => t.includes(b.toLowerCase())) ?? 'Zelfstandig professional';
  const provincie = PROVINCIES.find(p => t.includes(p.toLowerCase())) ?? 'Nederland';
  return { beroepsgroep, provincie };
}
const VEILIGE_TEKST: Record<string, string> = {
  intake: 'Aanvraag binnen, wordt verwerkt', acceptatie: 'Aanvraag en KVK-gegevens gecontroleerd',
  certificaten: 'Certificaat verwerkt voor opdrachtgever', facturatie: 'Factuurplanner aan het werk',
  exact: 'Exact-koppeling wordt gecontroleerd', kennisbank: 'Kennisbank wordt bijgewerkt',
  ads: 'Advertentieresultaten worden gecontroleerd', kwaliteit: 'Platform verbeterd door het team',
  assistent: 'Zeker-assistent beantwoordt een vraag', mail: 'Bevestigingsmail verwerkt', service: 'Serviceverzoek binnen, wordt opgepakt',
};
/** Echte machine_activiteit.tekst; alleen als de privacyfilter iets weghaalt (of tekst ontbreekt) een neutrale tekst. */
export function echteTekst(t: unknown, station: string): string {
  const origineel = (typeof t === 'string' ? t : '').replace(/[\u2013\u2014]/g, '-').replace(/\s{2,}/g, ' ').trim();
  const schoon = schoonTekst(origineel, 1000);
  if (!origineel || schoon !== origineel) return VEILIGE_TEKST[station] ?? VEILIGE_TEKST.kwaliteit;
  return origineel.slice(0, 90);
}
export function schermActiviteit(a: Ruw) {
  const station = (STATIONS as readonly string[]).includes(a.station) ? a.station : 'kwaliteit';
  const echteAanvraag = a.actie === 'lead_verzekering_aanvraag';
  const groep = intakeGroep(a.tekst);
  return {
    id: String(a.id ?? ''), station,
    actie: ['lead_verzekering_aanvraag','lead_actief','kvk_check','planner_run','exact_sync','wijziging','mail','cron','certificaat','chat','serviceverzoek','bav_aanmelding','artikel'].includes(a.actie) ? String(a.actie) : 'overig',
    tekst: echteTekst(a.tekst, station),
    status: (a.status === 'bezig' || a.status === 'fout' || a.status === 'onbekend' ? a.status : 'klaar') as 'bezig' | 'fout' | 'onbekend' | 'klaar',
    tijd: Number.isFinite(Date.parse(a.tijd)) ? new Date(a.tijd).toISOString() : '',
    echte_aanvraag: echteAanvraag,
    beroepsgroep: echteAanvraag ? groep.beroepsgroep : null,
    provincie: echteAanvraag ? groep.provincie : null,
  };
}

export type Toestand = 'aan_het_werk' | 'stand_by' | 'rust' | 'storing';
export const WERK_MINUTEN = 10;
const amsDag = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);
/** Toestand per werkplek: lopend of laatste actie < 10 min = aan het werk; laatste fout = storing; vandaag = stand-by; anders rust. */
export function bepaalToestand(w: { lopend?: unknown; laatst_actief_op?: unknown; laatste_status?: unknown } | undefined, nu: Date): Toestand {
  if (w?.lopend === true) return 'aan_het_werk';
  if (w?.laatste_status === 'fout') return 'storing';
  const t = typeof w?.laatst_actief_op === 'string' ? Date.parse(w.laatst_actief_op) : NaN;
  if (!Number.isFinite(t)) return 'rust';
  if (nu.getTime() - t < WERK_MINUTEN * 60_000) return 'aan_het_werk';
  return amsDag(new Date(t)) === amsDag(nu) ? 'stand_by' : 'rust';
}
const iso = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;

/** AI-team uit marketing_snapshot (bron ai_team): max 10 agents, vaste teksten door de privacyfilter. */
export function schoonAiTeam(snap: Snap): { naam: string; taak: string; resultaat: string | null; laatste_run: string | null; status: 'klaar' | 'fout' | 'gepland' }[] {
  const agents = (snap?.data as Ruw | undefined)?.agents;
  if (!Array.isArray(agents)) return [];
  return agents.slice(0, 12).filter((a: Ruw) => a && typeof a === 'object').map((a: Ruw) => {
    const resultaat = schoonTekst(a.resultaat, 70);
    return {
      naam: schoonTekst(a.naam, 70),
      taak: schoonTekst(a.taak, 70),
      resultaat: resultaat || null,
      laatste_run: typeof a.laatste_run === 'string' && Number.isFinite(Date.parse(a.laatste_run)) ? new Date(a.laatste_run).toISOString() : null,
      status: a.status === 'fout' || a.status === 'gepland' ? a.status : 'klaar' as const,
    };
  }).filter(a => a.naam);
}

type WorkerStatus = 'klaar' | 'fout' | 'gepland';
export type Worker = { naam: string; ritme: string | null; laatste: string | null; status: WorkerStatus; vandaag: number | null; week: number | null };
/** Witte lijst voor workers uit scherm_data: alleen naam, ritme, laatste tijd, status en tellingen. */
export function schoonWorkers(w: Ruw | null | undefined): { gepland: Worker[]; op_afroep: Worker[] } | null {
  if (!w || typeof w !== 'object') return null;
  const lijst = (x: unknown): Worker[] => (Array.isArray(x) ? x : []).slice(0, 20).filter((a: Ruw) => a && typeof a === 'object').map((a: Ruw) => {
    const ritme = schoonTekst(a.ritme, 30);
    return {
      naam: schoonTekst(a.naam, 40),
      ritme: ritme || null,
      laatste: typeof a.laatste === 'string' && Number.isFinite(Date.parse(a.laatste)) ? new Date(a.laatste).toISOString() : null,
      status: (a.status === 'fout' || a.status === 'gepland' ? a.status : 'klaar') as WorkerStatus,
      vandaag: getal(a.vandaag), week: getal(a.week),
    };
  }).filter(a => a.naam);
  const uit = { gepland: lijst(w.gepland), op_afroep: lijst(w.op_afroep) };
  return uit.gepland.length || uit.op_afroep.length ? uit : null;
}

/** Bouwt de publieke payload uit de geaggregeerde RPC-uitvoer; alleen witte-lijstvelden. */
export function bouwSchermPayload(r: Ruw, nu = new Date()) {
  const status = (s: unknown) => (s === "bezig" || s === "fout" ? s : "klaar");
  const doel = r?.doel ?? {};
  const totaal = getal(doel.totaal) ?? 0;
  const rest = Math.max(getal(doel.resterende_dagen) ?? 0, 0);
  const tempo = getal(doel.tempo_14d) ?? 0;
  const stations: Record<string, { vandaag: number; skills: number; laatste_status: string | null; toestand: Toestand; laatst_actief_op: string | null; lopende_tekst: string | null; duur_vandaag_min: number }> = {};
  for (const s of STATIONS) {
    const x = r?.stations?.[s] ?? {};
    const w = r?.werkstand?.[s];
    const tekst = w?.lopende_tekst ? echteTekst(w.lopende_tekst, s) : null;
    stations[s] = { vandaag: getal(x.vandaag) ?? 0, skills: getal(x.skills) ?? 0, laatste_status: x.laatste_status ? status(x.laatste_status) : null,
      toestand: bepaalToestand(w, nu), laatst_actief_op: iso(w?.laatst_actief_op), lopende_tekst: tekst, duur_vandaag_min: Math.max(0, Math.round(getal(w?.duur_vandaag_min) ?? 0)) };
  }
  const perioden = new Map<string, Ruw>((Array.isArray(r?.perioden) ? r.perioden : []).map((p: Ruw) => [String(p?.id ?? ''), p]));
  const kb = r?.kennisbank ?? {};
  const kbs = r?.klantbasis ?? {};
  const sv = r?.service ?? {};
  const gz = r?.gezondheid ?? {};
  return {
    gegenereerd_op: nu.toISOString(),
    activiteit: (Array.isArray(r?.activiteit) ? r.activiteit : []).filter((a: Ruw) => !a.is_test).slice(0, 40).map((a: Ruw) => {
      const p = perioden.get(String(a.id ?? ''));
      return { ...schermActiviteit(a), gestart_op: iso(p?.gestart_op), afgerond_op: iso(p?.afgerond_op), agent: p?.agent === true };
    }),
    stroom: {
      sinds: '2026-10-06',
      sessies: getal(r?.stroom?.sessies),
      gestart: getal(r?.stroom?.gestart), verstuurd: getal(r?.stroom?.verstuurd),
      kvk: getal(r?.stroom?.kvk), actief: getal(r?.stroom?.actief),
      certificaat: getal(r?.stroom?.certificaat), klant: getal(r?.stroom?.klant),
    },
    tijdlijn: (Array.isArray(r?.tijdlijn) ? r.tijdlijn : []).filter((a: Ruw) => !a.is_test && STATIONS.includes(a.station) && getal(a.minuut) !== null && a.minuut >= 0 && a.minuut < 1440).map((a: Ruw) => ({ station: String(a.station), minuut: Math.floor(a.minuut), n: Math.max(0, getal(a.n) ?? 0) })),
    processen: (Array.isArray(r?.processen) ? r.processen : []).filter((a: Ruw) => !a.is_test && STATIONS.includes(a.station)).map((a: Ruw) => ({ station: String(a.station), actie: ['kvk_check','planner_run','exact_sync','wijziging','lead_verzekering_aanvraag','lead_actief','mail'].includes(a.actie) ? a.actie as string : 'overig', status: status(a.status), n: Math.max(0, getal(a.n) ?? 0) })),
    stations,
    gebeurtenissen_vandaag: getal(r?.gebeurtenissen_vandaag) ?? 0,
    doel: {
      doel: 200,
      totaal,
      vandaag: getal(doel.vandaag) ?? 0,
      deze_week: getal(doel.deze_week) ?? 0,
      per_dag: (doel.per_dag ?? []).map((d: Ruw) => ({ dag: String(d.dag), n: getal(d.n) ?? 0 })),
      per_week: (doel.per_week ?? []).map((d: Ruw) => ({ week: String(d.week), n: getal(d.n) ?? 0 })),
      resterende_dagen: rest,
      benodigd_per_dag: rest > 0 ? Math.round((Math.max(200 - totaal, 0) / rest) * 10) / 10 : 0,
      tempo_14d: tempo,
      prognose: Math.round(totaal + tempo * rest),
    },
    klantbasis: {
      actieve_klanten: getal(kbs.actieve_klanten) ?? 0,
      actieve_contracten: getal(kbs.actieve_contracten) ?? 0,
      certificaten_week: getal(kbs.certificaten_week) ?? 0,
      certificaten_maand: getal(kbs.certificaten_maand) ?? 0,
      nieuw_per_maand: (kbs.nieuw_per_maand ?? []).map((d: Ruw) => ({ maand: String(d.maand), n: getal(d.n) ?? 0 })),
    },
    service: {
      open: getal(sv.open) ?? 0,
      afhandeltijd_uur: getal(sv.afhandeltijd_uur),
      bevestiging_5min_pct: getal(sv.bevestiging_5min_pct),
    },
    gezondheid: {
      cron_ok_24u: getal(gz.cron_ok_24u) ?? 0,
      cron_totaal_24u: getal(gz.cron_totaal_24u) ?? 0,
      cron_actief: getal(gz.cron_actief) ?? 0,
      uptime_7d_pct: getal(gz.uptime_7d_pct),
      planner_ok: gz.planner_ok === true ? true : gz.planner_ok === false ? false : null,
      exact_ok: gz.exact_ok === true,
      fouten_24u: getal(gz.fouten_24u) ?? 0,
    },
    kennisbank: {
      gepubliceerd: getal(kb.gepubliceerd) ?? 0,
      nieuw_maand: getal(kb.nieuw_maand) ?? 0,
      laatste: (Array.isArray(kb.laatste) ? kb.laatste : []).slice(0, 3).map((t: unknown) => schoonTekst(t)).filter(Boolean),
      content_nieuw: getal(kb.content_nieuw),
      content_verbeterd: getal(kb.content_verbeterd),
    },
    ai_team: schoonAiTeam(r?.marketing?.ai_team),
    workers: schoonWorkers(r?.workers),
    marketing: schoonMarketing(r?.marketing),
  };
}

export type SchermPayload = ReturnType<typeof bouwSchermPayload>;
