// A8-aanvulling Bezoekerskaart: GA4-plaatsen (alleen plaats, provincie, aantal) en de definitie van 'Nu op de site'.
// Geen IP-adressen, geen personen, geen tijdstippen per bezoeker.

export type BezoekPlaats = { plaats: string; provincie: string; aantal: number };
export type BezoekersPayload = {
  dag: string;
  totaal: number;
  plaatsen: BezoekPlaats[];
  nu: BezoekPlaats[];
  bijgewerkt_op: string | null;
};

export const ONBEKEND = "onbekend";
export const BUITENLAND = "buitenland";

/** 'Nu op de site' = paginabezoeken (via RPC site_bezoek) in de laatste 5 minuten; daarna vallen ze eruit. */
export const NU_OP_SITE_VENSTER_MS = 5 * 60_000;

export function nuOpSite(tijden: (string | null | undefined)[], nu: number, vensterMs = NU_OP_SITE_VENSTER_MS): number {
  let n = 0;
  for (const t of tijden) {
    const ms = t ? Date.parse(t) : NaN;
    if (Number.isFinite(ms) && ms <= nu && nu - ms < vensterMs) n++;
  }
  return n;
}

// GA4 levert provincies in het Engels.
const PROVINCIE: Record<string, string> = {
  "north holland": "Noord-Holland", "south holland": "Zuid-Holland", "north brabant": "Noord-Brabant",
  "friesland": "Fryslân", "fryslan": "Fryslân", "fryslân": "Fryslân", "groningen": "Groningen", "drenthe": "Drenthe",
  "overijssel": "Overijssel", "flevoland": "Flevoland", "gelderland": "Gelderland", "utrecht": "Utrecht",
  "zeeland": "Zeeland", "limburg": "Limburg",
  "noord-holland": "Noord-Holland", "zuid-holland": "Zuid-Holland", "noord-brabant": "Noord-Brabant",
};

const leeg = (s: string) => !s || s === "(not set)" || s === "(other)";

export function provincieNaam(regio: string | null | undefined): string {
  const r = String(regio ?? "").trim();
  if (leeg(r)) return ONBEKEND;
  return PROVINCIE[r.toLowerCase()] ?? ONBEKEND;
}

const tekst = (s: unknown) => String(s ?? "").replace(/[^\p{L}\p{N}' .()-]/gu, "").trim().slice(0, 60);
const aantal = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };

/** GA4-rij (city, region, country, waarde) -> plaats/provincie/aantal; buitenland samengevat, '(not set)' = onbekend. */
export function normaliseerGaRijen(rijen: { city?: string; region?: string; country?: string; aantal?: unknown }[]): BezoekPlaats[] {
  const som = new Map<string, BezoekPlaats>();
  for (const r of rijen ?? []) {
    const n = aantal(r.aantal);
    if (!n) continue;
    const land = String(r.country ?? "").trim();
    let plaats: string, provincie: string;
    if (land && land !== "Netherlands" && land !== "Nederland") { plaats = BUITENLAND; provincie = BUITENLAND; }
    else {
      const c = String(r.city ?? "").trim();
      plaats = leeg(c) ? ONBEKEND : tekst(c) || ONBEKEND;
      provincie = provincieNaam(r.region);
    }
    const k = `${plaats}|${provincie}`;
    const b = som.get(k);
    if (b) b.aantal += n; else som.set(k, { plaats, provincie, aantal: n });
  }
  return [...som.values()].sort((a, b) => b.aantal - a.aantal || a.plaats.localeCompare(b.plaats));
}

/** Schone schermpayload uit de cachetabel: alleen plaats, provincie en aantal per regel. */
export function bouwBezoekersPayload(rijen: { soort?: unknown; plaats?: unknown; provincie?: unknown; aantal?: unknown; dag?: unknown; bijgewerkt_op?: unknown }[] | null | undefined, vandaag: string): BezoekersPayload | null {
  const eigen = (rijen ?? []).filter((r) => r && r.dag === vandaag);
  if (eigen.length === 0) return null;
  const schoon = (r: { plaats?: unknown; provincie?: unknown; aantal?: unknown }): BezoekPlaats => ({ plaats: tekst(r.plaats) || ONBEKEND, provincie: tekst(r.provincie) || ONBEKEND, aantal: aantal(r.aantal) });
  const plaatsen = eigen.filter((r) => r.soort === "dag").map(schoon).filter((p) => p.aantal > 0).slice(0, 200);
  const nu = eigen.filter((r) => r.soort === "nu").map(schoon).filter((p) => p.aantal > 0).slice(0, 100);
  const totaalRij = eigen.find((r) => r.soort === "totaal");
  const totaal = totaalRij ? aantal(totaalRij.aantal) : plaatsen.reduce((s, p) => s + p.aantal, 0);
  const op = eigen.map((r) => (typeof r.bijgewerkt_op === "string" ? r.bijgewerkt_op : "")).sort().pop() || null;
  return { dag: vandaag, totaal, plaatsen, nu, bijgewerkt_op: op };
}

/** A8-aanvulling Bezoekerskaart per week (6-11): de dag in de cache is het 7-dagentotaal; zonder rijen voor vandaag valt het scherm terug op de meest recente dag met rijen. */
export function nieuwsteBezoekDag(dagen: (string | null | undefined)[], vandaag: string): string {
  let best = "";
  for (const d of dagen) if (typeof d === "string" && d > best) best = d;
  return best || vandaag;
}

/** Top-N voor de lijst: alleen echte Nederlandse plaatsen. */
export function topPlaatsen(p: BezoekPlaats[], n = 5) {
  return p.filter((x) => x.plaats !== ONBEKEND && x.plaats !== BUITENLAND).slice(0, n);
}
