/** Behoud onbekende serveruitleg; vertaal alleen bekende technische weigeringen. */
export function leadStatusFout(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message || "Er is geen foutuitleg ontvangen. Probeer het opnieuw.";
  if (message.includes("Klantkoppeling alleen wijzigen")) return "De klantkoppeling is beschermd. Sluit alleen de vraag af; wijzig de gekoppelde klant of contactpersoon via Koppel aan klant.";
  if (message.includes("opzeggen of activatie terugdraaien")) return "Opzeggen kan niet via deze statuslijst. Gebruik de opzegknop bij de klant. Een activatie terugdraaien mag alleen een supervisor of admin.";
  if (/row-level security|permission denied/i.test(message)) return "Je hebt geen toestemming om deze lead te wijzigen. Controleer je teamtoegang en tweestapscode.";
  if (message.includes("lead niet gevonden of heeft deze uitkomst al")) return "Deze lead is niet beschikbaar of heeft deze uitkomst al. Vernieuw de pagina.";
  return message;
}