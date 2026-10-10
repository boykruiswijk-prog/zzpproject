import { formatDateNL } from "@/lib/dateFormat";

export type CreditInfo = { klant_contract_id: string; status: string; melding: string | null; bedrag: number | null; credit_vanaf: string | null; credit_tm: string | null; bron: string };

export const CREDIT_STATUS_LABEL: Record<string, string> = {
  te_maken: "Te maken",
  geblokkeerd: "Geblokkeerd",
  concept_aangemaakt: "Concept in Exact",
  verwerkt: "Verwerkt in Exact",
  geen_planner_factuur: "Handmatig beoordelen",
  niet_nodig: "Niet nodig",
  wacht_op_akkoord: "Wacht op akkoord Ellen",
  niet_crediteren: "Niet crediteren",
};

/** Eén regel creditstatus voor in het detaildeel, bijv. "Concept in Exact · € 542,96 · periode 3 okt 2026 t/m 4 okt 2027". */
export function creditStatusTekst(c: CreditInfo): string {
  let t = CREDIT_STATUS_LABEL[c.status] ?? c.status;
  if (c.status === "geblokkeerd" && c.melding) t += ` — ${c.melding}`;
  if (c.bedrag != null) t += ` · € ${Number(c.bedrag).toFixed(2).replace(".", ",")}`;
  if (c.credit_vanaf && c.credit_tm) t += ` · periode ${formatDateNL(c.credit_vanaf)} t/m ${formatDateNL(c.credit_tm)}`;
  return t;
}
