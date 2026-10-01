// Na een geslaagde eerste factuur bij activatie: zet de klant in de factuurplanner.
// Maakt (idempotent) onderneming + klant_contracten-regel met gefactureerd_tm = einde eerste periode.
// Geen Exact-verkeer, geen mails.
// deno-lint-ignore-file no-explicit-any
import { dagErna } from "./factuurPeriode.ts";

export const SITE_BRON = "site_activatie";

/** Stabiel, positief 31-bits rijnummer per lead → (bron, bron_rij) uniek en herhaalbaar. */
export function bronRijVoorLead(leadId: string): number {
  let h = 0;
  for (const ch of leadId.replace(/-/g, "")) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 100_000;
}

export interface ContractSpec {
  cyclus: "maand" | "jaar";
  itemcode: string;
  bedrag_per_periode: number;
  periodeStart: string;
  periodeEind: string;
}

export function contractRegelVoorActivatie(lead: any, ondernemingId: string, spec: ContractSpec) {
  return {
    onderneming_id: ondernemingId,
    bron: SITE_BRON,
    bron_rij: bronRijVoorLead(String(lead.id)),
    type: "verzekering",
    itemcode: spec.itemcode,
    product: "bav_avb",
    cyclus: spec.cyclus,
    aantal: 1,
    bedrag_per_periode: spec.bedrag_per_periode,
    // maandwaarde is een gegenereerde kolom: nooit meesturen.
    begin_datum: spec.periodeStart,
    factureren_vanaf: spec.periodeStart,
    gefactureerd_tm: spec.periodeEind,
    volgende_factuurdatum: dagErna(spec.periodeEind),
    gefactureerd_tm_bron: SITE_BRON,
    status: "actief",
    facturatie_status: "planner",
    afwijkingen: [],
    is_test: !!lead.is_test,
  };
}

export async function zetInPlanner(supabase: any, lead: any, exactAccountId: string, spec: ContractSpec) {
  let { data: ond } = await supabase.from("ondernemingen").select("id")
    .eq("exact_account_id", exactAccountId).limit(1).maybeSingle();
  if (!ond && lead.exact_relatie_code) {
    ({ data: ond } = await supabase.from("ondernemingen").select("id")
      .eq("exact_relatie_code", String(lead.exact_relatie_code)).limit(1).maybeSingle());
  }
  if (!ond) {
    const { data, error } = await supabase.from("ondernemingen").insert({
      naam: lead.bedrijfsnaam ?? `${lead.voornaam ?? ""} ${lead.achternaam ?? ""}`.trim(),
      kvk: lead.kvk_nummer ?? null,
      exact_account_id: exactAccountId,
      exact_relatie_code: lead.exact_relatie_code ?? null,
      exact_koppeling_status: "gekoppeld",
      bron: SITE_BRON,
      is_test: !!lead.is_test,
    }).select("id").single();
    if (error) return { ok: false, fout: `onderneming: ${error.message}` };
    ond = data;
  }
  const rij = contractRegelVoorActivatie(lead, ond.id, spec);
  const { error } = await supabase.from("klant_contracten")
    .upsert(rij, { onConflict: "bron,bron_rij", ignoreDuplicates: true });
  if (error) return { ok: false, fout: `contract: ${error.message}` };
  return { ok: true, onderneming_id: ond.id, bron_rij: rij.bron_rij };
}

const nlDatum = (d: string) => { const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}-${m}-${y}`; };
export const euroNL = (n: number) => `€ ${Number(n).toFixed(2).replace(".", ",")}`;

/** Logtekst met het werkelijke factuurbedrag (niet de jaarpremie). */
export function factuurLogTekst(nummer: string | null | undefined, bedrag: number, periode?: { start: string; eind: string; naarRato?: boolean }): string {
  const p = periode ? ` (${nlDatum(periode.start)} t/m ${nlDatum(periode.eind)}${periode.naarRato ? ", naar rato" : ""})` : "";
  return `Factuur ${nummer ?? "(concept)"} aangemaakt: ${euroNL(bedrag)}${p}`;
}
