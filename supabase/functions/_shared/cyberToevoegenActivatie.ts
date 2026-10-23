import { CYBER, CYBER_VERSIE } from "./cyber.ts";
import { periodeEind, periodeStart } from "./factuurPeriode.ts";
import { COMPANY } from "./company.ts";

export const CYBER_TOEVOEG_BRON = "site_cyber_toevoegen";
export const CYBER_TOEVOEG_ONDERWERP = "Je cyberverzekering is toegevoegd";
export const CYBER_TOEVOEG_MAIL = `Hoi {voornaam},

Je cyberverzekering is toegevoegd aan je BAV + AVB bij ZP Zaken. De dekking gaat in op {ingangsdatum}.

Wat je hebt:
- Cyberdekking tot EUR 50.000 per schade. Eigen risico EUR 500 per schade (bij cyberfraude EUR 1.000).
- Hulp in de eerste 72 uur na een incident tot EUR 15.000, zonder eigen risico.
- Premie: {cyber_premie}, inclusief kosten en assurantiebelasting. Dit wordt {cyber_incasso} geïncasseerd, net als je BAV + AVB.
- Looptijd 12 maanden, daarna stilzwijgend verlengd met 12 maanden.

Cyber is dagelijks opzegbaar. Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar.

De voorwaarden van de cyberverzekering kun je opvragen via ${COMPANY.phoneDisplay} of ${COMPANY.website}/contact. In Mijn ZP zie je je polis en je documenten.

Heb je een cyberincident? Bel direct ${COMPANY.phoneDisplay}.

Met vriendelijke groet,
Team ZP Zaken`;

export function cyberToevoegSpec(ingang: string, cyclus: "maand" | "jaar", n = 0) {
  const start = periodeStart(ingang, cyclus, n);
  return {
    product: "cyber_clear", cyclus, itemcode: cyclus === "jaar" ? "102J" : "102M",
    aantal: 1, bedrag_per_periode: cyclus === "jaar" ? CYBER.jaarprijs : CYBER.maandprijs,
    periode_start: start, periode_eind: periodeEind(start, cyclus),
    cyber_ingangsdatum: ingang, cyber_einddatum: periodeEind(ingang, "jaar"),
    cyber_voorwaarden_versie: CYBER_VERSIE,
  };
}

export function cyberToevoegMailData(voornaam: string | null, ingang: string, cyclus: "maand" | "jaar") {
  const [y, m, d] = ingang.slice(0, 10).split("-");
  return {
    voornaam: voornaam?.trim() || "klant", ingangsdatum: `${d}-${m}-${y}`,
    cyber_premie: cyclus === "jaar" ? "EUR 250 per jaar" : "EUR 27,50 per maand",
    cyber_incasso: cyclus === "jaar" ? "jaarlijks vooraf" : "maandelijks",
  };
}