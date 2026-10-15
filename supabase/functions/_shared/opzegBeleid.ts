// Opzegbeleid creditnota's (besluit Boy 15-10-2026, D1-aanvulling 2).
// Byte-gelijk met src/lib/opzegBeleid.ts.
// Maandpolis en cyber: per dag opzegbaar, nooit een creditnota.
// Jaarpolis (niet cyber): D1 jaarpolis, wacht op Boy: crediteren blijft zoals in D1 tot Boy anders besluit.
export type OpzegCreditBeleid = "geen_credit_maand" | "geen_credit_cyber" | "credit_jaar_wacht_op_boy";

export const OPZEG_GEEN_CREDIT_TEKST = "Per dag opzegbaar. Geen creditnota (maandpolis/cyber, besluit 15-10-2026)";

export function opzegCreditBeleid(c: { cyclus?: string | null; product?: string | null }): OpzegCreditBeleid {
  const product = (c.product ?? "").toLowerCase();
  if (product.startsWith("cyber")) return "geen_credit_cyber";
  if ((c.cyclus ?? "").toLowerCase() === "maand") return "geen_credit_maand";
  return "credit_jaar_wacht_op_boy";
}

export function opzegZonderCredit(c: { cyclus?: string | null; product?: string | null }): boolean {
  return opzegCreditBeleid(c) !== "credit_jaar_wacht_op_boy";
}
