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
    return {
      dag: s.dag ?? null,
      vertoningen: eerste(d, "vertoningen", "impressions"),
      klikken: eerste(d, "klikken", "clicks"),
      conversies: eerste(d, "conversies", "conversions"),
      // Only an explicitly defined month-to-date spend can use the monthly budget.
      budget_pct: d.periode === 'maand_tot_datum' && d.budget_scope === 'totaal_advertenties' && kosten !== null
        ? Math.round((kosten / ADS_BUDGET) * 1000) / 10 : null,
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
export function schermActiviteit(a: Ruw) {
  const station = (STATIONS as readonly string[]).includes(a.station) ? a.station : 'kwaliteit';
  const echteAanvraag = a.actie === 'lead_verzekering_aanvraag';
  const groep = intakeGroep(a.tekst);
  return {
    id: String(a.id ?? ''), station,
    tekst: echteAanvraag ? `Nieuwe aanvraag binnen, ${groep.beroepsgroep} uit ${groep.provincie}` : VEILIGE_TEKST[station],
    status: a.status === 'bezig' || a.status === 'fout' ? a.status as 'bezig' | 'fout' : 'klaar' as const,
    tijd: Number.isFinite(Date.parse(a.tijd)) ? new Date(a.tijd).toISOString() : '',
    echte_aanvraag: echteAanvraag,
    beroepsgroep: echteAanvraag ? groep.beroepsgroep : null,
    provincie: echteAanvraag ? groep.provincie : null,
  };
}

/** Bouwt de publieke payload uit de geaggregeerde RPC-uitvoer; alleen witte-lijstvelden. */
export function bouwSchermPayload(r: Ruw, nu = new Date()) {
  const status = (s: unknown) => (s === "bezig" || s === "fout" ? s : "klaar");
  const doel = r?.doel ?? {};
  const totaal = getal(doel.totaal) ?? 0;
  const rest = Math.max(getal(doel.resterende_dagen) ?? 0, 0);
  const tempo = getal(doel.tempo_14d) ?? 0;
  const stations: Record<string, { vandaag: number; laatste_status: string | null }> = {};
  for (const s of STATIONS) {
    const x = r?.stations?.[s] ?? {};
    stations[s] = { vandaag: getal(x.vandaag) ?? 0, laatste_status: x.laatste_status ? status(x.laatste_status) : null };
  }
  const kb = r?.kennisbank ?? {};
  const kbs = r?.klantbasis ?? {};
  const sv = r?.service ?? {};
  const gz = r?.gezondheid ?? {};
  return {
    gegenereerd_op: nu.toISOString(),
    activiteit: (Array.isArray(r?.activiteit) ? r.activiteit : []).filter((a: Ruw) => !a.is_test).slice(0, 40).map(schermActiviteit),
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
      laatste: [], // Titels kunnen persoonsnamen bevatten; alleen aantallen zijn publiek.
    },
    marketing: schoonMarketing(r?.marketing),
  };
}

export type SchermPayload = ReturnType<typeof bouwSchermPayload>;
