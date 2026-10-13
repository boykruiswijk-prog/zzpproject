// deno-lint-ignore-file no-explicit-any
// Besluit D4 (Boy 13 okt 2026): de ingangsdatum is nooit de dag van aanvraag of eerder.
// Vroegst is de dag na de aanvraag, gerekend in Europe/Amsterdam. Puur, zonder afhankelijkheden.

/** Kalenderdag (YYYY-MM-DD) van een moment in Europe/Amsterdam. */
export function nlDag(moment: Date | string = new Date()): string {
  const d = typeof moment === "string" ? new Date(moment) : moment;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Dag + n kalenderdagen (UTC-rekenen op een datum zonder tijd, dus geen zomertijdeffect). */
export function plusDagen(dag: string, n: number): string {
  const d = new Date(`${dag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Vroegst toegestane ingangsdatum: de NL-dag na het aanvraagmoment. */
export function vroegsteIngangsdatum(aanvraagMoment: Date | string = new Date()): string {
  return plusDagen(nlDag(aanvraagMoment), 1);
}

/** dd-mm-jjjj voor een YYYY-MM-DD datum. */
export function dagNL(dag: string): string {
  const [y, m, d] = dag.split("-");
  return `${d}-${m}-${y}`;
}

/** Foutmelding voor een klantformulier, of null als de datum mag. */
export function ingangsdatumFout(datum: string | null | undefined, aanvraagMoment: Date | string = new Date()): string | null {
  if (!datum) return null;
  const vroegst = vroegsteIngangsdatum(aanvraagMoment);
  return datum < vroegst ? `De ingangsdatum is vroegst morgen (${dagNL(vroegst)}).` : null;
}

/** Corrigeert een te vroege datum naar de vroegst toegestane; geeft null als er niets te corrigeren is. */
export function corrigeerIngangsdatum(datum: string | null | undefined, aanvraagMoment: Date | string = new Date()): { oud: string; nieuw: string } | null {
  if (!datum) return null;
  const vroegst = vroegsteIngangsdatum(aanvraagMoment);
  return datum < vroegst ? { oud: datum, nieuw: vroegst } : null;
}

/** Heeft het team de ingangsdatum intern gezet of bevestigd? (activatie_log-regel 'ingangsdatum_gewijzigd'). */
export function ingangsdatumInternGezet(activatieLog: unknown, extraLog = false): boolean {
  if (extraLog) return true;
  return Array.isArray(activatieLog) && activatieLog.some((r: any) => r?.actie === "ingangsdatum_gewijzigd" || r?.type === "ingangsdatum_gewijzigd");
}

/** Blokkeert activatie alleen als een te vroege datum nog de klantkeuze is. Intern gezet = vrij. */
export function ingangsdatumBlokkeertActivatie(lead: { ingangsdatum?: string | null; created_at?: string | null; activatie_log?: unknown }, internGezet = false): boolean {
  if (!lead.ingangsdatum || !lead.created_at) return false;
  if (ingangsdatumInternGezet(lead.activatie_log, internGezet)) return false;
  return String(lead.ingangsdatum).slice(0, 10) < vroegsteIngangsdatum(lead.created_at);
}

export const MELDING_INGANG_KLANT_TE_VROEG = "Pas eerst de ingangsdatum aan of bevestig hem via Ingangsdatum aanpassen.";
