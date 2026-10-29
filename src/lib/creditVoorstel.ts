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

// Besluit Boy 29-10 (C-aanvulling): standaard laatste dag van de dekking bij opzeggen.
// = dag vóór de eerstvolgende verlengdatum (volgende_factuurdatum - 1). Ligt die verlengdatum al
// in het verleden, dan de dag vóór de laatst gestarte periode (verankerd op factureren_vanaf ?? begin_datum).
export type DekkingContract = {
  cyclus: string | null; volgende_factuurdatum: string | null;
  begin_datum: string | null; factureren_vanaf: string | null;
};

function verschuifDagen(iso: string, n: number): string {
  return new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}
function plusMaanden(iso: string, n: number): string {
  const [j, m, d] = iso.slice(0, 10).split("-").map(Number);
  const doel = new Date(Date.UTC(j, m - 1 + n, 1));
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
  doel.setUTCDate(Math.min(d, laatste));
  return doel.toISOString().slice(0, 10);
}

export function standaardLaatsteDekkingsdag(k: DekkingContract, vandaag: string): string {
  const vfd = k.volgende_factuurdatum?.slice(0, 10);
  if (vfd && vfd > vandaag) return verschuifDagen(vfd, -1);
  const anker = (k.factureren_vanaf ?? k.begin_datum)?.slice(0, 10);
  if (anker && anker <= vandaag) {
    const stap = k.cyclus === "jaar" ? 12 : 1;
    let start = anker;
    for (let n = 1; n < 1000; n++) { const s = plusMaanden(anker, n * stap); if (s > vandaag) break; start = s; }
    return verschuifDagen(start, -1);
  }
  return vfd ? verschuifDagen(vfd, -1) : vandaag;
}
