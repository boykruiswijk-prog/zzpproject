// Besluit Boy 12-11-2026: kantooranimatie, afdelingsstanden en workers tonen alleen echte bedrijfsgebeurtenissen.
// Spiegel van SQL public.scherm_echte_gebeurtenis (migratie 0269); schermEcht.test bewaakt beide.
export function isEchteGebeurtenis(actie: unknown, tekst: unknown, status: unknown): boolean {
  if (status === "fout") return false;
  const t = typeof tekst === "string" ? tekst : "";
  switch (actie) {
    case "lead_verzekering_aanvraag": case "certificaat": case "serviceverzoek": return true;
    case "planner_run": return /^Factuurplanner draaide: [1-9][0-9]* concepten/.test(t);
    case "contract_status": return /(opgezegd|beëindigd|beeindigd|geroyeerd)/i.test(t);
    default: return false;
  }
}
