// Vergelijking BAV-aanbieders voor zzp'ers (/bav-zzp-vergelijken).
// Per kwartaal bijwerken: per aanbieder de gegevens van de productpagina, de bron-URL en de controledatum.
// De ZP Zaken-rij komt uitsluitend uit bavPakketten.ts (nooit hier hardcoden).
// Alleen relatieve imports: ook gebruikt door seoRoutes/prerender/llms-generator.

import { bavPakketten, getPakket } from "./bavPakketten";

export interface BavAanbieder {
  aanbieder: string;
  watJeKrijgt: string;
  vanafPrijs: string;
  verzekerdBedrag: string;
  eigenRisico: string;
  opzeggen: string;
  bronUrl: string;
  /** ISO-datum waarop de gegevens op de bronpagina zijn gecontroleerd. */
  gecontroleerd_op: string;
  /** Eigen rij van ZP Zaken (andere opmaak, interne bronlink). */
  eigen?: boolean;
}

/** Datum van de laatste controle van de hele vergelijking. */
export const VERGELIJKING_GECONTROLEERD_OP = "2026-10-05";
export const VERGELIJKING_GECONTROLEERD_LABEL = "5 oktober 2026";

const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

function zpZakenRij(): BavAanbieder {
  const maand = getPakket("maandelijks");
  const jaar = getPakket("jaarlijks");
  const d = maand.dekkingen;
  const inclKosten = bavPakketten.every((p) => (p.usps as readonly string[]).includes("Premie inclusief kosten en assurantiebelasting"));
  return {
    aanbieder: "ZP Zaken (via Hiscox)",
    watJeKrijgt: "BAV + AVB in één polis",
    vanafPrijs: `${eur(maand.prijs)} per maand of ${eur(jaar.prijs)} per jaar${inclKosten ? ", premie incl. kosten en assurantiebelasting" : ""}`,
    verzekerdBedrag: `BAV ${eur(d.bav.perGebeurtenis)} en AVB ${eur(d.avb.perGebeurtenis)} per aanspraak`,
    eigenRisico: "Geen",
    opzeggen: "Dagelijks",
    bronUrl: "/verzekeringen",
    gecontroleerd_op: VERGELIJKING_GECONTROLEERD_OP,
    eigen: true,
  };
}

const C = VERGELIJKING_GECONTROLEERD_OP;

export const bavVergelijking: BavAanbieder[] = [
  zpZakenRij(),
  {
    aanbieder: "Insify",
    watJeKrijgt: "Alleen BAV. AVB is een losse verzekering (vanaf € 7,95 per maand)",
    vanafPrijs: "Vanaf € 35,30 per maand",
    verzekerdBedrag: "Zelf kiezen, tot € 2 miljoen per jaar",
    eigenRisico: "Zelf kiezen, € 250 tot € 2.500",
    opzeggen: "Dagelijks",
    bronUrl: "https://www.insify.nl/beroepsaansprakelijkheidsverzekering-bav/zzp/",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "Knab (verzekeraar Alicia)",
    watJeKrijgt: "Alleen BAV. AVB is een losse verzekering (vanaf € 9,08 per maand)",
    vanafPrijs: "Vanaf € 27,22 per maand, 5% korting met Knab-rekening",
    verzekerdBedrag: "€ 250.000 of € 500.000 per claim",
    eigenRisico: "Niet vermeld",
    opzeggen: "Dagelijks",
    bronUrl: "https://www.knab.nl/zakelijk/verzekeren/zzp/beroepsaansprakelijkheidsverzekering",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "Centraal Beheer",
    watJeKrijgt: "BAV, alleen samen met hun AVB",
    vanafPrijs: "Vanaf € 38,56 per maand (zzp-pagina). Algemene BAV-pagina noemt vanaf € 25,20",
    verzekerdBedrag: "€ 250.000 standaard, € 2.500.000 voor onder meer architecten",
    eigenRisico: "€ 250 per claim",
    opzeggen: "Niet vermeld",
    bronUrl: "https://www.centraalbeheer.nl/zakelijk/bedrijfsverzekeringen/bedrijfsaansprakelijkheidsverzekering/beroepsaansprakelijkheidsverzekering/zzp",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "De Goudse",
    watJeKrijgt: "Alleen BAV, via een adviseur. AVB apart",
    vanafPrijs: "Voorbeeld: € 29,17 per maand (jurist, € 125.000 omzet, € 250.000 dekking), zonder assurantiebelasting",
    verzekerdBedrag: "€ 250.000, € 500.000 of € 1.000.000 per aanspraak, per jaar maximaal 2 keer",
    eigenRisico: "€ 750 per aanspraak",
    opzeggen: "Niet vermeld",
    bronUrl: "https://www.goudse.nl/ondernemer/mijnbedrijf/aansprakelijkheid/beroepsaansprakelijkheidsverzekering-voor-zzp-ers",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "ZZP Nederland (verzekeraar Hiscox)",
    watJeKrijgt: "Alleen BAV. AVB apart",
    vanafPrijs: "Geen vanaf-prijs. Pagina noemt gemiddeld € 20 tot € 100 per maand, 10% ledenkorting",
    verzekerdBedrag: "Niet vermeld",
    eigenRisico: "Niet vermeld (geen eigen risico op verdedigingskosten)",
    opzeggen: "Niet vermeld",
    bronUrl: "https://www.zzp-nederland.nl/verzekeringen-en-advies/zzp-verzekeringen/aansprakelijkheidsverzekering/beroepsaansprakelijkheid",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "Allianz",
    watJeKrijgt: "BAV. AVB kan als uitbreiding",
    vanafPrijs: "Vanaf ongeveer € 375 per jaar",
    verzekerdBedrag: "Niet vermeld",
    eigenRisico: "Zelf kiezen, bedragen niet vermeld",
    opzeggen: "Niet vermeld",
    bronUrl: "https://www.allianz.nl/zakelijk/verzekeringen/aansprakelijkheid/beroepsaansprakelijkheidsverzekering.html",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "Nationale-Nederlanden",
    watJeKrijgt: "BAV, alleen samen met een AVB. Voor juridische en administratieve beroepen",
    vanafPrijs: "Niet vermeld (online berekenen)",
    verzekerdBedrag: "Maximaal € 1.000.000 per aanspraak en € 2.000.000 per jaar",
    eigenRisico: "€ 125, € 250, € 500 of € 1.000",
    opzeggen: "Op elk moment",
    bronUrl: "https://www.nn.nl/Zakelijk/Schadeverzekeringen/zzp/beroepsaansprakelijkheidsverzekering.htm",
    gecontroleerd_op: C,
  },
  {
    aanbieder: "Interpolis (via Rabobank)",
    watJeKrijgt: "BAV, alleen met een zakelijke rekening bij Rabobank. AVB apart",
    vanafPrijs: "Niet vermeld (online berekenen)",
    verzekerdBedrag: "Niet vermeld",
    eigenRisico: "Niet vermeld",
    opzeggen: "Niet vermeld",
    bronUrl: "https://www.rabobank.nl/bedrijven/verzekeren/zzp/beroepsaansprakelijkheidsverzekering-zzp",
    gecontroleerd_op: C,
  },
];

export const YEZZER_URL = "https://www.yezzer.nl/verzekeringen/beroepsaansprakelijkheidsverzekering/zzp/vergelijken";

/** Zichtbare FAQ; dezelfde lijst voedt het FAQPage-schema. Bedragen van ZP Zaken uit bavPakketten. */
export function bavVergelijkingFaq(): { question: string; answer: string }[] {
  const maand = getPakket("maandelijks");
  return [
    { question: "Wat is het verschil tussen een BAV en een AVB?", answer: "Een BAV dekt financiële schade bij je klant door een fout in je werk, zoals een verkeerd advies of een fout in software. Een AVB dekt schade aan personen of spullen, bijvoorbeeld als je bij een klant een laptop laat vallen. Veel zzp'ers hebben allebei nodig." },
    { question: "Is een BAV verplicht voor zzp'ers?", answer: "Niet voor iedereen. Voor sommige beroepen is het wettelijk of door een beroepsorganisatie verplicht. Veel opdrachtgevers en bemiddelaars vragen er ook om in hun contract." },
    { question: "Wat kost een BAV voor een zzp'er?", answer: `De prijzen op de sites van aanbieders beginnen rond € 25 tot € 40 per maand voor alleen een BAV. Je premie hangt af van je beroep, je omzet, het verzekerd bedrag en het eigen risico. Bij ZP Zaken betaal je vanaf ${eur(maand.prijs)} per maand voor BAV en AVB samen.` },
    { question: "Welk verzekerd bedrag heb ik nodig?", answer: "Dat hangt af van je werk en wat je opdrachtgever vraagt. Kijk in je contract welk bedrag er staat. Veel goedkope polissen starten bij € 250.000 per aanspraak. Dat is soms te weinig voor grotere opdrachten." },
    { question: "Kan ik mijn BAV dagelijks opzeggen?", answer: "Bij ZP Zaken, Insify en Knab wel. Bij andere aanbieders staat het niet altijd op de productpagina. Check de voorwaarden voordat je afsluit." },
    { question: "Wat is uitloop en heb ik dat nodig?", answer: "Uitloop dekt claims die binnenkomen nadat je je polis hebt gestopt, voor fouten uit de tijd dat je verzekerd was. Dat is handig als je stopt als zzp'er. Vraag bij elke aanbieder na of en hoe uitloop geregeld is." },
    { question: "Hoe snel ben ik verzekerd bij ZP Zaken?", answer: "Je sluit online af. Het is binnen 24 uur geregeld en je krijgt het certificaat in je mailbox." },
  ];
}
