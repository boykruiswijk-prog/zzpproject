// Pure opbouw van een planner-factuur (Type 8020). Lidmaatschappen lopen via artikel BAV-AVB
// maar krijgen eigen grootboek (uit de mapping) en een omschrijving zonder "BAV-AVB"/"premie".
// deno-lint-ignore-file no-explicit-any
import { periodeTekst, regelOmschrijving } from "./factuurTekst.ts";

const MAX = 60;
const LID: Record<string, string> = { "400": "Startup", "425": "Light", "450": "All-in" };
const LID_PRODUCT: Record<string, string> = { lidmaatschap_startup: "Startup", lidmaatschap_light: "Light", lidmaatschap_allin: "All-in" };

export function lidmaatschapNaam(itemcode?: string | null, product?: string | null): string | null {
  return LID[String(itemcode ?? "").trim()] ?? LID_PRODUCT[String(product ?? "").trim()] ?? null;
}

/** " (30% korting)"; komma als decimaalteken. Leeg zonder korting. */
export function kortingTekst(pct?: number | string | null): string {
  const p = Number(pct ?? 0);
  if (!(p > 0 && p < 100)) return "";
  return ` (${String(Math.round(p * 100) / 100).replace(".", ",")}% korting)`;
}

/** Regeltekst met kortingsvermelding achteraan; inkorten gaat ten koste van de periodetekst, nooit van de korting. */
export function factuurRegelTekst(k: { itemcode?: string | null; product?: string | null; periode_start: string; periode_eind: string; korting_pct?: number | string | null }): string {
  const kt = kortingTekst(k.korting_pct);
  const basis = factuurRegelBasis(k);
  return kt ? `${basis.slice(0, MAX - kt.length).trimEnd()}${kt}` : basis;
}

function factuurRegelBasis(k: { itemcode?: string | null; product?: string | null; periode_start: string; periode_eind: string }): string {
  if (k.product === "cyber_clear") return `${periodeTekst(k.periode_start, k.periode_eind)} Cyberpremie`.slice(0, MAX);
  const lid = lidmaatschapNaam(k.itemcode, k.product);
  return lid
    ? `Lidmaatschap ZP Zaken ${lid} ${periodeTekst(k.periode_start, k.periode_eind)}`.slice(0, MAX)
    : regelOmschrijving("premie", k.periode_start, k.periode_eind);
}

export function factuurKopTekst(k: { itemcode?: string | null; product?: string | null; periode_start: string; periode_eind: string }): string {
  const lid = lidmaatschapNaam(k.itemcode, k.product);
  return (lid ? `Lidmaatschap ZP Zaken ${lid} ${periodeTekst(k.periode_start, k.periode_eind)}` : `Premie ${periodeTekst(k.periode_start, k.periode_eind)}`).slice(0, MAX);
}

/** Grootboek-ID uit de cache; null als nog onbekend. */
export function glUitCache(cfg: any, code: string): string | null {
  const c = String(code ?? "").trim();
  if (!c) return null;
  const bav = String(cfg?.gl_code_bav ?? "8003").trim();
  if (c === bav && cfg?.gl_account_id_bav && String(cfg?.gl_account_id_bav_code ?? "").trim() === c) return String(cfg.gl_account_id_bav);
  const id = cfg?.gl_account_ids?.[c];
  return id ? String(id) : null;
}

/** Exact-BTW-code; spaties (Exact levert "2  ") weg, leeg → "0" (Geen BTW). */
export function btwCode(c?: string | null): string {
  const v = String(c ?? "").trim();
  return v || "0";
}

export class BtwNietPassendError extends Error {
  constructor() { super("BTW-code past niet bij grootboek"); this.name = "BtwNietPassendError"; }
}

/** Guard: lidmaatschap (8004) nooit zonder BTW, verzekering (8003) altijd Geen BTW. */
export function btwPastBijGrootboek(glCode?: string | null, btw?: string | null): boolean {
  const gl = String(glCode ?? "").trim(); const b = btwCode(btw);
  if (gl === "8004" && b === "0") return false;
  if (gl === "8003" && b !== "0") return false;
  return true;
}

export function controleerBtw(glCode?: string | null, btw?: string | null): void {
  if (!btwPastBijGrootboek(glCode, btw)) throw new BtwNietPassendError();
}

export function bouwFactuurPayload(k: any, glId: string | null, sleutel: string, sleutelVeld: "YourRef" | "Remarks") {
  controleerBtw(k.gl_code, k.btw_code);
  const regel: any = { Item: k.exact_item_id, Quantity: Number(k.aantal), UnitPrice: Number(k.bedrag_per_periode), VATCode: btwCode(k.btw_code),
    Description: factuurRegelTekst(k), StartTime: `${k.periode_start}T00:00:00`, EndTime: `${k.periode_eind}T00:00:00` };
  if (glId) regel.GLAccount = glId;
  const payload: any = { InvoiceTo: k.exact_account_id, OrderedBy: k.exact_account_id, Journal: "70", PaymentCondition: "IN",
    Type: 8020, Status: 20, InvoiceDate: `${k.periode_start}T00:00:00`, OrderDate: `${k.periode_start}T00:00:00`,
    Description: factuurKopTekst(k), SalesInvoiceLines: [regel] };
  if (sleutelVeld === "YourRef") payload.YourRef = sleutel; else payload.Remarks = sleutel;
  return payload;
}
