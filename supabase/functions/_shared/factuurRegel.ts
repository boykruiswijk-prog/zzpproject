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

export function factuurRegelTekst(k: { itemcode?: string | null; product?: string | null; periode_start: string; periode_eind: string }): string {
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

export function bouwFactuurPayload(k: any, glId: string | null, sleutel: string, sleutelVeld: "YourRef" | "Remarks") {
  const regel: any = { Item: k.exact_item_id, Quantity: Number(k.aantal), UnitPrice: Number(k.bedrag_per_periode), VATCode: "0",
    Description: factuurRegelTekst(k), StartTime: `${k.periode_start}T00:00:00`, EndTime: `${k.periode_eind}T00:00:00` };
  if (glId) regel.GLAccount = glId;
  const payload: any = { InvoiceTo: k.exact_account_id, OrderedBy: k.exact_account_id, Journal: "70", PaymentCondition: "IN",
    Type: 8020, Status: 20, InvoiceDate: `${k.periode_start}T00:00:00`, OrderDate: `${k.periode_start}T00:00:00`,
    Description: factuurKopTekst(k), SalesInvoiceLines: [regel] };
  if (sleutelVeld === "YourRef") payload.YourRef = sleutel; else payload.Remarks = sleutel;
  return payload;
}
