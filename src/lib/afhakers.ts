// Regels afgehaakte aanvragen (besluit Boy 4-11). SQL menu_tellers/afhakers_automatisch_afronden hanteren dezelfde grenzen.
export const WACHTTIJD_DAGEN = 7;

type C = {
  status: string; is_test?: boolean; lead_id?: string | null;
  herinnering_verstuurd_op?: string | null; gezien_op?: string | null; contact_vastgelegd_op?: string | null;
};

/** Telt mee in de teller: open, geen herinneringsmail, nog niet gezien en geen contact vastgelegd. */
export function vraagtHandeling(c: C): boolean {
  return c.status === "open" && !c.is_test && !c.lead_id && !c.herinnering_verstuurd_op && !c.gezien_op && !c.contact_vastgelegd_op;
}

/** Datum waarop een afhaker met herinnering automatisch wordt afgerond (null zonder herinnering). */
export function afrondMoment(herinneringOp: string | null | undefined): Date | null {
  if (!herinneringOp) return null;
  return new Date(new Date(herinneringOp).getTime() + WACHTTIJD_DAGEN * 86_400_000);
}

/** Wordt automatisch afgerond na herinnering: open, wachttijd voorbij, geen contact, geen aanvraag. */
export function wordtAutomatischAfgerond(c: C, nu: Date = new Date()): boolean {
  const m = afrondMoment(c.herinnering_verstuurd_op);
  return c.status === "open" && !c.lead_id && !c.contact_vastgelegd_op && !!m && m.getTime() <= nu.getTime();
}

export function mailStatusLabel(status: string): string {
  if (status === "sent") return "verstuurd, aangenomen door de mailserver";
  if (status === "skipped") return "niet verstuurd (testomgeving of afgemeld)";
  if (status === "failed") return "mislukt";
  return status;
}

export const CONTACT_SOORTEN = [
  { waarde: "gebeld", label: "Gebeld" },
  { waarde: "gemaild", label: "Gemaild" },
  { waarde: "notitie", label: "Notitie" },
] as const;
