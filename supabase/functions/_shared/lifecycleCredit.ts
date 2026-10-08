// Read-only invoiced-period reader. Monthly refunds never use an annual premium.
import { berekenOpzegCredit, type GefactureerdePeriode } from "./creditOpzegging.ts";
import { bronRijVoorLead, SITE_BRON } from "./klantContractActivatie.ts";
import { lastOfMonth } from "./polisProRata.ts";

type LeadVoorCredit = {
  id: string; ingangsdatum: string; exact_invoice_id?: string | null;
  exact_invoice_amount?: number | null;
};

// deno-lint-ignore no-explicit-any
export async function maandLifecycleCredit(db: any, lead: LeadVoorCredit, einddatum: string) {
  const perioden = new Map<string, GefactureerdePeriode>();
  const voegToe = (id: string, start: string, eind: string, bedrag: number) => {
    if (Number.isFinite(Number(bedrag)) && Number(bedrag) > 0) {
      perioden.set(id, { periode_start: start.slice(0, 10), periode_eind: eind.slice(0, 10), bedrag: Number(bedrag) });
    }
  };
  if (lead.exact_invoice_id && lead.exact_invoice_amount != null) {
    voegToe(lead.exact_invoice_id, lead.ingangsdatum, lastOfMonth(lead.ingangsdatum), lead.exact_invoice_amount);
  }
  const { data: oud, error: oudFout } = await db.from("monthly_invoices_log")
    .select("exact_invoice_id,periode_start,periode_eind,bedrag,status").eq("lead_id", lead.id);
  if (oudFout) throw new Error("Gefactureerde maandperioden konden niet worden gelezen");
  for (const p of oud ?? []) {
    if (p.exact_invoice_id && p.periode_start && p.periode_eind && !["failed", "error", "skipped"].includes(p.status)) {
      voegToe(p.exact_invoice_id, p.periode_start, p.periode_eind, p.bedrag);
    }
  }
  const { data: contract, error: contractFout } = await db.from("klant_contracten")
    .select("id").eq("bron", SITE_BRON).eq("bron_rij", bronRijVoorLead(lead.id)).maybeSingle();
  if (contractFout) throw new Error("Factuurcontract kon niet worden gelezen");
  if (contract) {
    const { data: gepland, error: planningFout } = await db.from("factuur_planning")
      .select("exact_invoice_id,periode_start,periode_eind,bedrag,status")
      .eq("klant_contract_id", contract.id).in("status", ["concept_aangemaakt", "verwerkt"]);
    if (planningFout) throw new Error("Gefactureerde perioden konden niet worden gelezen");
    for (const p of gepland ?? []) {
      if (p.exact_invoice_id) voegToe(p.exact_invoice_id, p.periode_start, p.periode_eind, p.bedrag);
    }
  }
  const credit = berekenOpzegCredit(einddatum, [...perioden.values()]);
  const laatste = credit.regels.at(-1);
  return {
    credit_bedrag: credit.bedrag,
    resterende_dagen: credit.regels.reduce((s, p) => s + p.resterende_dagen, 0),
    dagprijs: credit.regels[0]?.dagprijs ?? 0,
    totaal_polis_dagen: credit.regels.reduce((s, p) => s + p.totaal_dagen, 0),
    credit_vanaf: credit.vanaf,
    periode_eind: laatste?.periode_eind ?? lastOfMonth(einddatum),
    perioden: credit.regels,
  };
}