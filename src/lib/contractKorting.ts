// Korting per contractregel. Zelfde regels als SQL korting_voor_periode / korting_netto (migratie 0128).
import { supabase } from "@/integrations/supabase/client";

export type MetKorting = { korting_pct?: number | string | null; korting_vanaf?: string | null; korting_tot?: string | null };

/** Percentage voor een periode die op ps (jjjj-mm-dd) begint; null = geen korting. */
export function kortingVoorPeriode(k: MetKorting, ps: string): number | null {
  const pct = k.korting_pct == null ? null : Number(k.korting_pct);
  if (pct == null || !k.korting_vanaf || ps < k.korting_vanaf || (k.korting_tot && ps > k.korting_tot)) return null;
  return pct;
}

/** round(basis * (1 - pct/100), 2), in centen gerekend zodat 55 x 0,7 precies 38,50 is. */
export function nettoStuksprijs(basis: number, pct: number | null): number {
  if (pct == null) return basis;
  return Math.round(basis * (100 - pct)) / 100;
}

/** Starterlogica zoals SQL contract_bedrag_voor_periode. */
export function basisStuksprijs(tarief: string | null | undefined, starterTot: string | null | undefined, bedrag: number, na: number | null | undefined, ps: string): number {
  return tarief === "starter" && starterTot && na != null && ps > starterTot ? Number(na) : Number(bedrag);
}

export const pctTekst = (p: number | string) => `${String(Math.round(Number(p) * 100) / 100).replace(".", ",")}%`;

export type KortingVoorbeeld = { grens: string; periode_start: string | null; periode_eind: string | null; cyclus: string; aantal: number; itemcode: string; product: string; basis: number | null; netto: number | null; concept_periode: string | null; status: string };

export async function kortingVoorbeeld(contractId: string, pct: number | null, vanaf: string | null): Promise<KortingVoorbeeld> {
  const { data, error } = await (supabase.rpc as any)("contract_korting_voorbeeld", { _contract_id: contractId, _pct: pct, _vanaf: vanaf });
  if (error) throw new Error(error.message);
  return data as KortingVoorbeeld;
}

export async function zetKorting(contractId: string, pct: number, reden: string, vanaf: string, tot: string | null) {
  const { data, error } = await (supabase.rpc as any)("zet_contract_korting", { _contract_id: contractId, _pct: pct, _reden: reden.trim(), _vanaf: vanaf, _tot: tot || null });
  if (error) throw new Error(error.message);
  return data as { concept_periode: string | null };
}

export async function stopKorting(contractId: string, toelichting: string) {
  const { data, error } = await (supabase.rpc as any)("verwijder_contract_korting", { _contract_id: contractId, _toelichting: toelichting.trim() });
  if (error) throw new Error(error.message);
  return data as { per: string; concept_periode: string | null };
}

export const conceptWaarschuwing = (d: string) =>
  `Er staat al een concept in Exact voor ${d.split("-").reverse().join("-")} tegen de oude prijs; pas dat concept in Exact handmatig aan of laat het lopen.`;
