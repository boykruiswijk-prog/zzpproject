/** A23: tegeldefinities en rekenhulpen voor /admin/inzicht/:tegel. Getallen komen uit RPC inzicht_tegel. */
export type Eenheid = "aantal" | "euro" | "procent";
export type TegelDef = { titel: string; eenheid: Eenheid; uitleg: string; alleenSupervisor?: boolean };

export const TEGELS: Record<string, TegelDef> = {
  klanten: { titel: "Klanten", eenheid: "aantal", uitleg: "Ondernemingen met een lopend contract, zonder test." },
  contracten: { titel: "Actieve contractregels", eenheid: "aantal", uitleg: "Status actief, loopt af of einddatumcontrole, zonder test." },
  aanvragen: { titel: "Aanvragen BAV + AVB sinds 6 okt", eenheid: "aantal", uitleg: "6 okt t/m 31 dec, ontdubbeld per KvK, zonder test." },
  conversie: { titel: "Conversie aanvragen sinds 6 okt", eenheid: "procent", uitleg: "Aandeel aanvragen sinds 6 okt dat klant is geworden." },
  service_open: { titel: "Serviceverzoeken open", eenheid: "aantal", uitleg: "Open serviceverzoeken, zonder test." },
  netto_groei: { titel: "Netto groei", eenheid: "aantal", uitleg: "Instroom min beëindigingen, zelfde getal als het live-scherm." },
  leads: { titel: "Leads", eenheid: "aantal", uitleg: "Alle ontvangen leads, zonder test." },
  mrr: { titel: "Maandwaarde (MRR)", eenheid: "euro", uitleg: "Jaarcontracten gedeeld door 12." },
  jaarwaarde: { titel: "Jaarwaarde (MRR × 12)", eenheid: "euro", uitleg: "Maandwaarde maal 12." },
  opzeggingen: { titel: "Opzeggingen te koppelen", eenheid: "aantal", uitleg: "Opzeggingen die nog aan een contract gekoppeld moeten worden." },
  vandaag: { titel: "Vandaag te doen", eenheid: "aantal", uitleg: "Jouw acties voor vandaag." },
  arr: { titel: "ARR", eenheid: "euro", uitleg: "Actieve contracten maal 12, zonder test.", alleenSupervisor: true },
  loopt_af: { titel: "ARR die afloopt", eenheid: "euro", uitleg: "Contracten met status loopt af, maal 12.", alleenSupervisor: true },
  arr_maand: { titel: "Nieuwe en aflopende ARR per maand", eenheid: "euro", uitleg: "Netto sinds 1 oktober 2026: nieuw min aflopend.", alleenSupervisor: true },
};

export const AANVRAAG_DOEL = { doel: 200, van: "2026-10-06", tot: "2026-12-31", dagen: 87 } as const;

const dagMs = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const plusDagen = (d: string, n: number) => new Date(utc(d) + n * dagMs).toISOString().slice(0, 10);

/** Schemalijn: 200 × verstreken dagen / 87, verstreken = dagen sinds 6 okt inclusief vandaag, max 87. */
export function schemaWaarde(dag: string): number {
  const verstreken = Math.min(AANVRAAG_DOEL.dagen, Math.max(0, Math.round((utc(dag) - utc(AANVRAAG_DOEL.van)) / dagMs) + 1));
  return Math.round((AANVRAAG_DOEL.doel * verstreken) / AANVRAAG_DOEL.dagen * 10) / 10;
}

export function verandering(huidig: number, vorige: number | null | undefined) {
  if (vorige == null) return null;
  const absoluut = Math.round((huidig - vorige) * 100) / 100;
  const procent = vorige === 0 ? null : Math.round((absoluut / Math.abs(vorige)) * 1000) / 10;
  return { absoluut, procent };
}

export type Punt = { dag: string; waarde: number };
export type Periode = "30d" | "90d" | "12m" | "sinds6okt";
export const PERIODES: { key: Periode; label: string }[] = [
  { key: "30d", label: "30 dagen" }, { key: "90d", label: "90 dagen" },
  { key: "12m", label: "12 maanden" }, { key: "sinds6okt", label: "Sinds 6 oktober" },
];

export function periodeStart(p: Periode, vandaag: string): string {
  if (p === "30d") return plusDagen(vandaag, -29);
  if (p === "90d") return plusDagen(vandaag, -89);
  if (p === "12m") return plusDagen(vandaag, -364);
  return AANVRAAG_DOEL.van;
}

export type Groep = "dag" | "week" | "maand";
export function groepSleutel(dag: string, g: Groep): string {
  if (g === "dag") return dag;
  if (g === "maand") return `${dag.slice(0, 7)}-01`;
  const d = new Date(`${dag}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // maandag = 0
  return plusDagen(dag, -dow);
}

/** Groepeer per dag/week/maand. "som" voor gebeurtenissen (aanvragen per dag), "laatste" voor standen. */
export function groepeer(punten: Punt[], g: Groep, wijze: "som" | "laatste"): Punt[] {
  const m = new Map<string, number>();
  for (const p of [...punten].sort((a, b) => a.dag.localeCompare(b.dag))) {
    const k = groepSleutel(p.dag, g);
    m.set(k, wijze === "som" ? (m.get(k) ?? 0) + p.waarde : p.waarde);
  }
  return [...m.entries()].map(([dag, waarde]) => ({ dag, waarde }));
}

/** Cumulatieve aanvragen per dag vanaf 6 okt t/m vandaag met schemalijn. */
export function cumulatiefTegenSchema(perDag: Punt[], vandaag: string) {
  const tot = vandaag < AANVRAAG_DOEL.tot ? vandaag : AANVRAAG_DOEL.tot;
  const per = new Map(perDag.map((p) => [p.dag, p.waarde]));
  const uit: { dag: string; cumulatief: number; schema: number }[] = [];
  let som = 0;
  for (let d: string = AANVRAAG_DOEL.van; d <= tot; d = plusDagen(d, 1)) {
    som += per.get(d) ?? 0;
    uit.push({ dag: d, cumulatief: som, schema: schemaWaarde(d) });
  }
  return uit;
}
