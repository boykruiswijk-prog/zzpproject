// Creditnota bij opzegging via het CRM. Pure functie, geen Exact- of DB-calls.
// Hergebruikt exact de naar-rato-regel van polis-lifecycle (calculatePauzeCredit):
// dagprijs = periodebedrag / dagen in de gefactureerde periode, × resterende dagen (inclusief).
import { calculatePauzeCredit } from "./polisProRata.ts";

export type GefactureerdePeriode = { periode_start: string; periode_eind: string; bedrag: number };

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
  return `Creditnota opzegging per ${nl(einddatum)} – periode ${nl(vanaf)} t/m ${nl(tm)} (oorspronkelijk gefactureerd vóór 17-10-2026)`;
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
      Item: c.exact_item_id, Quantity: 1, UnitPrice: Math.round(r.credit_bedrag * 100) / 100, VATCode: String(c.btw_code ?? "").trim() || "0",
      Description: `Credit ${nl(r.credit_vanaf)} t/m ${nl(r.periode_eind)} opzegging`.slice(0, 60),
      StartTime: `${r.credit_vanaf}T00:00:00`, EndTime: `${r.periode_eind}T00:00:00`,
    };
    if (c.gl_account_id) l.GLAccount = c.gl_account_id;
    return l;
  });
  return {
    InvoiceTo: c.exact_account_id, OrderedBy: c.exact_account_id, Journal: "70", PaymentCondition: "IN",
    Type: 8021, Status: 20, InvoiceDate: nu, OrderDate: nu,
    YourRef: c.creditsleutel,
    Remarks: `${c.creditsleutel} – ${oudSysteemOmschrijving(c.einddatum, c.credit_vanaf, c.credit_tm)}`,
    Description: `Creditnota opzegging per ${nl(c.einddatum)}`.slice(0, 60),
    SalesInvoiceLines: lijnen,
  };
}
