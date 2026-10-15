// D9 herinneringscyclus (besluit Boy 15-10-2026). Byte-gelijk met src/lib/incassoCyclus.ts.
// Database-tegenhanger: public.incasso_welke_stap / incasso_cyclus_stap.
export type IncassoStap = "herinnering_1" | "herinnering_2_aanmaning" | "herinnering_3_opschorting" | "royement_voorstel";
export const STAP_DAG: Record<IncassoStap, number> = { herinnering_1: 0, herinnering_2_aanmaning: 14, herinnering_3_opschorting: 28, royement_voorstel: 42 };
export const STAP_LABEL: Record<IncassoStap, string> = {
  herinnering_1: "Herinnering 1", herinnering_2_aanmaning: "Aanmaning", herinnering_3_opschorting: "Opschorting", royement_voorstel: "Royementsvoorstel",
};
/** Mailsleutel per stap; royementsvoorstel stuurt nooit een mail. */
export const STAP_MAIL: Record<IncassoStap, string | null> = {
  herinnering_1: "incasso_herinnering_1", herinnering_2_aanmaning: "incasso_herinnering_2_aanmaning",
  herinnering_3_opschorting: "incasso_herinnering_3_opschorting", royement_voorstel: null,
};

/** Dagdrempel van de stap die nu geldt: 0, 14, 28 of 42 (null voor dag < 0). */
export function welkeStap(dagen: number): IncassoStap | null {
  if (dagen >= 42) return "royement_voorstel";
  if (dagen >= 28) return "herinnering_3_opschorting";
  if (dagen >= 14) return "herinnering_2_aanmaning";
  if (dagen >= 0) return "herinnering_1";
  return null;
}

/** Wat de engine vandaag doet voor een geval: niets als betaald/niet open of als de stap al gelogd is. */
export function stapVandaag(geval: { status: string; dagen: number; gedaan: IncassoStap[] }):
  { stap: IncassoStap; opschorten: boolean; royementVoorstel: boolean; royeren: false } | null {
  if (geval.status !== "open") return null;
  const stap = welkeStap(geval.dagen);
  if (!stap || geval.gedaan.includes(stap)) return null;
  return { stap, opschorten: stap === "herinnering_3_opschorting", royementVoorstel: stap === "royement_voorstel", royeren: false };
}

export function volgendeStap(dagen: number): { stap: IncassoStap; dag: number } | null {
  const v = (Object.entries(STAP_DAG) as [IncassoStap, number][]).find(([, d]) => d > dagen);
  return v ? { stap: v[0], dag: v[1] } : null;
}

/** Geen dubbele beltaak: alleen nieuw als er geen open taak is voor dezelfde klant en factuur. */
export function nieuweBeltaakNodig(open: { soort: string; status: string; onderneming_id: string; factuurnummer: string }[], ondernemingId: string, factuurnummer: string): boolean {
  return !open.some((t) => t.soort === "incasso_mislukt_bellen" && t.status === "open" && t.onderneming_id === ondernemingId && t.factuurnummer === factuurnummer.trim());
}
