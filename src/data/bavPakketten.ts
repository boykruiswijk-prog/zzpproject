// Single source of truth voor BAV-pakketten. Alle plekken op de site
// die tarieven of dekkingen tonen importeren uit dit bestand.
import { CYBER, CYBER_DEKKING, CYBER_HULP, CYBER_LOOPTIJD, CYBER_POLISVOORWAARDEN } from "../../supabase/functions/_shared/cyber";

export const bavPakketten = [
  {
    id: "maandelijks",
    name: "BAV & AVB Maandelijks",
    label: null,
    prijs: 55,
    periode: "maand" as const,
    prijsLabel: "€ 55 per maand",
    dekkingen: {
      bav: { perGebeurtenis: 5_000_000, perJaar: 15_000_000 },
      avb: { perGebeurtenis: 2_500_000, perJaar: 5_000_000 },
      cyber: null,
    },
    usps: [
      "Geen jaarcontract en dagelijks opzegbaar. Zeg je op, dan krijg je een creditnota voor de dagen die je al betaald hebt.",
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
  {
    id: "jaarlijks",
    name: "BAV & AVB Jaarlijks",
    label: "Maandelijks opzegbaar",
    prijs: 600,
    periode: "jaar" as const,
    prijsLabel: "€ 600 per jaar",
    dekkingen: {
      bav: { perGebeurtenis: 5_000_000, perJaar: 15_000_000 },
      avb: { perGebeurtenis: 2_500_000, perJaar: 5_000_000 },
      cyber: null,
    },
    usps: [
      "Voordeligste optie",
      "Geen jaarcontract en dagelijks opzegbaar. Zeg je op, dan krijg je een creditnota voor de dagen die je al betaald hebt.",
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
  {
    id: "jaarlijks-cyber",
    name: "BAV & AVB Jaarlijks + Cyber",
    label: "Optimale dekking",
    prijs: 850,
    periode: "jaar" as const,
    prijsLabel: "€ 850 per jaar",
    dekkingen: {
      bav: { perGebeurtenis: 5_000_000, perJaar: 15_000_000 },
      avb: { perGebeurtenis: 2_500_000, perJaar: 5_000_000 },
      cyber: { perSchade: CYBER.perSchade },
    },
    usps: [
      "BAV + AVB: geen eigen risico, dagelijks opzegbaar en pauzeerbaar. Creditnota voor resterende al betaalde dagen.",
      CYBER_DEKKING, CYBER_HULP, CYBER_LOOPTIJD, CYBER_POLISVOORWAARDEN,
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
  {
    id: "maandelijks-cyber", name: "BAV & AVB Maandelijks + Cyber", label: null,
    prijs: 82.5, periode: "maand" as const, prijsLabel: "€ 82,50 per maand",
    dekkingen: {
      bav: { perGebeurtenis: 5_000_000, perJaar: 15_000_000 },
      avb: { perGebeurtenis: 2_500_000, perJaar: 5_000_000 },
      cyber: { perSchade: CYBER.perSchade },
    },
    usps: ["BAV + AVB: geen eigen risico, dagelijks opzegbaar en pauzeerbaar. Creditnota voor resterende al betaalde dagen.", CYBER_DEKKING, CYBER_HULP, CYBER_LOOPTIJD, CYBER_POLISVOORWAARDEN, "Premie inclusief kosten en assurantiebelasting"],
  },
] as const;

export type BavPakketId = (typeof bavPakketten)[number]["id"];

export const VANAF_PRIJS_LABEL = "Vanaf €55 per maand";

export function getPakket(id: BavPakketId) {
  const pakket = bavPakketten.find((p) => p.id === id);
  if (!pakket) throw new Error("Onbekend BAV-pakket");
  return pakket;
}

/** "€5M" / "€2,5M" notatie voor dekkingsbedragen. */
export const formatMiljoenKort = (n: number) => `€${(n / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}M`;

/** Compacte prijsregel, bv. "Vanaf €55/mnd · BAV €5M · AVB €2,5M" (uit het maandpakket). */
export function vanafPrijsregel(): string {
  const p = getPakket("maandelijks");
  return `Vanaf €${p.prijs}/mnd · BAV ${formatMiljoenKort(p.dekkingen.bav.perGebeurtenis)} · AVB ${formatMiljoenKort(p.dekkingen.avb.perGebeurtenis)}`;
}
