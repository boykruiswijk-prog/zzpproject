// Creditnota bij opzegging via het CRM. Pure functie, geen Exact- of DB-calls.
// Hergebruikt exact de naar-rato-regel van polis-lifecycle (calculatePauzeCredit):
// dagprijs = periodebedrag / dagen in de gefactureerde periode, × resterende dagen (inclusief).
import { calculatePauzeCredit } from "./polisProRata.ts";
import { exactRegelBedrag, regelOmschrijving } from "./factuurTekst.ts";
import { creditBetaalconditie } from "./creditBetaalconditie.ts";

export type GefactureerdePeriode = { periode_start: string; periode_eind: string; bedrag: number };

export type CreditVoorPlanner = { bron?: string | null; bedrag: number | string | null; berekening?: unknown; bedrag_handmatig?: boolean };
export function heeftVastCreditBedrag(c: CreditVoorPlanner): boolean {
  return c.bron === "correctie" || c.bedrag_handmatig === true;
}

/** Besluit Boy 7-11: een vastgelegd bedrag en zijn onderbouwing blijven ongewijzigd. */
export function berekenCreditVoorPlanner(c: CreditVoorPlanner, herbereken: () => { bedrag: number }): { bedrag: number; berekening: unknown } {
  if (heeftVastCreditBedrag(c)) {
    const bedrag = Number(c.bedrag);
    if (c.bedrag === null || !Number.isFinite(bedrag) || bedrag < 0) throw new Error("vastgelegd creditbedrag ontbreekt of is ongeldig");
    return { bedrag, berekening: c.berekening };
  }
  const berekening = herbereken();
  return { bedrag: berekening.bedrag, berekening };
}

function dagErna(iso: string): string {
  return new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

export function berekenOpzegCredit(einddatum: string, perioden: GefactureerdePeriode[]) {
  const vanaf = dagErna(einddatum);
  const regels = perioden
    .filter((p) => p.periode_eind > einddatum)
    .map((p) => {
      const start = p.periode_start > vanaf ? p.periode_start : vanaf;
      const c = calculatePauzeCredit({
        ingangsdatum: p.periode_start, polis_einddatum: p.periode_eind,
        jaarprijs: Number(p.bedrag), pauze_datum: start,
      });
      return { ...p, credit_vanaf: start, credit_bedrag: c.credit_bedrag, resterende_dagen: c.resterende_dagen, dagprijs: c.dagprijs, totaal_dagen: c.totaal_polis_dagen };
    });
  const bedrag = Math.round(regels.reduce((s, r) => s + r.credit_bedrag, 0) * 100) / 100;
  return { vanaf, bedrag, regels, regel: "per dag (calculatePauzeCredit uit polisProRata)" };
}

// ── Oud systeem: perioden reconstrueren uit contractgegevens ──────────────
// Periodes per cyclus, verankerd op factureren_vanaf ?? begin_datum (zelfde als factuur_periode_start/eind in de DB).
function plusMaanden(iso: string, n: number): string {
  const [j, m, d] = iso.slice(0, 10).split("-").map(Number);
  const doel = new Date(Date.UTC(j, m - 1 + n, 1));
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
  doel.setUTCDate(Math.min(d, laatste));
  return doel.toISOString().slice(0, 10);
}
function dagErvoor(iso: string): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}

export type ContractVoorCredit = {
  cyclus: string; aantal: number; bedrag_per_periode: number;
  begin_datum: string | null; factureren_vanaf: string | null; gefactureerd_tm: string;
};

export function oudSysteemPerioden(k: ContractVoorCredit, einddatum: string): GefactureerdePeriode[] {
  const anker = (k.factureren_vanaf ?? k.begin_datum)?.slice(0, 10);
  if (!anker) return [];
  const stap = k.cyclus === "jaar" ? 12 : 1;
  const bedrag = Math.round(Number(k.bedrag_per_periode) * Number(k.aantal ?? 1) * 100) / 100;
  const uit: GefactureerdePeriode[] = [];
  for (let n = 0; n < 1000; n++) {
    const start = plusMaanden(anker, n * stap);
    if (start > k.gefactureerd_tm) break;
    const eind = dagErvoor(plusMaanden(anker, (n + 1) * stap));
    if (eind > einddatum) uit.push({ periode_start: start, periode_eind: eind, bedrag });
  }
  return uit;
}

export function berekenOudSysteemCredit(k: ContractVoorCredit, einddatum: string) {
  return { ...berekenOpzegCredit(einddatum, oudSysteemPerioden(k, einddatum)), bron: "oud_systeem" as const };
}

const nl = (iso: string) => { const [j, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${j}`; };

export function oudSysteemOmschrijving(einddatum: string, vanaf: string, tm: string): string {
  return `Creditnota opzegging per ${nl(einddatum)} – periode ${nl(vanaf)} t/m ${nl(tm)} (oorspronkelijk gefactureerd vóór 13-10-2026)`;
}

/** Exact-payload voor een creditnota (Type 8021, concept Status 20). Kopteksten max 60 tekens; volledige omschrijving in Remarks naast de sleutel. */
export function oudSysteemCreditPayload(c: {
  creditsleutel: string; exact_account_id: string; exact_item_id: string; gl_account_id?: string | null;
  /** BTW-code van de oorspronkelijke factuur (uit de artikelmapping van het itemcode). */
  btw_code?: string | null;
  einddatum: string; credit_vanaf: string; credit_tm: string; vandaag: string;
  regels: { credit_vanaf: string; periode_eind: string; credit_bedrag: number }[];
}) {
  const nu = `${c.vandaag}T00:00:00`;
  const lijnen = c.regels.filter((r) => r.credit_bedrag > 0).map((r) => {
    const l: Record<string, unknown> = {
      Item: c.exact_item_id, ...exactRegelBedrag(8021, r.credit_bedrag), VATCode: String(c.btw_code ?? "").trim() || "0",
      Description: `Credit ${nl(r.credit_vanaf)} t/m ${nl(r.periode_eind)} opzegging`.slice(0, 60),
      StartTime: `${r.credit_vanaf}T00:00:00`, EndTime: `${r.periode_eind}T00:00:00`,
    };
    if (c.gl_account_id) l.GLAccount = c.gl_account_id;
    return l;
  });
  return {
    InvoiceTo: c.exact_account_id, OrderedBy: c.exact_account_id, Journal: "70", PaymentCondition: creditBetaalconditie(),
    Type: 8021, Status: 20, InvoiceDate: nu, OrderDate: nu,
    YourRef: c.creditsleutel,
    Remarks: `${c.creditsleutel} – ${oudSysteemOmschrijving(c.einddatum, c.credit_vanaf, c.credit_tm)}`,
    Description: `Creditnota opzegging per ${nl(c.einddatum)}`.slice(0, 60),
    SalesInvoiceLines: lijnen,
  };
}

/** Exact-payload voor een plannercreditnota (opzegging of correctie) bij een bestaande factuur. Concept (Status 20), nooit incasso. */
export function plannerCreditPayload(c: {
  exact_account_id: string; item: string; btw: string; gl?: string | null; bedrag: number; credit_vanaf: string; credit_tm: string;
  origineel_factuurnummer: string; creditsleutel: string; vandaag: string; bron?: string | null;
}) {
  const omschrijving = c.bron === "correctie"
    ? `${regelOmschrijving("premie", c.credit_vanaf, c.credit_tm).replace(" BAV-AVB premie", "")} correctie betaalwijze`.slice(0, 60)
    : regelOmschrijving("restitutie_opzegging", c.credit_vanaf, c.credit_tm);
  const regel: Record<string, unknown> = { Item: c.item, ...exactRegelBedrag(8021, Number(c.bedrag)), VATCode: c.btw, Description: omschrijving,
    StartTime: `${c.credit_vanaf}T00:00:00`, EndTime: `${c.credit_tm}T00:00:00` };
  if (c.gl) regel.GLAccount = c.gl;
  const nu = `${c.vandaag}T00:00:00`;
  return { InvoiceTo: c.exact_account_id, OrderedBy: c.exact_account_id, Journal: "70", PaymentCondition: creditBetaalconditie(),
    Type: 8021, Status: 20, InvoiceDate: nu, OrderDate: nu, YourRef: c.origineel_factuurnummer, Remarks: c.creditsleutel,
    Description: `Creditnota bij factuur ${c.origineel_factuurnummer}`.slice(0, 60), SalesInvoiceLines: [regel] };
}

/** Besluit Boy 12-11-2026 11:45: credits waarvan de oorspronkelijke factuur in AFAS staat (oud systeem, of correctie zonder origineel factuurnummer) worden een losse creditnota op de bestaande Exact-relatie. */
export type CreditRoute = { route: "oud" | "los" | "factuur" } | { route: "ontbreekt"; ontbreekt: string[] };
export function kiesCreditRoute(c: { bron?: string | null; exact_account_id?: string | null; _item?: string | null; origineel_factuurnummer?: string | null; bedrag_handmatig?: boolean; bedrag?: unknown }): CreditRoute {
  const afas = !c.origineel_factuurnummer && (c.bron === "oud_systeem" || c.bron === "correctie");
  const ontbreekt: string[] = [];
  if (!c.exact_account_id) ontbreekt.push("Exact-relatie");
  if (!c._item) ontbreekt.push("artikel");
  if (!afas && !c.origineel_factuurnummer) ontbreekt.push("oorspronkelijk factuurnummer");
  if (ontbreekt.length) return { route: "ontbreekt", ontbreekt };
  if (c.bron === "oud_systeem" && !heeftVastCreditBedrag(c as CreditVoorPlanner)) return { route: "oud" };
  return { route: afas ? "los" : "factuur" };
}

/** Losse creditnota (concept, Type 8021) zonder oorspronkelijke Exact-factuur: één regel, periode in de omschrijving, creditsleutel als referentie. */
export function losseCreditPayload(c: {
  exact_account_id: string; item: string; btw: string; gl?: string | null; bedrag: number; credit_vanaf: string; credit_tm: string;
  creditsleutel: string; vandaag: string;
}) {
  const periode = `${nl(c.credit_vanaf)} t/m ${nl(c.credit_tm)}`;
  const regel: Record<string, unknown> = { Item: c.item, ...exactRegelBedrag(8021, Number(c.bedrag)), VATCode: c.btw,
    Description: `Credit ${periode}`.slice(0, 60), StartTime: `${c.credit_vanaf}T00:00:00`, EndTime: `${c.credit_tm}T00:00:00` };
  if (c.gl) regel.GLAccount = c.gl;
  const nu = `${c.vandaag}T00:00:00`;
  return { InvoiceTo: c.exact_account_id, OrderedBy: c.exact_account_id, Journal: "70", PaymentCondition: creditBetaalconditie(),
    Type: 8021, Status: 20, InvoiceDate: nu, OrderDate: nu, YourRef: c.creditsleutel,
    Remarks: `${c.creditsleutel} periode ${periode} (oorspronkelijk gefactureerd in AFAS)`,
    Description: `Creditnota periode ${periode}`.slice(0, 60), SalesInvoiceLines: [regel] };
}

export function ontbrekendCreditMelding(c: { creditsleutel: string; credit_vanaf?: string | null; credit_tm?: string | null }, ontbreekt: string[]) {
  const periode = c.credit_vanaf && c.credit_tm ? ` voor de periode ${nl(c.credit_vanaf)} t/m ${nl(c.credit_tm)}` : "";
  return {
    titel: `Creditnota ${c.creditsleutel} kan niet automatisch`,
    omschrijving: `De factuurplanner kan creditnota ${c.creditsleutel}${periode} niet in Exact maken, omdat ${ontbreekt.join(" en ")} ontbreekt. De credit staat in de admin op geblokkeerd en is niet afgehandeld.`,
    onderdeel: "admin",
    wat_moet_ellen_doen: `Vul ${ontbreekt.join(" en ")} aan bij dit contract, of laat de creditnota handmatig maken in Exact.`,
  };
}
