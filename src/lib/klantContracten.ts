// Pure helpers voor klantcontracten (AFAS-import). Geen facturatie: alleen weergave/planning.

export type Product =
  | "bav_avb" | "cyber_clear" | "lidmaatschap_allin" | "lidmaatschap_startup"
  | "lidmaatschap_light" | "nimble_bav" | "onbekend";

export const PRODUCT_LABEL: Record<Product, string> = {
  bav_avb: "BAV-AVB",
  cyber_clear: "Cyber Clear",
  lidmaatschap_allin: "Lidmaatschap All-in (uitlopend)",
  lidmaatschap_startup: "Lidmaatschap Start-up (uitlopend)",
  lidmaatschap_light: "Lidmaatschap Light (uitlopend)",
  nimble_bav: "Nimble BAV",
  onbekend: "Onbekende code",
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  actief: "Actief",
  loopt_af: "Loopt af",
  einddatum_controle: "Einddatum controleren",
  vervangen: "Vervangen",
};

/** Itemcode → product; zelfde regels als de importfunctie in de database. */
export function productVoorItemcode(code: string): Product {
  const c = (code ?? "").trim();
  if (["100M", "100J", "100J495", "100HDI", "100-OUD"].includes(c) || c.startsWith("100-OUDJ") || c.startsWith("100-OUDM")) return "bav_avb";
  if (c === "102M" || c === "102J" || c === "102-OUD") return "cyber_clear";
  if (c === "450") return "lidmaatschap_allin";
  if (c === "400") return "lidmaatschap_startup";
  if (c === "425") return "lidmaatschap_light";
  if (c === "Nimble") return "nimble_bav";
  return "onbekend";
}

export type ContractRegel = {
  id: string;
  onderneming_id: string;
  cyclus: "maand" | "jaar";
  aantal: number;
  bedrag_per_periode: number;
  volgende_factuurdatum: string | null;
  eind_datum: string | null;
  status: string;
  product: Product;
};

export const periodeBedrag = (c: Pick<ContractRegel, "aantal" | "bedrag_per_periode">) =>
  Number(c.bedrag_per_periode) * Number(c.aantal);

/** Maandwaarde: maandbedrag, of jaarbedrag/12. */
export const maandwaarde = (c: Pick<ContractRegel, "aantal" | "bedrag_per_periode" | "cyclus">) =>
  c.cyclus === "jaar" ? periodeBedrag(c) / 12 : periodeBedrag(c);

const parseDatum = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const maandSleutel = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const plusMaanden = (d: Date, n: number) => {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const laatste = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), laatste));
  return r;
};

export type AgendaMaand = { maand: string; maandAantal: number; maandBedrag: number; jaarAantal: number; jaarBedrag: number };

/**
 * Facturatie-agenda: per kalendermaand de factuurperiodes die in die maand STARTEN.
 * Maandcontracten starten elke maand een periode, jaarcontracten één keer per 12 maanden.
 * Vervangen regels tellen niet mee; periodes na de einddatum ook niet.
 */
export function facturatieAgenda(contracten: ContractRegel[], vanaf: Date, aantalMaanden = 12): AgendaMaand[] {
  const start = new Date(Date.UTC(vanaf.getUTCFullYear(), vanaf.getUTCMonth(), 1));
  const eindGrens = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + aantalMaanden, 1));
  const maanden: AgendaMaand[] = [];
  const idx = new Map<string, AgendaMaand>();
  for (let i = 0; i < aantalMaanden; i++) {
    const m: AgendaMaand = { maand: maandSleutel(plusMaanden(start, i)), maandAantal: 0, maandBedrag: 0, jaarAantal: 0, jaarBedrag: 0 };
    maanden.push(m); idx.set(m.maand, m);
  }
  for (const c of contracten) {
    if (c.status === "vervangen" || !c.volgende_factuurdatum) continue;
    const eerste = parseDatum(c.volgende_factuurdatum);
    const eind = c.eind_datum ? parseDatum(c.eind_datum) : null;
    const stap = c.cyclus === "jaar" ? 12 : 1;
    const bedrag = periodeBedrag(c);
    for (let n = 0; n < 1000; n++) {
      const d = plusMaanden(eerste, n * stap);
      if (d >= eindGrens) break;
      if (eind && d > eind) break;
      const m = idx.get(maandSleutel(d));
      if (!m) continue; // vóór de agenda-start
      if (c.cyclus === "jaar") { m.jaarAantal++; m.jaarBedrag += bedrag; }
      else { m.maandAantal++; m.maandBedrag += bedrag; }
    }
  }
  for (const m of maanden) { m.maandBedrag = Math.round(m.maandBedrag * 100) / 100; m.jaarBedrag = Math.round(m.jaarBedrag * 100) / 100; }
  return maanden;
}

export const formatEuro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n ?? 0);

export const maskeerIban = (iban?: string | null) => {
  const s = (iban ?? "").replace(/\s/g, "");
  return s.length > 8 ? `${s.slice(0, 4)} •••• ${s.slice(-4)}` : s;
};
