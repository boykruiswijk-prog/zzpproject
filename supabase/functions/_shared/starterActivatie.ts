// Startertarief bij activatie: alleen na handmatige goedkeuring (beoordeel_startertarief).
// Pure functies, geen Exact- of databaseverkeer.
// deno-lint-ignore-file no-explicit-any
import { nieuweCyber, basisPakket } from "./cyber.ts";
import { STARTER, starterTot } from "./starterTarief.ts";

const STARTER_PAKKETTEN = new Set(["maandelijks", "jaarlijks"]);

/** Starter-activatie toegestaan? null = geen starter; "wacht" = eerst controleren. */
export function starterStatus(lead: any): null | "wacht" | "starter" {
  if (lead?.tarief_type !== "starter" && lead?.starter_controle_status !== "te_controleren") return null;
  if (lead.starter_controle_status === "te_controleren") return "wacht";
   if (lead.tarief_type === "starter" && lead.starter_controle_status === "goedgekeurd" && STARTER_PAKKETTEN.has(nieuweCyber(lead) ? basisPakket(String(lead.gekozen_pakket)) : String(lead.gekozen_pakket)) && lead.ingangsdatum) return "starter";
  return null;
}

/** Contractvelden voor de factuurplanner. */
export function starterContractVelden(lead: any): { tarief_type: "standaard" | "starter"; starter_tot: string | null; bedrag_na_starter: number | null } {
  if (starterStatus(lead) !== "starter") return { tarief_type: "standaard", starter_tot: null, bedrag_na_starter: null };
  const maand = basisPakket(String(lead.gekozen_pakket)) === "maandelijks";
  return { tarief_type: "starter", starter_tot: starterTot(String(lead.ingangsdatum).slice(0, 10)), bedrag_na_starter: maand ? STARTER.naMaandprijs : STARTER.naJaarprijs };
}

/** Maandprijs voor deze lead (starter 45, anders de gewone prijs). */
export function maandprijsVoorLead(lead: any, gewoon: number): number {
  return starterStatus(lead) === "starter" && basisPakket(String(lead.gekozen_pakket)) === "maandelijks" ? STARTER.maandprijs : gewoon;
}

/** Eerste factuur: zelfde artikel, alleen de prijs op de regel wijkt af. */
export function pakketSpecVoorLead<T extends { naam: string; bedrag: number; betalingsregel: string }>(lead: any, spec: T | null): T | null {
  if (spec && nieuweCyber(lead)) spec = { ...spec, bedrag: basisPakket(String(lead.gekozen_pakket)) === "maandelijks" ? 660 : 600 };
  if (!spec || starterStatus(lead) !== "starter") return spec;
  if (basisPakket(String(lead.gekozen_pakket)) === "maandelijks") {
    return { ...spec, bedrag: STARTER.maandprijs * 12, betalingsregel: `Betaling: maandelijks € ${STARTER.maandprijs} (startertarief eerste 12 maanden, daarna € ${STARTER.naMaandprijs}) via SEPA-incasso` };
  }
  return { ...spec, bedrag: STARTER.jaarprijs, betalingsregel: `Betaling: jaarlijks vooraf via SEPA-incasso (startertarief eerste jaar, daarna € ${STARTER.naJaarprijs})` };
}
