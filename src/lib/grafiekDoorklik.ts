/** A23-aanvulling 2: doorklikken op grafiekelementen. Telling (admin_grafiek) en lijst (admin_grafiek_records)
 *  komen uit dezelfde SQL-bronfunctie admin_grafiek_bron, dus lijstlengte = grafiekwaarde. */
import { plusDagen, groepSleutel, type Groep } from "@/lib/inzicht";

export type GrafiekNaam =
  | "leads_dag" | "leads_status" | "leads_status_type" | "leads_verzekering" | "activaties_maand"
  | "aanvragen" | "arr_nieuw" | "arr_aflopend" | "arr_netto";
export type GrafiekPunt = { sleutel: string; waarde: number };
export type GrafiekRecord = {
  sleutel: string; dag: string; id: string; link: string | null; naam: string | null; bedrijfsnaam: string | null;
  email: string | null; product: string | null; status: string | null; binnengekomen: string | null;
  bron: string | null; behandelaar: string | null; bedrag: number | null;
};
export type Doorklik = { grafiek: GrafiekNaam; titel: string; waarde: number; sleutel?: string; van?: string; tot?: string };

const PRODUCTEN: Record<string, string> = {
  bav_avb: "BAV & AVB", cyber_clear: "Cyber", cyber: "Cyber", aov: "AOV",
  lidmaatschap_allin: "Lidmaatschap All-in", lidmaatschap_startup: "Lidmaatschap Start-up",
};
/** Nette productnaam; ruwe codes zoals "bav_avb" worden leesbaar, bestaande namen blijven gelijk. */
export function productNaam(v: string | null | undefined): string {
  if (!v) return "Onbekend";
  return PRODUCTEN[v] ?? v;
}

/** Eerste en laatste dag van een gegroepeerd element (dag/week/maand), begrensd op de periodestart. */
export function bucketBereik(dag: string, g: Groep, start?: string): { van: string; tot: string } {
  const begin = groepSleutel(dag, g);
  let tot = begin;
  if (g === "week") tot = plusDagen(begin, 6);
  if (g === "maand") { const [y, m] = begin.split("-").map(Number); tot = plusDagen(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1); }
  return { van: start && start > begin ? start : begin, tot };
}

/** Records die bij een element horen; spiegel van de WHERE in admin_grafiek_records. */
export function filterRecords(rs: GrafiekRecord[], d: Pick<Doorklik, "sleutel" | "van" | "tot">): GrafiekRecord[] {
  return rs.filter((r) => (d.sleutel == null || r.sleutel === d.sleutel) && (d.van == null || r.dag >= d.van) && (d.tot == null || r.dag <= d.tot));
}

/** Telling per element; spiegel van admin_grafiek (aantal, of som van bedrag voor ARR). */
export function telRecords(rs: GrafiekRecord[], grafiek: GrafiekNaam): GrafiekPunt[] {
  const m = new Map<string, number>();
  for (const r of rs) m.set(r.sleutel, (m.get(r.sleutel) ?? 0) + (grafiek.startsWith("arr_") ? Number(r.bedrag ?? 0) : 1));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sleutel, waarde]) => ({ sleutel, waarde: Math.round(waarde * 100) / 100 }));
}
