import { getPakket } from "@/data/bavPakketten";

/**
 * Enige bron van tekst voor het blok "Waar let je op bij een BAV?" (besluit Boy 5-11-2026,
 * register F-aanvulling Waarde zichtbaar). Geen namen van andere aanbieders, geen negatieve uitspraken.
 * Bedragen en prijzen komen uit bavPakketten.
 */
const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const maand = getPakket("maandelijks");
const jaar = getPakket("jaarlijks");

export const WAAR_LET_JE_OP_TITEL = "Waar let je op bij een BAV?";
export const WAAR_LET_JE_OP_INTRO = "Vergelijk niet alleen de prijs. Deze vier punten maken het verschil.";
export const WAAR_LET_JE_OP_PRIJS = `${eur(maand.prijs)} per maand of ${eur(jaar.prijs)} per jaar, inclusief kosten en assurantiebelasting`;
export const WAAR_LET_JE_OP_VOORWAARDEN = "Wat precies gedekt is, staat in de polisvoorwaarden.";

export interface WaarLetJeOpPunt {
  titel: string;
  /** Wat je in het algemeen ziet, zonder aanbiedernamen. */
  vaak: string;
  /** Korte versie voor de vergelijkingstabel. */
  vaakKort: string;
  bijZpZaken: string;
}

export const WAAR_LET_JE_OP_PUNTEN: WaarLetJeOpPunt[] = [
  {
    titel: "Verzekerd bedrag per aanspraak",
    vaak: `Goedkopere pakketten hebben voor de BAV vaak € 250.000 of € 500.000 per aanspraak.`,
    vaakKort: "BAV vaak € 250.000 of € 500.000 per aanspraak",
    bijZpZaken: `BAV ${eur(maand.dekkingen.bav.perGebeurtenis)} en AVB ${eur(maand.dekkingen.avb.perGebeurtenis)} per aanspraak.`,
  },
  {
    titel: "Eigen risico",
    vaak: "Soms geldt een eigen risico per schade, dat je zelf betaalt.",
    vaakKort: "Soms een eigen risico per schade",
    bijZpZaken: "Geen eigen risico op de BAV + AVB.",
  },
  {
    titel: "Prijs inclusief of exclusief",
    vaak: "Let op of assurantiebelasting (21%) en poliskosten al in de prijs zitten.",
    vaakKort: "Prijs soms zonder assurantiebelasting (21%) of poliskosten",
    bijZpZaken: `${WAAR_LET_JE_OP_PRIJS}.`,
  },
  {
    titel: "Opzegbaar en snel geregeld",
    vaak: "Soms zit je een jaar vast of duurt het even voordat je polis rond is.",
    vaakKort: "Soms een jaarcontract",
    bijZpZaken: "Geen jaarcontract, dagelijks opzegbaar en binnen 24 uur geregeld met het certificaat per mail.",
  },
];

/** Eén FAQ-vraag met de vier punten, voor /bav-zzp-vergelijken (zichtbaar en in FAQ-gegevens). */
export function waarLetJeOpFaq(): { question: string; answer: string } {
  return {
    question: "Waar let ik op bij het vergelijken van een BAV?",
    answer:
      WAAR_LET_JE_OP_PUNTEN.map((p, i) => `${i + 1}. ${p.titel}: ${p.vaak} Bij ZP Zaken: ${p.bijZpZaken}`).join(" ") +
      ` ${WAAR_LET_JE_OP_VOORWAARDEN}`,
  };
}
