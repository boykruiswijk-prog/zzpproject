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
export const ACTIES = ['lead_verzekering_aanvraag','lead_actief','kvk_check','planner_run','exact_sync','wijziging','mail','cron','certificaat','chat','serviceverzoek','bav_aanmelding','artikel','artikel_live',
  'formulier_start','formulier_stap','formulier_af','chat_bericht','artikel_verbeterd','indexnow','contract_status','contract_nieuw','portal_uitnodiging','spamfilter','mail_verzonden','dba_check','screening','collectief','site_bezoek'];
/** Meervoud voor gegroepeerde sitebezoeken: "3 bezoekers lezen een kennisbankartikel". */
export const BEZOEK_MEERVOUD: Record<string, string> = {
  'Bezoeker bekijkt de homepage': 'bezoekers bekijken de homepage',
  'Bezoeker bekijkt de verzekeringen': 'bezoekers bekijken de verzekeringen',
  'Bezoeker opent het aanvraagformulier': 'bezoekers openen het aanvraagformulier',
  'Starter bekijkt het starterspakket': 'starters bekijken het starterspakket',
  'Bezoeker bekijkt een beroepspagina': 'bezoekers bekijken een beroepspagina',
  'Bezoeker leest een kennisbankartikel': 'bezoekers lezen een kennisbankartikel',
  'Bezoeker bekijkt het collectief': 'bezoekers bekijken het collectief',
  'Bezoeker bekijkt de contactpagina': 'bezoekers bekijken de contactpagina',
  'Klant logt in op Mijn ZP': 'klanten loggen in op Mijn ZP',
};
/** Groepeert opeenvolgende identieke sitebezoeken (zelfde tekst, binnen 1 minuut van de vorige). */
export function groepeerBezoeken<T extends { actie: string; tekst: string; tijd: string; aantal?: number }>(lijst: T[]): (T & { aantal: number })[] {
  const uit: (T & { aantal: number; _basis?: string; _laatst?: number })[] = [];
  for (const a of lijst) {
    const vorige = uit[uit.length - 1];
    const t = Date.parse(a.tijd);
    if (a.actie === 'site_bezoek' && vorige && vorige.actie === 'site_bezoek' && vorige._basis === a.tekst && BEZOEK_MEERVOUD[a.tekst]
      && Number.isFinite(t) && Number.isFinite(vorige._laatst!) && Math.abs(vorige._laatst! - t) <= 60_000) {
      vorige.aantal += 1; vorige._laatst = t;
      vorige.tekst = `${vorige.aantal} ${BEZOEK_MEERVOUD[a.tekst]}`;
      continue;
    }
    uit.push({ ...a, aantal: 1, _basis: a.tekst, _laatst: t });
  }
  return uit.map(({ _basis, _laatst, ...r }) => r as T & { aantal: number });
}
export function schermActiviteit(a: Ruw) {
  const station = (STATIONS as readonly string[]).includes(a.station) ? a.station : 'kwaliteit';
  const echteAanvraag = a.actie === 'lead_verzekering_aanvraag';
  const groep = intakeGroep(a.tekst);
  return {
    id: String(a.id ?? ''), station,
    actie: ACTIES.includes(a.actie) ? String(a.actie) : 'overig',
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

/** Vaste lijst AI-agents op het live-scherm; marketing_snapshot (bron ai_team) vult alleen status en resultaat aan. */
export const AI_TEAM = [
  { id: 'ads', naam: 'Ads-bewaking', taak: 'Bewaakt Google en Microsoft Ads 3x per dag', station: 'ads' },
  { id: 'conversies', naam: 'Conversie-terugmelding', taak: 'Meldt elke ochtend nieuwe klanten terug aan Google', station: 'ads' },
  { id: 'kwaliteit', naam: 'Kwaliteitscontrole', taak: 'Test elke ochtend site, platform en teksten', station: 'kwaliteit' },
  { id: 'content', naam: 'Contentmachine', taak: 'Schrijft en verbetert kennisbankartikelen (di en do)', station: 'kennisbank' },
  { id: 'markt', naam: 'Marktmonitor', taak: 'Volgt prijzen, cyber en AI-zichtbaarheid (ma)', station: 'kwaliteit' },
  { id: 'rapportage', naam: 'Weekrapportage', taak: 'Meet de voortgang naar 200 aanvragen (ma)', station: 'kwaliteit' },
  { id: 'beveiliging', naam: 'Beveiliging', taak: 'Controleert beveiliging en toegang (ma)', station: 'kwaliteit' },
  { id: 'scherm', naam: 'Live-scherm', taak: 'Ververst dit scherm elke 2 uur', station: 'kwaliteit' },
  { id: 'dagstatus', naam: 'Dagstatus', taak: 'Maakt elke ochtend het statusoverzicht (dagelijks 08:12)', station: 'kwaliteit', ritme: 'elke ochtend 08:12' },
  { id: 'aanbevelingen', naam: 'Aanbevelingencontrole', taak: 'Beoordeelt de aanbevelingen van Google Ads (ma)', station: 'ads', ritme: 'elke maandag' },
] as const;
export type AiAgentId = typeof AI_TEAM[number]['id'];

/** Koppelt een geplande-taaknaam aan een agent-id; specifieke namen vóór de algemene Ads-regel. */
export function koppelTaak(naam: unknown): AiAgentId | null {
  const n = typeof naam === 'string' ? naam.trim().toLowerCase() : '';
  if (!n) return null;
  if (n.startsWith('dagstatus zp zaken') || n === 'dagstatus') return 'dagstatus';
  if (n.startsWith('aanbevelingencontrole google ads') || n === 'aanbevelingencontrole') return 'aanbevelingen';
  const exact = AI_TEAM.find(a => a.naam.toLowerCase() === n || a.id === n);
  if (exact) return exact.id;
  if (/\bads\b/.test(n)) return 'ads';
  return null;
}

/** Vervangt elk "N van 200" in vrije tekst door het live aantal; aantallen komen nooit uit marketing_snapshot. */
export function liveDoelTekst(tekst: string, totaal: number): string {
  return tekst.replace(/\b\d+\s+van\s+200\b/g, `${totaal} van 200`);
}

/** Tekstvoorvoegsel in machine_activiteit (agent_run/agent_stap) per agent, voor een recentere laatste run. */
export const AGENT_VOORVOEGSEL: Record<AiAgentId, string[]> = {
  ads: ['ads-agent'], conversies: ['conversie-agent'], kwaliteit: ['kwaliteitsagent'], content: ['contentagent'],
  markt: ['marktagent'], rapportage: ['rapportage-agent', 'weekrapportage'], beveiliging: ['beveiligingsagent'],
  scherm: ['scherm-agent', 'live-scherm'], dagstatus: ['dagstatus'], aanbevelingen: ['aanbevelingen'],
};
/** Laatste machine_activiteit-tijd per agent-id uit scherm_versheid().agent_laatst. */
export function agentLaatst(lijst: unknown): Partial<Record<AiAgentId, string>> {
  const uit: Partial<Record<AiAgentId, string>> = {};
  for (const r of Array.isArray(lijst) ? lijst : []) {
    const k = typeof r?.sleutel === 'string' ? r.sleutel.trim().toLowerCase() : '';
    const t = iso(r?.tijd);
    if (!k || !t) continue;
    const id = (Object.keys(AGENT_VOORVOEGSEL) as AiAgentId[]).find(a => AGENT_VOORVOEGSEL[a].some(v => k.startsWith(v)));
    if (id && (!uit[id] || Date.parse(t) > Date.parse(uit[id]!))) uit[id] = t;
  }
  return uit;
}

type AiRij = { naam: string; taak: string; resultaat: string | null; laatste_run: string | null; status: 'klaar' | 'fout' | 'gepland' };
/** AI-team: altijd de vaste lijst (gepland zonder run), aangevuld uit de snapshot; daarna onbekende agents tot max 12. */
export function schoonAiTeam(snap: Snap, doelTotaal?: number, recent: Partial<Record<AiAgentId, string>> = {}): AiRij[] {
  const agents = (snap?.data as Ruw | undefined)?.agents;
  if (!Array.isArray(agents)) return [];
  const rij = (a: Ruw, basis?: { naam: string; taak: string }): AiRij => {
    const ruw = schoonTekst(a.resultaat, 70);
    const resultaat = doelTotaal == null ? ruw : liveDoelTekst(ruw, doelTotaal);
    const laatste_run = typeof a.laatste_run === 'string' && Number.isFinite(Date.parse(a.laatste_run)) ? new Date(a.laatste_run).toISOString() : null;
    return {
      naam: basis ? basis.naam : schoonTekst(a.naam, 70),
      taak: basis ? basis.taak : schoonTekst(a.taak, 70),
      resultaat: resultaat || null,
      laatste_run,
      status: a.status === 'fout' ? 'fout' : !laatste_run || a.status === 'gepland' ? 'gepland' : 'klaar',
    };
  };
  const geldig = agents.filter((a: Ruw) => a && typeof a === 'object');
  const perId = new Map<string, Ruw>();
  const overig: Ruw[] = [];
  for (const a of geldig) {
    const id = (AI_TEAM.some(t => t.id === a.id) ? a.id : koppelTaak(a.naam)) as string | null;
    if (id && !perId.has(id)) perId.set(id, a); else overig.push(a);
  }
  const vast = AI_TEAM.map(t => {
    const r = rij(perId.get(t.id) ?? {}, t);
    const m = recent[t.id];
    if (m && (!r.laatste_run || Date.parse(m) > Date.parse(r.laatste_run))) {
      r.laatste_run = m;
      if (r.status === 'gepland') r.status = 'klaar';
    }
    return r;
  });
  return [...vast, ...overig.map(a => rij(a)).filter(a => a.naam)].slice(0, 12);
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

/** Voegt de geplande AI-taken met eigen ritme (afgeleid uit AI_TEAM) toe aan de geplande workers. */
export function metAgentWorkers(w: { gepland: Worker[]; op_afroep: Worker[] } | null, team: AiRij[]) {
  const extra: Worker[] = AI_TEAM.filter(t => 'ritme' in t).map(t => {
    const a = team.find(x => x.naam === t.naam);
    return { naam: t.naam, ritme: (t as { ritme: string }).ritme, laatste: a?.laatste_run ?? null, status: a?.status ?? 'gepland', vandaag: null, week: null };
  });
  if (!w) return null;
  const namen = new Set(w.gepland.map(x => x.naam));
  return { ...w, gepland: [...w.gepland, ...extra.filter(x => !namen.has(x.naam))] };
}

/** Bouwt de publieke payload uit de geaggregeerde RPC-uitvoer; alleen witte-lijstvelden. */
export function bouwSchermPayload(r: Ruw, nu = new Date()) {
  const status = (s: unknown) => (s === "bezig" || s === "fout" ? s : "klaar");
  const doel = r?.doel ?? {};
  const totaal = getal(doel.totaal) ?? 0;
  const rest = Math.max(getal(doel.resterende_dagen) ?? 0, 0);
  const tempo = getal(doel.tempo_14d) ?? 0;
  const stations: Record<string, { vandaag: number; skills: number; laatste_status: string | null; toestand: Toestand; laatst_actief_op: string | null; lopende_tekst: string | null; duur_vandaag_min: number; agent_bezig_sinds: string | null }> = {};
  for (const s of STATIONS) {
    const x = r?.stations?.[s] ?? {};
    const w = r?.werkstand?.[s];
    const tekst = w?.lopende_tekst ? echteTekst(w.lopende_tekst, s) : null;
    stations[s] = { vandaag: getal(x.vandaag) ?? 0, skills: getal(x.skills) ?? 0, laatste_status: x.laatste_status ? status(x.laatste_status) : null,
      toestand: bepaalToestand(w, nu), laatst_actief_op: iso(w?.laatst_actief_op), lopende_tekst: tekst, duur_vandaag_min: Math.max(0, Math.round(getal(w?.duur_vandaag_min) ?? 0)),
      agent_bezig_sinds: w?.lopend === true ? iso(w?.agent_bezig_sinds) : null };
  }
  const perioden = new Map<string, Ruw>((Array.isArray(r?.perioden) ? r.perioden : []).map((p: Ruw) => [String(p?.id ?? ''), p]));
  const kb = r?.kennisbank ?? {};
  const kbs = r?.klantbasis ?? {};
  const sv = r?.service ?? {};
  const gz = r?.gezondheid ?? {};
  const recent = agentLaatst(r?.versheid?.agent_laatst);
  const team = schoonAiTeam(r?.marketing?.ai_team, totaal, recent);
  const snapOp = r?.versheid?.snapshot_op ?? {};
  return {
    gegenereerd_op: nu.toISOString(),
    /** Gezet door scherm-data als de cache wordt teruggegeven na een fout. */
    verouderd_sinds: null as string | null,
    /** Tijd van de laatste Scherm-feed (elke 2 uur) per momentopnameblok; null = nog niet gemeten. */
    bijgewerkt: {
      google_ads: iso(snapOp.google_ads), microsoft_ads: iso(snapOp.microsoft_ads),
      search_console: iso(snapOp.search_console), ai_zichtbaarheid: iso(snapOp.ai_zichtbaarheid), ai_team: iso(snapOp.ai_team),
    },
    activiteit: groepeerBezoeken((Array.isArray(r?.activiteit) ? r.activiteit : []).filter((a: Ruw) => !a.is_test).slice(0, 120).map((a: Ruw) => {
      const p = perioden.get(String(a.id ?? ''));
      return { ...schermActiviteit(a), gestart_op: iso(p?.gestart_op), afgerond_op: iso(p?.afgerond_op), agent: p?.agent === true };
    })).slice(0, 40),
    nu_op_site: getal(r?.nu_op_site),
    stroom: {
      sinds: '2026-10-06',
      sessies: getal(r?.stroom?.sessies),
      gestart: getal(r?.stroom?.gestart), verstuurd: getal(r?.stroom?.verstuurd),
      kvk: getal(r?.stroom?.kvk), actief: getal(r?.stroom?.actief),
      certificaat: getal(r?.stroom?.certificaat), klant: getal(r?.stroom?.klant),
    },
    tijdlijn: (Array.isArray(r?.tijdlijn) ? r.tijdlijn : []).filter((a: Ruw) => !a.is_test && STATIONS.includes(a.station) && getal(a.minuut) !== null && a.minuut >= 0 && a.minuut < 1440).map((a: Ruw) => ({ station: String(a.station), minuut: Math.floor(a.minuut), n: Math.max(0, getal(a.n) ?? 0) })),
    processen: (Array.isArray(r?.processen) ? r.processen : []).filter((a: Ruw) => !a.is_test && a.actie !== 'cron' && STATIONS.includes(a.station)).map((a: Ruw) => ({ station: String(a.station), actie: ['kvk_check','planner_run','exact_sync','wijziging','lead_verzekering_aanvraag','lead_actief','mail'].includes(a.actie) ? a.actie as string : 'overig', status: status(a.status), n: Math.max(0, getal(a.n) ?? 0) })),
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
    ai_team: team,
    workers: metAgentWorkers(schoonWorkers(r?.workers), team),
    marketing: schoonMarketing(r?.marketing),
  };
}

/** Oude cache na een fout: zichtbaar verouderd, zodat het scherm oranje toont. */
export function markeerVerouderd(body: string, sinds: number) {
  try { return JSON.stringify({ ...JSON.parse(body), verouderd_sinds: new Date(sinds).toISOString() }); } catch { return body; }
}

export type SchermPayload = ReturnType<typeof bouwSchermPayload>;
