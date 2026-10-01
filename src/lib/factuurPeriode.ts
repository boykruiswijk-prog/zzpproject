// Factuurplanner: pure periode- en sleutelregels. Byte-gelijk gespiegeld in src/lib/factuurPeriode.ts.
// Database-tegenhanger: public.factuur_periode_start / factuur_periode_eind.
export type Cyclus = "maand" | "jaar";

function parse(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}
function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function dagenInMaand(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Anker + n maanden/jaren, zoals Postgres: dag wordt afgekapt op het maandeinde (31-01 + 1 mnd = 28/29-02). */
export function periodeStart(anker: string, cyclus: Cyclus, n: number): string {
  const [y, m, d] = parse(anker);
  const totaal = (y * 12 + (m - 1)) + (cyclus === "jaar" ? 12 * n : n);
  const ny = Math.floor(totaal / 12);
  const nm = (totaal % 12) + 1;
  return fmt(ny, nm, Math.min(d, dagenInMaand(ny, nm)));
}

export function dagErvoor(iso: string): string {
  const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function dagErna(iso: string): string {
  const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Einde = start + 1 maand of 1 jaar − 1 dag. */
export function periodeEind(start: string, cyclus: Cyclus): string {
  return dagErvoor(periodeStart(start, cyclus, 1));
}

export function periodeBedrag(bedragPerPeriode: number, aantal: number): number {
  return Math.round(bedragPerPeriode * aantal * 100) / 100;
}

/** Planningssleutel: alleen "ZPF-" + 8 hoofdletter-hex, zonder andere tekst. */
export function planningsSleutel(hex8: string): string {
  const h = hex8.replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase();
  if (h.length !== 8) throw new Error("sleutel vereist 8 hex-tekens");
  return `ZPF-${h}`;
}
export const SLEUTEL_PATROON = /^ZPF-[0-9A-F]{8}$/;

/** Werkdagen (ma–vr) tussen twee momenten, exclusief de startdag. */
export function werkdagenTussen(vanIso: string, totIso: string): number {
  let d = new Date(`${vanIso.slice(0, 10)}T00:00:00Z`);
  const eind = new Date(`${totIso.slice(0, 10)}T00:00:00Z`);
  let n = 0;
  while (d < eind) {
    d = new Date(d.getTime() + 86400000);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

/** Exact-status → planningstatus. 20 = concept, 50 = verwerkt; ontbrekend = verwijderd. */
export function planningStatusUitExact(
  exactStatus: number | null | undefined,
  gevonden: boolean,
  conceptOp: string,
  vandaag: string,
  termijnWerkdagen = 5,
): "concept_aangemaakt" | "verwerkt" | "verwijderd_in_exact" | "te_laat" {
  if (!gevonden) return "verwijderd_in_exact";
  if (Number(exactStatus) === 50) return "verwerkt";
  return werkdagenTussen(conceptOp, vandaag) > termijnWerkdagen ? "te_laat" : "concept_aangemaakt";
}
