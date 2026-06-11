// Single source of truth voor BAV-pakketten. Alle plekken op de site
// die tarieven of dekkingen tonen importeren uit dit bestand.

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
      "Dagelijks opzegbaar",
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
  {
    id: "jaarlijks",
    name: "BAV & AVB Jaarlijks",
    label: "Goedkoopste premie",
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
      "Dagelijks opzegbaar",
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
  {
    id: "jaarlijks-cyber",
    name: "BAV & AVB Jaarlijks + Cyber",
    label: "Optimale dekking",
    prijs: 750,
    periode: "jaar" as const,
    prijsLabel: "€ 750 per jaar",
    dekkingen: {
      bav: { perGebeurtenis: 5_000_000, perJaar: 15_000_000 },
      avb: { perGebeurtenis: 2_500_000, perJaar: 5_000_000 },
      cyber: { perSchade: 50_000, perJaar: 5_000_000 },
    },
    usps: [
      "Inclusief cyberdekking",
      "Dagelijks opzegbaar",
      "Premie inclusief kosten en assurantiebelasting",
    ],
  },
] as const;

export type BavPakketId = (typeof bavPakketten)[number]["id"];

export const VANAF_PRIJS_LABEL = "Vanaf €55 per maand";

export function getPakket(id: BavPakketId) {
  return bavPakketten.find((p) => p.id === id)!;
}
