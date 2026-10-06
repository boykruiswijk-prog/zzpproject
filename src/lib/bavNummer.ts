import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Rij uit de view crm_bav_nummers. */
export type BavRij = {
  bron: "zp" | "afas" | "klant" | "hiscox";
  nummer: string;
  onderneming_id: string | null;
  lead_id: string | null;
  policy_id: string | null;
  contract_id: string | null;
  status: string | null;
  datum: string | null;
};

export const BAV_BRON_LABEL: Record<string, string> = {
  zp: "ZP Zaken",
  afas: "AFAS-import",
  klant: "opgegeven door klant",
};

export type BavKeuze = { nummer: string; bron: string; hiscox: string | null } | null;

const nieuwsteEerst = (a: BavRij, b: BavRij) => ((a.datum ?? "") < (b.datum ?? "") ? 1 : -1);

/**
 * Volgorde: a) certificaat van de site (geldig eerst), b) AFAS-import (voor dit contract), c) opgave klant.
 * Een HPI.-nummer van de klant wordt apart als Hiscox-polis getoond.
 */
export function kiesBavNummer(rijen: BavRij[], opties: { contractId?: string | null; policyId?: string | null } = {}): BavKeuze {
  const hiscox = rijen.filter((r) => r.bron === "hiscox").sort(nieuwsteEerst)[0]?.nummer ?? null;
  const zp = rijen.filter((r) => r.bron === "zp").sort((a, b) => {
    if (opties.policyId) { if (a.policy_id === opties.policyId) return -1; if (b.policy_id === opties.policyId) return 1; }
    const ga = a.status === "geldig" || a.status === "bevestigd" ? 0 : 1, gb = b.status === "geldig" || b.status === "bevestigd" ? 0 : 1;
    return ga - gb || nieuwsteEerst(a, b);
  })[0];
  if (zp) return { nummer: zp.nummer, bron: BAV_BRON_LABEL.zp, hiscox };
  const afas = rijen.filter((r) => r.bron === "afas" && (!opties.contractId || r.contract_id === opties.contractId)).sort(nieuwsteEerst)[0]
    ?? rijen.filter((r) => r.bron === "afas").sort(nieuwsteEerst)[0];
  if (afas) return { nummer: afas.nummer, bron: BAV_BRON_LABEL.afas, hiscox };
  const klant = rijen.filter((r) => r.bron === "klant").sort(nieuwsteEerst)[0];
  if (klant) return { nummer: klant.nummer, bron: BAV_BRON_LABEL.klant, hiscox };
  return hiscox ? { nummer: "", bron: "", hiscox } : null;
}

/** Haalt alle BAV-rijen op voor ondernemingen en/of leads. */
export async function haalBavRijen(ondIds: string[], leadIds: string[] = []): Promise<BavRij[]> {
  const f: string[] = [];
  if (ondIds.length) f.push(`onderneming_id.in.(${ondIds.join(",")})`);
  if (leadIds.length) f.push(`lead_id.in.(${leadIds.join(",")})`);
  if (!f.length) return [];
  const uit: BavRij[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await (supabase.from as any)("crm_bav_nummers").select("*").or(f.join(",")).range(a, a + 999);
    if (error) throw error;
    uit.push(...((data ?? []) as BavRij[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

export function useBavRijen(ondIds: string[], leadIds: string[] = []) {
  return useQuery({
    queryKey: ["bav-nummers", ondIds.join(","), leadIds.join(",")],
    queryFn: () => haalBavRijen(ondIds, leadIds),
    enabled: ondIds.length + leadIds.length > 0,
    staleTime: 60_000,
  });
}

/** Alle rijen (voor lijsten en zoeken), gepagineerd. */
export async function haalAlleBavRijen(): Promise<BavRij[]> {
  const uit: BavRij[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await (supabase.from as any)("crm_bav_nummers").select("*").range(a, a + 999);
    if (error) throw error;
    uit.push(...((data ?? []) as BavRij[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

/** Contract- of polisstatus volgens de regel: einddatum vandaag of eerder = beeindigd. */
export function vandaagNL() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}
export type EindStatus = { soort: "lopend" | "loopt_af" | "beeindigd"; datum: string | null };
export function contractEindStatus(c: { status: string; eind_datum: string | null }): EindStatus {
  if (c.status === "vervangen") return { soort: "beeindigd", datum: c.eind_datum };
  if (c.eind_datum) return { soort: c.eind_datum <= vandaagNL() ? "beeindigd" : "loopt_af", datum: c.eind_datum };
  if (c.status === "loopt_af") return { soort: "beeindigd", datum: null };
  return { soort: "lopend", datum: null };
}
