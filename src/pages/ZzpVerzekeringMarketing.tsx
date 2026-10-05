import { Clock, Megaphone, ShieldCheck } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Heb ik als freelance marketeer een BAV nodig?", answer: "Het is niet verplicht. Wel vragen steeds meer opdrachtgevers erom. En één fout in een campagne kan duur zijn." },
  { question: "Ben ik verzekerd als ik per ongeluk rechten van een ander schend?", answer: "Dat hangt af van de situatie. Lees de polisvoorwaarden op de pagina documenten, die zijn leidend. Twijfel je? Neem contact op." },
  { question: "Kan ik als designer of copywriter deze polis afsluiten?", answer: "Ja. Ook als designer, copywriter of social media specialist kun je deze polis afsluiten." },
  { question: "Wat kost een BAV voor marketing?", answer: `Vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar voor BAV en AVB samen. Zonder eigen risico.` },
  { question: "Hoe snel kan ik een certificaat sturen naar mijn opdrachtgever?", answer: "Je sluit online af. Binnen 24 uur is het geregeld en staat je certificaat in je mailbox." },
];

export default function ZzpVerzekeringMarketing() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-marketing"
      serviceName="Beroepsaansprakelijkheidsverzekering marketing"
      badge="Voor marketing en communicatie"
      title={<>ZZP verzekering voor <span className="text-accent">marketeers</span></>}
      subtitle="Als marketeer, copywriter of designer maak je werk dat de wereld in gaat. Een fout in een campagne of een gemiste lancering kan je opdrachtgever geld kosten. Met een BAV en AVB in één polis ben je beschermd."
      sector="pr-marketing"
      benefits={[
        { icon: Megaphone, title: "Voor marketing, communicatie en design", description: `Voor marketeers, communicatieadviseurs, copywriters, designers en social media specialisten. ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per gebeurtenis.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Je betaalt geen eigen risico. En je polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Snel geregeld", description: "Online afsluiten. Binnen 24 uur geregeld en je certificaat staat in je mailbox." },
      ]}
      explainers={[
        { title: "Campagne met een fout of een gemiste lancering", text: "Een prijs fout in een advertentie, een beeld waar een ander rechten op heeft of een lancering die te laat is. Zulke fouten kunnen leiden tot een claim. Wat precies gedekt is, staat in de polisvoorwaarden.", bullets: ["BAV en AVB in één polis via Hiscox", "Ook voor copywriters en designers", "Certificaat voor je opdrachtgever"] },
        { title: "Persoonlijk advies", text: "Je adviseur denkt mee over je opdrachten en wat je opdrachtgever vraagt. De polisvoorwaarden zijn leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "zzp-verzekering-kosten-2026", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp", "wat-kosten-verzekeringen-voor-zzp-ers"]}
    />
  );
}
