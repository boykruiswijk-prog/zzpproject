// Verwacht creditbedrag voor een opzegging. Gebruikt dezelfde rekenregels als de factuurplanner
// (credit_dryrun / planner): berekenOudSysteemCredit voor oud systeem, berekenOpzegCredit voor platformfacturen.
import { berekenOpzegCredit, berekenOudSysteemCredit, type GefactureerdePeriode } from "../../supabase/functions/_shared/creditOpzegging";

export type CreditContract = {
  cyclus: string; aantal: number; bedrag_per_periode: number;
  begin_datum: string | null; factureren_vanaf: string | null; gefactureerd_tm: string | null;
};

export function verwachtCredit(k: CreditContract, einddatum: string, plannerPerioden: GefactureerdePeriode[] = []) {
  if (plannerPerioden.length) {
    const r = berekenOpzegCredit(einddatum, plannerPerioden);
    const tm = plannerPerioden.map((p) => p.periode_eind).sort().at(-1) ?? null;
    return { bedrag: r.bedrag, vanaf: r.vanaf, tm, bron: "planner" as const };
  }
  if (k.gefactureerd_tm && k.gefactureerd_tm > einddatum) {
    const r = berekenOudSysteemCredit({ ...k, gefactureerd_tm: k.gefactureerd_tm }, einddatum);
    return { bedrag: r.bedrag, vanaf: r.vanaf, tm: k.gefactureerd_tm, bron: "oud_systeem" as const };
  }
  return null;
}

export const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
