// Betalingsconditie voor creditnota's. Een creditnota kan niet worden geïncasseerd: wij betalen terug of verrekenen.
// Gekozen bestaande Exact-conditie (GET cashflow/PaymentConditions, 3-11-2026): "07" = "Betaling binnen 7 dagen",
// PaymentMethod B (op rekening). Deze conditie gebruikte het team ook al handmatig bij creditnota's (26700097, 26700140).
// Gewone facturen houden hun eigen conditie; dit bestand geldt alleen voor Type 8021.
export const CREDIT_BETAALCONDITIE = "07";
export const INCASSO_CONDITIE = "IN";

export function creditBetaalconditie(): string {
  if (CREDIT_BETAALCONDITIE.toUpperCase() === INCASSO_CONDITIE) throw new Error("creditnota mag nooit incasso zijn");
  return CREDIT_BETAALCONDITIE;
}
